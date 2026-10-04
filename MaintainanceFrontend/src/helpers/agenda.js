import { NEXT_ACTION_LABELS } from '@/config/constants';
import { TIMEZONE_OFFSET_MINUTES } from '@/config/locale';
import { formatNpr, formatTime, kathmanduDay, toDevanagariDigits } from '@/helpers/format';
import { lateBy } from '@/helpers/leadFollowUp';
import { BS_MONTH_NAMES, BS_MONTH_NAMES_NE, adToBs, bsToAd } from '@/helpers/nepaliDate';

/**
 * The SLA board's calendar (`components/agenda/`), without a DOM. Days are Kathmandu calendar days as
 * `YYYY-MM-DD` strings — the API's `from` / `to`, the grid's cells and the URL's `day` alike — so no browser
 * timezone ever moves a deadline onto the wrong square. Nepal's week runs Sunday to Saturday, the holiday.
 */

const DAY_MS = 86_400_000;
const toMs = (day) => Date.parse(`${day}T00:00:00Z`);
const fromMs = (ms) => new Date(ms).toISOString().slice(0, 10);

/** Each kind: what it is, the shorter word a chip has room for, and its colour (a theme variable, `--tone`). */
export const AGENDA_KINDS = {
  response: { label: 'Reply deadline', short: 'Reply', tone: '--sla-warn' },
  followUp: { label: 'Follow-up', short: 'Follow-up', tone: '--info' },
  visit: { label: 'Site visit', short: 'Visit', tone: '--chart-1' },
  job: { label: 'Job', short: 'Job', tone: '--note-purple-edge' },
  quotation: { label: 'Quotation expiry', short: 'Quote', tone: '--note-pink-edge' },
  invoice: { label: 'Invoice due', short: 'Invoice', tone: '--success' },
  amcVisit: { label: 'AMC visit', short: 'AMC', tone: '--note-yellow-edge' },
  renewal: { label: 'AMC renewal', short: 'Renewal', tone: '--muted-foreground' },
};

/** The legend's order — the API's too. */
export const AGENDA_KIND_ORDER = Object.keys(AGENDA_KINDS);

/** The inline style that sets `--tone` for a kind; chips, dots and the legend read it. */
export const kindStyle = (kind) => ({ '--tone': `var(${AGENDA_KINDS[kind]?.tone ?? '--primary'})` });

/** The calendar's three ways of looking. */
export const AGENDA_VIEWS = [
  { value: 'month', label: 'Month' },
  { value: 'week', label: 'Week' },
  { value: 'list', label: 'List' },
];

export const WEEKDAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
/** The same days in Nepali — a BS date is written in Nepali script, weekday and all. */
export const NE_WEEKDAY_NAMES = ['आइत', 'सोम', 'मङ्गल', 'बुध', 'बिहि', 'शुक्र', 'शनि'];
/** Saturday: the weekly holiday, shaded on the grid. */
export const HOLIDAY = 6;

/** Kathmandu's today. */
export const ktmToday = (now = Date.now()) => kathmanduDay(new Date(now).toISOString());

/** Whether `value` is a real `YYYY-MM-DD` day (a URL can carry anything). */
export const isDay = (value) => /^\d{4}-\d{2}-\d{2}$/.test(String(value ?? '')) && fromMs(toMs(value)) === value;

/** `day` moved by `n` days. */
export const addDays = (day, n) => fromMs(toMs(day) + n * DAY_MS);

/** 0 = Sunday … 6 = Saturday. */
export const weekdayOf = (day) => new Date(toMs(day)).getUTCDay();

/** The Sunday the week of `day` starts on. */
export const weekStart = (day) => addDays(day, -weekdayOf(day));

/** A day's Bikram Sambat date, or null outside the table. */
export function bsOf(day) {
  try {
    return adToBs(new Date(toMs(day)));
  } catch {
    return null;
  }
}

