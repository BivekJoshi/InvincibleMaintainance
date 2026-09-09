import { prisma } from '../lib/prisma.js';
import { env } from '../config/env.js';
import { dayjs, startOfDay, endOfDay, addDays } from '../utils/dates.js';
import { BOOKING_SLOTS } from '../shared/enums.js';
import { getSetting } from './settings.service.js';

/**
 * How much survey capacity is left, per day and per slot.
 *
 * Everything here is computed in Asia/Kathmandu. The offset is +05:45, so
 * bucketing by UTC hour would misplace every slot — always go through
 * dayjs().tz() rather than getUTCHours().
 */

const tz = () => env.business.timezone;
const dayKey = (date) => dayjs(date).tz(tz()).format('YYYY-MM-DD');

/** Which slot an instant falls in, by local hour against the slot's own bounds. */
function slotForDate(date) {
  const hour = dayjs(date).tz(tz()).hour();
  const slot = BOOKING_SLOTS.find((s) => hour >= s.startHour && hour < s.endHour);
  // Anything outside business hours counts against the nearest slot rather than
  // vanishing from the demand side.
  if (slot) return slot.key;
  return hour < BOOKING_SLOTS[0].startHour ? BOOKING_SLOTS[0].key : BOOKING_SLOTS[BOOKING_SLOTS.length - 1].key;
}

/**
 * @param {{ from?: string, days?: number }} opts
 * @returns {Promise<object>} day-by-day capacity, demand and fullness
 */
export async function surveyAvailability({ from, days = 14 } = {}) {
  const [closedWeekdays, maxDaysAhead, slotCapacitySetting, leadTimeHours] = await Promise.all([
    getSetting('booking.closedWeekdays', [6]),
    getSetting('booking.maxDaysAhead', 30),
    getSetting('booking.slotCapacity', null),
    getSetting('booking.leadTimeHours', 4),
  ]);

  const span = Math.min(Math.max(1, Number(days) || 14), Number(maxDaysAhead) || 30);
  const start = startOfDay(from ? new Date(from) : new Date());
  const end = endOfDay(addDays(start, span - 1));

  // Supply. Technician carries no role of its own, so surveyor-ness comes from the user.
  const surveyors = await prisma.technician.findMany({
    where: {
      deletedAt: null,
      isAvailable: true,
      user: { role: 'SURVEYOR', isActive: true, deletedAt: null },
    },
    select: { id: true, dailyCapacity: true },
  });
  const capacityPerDay = surveyors.reduce((total, s) => total + (s.dailyCapacity ?? 0), 0);
  const slotCapacity = slotCapacitySetting != null
    ? Number(slotCapacitySetting)
    : Math.ceil(capacityPerDay / BOOKING_SLOTS.length);

  // Demand, from two sources that must not double-count. A lead that has reached
  // INSPECTION_SCHEDULED already has a Job, so counting it again would halve the
  // apparent capacity — hence the status filter.
  const [visits, pending] = await Promise.all([
    prisma.job.findMany({
      where: {
        deletedAt: null,
        type: 'INSPECTION',
        status: { not: 'CANCELLED' },
        scheduledStart: { gte: start, lte: end },
      },
      select: { scheduledStart: true },
    }),
    prisma.lead.findMany({
      where: {
        deletedAt: null,
        source: 'booking',
        status: { in: ['NEW', 'CONTACTED'] },
        preferredAt: { gte: start, lte: end },
      },
      select: { preferredAt: true, preferredSlot: true },
    }),
  ]);

  /** @type {Map<string, Map<string, number>>} */
  const booked = new Map();
  const bump = (date, slotKey) => {
    const key = dayKey(date);
    if (!booked.has(key)) booked.set(key, new Map());
    const slots = booked.get(key);
    const s = slotKey ?? slotForDate(date);
    slots.set(s, (slots.get(s) ?? 0) + 1);
  };
  visits.forEach((v) => bump(v.scheduledStart));
  pending.forEach((l) => bump(l.preferredAt, l.preferredSlot ?? undefined));

  const closed = Array.isArray(closedWeekdays) ? closedWeekdays : [];
  const earliest = dayjs().tz(tz()).add(Number(leadTimeHours) || 0, 'hour');

  const daysOut = Array.from({ length: span }, (_, i) => {
    const date = dayjs(start).tz(tz()).add(i, 'day');
    const key = date.format('YYYY-MM-DD');
    const weekday = date.day();
    const isClosed = closed.includes(weekday);
    const perSlot = booked.get(key) ?? new Map();

    const slots = BOOKING_SLOTS.map((slot) => {
      const count = perSlot.get(slot.key) ?? 0;
      // A slot whose window has already passed today cannot be booked.
      const tooSoon = date.hour(slot.endHour).isBefore(earliest);
      return {
        key: slot.key,
        label: slot.label,
        window: slot.window,
        booked: count,
        capacity: slotCapacity,
        isFull: isClosed || tooSoon || (slotCapacity > 0 && count >= slotCapacity),
        reason: isClosed ? 'closed' : tooSoon ? 'too_soon' : count >= slotCapacity && slotCapacity > 0 ? 'full' : null,
      };
    });

    const dayBooked = slots.reduce((t, s) => t + s.booked, 0);
    return {
      date: key,
      weekday,
      isClosed,
      booked: dayBooked,
      capacity: capacityPerDay,
      isFull: slots.every((s) => s.isFull),
      slots,
    };
  });

  return {
    timezone: tz(),
    capacityPerDay,
    slotCapacity,
    surveyors: surveyors.length,
    maxDaysAhead: Number(maxDaysAhead) || 30,
    closedWeekdays: closed,
    days: daysOut,
  };
}

/**
 * Whether a requested slot is already full. Used to flag a booking for manual
 * rescheduling — never to reject it. Throwing a lead away to protect a calendar
 * is the wrong trade on a marketing funnel.
 */
export async function isSlotFull(preferredAt, preferredSlot) {
  if (!preferredAt) return false;
  const availability = await surveyAvailability({ from: dayKey(preferredAt), days: 1 });
  const day = availability.days[0];
  if (!day) return false;
  if (day.isClosed) return true;
  const slot = day.slots.find((s) => s.key === (preferredSlot ?? slotForDate(preferredAt)));
  return Boolean(slot?.isFull);
}
