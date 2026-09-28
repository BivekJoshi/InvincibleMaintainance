import { formatQty } from '@/helpers/handoff';
import { formatShare } from '@/helpers/paymentSchedule';

/**
 * The job on site, as the office reads it (Phase L7) — the words and small decisions of the BOQ & progress,
 * Materials / Labour, Site diary and Variations tabs, without a DOM. **No money is worked out here**: earned value,
 * a line's value and a variation's total are the server's paisa, shown as they come; this file only says who may see
 * them and words the quantities.
 */

/** Earned value and a line's value are selling money: the API sends them to quotations:read / invoices:read only. */
export const seesEarnedValue = (can) => can('quotations:read') || can('invoices:read');

/** A quantity with its unit, without float noise: "120 kg", "7.5 days". */
export const qtyWithUnit = (qty, unit) => `${formatQty(qty)}${unit ? ` ${unit}` : ''}`;

/**
 * The OVER_PLAN warning in words (the issue dialog's toast): "Crystalline slurry: 130 kg issued to this job against
 * 120 kg planned." — or, on a job with a plan, a material it never planned.
 *
 * @param {{ name?: string|null, unit?: string|null, planned?: number, issued?: number }} warning
 */
export function overPlanText(warning) {
  const name = warning.name ?? 'This material';
  if (!Number(warning.planned)) return `${name} is not in this job’s plan — ${qtyWithUnit(warning.issued, warning.unit)} issued to it now.`;
  return `${name}: ${qtyWithUnit(warning.issued, warning.unit)} issued to this job against ${qtyWithUnit(warning.planned, warning.unit)} planned.`;
}

/**
 * The next running bill the progress calls for: "Earned value has passed <label> — raise the running bill" (L8 raises
 * it; until then the prompt links to the invoices). Null when no stage is due.
 *
 * @param {{ label: string, basisPoints?: number }|null|undefined} nextBill  the server's `nextBill`
 */
export function nextBillPrompt(nextBill) {
  if (!nextBill) return null;
  const share = nextBill.basisPoints ? ` (${formatShare(nextBill.basisPoints)})` : '';
  return `Earned value has passed ${nextBill.label}${share} — raise the running bill`;
}

/** A progress percentage as the tab writes it: whole, or up to two decimals (59.95% has not reached 60%). */
export const pctText = (pct) => `${Number((Number(pct) || 0).toFixed(2))}%`;

/**
 * How a trade's logged days compare with its plan: `over` past the plan, `done` at it, `under` below it, `unplanned`
 * when the plan has none. Days, not money.
 */
export function labourState({ plannedDays, loggedDays }) {
  const planned = Number(plannedDays) || 0;
  const logged = Number(loggedDays) || 0;
  if (!planned) return logged > 0 ? 'unplanned' : 'under';
  if (logged > planned + 1e-9) return 'over';
  if (Math.abs(logged - planned) <= 1e-9) return 'done';
  return 'under';
}

/** A diary day's crew in people: the sum of its headcount. */
export const diaryHeadcount = (day) => (day?.headcount ?? []).reduce((sum, h) => sum + (Number(h.count) || 0), 0);

/** A day as the office's diary lists it: "Mon, 28 Sept 2026", from a Kathmandu `YYYY-MM-DD`. */
export const diaryDayIso = (day) => `${day}T06:15:00.000Z`;