/** A BS date's AD day, or null outside the table. */
const bsDay = (year, month, day) => {
  try {
    return fromMs(bsToAd(year, month, day).getTime());
  } catch {
    return null;
  }
};

/**
 * A BS date is written in Nepali script — Devanagari digits and month names, "१८ असोज २०८३" — wherever the calendar
 * shows one (the office asked for it; it is the one place the English back office writes Devanagari digits). Times
 * and AD dates stay Latin.
 */
const ne = toDevanagariDigits;
const bsName = (bs) => BS_MONTH_NAMES_NE[bs.month - 1];

/**
 * Calendars (`calendar`): `'ad'` — the Gregorian months — or `'bs'` — Bikram Sambat, the Nepali calendar: the month
 * grid, its steps and every heading follow that calendar's months, and the other calendar's date rides in each
 * cell's corner. The days themselves stay AD `YYYY-MM-DD` strings either way; a day outside the BS table (after BS
 * 2100) falls back to AD.
 */

/** The 1st of the month `day` is in — the AD month, or with `bs` the BS month. */
export function monthStart(day, calendar = 'ad') {
  const bs = calendar === 'bs' ? bsOf(day) : null;
  return (bs && bsDay(bs.year, bs.month, 1)) || `${day.slice(0, 7)}-01`;
}

/** Names the month `day` is in, so a cell can tell whether it is outside the month on screen. */
const monthKey = (day, calendar) => {
  const bs = calendar === 'bs' ? bsOf(day) : null;
  return bs ? `${bs.year}-${bs.month}` : day.slice(0, 7);
};

/** Same month — in the calendar on screen? */
export const sameMonth = (a, b, calendar = 'ad') => monthKey(a, calendar) === monthKey(b, calendar);

/** The 1st of the month `step` months on from `day`'s. */
function shiftMonth(day, step, calendar) {
  const bs = calendar === 'bs' ? bsOf(day) : null;
  if (bs) {
    const index = bs.year * 12 + bs.month - 1 + step;
    const next = bsDay(Math.floor(index / 12), (index % 12) + 1, 1);
    if (next) return next;
  }
  const [y, m] = day.split('-').map(Number);
  return fromMs(Date.UTC(y, m - 1 + step, 1));
}

/** Every day of the month `anchor` is in, the 1st first. */
export function monthDays(anchor, calendar = 'ad') {
  const first = monthStart(anchor, calendar);
  const length = Math.round((toMs(shiftMonth(first, 1, calendar)) - toMs(first)) / DAY_MS);
  return Array.from({ length }, (_, i) => addDays(first, i));
}

/**
 * Six weeks from the Sunday on or before the 1st — every month the same height, so the page never jumps. A BS
 * month runs to 32 days and still fits.
 */
export function monthGrid(anchor, calendar = 'ad') {
  const first = weekStart(monthStart(anchor, calendar));
  return Array.from({ length: 42 }, (_, i) => addDays(first, i));
}

/** The seven days of `anchor`'s week, Sunday first. */
export const weekDays = (anchor) => Array.from({ length: 7 }, (_, i) => addDays(weekStart(anchor), i));

/**
 * The anchor one period on (`step` 1) or back (-1). A month step lands on the 1st, so 31 January never
 * skips February (nor 32 Ashadh a month).
 */
export function shiftAnchor(anchor, view, step, calendar = 'ad') {
  return view === 'week' ? addDays(anchor, 7 * step) : shiftMonth(anchor, step, calendar);
}

/** The days a view shows, as the API's `{ from, to }`: the week, or the month's whole six-week grid. */
export function spanFor(view, anchor, calendar = 'ad') {
  const days = view === 'week' ? weekDays(anchor) : monthGrid(anchor, calendar);
  return { from: days[0], to: days[days.length - 1] };
}

const AD = (day, opts) => new Date(toMs(day)).toLocaleDateString('en-GB', { timeZone: 'UTC', ...opts });

