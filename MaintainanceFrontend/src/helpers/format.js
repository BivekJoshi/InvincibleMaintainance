import { NE_DISPLAY_DIGITS, NE_WEEKDAY_NAMES, TIMEZONE_OFFSET_MINUTES } from '@/config/locale';
import { displayCalendar } from '@/helpers/displayCalendar';
import { BS_MONTH_NAMES_NE, adToBs, fiscalYearLabel, formatBs } from '@/helpers/nepaliDate';

/**
 * Display helpers. The API sends money as integer paisa and dates as UTC ISO strings;
 * everything user-facing is formatted here so the rules live in one place.
 *
 * Phase J1: the helpers a customer or a technician reads take `{ locale }` — `'en'` (the default, so the back office is
 * unchanged) or `'ne'`: Nepali month and relative-time words, `रु.` for `Rs.`, and the digits `NE_DISPLAY_DIGITS` picks
 * (`{ digits: 'deva' | 'latin' }` overrides it). Numbers keep Nepal's lakh grouping in both languages. All of it is
 * display only — what goes into an input or a request is never converted, and `toLatinDigits` reads a Devanagari digit
 * typed on a Nepali keyboard back into the Latin one the API expects.
 *
 * The back office's Calendar switch (`helpers/displayCalendar.js`): a date formatted **without** a `locale` — the
 * admin's way — is written in BS, in Nepali script ("१८ असोज २०८३"), while the switch says Nepali. A call that passes
 * a `locale` (the site, the documents, the field app) or a `calendar` is never moved by it.
 */

const NPR = new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const NPR_COMPACT = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 });

const DEVANAGARI_DIGITS = '०१२३४५६७८९';

/** `1,25,000` → `१,२५,०००`. Display only. */
export const toDevanagariDigits = (text) => String(text ?? '').replace(/[0-9]/g, (d) => DEVANAGARI_DIGITS[d]);

/** `१२.५` → `12.5` — what someone typed on a Nepali keyboard, before it is parsed or sent. */
export const toLatinDigits = (text) => String(text ?? '').replace(/[०-९]/g, (d) => String(DEVANAGARI_DIGITS.indexOf(d)));

/** The digits `locale` prints: Latin in English; in Nepali, `NE_DISPLAY_DIGITS` (`config/locale.js`). */
export const displayDigits = (locale) => (locale === 'ne' ? NE_DISPLAY_DIGITS : 'latin');

/** `text` with its digits as `locale` prints them — `digits` forces `'deva'` or `'latin'`. */
export const localizeDigits = (text, locale = 'en', digits = displayDigits(locale)) =>
  (digits === 'deva' ? toDevanagariDigits(text) : String(text ?? ''));

/** The Intl locale for dates and relative times: Nepali words with Latin digits (digits are `localizeDigits`'s job). */
const intlLocale = (locale) => (locale === 'ne' ? 'ne-NP-u-nu-latn' : 'en-GB');

/**
 * A count or a quantity as a person reads it: lakh grouping, at most `maximumFractionDigits` decimals, the locale's
 * digits — `1234567.5` → `12,34,567.5` (`१२,३४,५६७.५` with Devanagari digits). `''` for anything that is not a number.
 *
 * @param {number|string|null|undefined} value
 * @param {{ locale?: 'en'|'ne', digits?: 'latin'|'deva', maximumFractionDigits?: number }} [opts]
 */
export function formatNumber(value, { locale = 'en', digits, maximumFractionDigits = 2 } = {}) {
  if (value == null || value === '') return '';
  const n = Number(value);
  if (!Number.isFinite(n)) return '';
  return localizeDigits(new Intl.NumberFormat('en-IN', { maximumFractionDigits }).format(n), locale, digits);
}

export const paisaToRupees = (paisa) => Number(paisa || 0) / 100;

/** The currency mark each language writes before an amount. */
const RUPEE_SYMBOL = { en: 'Rs.', ne: 'रु.' };

