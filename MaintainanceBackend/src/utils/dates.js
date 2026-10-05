import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc.js';
import timezone from 'dayjs/plugin/timezone.js';
import relativeTime from 'dayjs/plugin/relativeTime.js';
import { env } from '../config/env.js';
import { formatBs } from './nepaliDate.js';

dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.extend(relativeTime);
dayjs.tz.setDefault(env.business.timezone);

export { dayjs };

export const addMinutes = (date, m) => new Date(new Date(date).getTime() + m * 60000);
export const addDays = (date, d) => new Date(new Date(date).getTime() + d * 86400000);
export const startOfDay = (date = new Date()) => dayjs(date).tz(env.business.timezone).startOf('day').toDate();
export const endOfDay = (date = new Date()) => dayjs(date).tz(env.business.timezone).endOf('day').toDate();
/** Renders a UTC instant in Kathmandu local time. */
export const local = (date, fmt = 'YYYY-MM-DD HH:mm') =>
  dayjs(date).tz(env.business.timezone).format(fmt);

/**
 * A date as a message to a customer states it, in the customer's language (Phase J1): the Kathmandu day — "14 Sep
 * 2026" in English; in Nepali that day's Bikram Sambat date in Nepali words, "29 भदौ 2083", the calendar a Nepali
 * reader counts in (the documents print both). A day outside the BS table (after BS 2100, about AD 2043) is written
 * as its AD date rather than failing the message. `null` for no date.
 *
 * @param {Date|string|null|undefined} date
 * @param {'en'|'ne'} [locale]
 */
export function customerDate(date, locale = 'en') {
  if (!date) return null;
  if (locale !== 'ne') return local(date, 'D MMM YYYY');
  try {
    return formatBs(new Date(`${local(date, 'YYYY-MM-DD')}T00:00:00.000Z`), { long: true, locale: 'ne' });
  } catch {
    return local(date, 'D MMM YYYY');
  }
}

/** `customerDate` with the Kathmandu time: "14 Sep 2026 12:00" / "29 भदौ 2083, 12:00". */
export function customerDateTime(date, locale = 'en') {
  if (!date) return null;
  return `${customerDate(date, locale)}${locale === 'ne' ? ',' : ''} ${local(date, 'HH:mm')}`;
}

/**
 * A Prisma range for `from` / `to` given as Kathmandu calendar days (`YYYY-MM-DD`), inclusive —
 * "today" is the office's today whatever timezone the server runs in.
 */
export function kathmanduDayRange(from, to) {
  if (!from && !to) return undefined;
  const tz = env.business.timezone;
  return {
    ...(from ? { gte: dayjs.tz(from, tz).startOf('day').toDate() } : {}),
    ...(to ? { lte: dayjs.tz(to, tz).endOf('day').toDate() } : {}),
  };
}
