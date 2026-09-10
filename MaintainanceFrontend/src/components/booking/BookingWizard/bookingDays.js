/**
 * The calendar strip's dates, in Kathmandu time.
 *
 * Everything here works in `Asia/Kathmandu` rather than the browser's zone:
 * +05:45 is an offset almost no other zone shares, so a customer booking at
 * 23:30 in Kathmandu and a server thinking in UTC disagree about what "today"
 * is unless the day key is formed here, once.
 */

export const KTM = 'Asia/Kathmandu';

/** Kathmandu "today" as a YYYY-MM-DD key, so the calendar never offers yesterday. */
export const dayKey = (d) => new Intl.DateTimeFormat('en-CA', { timeZone: KTM }).format(d);

/** The next N open days, skipping the weekdays the business is closed. */
export function buildDays({ closedWeekdays = [6], maxDaysAhead = 30 } = {}) {
  const out = [];
  const now = new Date();

  for (let i = 0; i < maxDaysAhead && out.length < 14; i += 1) {
    const d = new Date(now.getTime() + i * 86400000);
    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone: KTM, weekday: 'short', day: '2-digit', month: 'short',
    }).formatToParts(d);
    const get = (t) => parts.find((p) => p.type === t)?.value ?? '';

    // Midday, so the offset can never push the date onto the neighbouring day.
    const weekdayIndex = new Date(`${dayKey(d)}T12:00:00+05:45`).getUTCDay();
    if (closedWeekdays.includes(weekdayIndex)) continue;

    out.push({ key: dayKey(d), weekday: i === 0 ? 'Today' : get('weekday'), day: get('day'), month: get('month') });
  }

  return out;
}

/** A day key back into something a customer reads. */
export function formatDayKey(key) {
  if (!key) return '—';
  return new Date(`${key}T12:00:00+05:45`).toLocaleDateString('en-GB', {
    weekday: 'short', day: '2-digit', month: 'short', year: 'numeric', timeZone: KTM,
  });
}

/** The UTC instant a chosen day and slot start at, which is what the API stores. */
export function preferredAtIso(date, startHour = 9) {
  return new Date(`${date}T${String(startHour).padStart(2, '0')}:00:00+05:45`).toISOString();
}
