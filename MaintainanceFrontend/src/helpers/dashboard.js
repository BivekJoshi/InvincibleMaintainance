import { ktmDay } from '@/helpers/dispatchBoard';

/**
 * The dashboard's arithmetic, kept out of the components so it can be tested
 * without drawing anything. Days are Kathmandu calendar days, `YYYY-MM-DD`.
 */

const DAY_MS = 86_400_000;

/** `YYYY-MM-DD` shifted by whole days — calendar arithmetic, no timezone involved. */
export function shiftDay(day, by) {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d) + by * DAY_MS).toISOString().slice(0, 10);
}

/** The last `count` Kathmandu days, oldest first, ending on `today`. */
export function lastDays(count, today = ktmDay()) {
  return Array.from({ length: count }, (_, i) => shiftDay(today, i - count + 1));
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
// Spelled out rather than from Intl: en-GB now says "Sept", and an axis wants three letters everywhere.
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** `2026-09-17` → `{ weekday: 'Thu', date: '17 Sep' }`, read as a calendar day. */
export function dayParts(day) {
  const d = new Date(`${day}T00:00:00Z`);
  return { weekday: WEEKDAYS[d.getUTCDay()], date: `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}` };
}

/** The Kathmandu hour of an instant, 0–23. */
export function ktmHour(now = new Date()) {
  return Number(new Intl.DateTimeFormat('en-GB', { hour: '2-digit', hourCycle: 'h23', timeZone: 'Asia/Kathmandu' }).format(now));
}

export function greetingFor(hour) {
  if (hour < 5) return 'Working late';
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

/**
 * The revenue report's daily rows as a running total over every one of the last
 * `count` days, so a quiet day is a flat stretch rather than a missing point.
 *
 * @param {{ key: string, invoiced: number, collected: number }[]} rows paisa
 * @returns {{ day: string, invoiced: number, collected: number }[]}
 */
export function runningRevenue(rows = [], count = 30, today = ktmDay()) {
  const byDay = Object.fromEntries(rows.map((r) => [r.key, r]));
  let invoiced = 0;
  let collected = 0;
  return lastDays(count, today).map((day) => {
    invoiced += byDay[day]?.invoiced ?? 0;
    collected += byDay[day]?.collected ?? 0;
    return { day, invoiced, collected };
  });
}

/**
 * A round top for a value axis and the ticks up to it: 0 and four steps of
 * 1, 2, 2.5 or 5 × a power of ten. Never below `min`, so an empty chart still
 * has a scale.
 */
export function niceScale(max, { min = 4, ticks = 4 } = {}) {
  const target = Math.max(max, min);
  const raw = target / ticks;
  const pow = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((f) => f * pow).find((s) => s >= raw);
  return { max: step * ticks, ticks: Array.from({ length: ticks + 1 }, (_, i) => i * step) };
}

/** Change between two numbers as a whole percentage, or null when there is no base. */
export function percentChange(current, previous) {
  if (!previous) return null;
  return Math.round(((current - previous) / previous) * 100);
}

/**
 * What needs someone today: every toned card whose count is above zero, the
 * red ones first, then by size.
 *
 * @param {Record<string, number>} cards the API's card values
 * @param {Record<string, { tone?: string, soon?: boolean }>} defs
 */
export function attentionItems(cards = {}, defs = {}) {
  const rank = { danger: 0, warn: 1 };
  return Object.entries(cards)
    .filter(([name, value]) => defs[name]?.tone && !defs[name].soon && value > 0)
    .map(([name, value]) => ({ name, value, tone: defs[name].tone }))
    .sort((a, b) => rank[a.tone] - rank[b.tone] || b.value - a.value);
}

/**
 * The groups that have something to show, each with its cards in order and
 * their values. Cards the API sent that no group names are gathered last.
 *
 * @param {Record<string, number>} cards
 * @param {{ key: string, label: string, cards: string[] }[]} groups
 */
export function groupCards(cards = {}, groups = []) {
  const placed = new Set(groups.flatMap((g) => g.cards));
  const out = groups
    .map((g) => ({ ...g, items: g.cards.filter((c) => c in cards).map((name) => ({ name, value: cards[name] })) }))
    .filter((g) => g.items.length);
  const rest = Object.keys(cards).filter((c) => !placed.has(c));
  if (rest.length) out.push({ key: 'other', label: 'Other', items: rest.map((name) => ({ name, value: cards[name] })) });
  return out;
}

/** Where a lead stands against its response deadline, as the SLA chip reads it. */
export function slaState(dueAt, now = Date.now(), warnMinutes = 30) {
  if (!dueAt) return 'none';
  const minutes = (new Date(dueAt).getTime() - now) / 60_000;
  if (minutes < 0) return 'breached';
  return minutes <= warnMinutes ? 'at_risk' : 'ok';
}

/** A job's window in Kathmandu time: `09:30–11:00`, or just the start. */
export function timeWindow(start, end) {
  const fmt = (iso) => new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone: 'Asia/Kathmandu' }).format(new Date(iso));
  if (!start) return '—';
  return end ? `${fmt(start)}–${fmt(end)}` : fmt(start);
}
