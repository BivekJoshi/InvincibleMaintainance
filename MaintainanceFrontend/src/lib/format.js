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

/** Rupees for a form field — the API expects rupees on input, paisa on output. */
export const rupeesInput = (paisa) => (paisa == null ? '' : String(paisaToRupees(paisa)));

const KTM = 'Asia/Kathmandu';

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
