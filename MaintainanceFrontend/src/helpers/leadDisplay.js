import { formatNpr } from '@/helpers/format';

/**
 * The website estimate's saved payload (`POST /public/estimate`'s answer) as label/value
 * pairs: what for, how much of it, at what rate, and the range the customer was shown.
 * Money in the payload is paisa.
 */
export function describeEstimate(payload) {
  if (!payload || typeof payload !== 'object') return [];
  const lines = [];
  const unit = payload.unit ?? '';
  if (payload.name) lines.push(['For', payload.name]);
  if (payload.qty != null) lines.push(['Size', `${payload.qty} ${unit}`.trim()]);
  if (payload.rateMin != null) {
    const rate = payload.rateMax != null && payload.rateMax !== payload.rateMin
      ? `${formatNpr(payload.rateMin)} – ${formatNpr(payload.rateMax)}`
      : formatNpr(payload.rateMin);
    lines.push(['Rate', unit ? `${rate} per ${unit}` : rate]);
  }
  if (payload.min != null) {
    lines.push(['Shown', payload.max != null && payload.max !== payload.min
      ? `${formatNpr(payload.min)} – ${formatNpr(payload.max)}`
      : formatNpr(payload.min)]);
  }
  return lines;
}

/** What a merge moves into the primary, summed over the picked duplicates; null when nothing does. */
export function mergePreview(rows) {
  const sum = (key) => rows.reduce((n, r) => n + (r._count?.[key] ?? 0), 0);
  const parts = [
    [sum('notes'), 'note'], [sum('activities'), 'timeline entry', 'timeline entries'],
    [sum('quotations'), 'quotation'], [sum('jobs'), 'job'],
  ].filter(([n]) => n > 0).map(([n, one, many]) => `${n} ${n === 1 ? one : many ?? `${one}s`}`);
  return parts.length ? parts.join(', ') : null;
}
