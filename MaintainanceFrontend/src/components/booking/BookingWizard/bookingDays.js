import { formatDate } from '@/helpers/format';

/**
 * The calendar strip's dates, in Kathmandu time.
 *
 * Everything here works in `Asia/Kathmandu` rather than the browser's zone:
 * +05:45 is an offset almost no other zone shares, so a customer booking at
 * 23:30 in Kathmandu and a server thinking in UTC disagree about what "today"
 * is unless the day key is formed here, once.
 *
 * Phase J1: the weekday and month are the visitor's language (`formatDate`, with Latin digits); "Today" is a word, so
 * a day only says whether it is today and the step words it.
 */

export const KTM = 'Asia/Kathmandu';

/** Kathmandu "today" as a YYYY-MM-DD key, so the calendar never offers yesterday. */
export const dayKey = (d) => new Intl.DateTimeFormat('en-CA', { timeZone: KTM }).format(d);

/** A day key's Kathmandu midday — never pushed onto the neighbouring day by the offset. */
const middayOf = (key) => `${key}T12:00:00+05:45`;

/** One part of a day, alone: `{ weekday: 'short' }` → "Tue" / "मङ्गल". */
const partOf = (key, locale, part) => formatDate(middayOf(key), {
  locale, day: undefined, month: undefined, year: undefined, ...part,
});

/**
 * The next N open days, skipping the weekdays the business is closed.
 *
 * @param {{ closedWeekdays?: number[], maxDaysAhead?: number }} [booking] `booking` from `/public/bootstrap`
 * @param {{ locale?: 'en'|'ne' }} [opts]
 * @returns {{ key: string, isToday: boolean, weekday: string, day: string, month: string }[]}
 */
export function buildDays({ closedWeekdays = [6], maxDaysAhead = 30 } = {}, { locale = 'en' } = {}) {
  const out = [];
  const now = new Date();

  for (let i = 0; i < maxDaysAhead && out.length < 14; i += 1) {
    const key = dayKey(new Date(now.getTime() + i * 86400000));

    const weekdayIndex = new Date(middayOf(key)).getUTCDay();
    if (closedWeekdays.includes(weekdayIndex)) continue;

    out.push({
      key,
      isToday: i === 0,
      weekday: partOf(key, locale, { weekday: 'short' }),
      day: partOf(key, locale, { day: '2-digit' }),
      month: partOf(key, locale, { month: 'short' }),
    });
  }

  return out;
}

/** A day key back into something a customer reads: "Tue, 29 Sept 2026" — in Nepali "2026 सेप्टेम्बर 29, मङ्गल". */
export function formatDayKey(key, { locale = 'en' } = {}) {
  if (!key) return '—';
  return formatDate(middayOf(key), { locale, weekday: 'short' });
}

/** The UTC instant a chosen day and slot start at, which is what the API stores. */
export function preferredAtIso(date, startHour = 9) {
  return new Date(`${date}T${String(startHour).padStart(2, '0')}:00:00+05:45`).toISOString();
}

/**
 * A time window's name in the visitor's language. `/public/bootstrap` sends each slot's `label` in English; the key
 * (`morning`, `afternoon`, `evening`) is what the site words, and a slot the site has no words for keeps its label.
 * The window itself (`8:00 – 12:00`) is shown as it comes.
 *
 * @param {ReturnType<typeof import('@/helpers/i18n').createT>} t a translator over `config/i18n/site.js`
 * @param {{ key: string, label?: string }} slot
 */
export const slotName = (t, slot) => (t.has(`booking.slots.${slot.key}`) ? t(`booking.slots.${slot.key}`) : slot.label);
