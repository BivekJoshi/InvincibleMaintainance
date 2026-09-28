/**
 * The hand-off from a won quotation to its job (Phase L6, decisions L-D3 and L-D4), without a DOM: the advance and
 * its gate as the office reads them, the ADVANCE_UNPAID refusal, and the Plan tab's crew calculator.
 *
 * The server decides the gate — `advance.awaitingAdvance` on `GET /admin/jobs/:id`, `awaitingAdvance` on a list row —
 * and answers 422 ADVANCE_UNPAID on schedule, assign, status (except CANCELLED and ON_HOLD) and complete. These only
 * say it before the dispatcher tries. No money is worked out here: amounts are the server's paisa, shown through
 * `helpers/format.js`. The crew calculator divides labour **days** by people — quantities, not money.
 */

/** Why a gated action is disabled (the job page's action bar). */
export const ADVANCE_LOCK_REASON = 'The advance is not paid yet';

/** A crew of this many when nobody is assigned yet. */
export const DEFAULT_CREW_SIZE = 2;

/**
 * Whether the job waits for its advance: the detail's `advance.awaitingAdvance`, or a list row's `awaitingAdvance`
 * (the jobs list, the dispatch board's cards, the unassigned queue).
 *
 * @param {object|null|undefined} job
 */
export function awaitingAdvanceOf(job) {
  if (!job) return false;
  if (typeof job.advance?.awaitingAdvance === 'boolean') return job.advance.awaitingAdvance;
  return Boolean(job.awaitingAdvance);
}

/**
 * The advance invoice a job waits for, as `{ id, number, status }` — from the detail (`advance.invoice`) or a list
 * row (`advanceInvoice`). Null when there is none.
 */
export function advanceInvoiceOf(job) {
  return job?.advance?.invoice ?? job?.advanceInvoice ?? null;
}

/**
 * The advance as the job page words it. Null when the job has no advance (its quotation had no ON_ACCEPT stage).
 *
 * - `awaiting`   — the gate holds: not paid, not overridden, the setting on
 * - `paid`       — the invoice is PAID
 * - `overridden` — a MANAGER or ADMIN let the job go ahead without it (`override.by`, `reason`, `at`)
 * - `void`       — the advance invoice was voided, so nothing holds the job
 * - `unpaid`     — owed, but the gate setting is off, so scheduling is not held
 *
 * @param {object|null|undefined} advance  `GET /admin/jobs/:id`'s `advance` (or the plan's)
 * @returns {{ kind: 'awaiting'|'paid'|'overridden'|'void'|'unpaid', title: string, tone: 'warning'|'success'|'info'|'muted' }|null}
 */
export function advanceState(advance) {
  if (!advance?.required) return null;
  if (advance.paid || advance.invoice?.status === 'PAID') {
    return { kind: 'paid', title: 'Advance paid — ready to schedule', tone: 'success' };
  }
  if (advance.overridden) {
    return { kind: 'overridden', title: 'Advance overridden — the job may go ahead unpaid', tone: 'info' };
  }
  if (advance.invoice?.status === 'VOID') {
    return { kind: 'void', title: 'The advance invoice was voided — nothing holds the job', tone: 'muted' };
  }
  if (advance.awaitingAdvance) {
    return { kind: 'awaiting', title: 'Waiting for the advance — scheduling is locked', tone: 'warning' };
  }
  return { kind: 'unpaid', title: 'Advance not paid yet — scheduling is not held (the gate is off)', tone: 'muted' };
}

/**
 * Whether this viewer may override the advance now: `jobs:advance-override` (MANAGER, ADMIN), and the gate holds. The
 * API answers 422 when no advance is required, it is paid or already overridden — the button is not offered then.
 *
 * @param {object|null|undefined} job
 * @param {(capability: string) => boolean} can
 */
export const canOverrideAdvance = (job, can) => Boolean(can('jobs:advance-override') && awaitingAdvanceOf(job));

/**
 * The 422 ADVANCE_UNPAID a gated action answers, as `{ message, invoiceId, invoiceNumber, balance }` (balance in
 * paisa) — or null for any other error.
 *
 * @param {unknown} err  what `unwrap()` threw
 */
export function advanceRefusal(err) {
  const error = err?.data?.error;
  if (error?.code !== 'ADVANCE_UNPAID') return null;
  const details = error.details && typeof error.details === 'object' && !Array.isArray(error.details) ? error.details : {};
  return {
    message: error.message || 'The advance is not paid yet.',
    invoiceId: details.invoiceId ?? null,
    invoiceNumber: details.invoiceNumber ?? null,
    balance: details.balance ?? null,
  };
}

/**
 * The crew calculator: how many days the work takes with `crewSize` people — the labour days divided by the crew,
 * **rounded up** to whole days. Rounded to six places first, so a sum like 12.000000000000002 labour days over a crew
 * of 2 is 6 days, not 7. 0 when there is no labour or no crew.
 *
 * @param {number|string} labourDays
 * @param {number|string} crewSize
 */
export function crewDays(labourDays, crewSize) {
  const days = Number(labourDays);
  const crew = Math.floor(Number(crewSize));
  if (!(days > 0) || !(crew >= 1)) return 0;
  return Math.ceil(Number((days / crew).toFixed(6)));
}

/** The crew the calculator starts from: the people assigned, or two when nobody is yet. */
export const defaultCrewSize = (plan) => (plan?.crew?.size > 0 ? plan.crew.size : DEFAULT_CREW_SIZE);

/**
 * The calculator's duration against the job's planned days (the quotation's estimate).
 *
 * @returns {{ tone: 'success'|'warning'|'muted', text: string }}
 */
export function crewVerdict(duration, plannedDays) {
  const planned = Number(plannedDays);
  if (!duration) return { tone: 'muted', text: 'No labour on the plan to divide.' };
  if (!(planned > 0)) return { tone: 'muted', text: 'The job has no planned days to compare with.' };
  const plan = `${formatQty(planned)} planned day${planned === 1 ? '' : 's'}`;
  if (duration <= planned) return { tone: 'success', text: `Fits the plan — ${duration} of ${plan}.` };
  const over = Number((duration - planned).toFixed(3));
  return { tone: 'warning', text: `${formatQty(over)} day${over === 1 ? '' : 's'} over the ${plan} — add people or move the end.` };
}

/**
 * A quantity as a site team reads it: Indian grouping, up to three decimals, no float noise (`1,234.5`, `0.333`).
 *
 * @param {number|string|null|undefined} qty
 */
export function formatQty(qty) {
  if (qty == null || qty === '') return '—';
  const n = Number(qty);
  if (!Number.isFinite(n)) return String(qty);
  return Number(n.toFixed(3)).toLocaleString('en-IN', { maximumFractionDigits: 3 });
}

/**
 * Where a schedule ends when it follows the job's plan: `plannedDays` days after the start — what the API does when
 * `scheduledEnd` is left out. Null without a start or a plan.
 *
 * @param {string|null|undefined} scheduledStart  UTC ISO
 * @param {number|null|undefined} plannedDays
 */
export function plannedEnd(scheduledStart, plannedDays) {
  const days = Number(plannedDays);
  if (!scheduledStart || !(days > 0)) return null;
  const start = new Date(scheduledStart).getTime();
  if (Number.isNaN(start)) return null;
  return new Date(start + Math.round(days * 86_400_000)).toISOString();
}