/**
 * `123456789` paisa → `Rs. 12,34,567.89` (`रु. 12,34,567.89` in Nepali).
 *
 * @param {number|string|null|undefined} paisa
 * @param {{ symbol?: boolean, compact?: boolean, locale?: 'en'|'ne', digits?: 'latin'|'deva' }} [opts]
 */
export function formatNpr(paisa, { symbol = true, compact = false, locale = 'en', digits } = {}) {
  const value = paisaToRupees(paisa);
  const body = localizeDigits(compact ? NPR_COMPACT.format(value) : NPR.format(value), locale, digits);
  return symbol ? `${RUPEE_SYMBOL[locale] ?? RUPEE_SYMBOL.en} ${body}` : body;
}

/**
 * Money that may be below zero, as a document writes a deduction — "− Rs. 50,000.00", the way the totals write a
 * discount — never "Rs. -50,000.00". Phase L6: a FINAL invoice's "Less: advance INV-…" line is a negative rate and
 * amount (the server's paisa); nothing is worked out here but the sign.
 */
export function formatSignedNpr(paisa, opts) {
  const value = Number(paisa) || 0;
  return value < 0 ? `− ${formatNpr(-value, opts)}` : formatNpr(value, opts);
}

/**
 * Money short enough for a chart axis, in the units Nepal counts in:
 * 4 500 000 paisa → `Rs 45K`, 1 250 000 00 → `Rs 12.5L`, 3 × 10⁹ → `Rs 3Cr`.
 */
export function formatNprShort(paisa) {
  const rupees = paisaToRupees(paisa);
  const abs = Math.abs(rupees);
  const [div, unit] = abs >= 1e7 ? [1e7, 'Cr'] : abs >= 1e5 ? [1e5, 'L'] : abs >= 1e3 ? [1e3, 'K'] : [1, ''];
  const n = rupees / div;
  return `Rs ${Number(n.toFixed(Math.abs(n) >= 100 || !unit ? 0 : 1))}${unit}`;
}

/** Rupees for a form field — the API expects rupees on input, paisa on output. */
export const rupeesInput = (paisa) => (paisa == null ? '' : String(paisaToRupees(paisa)));

/**
 * Paisa for a rupee amount, the inverse of `paisaToRupees`. Rounds to the nearest
 * paisa: 12345678.9 × 100 is 1234567889.9999998 in floating point.
 */
export const rupeesToPaisa = (rupees) => Math.round(Number(rupees || 0) * 100);

/**
 * Reads what someone typed into a money field — `1,23,45,678.90`, `Rs. 500`,
 * ` 12.5 ` — as rupees, rounded to the paisa. Returns null for empty, negative or
 * unreadable input rather than guessing.
 *
 * @param {string|number|null|undefined} input
 * @returns {number|null}
 */
export function parseRupees(input) {
  if (input == null) return null;
  if (typeof input === 'number') return Number.isFinite(input) && input >= 0 ? rupeesToPaisa(input) / 100 : null;
  // Phase J1: a Nepali keyboard types `१२५००` and `रु.`; both read the same as `12500` and `Rs.`.
  const cleaned = toLatinDigits(input).replace(/rs\.?|npr|रु\.?|,|\s/gi, '');
  if (!cleaned || !/^(\d+\.?\d*|\.\d+)$/.test(cleaned)) return null;
  return rupeesToPaisa(Number(cleaned)) / 100;
}

/** Rupees with Indian digit grouping and two decimals, no symbol: `1,23,45,678.90`. */
export const formatRupees = (rupees) => (rupees == null || rupees === '' ? '' : NPR.format(Number(rupees)));

const KTM = 'Asia/Kathmandu';

/**
 * A UTC instant as the date and wall-clock time it was in Kathmandu, for date and
 * time inputs: `2026-09-14T06:15:00Z` → `{ date: '2026-09-14', time: '12:00' }`.
 *
 * @param {string|Date|null|undefined} iso
 * @returns {{ date: string, time: string }}
 */