/** "27 Sept – 3 Oct 2026" — a run of AD days. */
function adRange(a, b) {
  const end = AD(b, { day: 'numeric', month: 'short', year: 'numeric' });
  if (sameMonth(a, b)) return `${AD(a, { day: 'numeric' })} – ${end}`;
  if (a.slice(0, 4) === b.slice(0, 4)) return `${AD(a, { day: 'numeric', month: 'short' })} – ${end}`;
  return `${AD(a, { day: 'numeric', month: 'short', year: 'numeric' })} – ${end}`;
}

/** "१८ – २४ असोज २०८३", "२५ असोज – १ कात्तिक २०८३" — a run of BS days, or null outside the table. */
function bsRange(from, to) {
  const a = bsOf(from);
  const b = bsOf(to);
  if (!a || !b) return null;
  const end = `${ne(b.day)} ${bsName(b)} ${ne(b.year)}`;
  if (a.year === b.year && a.month === b.month) return `${ne(a.day)} – ${end}`;
  if (a.year === b.year) return `${ne(a.day)} ${bsName(a)} – ${end}`;
  return `${ne(a.day)} ${bsName(a)} ${ne(a.year)} – ${end}`;
}

/** The AD months a span covers: "Sept – Oct 2026", "Dec 2026 – Jan 2027", "October 2026". */
function adMonthsLabel(from, to) {
  if (sameMonth(from, to)) return AD(from, { month: 'long', year: 'numeric' });
  const end = AD(to, { month: 'short', year: 'numeric' });
  const start = AD(from, from.slice(0, 4) === to.slice(0, 4) ? { month: 'short' } : { month: 'short', year: 'numeric' });
  return `${start} – ${end}`;
}

/** The BS months a span covers: "असोज – कात्तिक २०८३", "पुस २०८३ – माघ २०८४", "कात्तिक २०८३". */
export function bsSpanLabel(from, to) {
  const a = bsOf(from);
  const b = bsOf(to);
  if (!a || !b) return '';
  if (a.year === b.year && a.month === b.month) return `${bsName(a)} ${ne(a.year)}`;
  if (a.year === b.year) return `${bsName(a)} – ${bsName(b)} ${ne(b.year)}`;
  return `${bsName(a)} ${ne(a.year)} – ${bsName(b)} ${ne(b.year)}`;
}

/** Whether the calendar on screen is BS for this day (past the BS table it falls back to AD). */
export const readsBs = (day, calendar) => calendar === 'bs' && Boolean(bsOf(day));

/**
 * The period's name in the calendar on screen: "October 2026" / "असोज २०८३" for a month, "4 – 10 Oct 2026" /
 * "१८ – २४ असोज २०८३" for a week.
 */
export function periodLabel(view, anchor, calendar = 'ad') {
  const bs = calendar === 'bs' ? bsOf(anchor) : null;
  if (view === 'week') {
    const days = weekDays(anchor);
    return (bs && bsRange(days[0], days[6])) || adRange(days[0], days[6]);
  }
  return bs ? `${bsName(bs)} ${ne(bs.year)}` : AD(anchor, { month: 'long', year: 'numeric' });
}

/**
 * The same period in the other calendar, for the line under its name: "असोज – कात्तिक २०८३ वि.सं." under October
 * 2026, "Sept – Oct 2026 AD" under असोज २०८३.
 */
export function otherPeriodLabel(view, anchor, calendar = 'ad') {
  const days = view === 'week' ? weekDays(anchor) : monthDays(anchor, calendar);
  const [from, to] = [days[0], days[days.length - 1]];
  if (readsBs(anchor, calendar)) return `${view === 'week' ? adRange(from, to) : adMonthsLabel(from, to)} AD`;
  const bs = view === 'week' ? bsRange(from, to) : bsSpanLabel(from, to);
  return bs ? `${bs} वि.सं.` : '';
}

