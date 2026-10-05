import { NE_WEEKDAY_NAMES } from '@/config/locale';
import { kathmanduDay, toDevanagariDigits } from '@/helpers/format';
import { BS_MONTH_NAMES, BS_MONTH_NAMES_NE, adToBs, bsToAd } from '@/helpers/nepaliDate';

/**
 * Calendar days without a DOM, in AD or BS — the SLA board's calendar (`components/agenda/`), the date pickers
 * (`components/common/DateCalendar`, `BsCalendar`) and the clock. Days are Kathmandu calendar days as `YYYY-MM-DD`
 * strings, so no browser timezone ever moves a date onto the wrong square. Nepal's week runs Sunday to Saturday, the
 * holiday.
 */

const DAY_MS = 86_400_000;
const toMs = (day) => Date.parse(`${day}T00:00:00Z`);
const fromMs = (ms) => new Date(ms).toISOString().slice(0, 10);

export const WEEKDAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
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

/** The 1st of the month `step` months on from `day`'s — in AD or BS months. */
export function shiftMonth(day, step, calendar = 'ad') {
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