export function toKathmanduParts(iso) {
  const d = iso ? new Date(iso) : null;
  if (!d || Number.isNaN(d.getTime())) return { date: '', time: '' };
  const local = new Date(d.getTime() + TIMEZONE_OFFSET_MINUTES * 60_000).toISOString();
  return { date: local.slice(0, 10), time: local.slice(11, 16) };
}

/**
 * The inverse: a Kathmandu date and time → the UTC ISO string the API stores.
 * A missing time means the start of that day in Kathmandu.
 *
 * @param {string} date `YYYY-MM-DD`
 * @param {string} [time] `HH:mm`
 * @returns {string|null}
 */
export function fromKathmanduParts(date, time = '00:00') {
  const [y, m, d] = String(date ?? '').split('-').map(Number);
  const [hh, mm] = String(time || '00:00').split(':').map(Number);
  if (!y || !m || !d || [hh, mm].some(Number.isNaN)) return null;
  return new Date(Date.UTC(y, m - 1, d, hh, mm) - TIMEZONE_OFFSET_MINUTES * 60_000).toISOString();
}

/** A calendar day picked in the browser → `YYYY-MM-DD`, from its local parts (no UTC shift). */
export function toDateString(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return undefined;
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** `YYYY-MM-DD` → a local Date for a calendar widget to highlight. */
export function parseDateString(value) {
  const [y, m, d] = String(value ?? '').split('-').map(Number);
  return y && m && d ? new Date(y, m - 1, d) : undefined;
}

/** Whether a date formatted with these options follows the back office's Calendar switch into BS. */
const followsSwitch = (opts) => opts.locale === undefined && opts.calendar === undefined && displayCalendar() === 'bs';

/**
 * An instant's Kathmandu day in BS, as the back office's Nepali calendar writes it — in Nepali script, "१८ असोज २०८३".
 * The Intl keys a caller passes still say which parts it wants: `weekday` adds "आइत", `year: undefined` leaves the
 * year out, `day: undefined` leaves the month and year ("असोज २०८३"). `null` outside the BS table.
 *
 * @param {string|Date|null|undefined} iso
 * @param {Intl.DateTimeFormatOptions} [opts]
 */
export function formatBsDay(iso, opts = {}) {
  const day = kathmanduDay(iso);
  if (!day) return null;
  let bs;
  try {
    bs = adToBs(new Date(`${day}T00:00:00.000Z`));
  } catch {
    return null;
  }
  const wants = (key) => (key in opts ? opts[key] !== undefined : key !== 'weekday');
  return [
    wants('weekday') ? NE_WEEKDAY_NAMES[new Date(`${day}T00:00:00.000Z`).getUTCDay()] : null,
    wants('day') ? toDevanagariDigits(bs.day) : null,
    wants('month') ? BS_MONTH_NAMES_NE[bs.month - 1] : null,
    wants('year') ? toDevanagariDigits(bs.year) : null,
  ].filter(Boolean).join(' ');
}

/**
 * The Kathmandu calendar day of an instant: `14 Sept 2026`, in Nepali `2026 सेप्टेम्बर 14`. Any other key is an Intl
 * option (`{ weekday: 'short' }`, `{ year: undefined }`). `calendar: 'bs'` gives the Bikram Sambat date instead
 * (`29 भदौ 2083` in Nepali, `29 Bhadra 2083` in English). Without `locale` or `calendar`, the back office's Calendar
 * switch decides: in Nepali, `formatBsDay`'s "१८ असोज २०८३".
 *
 * @param {string|Date|null|undefined} iso
 * @param {{ locale?: 'en'|'ne', digits?: 'latin'|'deva', calendar?: 'ad'|'bs' } & Intl.DateTimeFormatOptions} [options]
 */
export function formatDate(iso, options = {}) {
  if (!iso) return '—';
  const { locale = 'en', digits, calendar = 'ad', ...opts } = options;
  if (followsSwitch(options)) return formatBsDay(iso, opts) || formatDate(iso, { ...options, calendar: 'ad' });
  if (calendar === 'bs') return formatDateBs(iso, { long: true, locale, digits }) || '—';
  const text = new Date(iso).toLocaleDateString(intlLocale(locale), {
    day: '2-digit', month: 'short', year: 'numeric', timeZone: KTM, ...opts,
  });
  return localizeDigits(text, locale, digits);
}

/**
 * A Kathmandu calendar day (`YYYY-MM-DD`) written the way `formatDate` writes an instant — the same options, and the
 * same Calendar switch: `formatDay('2026-10-04', { weekday: 'short', year: undefined })` → "Sun, 04 Oct" / "आइत १८ असोज".
 * Keys set to `undefined` are left out, so `{ day: undefined, year: undefined, month: 'short' }` is the month alone.
 */
export const formatDay = (day, opts) => (day ? formatDate(fromKathmanduParts(day, '12:00'), opts) : '—');

/** The Kathmandu calendar day an instant falls on, `YYYY-MM-DD` (`''` for none). */
export const kathmanduDay = (iso) => toKathmanduParts(iso).date;

/**
 * An instant's Bikram Sambat date: the day it was **in Kathmandu** (a due date of 14 Sept is stored as 18:15 UTC on
 * the 13th), converted by `helpers/nepaliDate.js` — the API's own table, copied byte for byte (Phase I). `''` when
 * there is no date or it lies outside the table. `long` gives "1 Shrawan 2083" (`locale: 'ne'` → "1 साउन 2083").
 *
 * @param {string|Date|null|undefined} iso
 * @param {{ long?: boolean, locale?: 'en'|'ne', digits?: 'latin'|'deva' }} [opts]
 */
export function formatDateBs(iso, { long = false, locale = 'en', digits } = {}) {
  const day = kathmanduDay(iso);
  if (!day) return '';
  try {
    return localizeDigits(formatBs(new Date(`${day}T00:00:00.000Z`), { long, locale }), locale, digits);
  } catch {
    return '';
  }
}

/** The era each language writes after a BS date. */
const BS_ERA = { en: 'BS', ne: 'वि.सं.' };

/**
 * AD with its BS twin, as a financial document states a date: "17 Jul 2026 (2083-04-01 BS)" — in Nepali
 * "2026 जुलाई 17 (2083-04-01 वि.सं.)".
 *
 * @param {string|Date|null|undefined} iso
 * @param {{ locale?: 'en'|'ne', digits?: 'latin'|'deva' }} [opts]
 */
export function formatDateAdBs(iso, { locale = 'en', digits } = {}) {
  if (!iso) return '—';
  const ad = formatDate(iso, { locale, digits, calendar: 'ad' });
  const bs = formatDateBs(iso, { locale, digits });
  return bs ? `${ad} (${bs} ${BS_ERA[locale] ?? BS_ERA.en})` : ad;
}

/** The Nepali fiscal year (Shrawan 1 – Ashadh end) an instant's Kathmandu day falls in: `'2083/84'`. */
export function fiscalYearOf(iso) {
  const day = kathmanduDay(iso);
  if (!day) return '';
  try {
    return fiscalYearLabel(new Date(`${day}T00:00:00.000Z`));
  } catch {
    return '';
  }
}

/**
 * What is still owed, as shown: the server's `balance`, never below zero. The API already floors it (an
 * overpayment is refused); a negative figure from an older row still reads as settled, not as a debt of −Rs.
 */
export const formatBalance = (paisa, opts) => formatNpr(Math.max(0, Number(paisa) || 0), opts);

/**
 * The day and the Kathmandu time. Without `locale`, the back office's Calendar switch decides the day:
 * "१८ असोज २०८३, 14:30" in Nepali — the time stays Latin.
 *
 * @param {{ locale?: 'en'|'ne', digits?: 'latin'|'deva' }} [options]
 */
export function formatDateTime(iso, options = {}) {
  if (!iso) return '—';
  const { locale = 'en', digits } = options;
  const bs = followsSwitch(options) ? formatBsDay(iso) : null;
  if (bs) return `${bs}, ${formatTime(iso)}`;
  return localizeDigits(new Date(iso).toLocaleString(intlLocale(locale), {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: KTM,
  }), locale, digits);
}

/** @param {{ locale?: 'en'|'ne', digits?: 'latin'|'deva' }} [opts] */
export function formatTime(iso, { locale = 'en', digits } = {}) {
  if (!iso) return '—';
  return localizeDigits(
    new Date(iso).toLocaleTimeString(intlLocale(locale), { hour: '2-digit', minute: '2-digit', timeZone: KTM }),
    locale, digits,
  );
}

/**
 * "in 42 min", "3 hours ago" — used by the SLA countdown; in Nepali "3 घण्टा पहिले".
 *
 * @param {string|Date|null|undefined} iso
 * @param {{ locale?: 'en'|'ne', digits?: 'latin'|'deva' }} [opts]
 */
export function relativeTime(iso, { locale = 'en', digits } = {}) {
  if (!iso) return '—';
  const diffMs = new Date(iso).getTime() - Date.now();
  const rtf = new Intl.RelativeTimeFormat(locale === 'ne' ? intlLocale('ne') : 'en', { numeric: 'auto' });
  const units = [
    ['day', 86400000], ['hour', 3600000], ['minute', 60000], ['second', 1000],
  ];
  for (const [unit, ms] of units) {
    if (Math.abs(diffMs) >= ms || unit === 'second') {
      return localizeDigits(rtf.format(Math.round(diffMs / ms), unit), locale, digits);
    }
  }
  return '—';
}

/**
 * A compact age for tight spaces — "now", "12m", "3h", "9d", "5mo".
 * @param {string} iso
 * @param {number} [now]  ms since the epoch
 */
export function shortAge(iso, now = Date.now()) {
  const minutes = Math.floor((now - new Date(iso).getTime()) / 60000);
  if (!Number.isFinite(minutes)) return '—';
  if (minutes < 1) return 'now';
  if (minutes < 60) return `${minutes}m`;
  if (minutes < 1440) return `${Math.floor(minutes / 60)}h`;
  const days = Math.floor(minutes / 1440);
  return days < 60 ? `${days}d` : `${Math.floor(days / 30)}mo`;
}

/** The hour and minute words each language writes after a length of time. */
const DURATION_UNITS = { en: { h: 'h', min: 'min' }, ne: { h: 'घण्टा', min: 'मिनेट' } };

/**
 * A length of time worked: 95 → "1 h 35 min", 0 → "0 min"; in Nepali "1 घण्टा 35 मिनेट".
 *
 * @param {number|null|undefined} minutes
 * @param {{ locale?: 'en'|'ne', digits?: 'latin'|'deva' }} [opts]
 */
export function formatMinutes(minutes, { locale = 'en', digits } = {}) {
  const unit = DURATION_UNITS[locale] ?? DURATION_UNITS.en;
  const h = Math.floor((minutes || 0) / 60);
  const m = (minutes || 0) % 60;
  const text = minutes
    ? [h ? `${h} ${unit.h}` : null, m ? `${m} ${unit.min}` : null].filter(Boolean).join(' ')
    : `0 ${unit.min}`;
  return localizeDigits(text, locale, digits);
}

/** "1h 42m left" / "2h 10m overdue" for the SLA chip. */
export function formatCountdown(minutes) {
  if (minutes == null) return '—';
  const overdue = minutes < 0;
  const abs = Math.abs(minutes);
  const h = Math.floor(abs / 60);
  const m = abs % 60;
  const body = h ? `${h}h ${m}m` : `${m}m`;
  return overdue ? `${body} overdue` : `${body} left`;
}

export const initials = (name = '') =>
  name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? '').join('');

export const titleCase = (s = '') =>
  s.toLowerCase().replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

/** Picks the best available image for a width, falling back to the original. */
export function imageUrl(media, width = 800) {
  if (!media) return null;
  if (typeof media === 'string') return media;
  return media.variants?.[String(width)] ?? media.variants?.['800'] ?? media.url ?? null;
}

/** 1 234 567 → "1.2 MB". */
export function formatBytes(bytes) {
  if (bytes == null) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