/** A BS month's name in Latin letters, "Ashwin" — beside its Nepali name, for a reader who does not read Devanagari. */
export function bsMonthNameEn(day) {
  const bs = bsOf(day);
  return bs ? BS_MONTH_NAMES[bs.month - 1] : null;
}

/** "Sun 4 Oct" — a day's heading; with `bs` "आइत १८ असोज"; `year` adds the year. */
export function dayHeading(day, { calendar = 'ad', year = false } = {}) {
  const bs = calendar === 'bs' ? bsOf(day) : null;
  if (bs) return `${NE_WEEKDAY_NAMES[weekdayOf(day)]} ${ne(bs.day)} ${bsName(bs)}${year ? ` ${ne(bs.year)}` : ''}`;
  return AD(day, { weekday: 'short', day: 'numeric', month: 'short', ...(year ? { year: 'numeric' } : {}) });
}

/** What a cell is headed with: the AD day ("4"), or the BS day in Nepali script ("१८"). */
export function dayNumber(day, calendar = 'ad') {
  const bs = calendar === 'bs' ? bsOf(day) : null;
  return bs ? ne(bs.day) : String(Number(day.slice(8)));
}

/** A grid cell's BS corner: the BS day, and the month's name on its 1st (and on the grid's first cell) — "१ कात्तिक". */
export function bsCell(day, first = false) {
  const bs = bsOf(day);
  if (!bs) return null;
  return { day: ne(bs.day), month: bs.day === 1 || first ? bsName(bs) : null };
}

/**
 * A cell's corner: the date in the *other* calendar — the BS day on an AD grid, the AD day on a BS one — with its
 * month's name on that month's 1st and on the first cell. `title` says which calendar it is; `lang` is `'ne'` for a
 * BS date, so it is set in a Devanagari face.
 */
export function cornerCell(day, first = false, calendar = 'ad') {
  if (readsBs(day, calendar)) {
    const date = Number(day.slice(8));
    return { day: String(date), month: date === 1 || first ? AD(day, { month: 'short' }) : null, title: 'English date (AD)', lang: 'en' };
  }
  const bs = bsCell(day, first);
  return bs ? { ...bs, title: 'Nepali date (BS)', lang: 'ne' } : null;
}

/** "18 Ashwin 2083" → "१८ असोज २०८३": an item's BS date in Nepali script; null outside the table. */
export function bsDate(day) {
  const bs = bsOf(day);
  return bs ? `${ne(bs.day)} ${bsName(bs)} ${ne(bs.year)}` : null;
}

/** The Kathmandu day an item sits on. */
export const itemDay = (item) => kathmanduDay(item.at);

/** A day's order: the all-day ones (due dates) first, then by the clock. */
export const byTime = (a, b) => Number(b.allDay) - Number(a.allDay) || new Date(a.at) - new Date(b.at) || a.kind.localeCompare(b.kind);

/**
 * Items by the Kathmandu day they sit on, each day in `byTime` order.
 *
 * @param {object[]} items
 * @returns {Map<string, object[]>}
 */
export function itemsByDay(items) {
  const days = new Map();
  for (const item of items) {
    const day = itemDay(item);
    if (!days.has(day)) days.set(day, []);
    days.get(day).push(item);
  }
  for (const list of days.values()) list.sort(byTime);
  return days;
}

/**
 * The board's Everyone / Mine / Unassigned switch, on the calendar. Mine is what the caller owns; Unassigned is the
 * ownable kinds (a lead's work, a quotation) with nobody on them — a job or an invoice is nobody's in this sense.
 *
 * @param {object[]} items
 * @param {'all'|'mine'|'unassigned'} scope
 * @param {string} [userId]
 */
export function itemsInScope(items, scope, userId) {
  if (scope === 'mine') return items.filter((i) => i.ownerId === userId);
  if (scope === 'unassigned') return items.filter((i) => i.ownable && !i.ownerId);
  return items;
}

