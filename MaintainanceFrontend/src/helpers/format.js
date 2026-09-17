import { TIMEZONE_OFFSET_MINUTES } from '@/config/locale';

/**
 * Display helpers. The API sends money as integer paisa and dates as UTC ISO strings;
 * everything user-facing is formatted here so the rules live in one place.
 */

const NPR = new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const NPR_COMPACT = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 });

export const paisaToRupees = (paisa) => Number(paisa || 0) / 100;

export function formatNpr(paisa, { symbol = true, compact = false } = {}) {
  const value = paisaToRupees(paisa);
  const body = compact ? NPR_COMPACT.format(value) : NPR.format(value);
  return symbol ? `Rs. ${body}` : body;
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
  const cleaned = String(input).replace(/rs\.?|npr|,|\s/gi, '');
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

export function formatDate(iso, opts = {}) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric', timeZone: KTM, ...opts,
  });
}

export function formatDateTime(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: KTM,
  });
}

export function formatTime(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: KTM });
}

/** "in 42 min", "3 hours ago" — used by the SLA countdown. */
export function relativeTime(iso) {
  if (!iso) return '—';
  const diffMs = new Date(iso).getTime() - Date.now();
  const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
  const units = [
    ['day', 86400000], ['hour', 3600000], ['minute', 60000], ['second', 1000],
  ];
  for (const [unit, ms] of units) {
    if (Math.abs(diffMs) >= ms || unit === 'second') {
      return rtf.format(Math.round(diffMs / ms), unit);
    }
  }
  return '—';
}

/** "1h 42m left" / "2h 10m overdue" for the SLA chip. */
/** A length of time worked: 95 → "1 h 35 min", 0 → "0 min". */
export function formatMinutes(minutes) {
  if (!minutes) return '0 min';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return [h ? `${h} h` : null, m ? `${m} min` : null].filter(Boolean).join(' ');
}

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