/** The URL's `hide=job,invoice` → the kinds switched off, known kinds only. */
export const parseHidden = (value) => new Set(String(value ?? '').split(',').filter((k) => k in AGENDA_KINDS));

/** …and back: `undefined` when nothing is hidden, so the address stays clean. */
export const serializeHidden = (hidden) => (hidden.size ? AGENDA_KIND_ORDER.filter((k) => hidden.has(k)).join(',') : undefined);

/** How many of each kind, for the legend's counts. */
export function countByKind(items) {
  const counts = Object.fromEntries(AGENDA_KIND_ORDER.map((k) => [k, 0]));
  for (const item of items) counts[item.kind] = (counts[item.kind] ?? 0) + 1;
  return counts;
}

/**
 * The tiles over the calendar: what is late (all of it — the API always sends every late item), what falls today,
 * what is still coming in the days on screen, and how many ownable items nobody has.
 *
 * @param {object[]} items  already scoped and filtered
 * @param {{ from: string, to: string }} span
 * @param {string} today
 */
export function agendaSummary(items, span, today) {
  let overdue = 0;
  let dueToday = 0;
  let upcoming = 0;
  let unowned = 0;
  for (const item of items) {
    if (item.ownable && !item.ownerId) unowned += 1;
    if (item.state === 'overdue') overdue += 1;
    else if (item.state === 'today') dueToday += 1;
    else {
      const day = itemDay(item);
      if (day >= span.from && day <= span.to && day >= today) upcoming += 1;
    }
  }
  return { overdue, today: dueToday, upcoming, unowned, todayInView: today >= span.from && today <= span.to };
}

/** "09:00", "10:00–12:00" (an end on the same day), or "All day" for a due date. */
export function itemTime(item) {
  if (item.allDay) return 'All day';
  const start = formatTime(item.at);
  if (!item.endAt || itemDay({ at: item.endAt }) !== itemDay(item)) return start;
  return `${start}–${formatTime(item.endAt)}`;
}

const QUOTE_WORDS = {
  OFFICE_APPROVED: 'Approved, not sent yet — valid until this day',
  SENT: 'With the customer — expires this day',
  CHANGES_REQUESTED: 'Customer asked for changes — expires this day',
};

/**
 * What to do, in a line: "Reply to the enquiry", "Call — Ask about the roof", "Site visit · Hari",
 * "Rs. 7,499.50 still owed".
 */
export function itemAction(item) {
  switch (item.kind) {
    case 'response': return 'First reply to the enquiry';
    case 'followUp': {
      const label = NEXT_ACTION_LABELS[item.type] ?? 'Follow up';
      return item.note ? `${label} — ${item.note}` : label;
    }
    case 'visit':
    case 'job': {
      const who = item.people?.length ? item.people.join(', ') : 'Nobody assigned yet';
      return `${item.kind === 'visit' ? 'Site visit' : 'Job'} · ${who}`;
    }
    case 'quotation': return QUOTE_WORDS[item.status] ?? 'Quotation expires this day';
    case 'invoice': return `${formatNpr(item.amount ?? 0)} still owed`;
    case 'amcVisit': return 'AMC visit due — book it';
    case 'renewal': return 'Contract ends — offer the renewal';
    default: return '';
  }
}

/**
 * How late an overdue item is: "45 min late", "3 h late", "12 d late". A due date is late from the end of its day.
 *
 * @param {object} item
 * @param {number} [now]
 * @returns {string|null}
 */
export function lateLabel(item, now = Date.now()) {
  if (item.state !== 'overdue') return null;
  const since = item.allDay
    ? toMs(addDays(itemDay(item), 1)) - TIMEZONE_OFFSET_MINUTES * 60_000
    : new Date(item.endAt && (item.kind === 'job' || item.kind === 'visit') ? item.endAt : item.at).getTime();
  return `${lateBy(Math.max(1, Math.floor((now - since) / 60_000)))} late`;
}
