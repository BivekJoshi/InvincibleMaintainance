/**
 * Close-out without a DOM (Phase L8): which job lines the contract measures, where the final measurement stands, what
 * the running and final bills allow, and the API's refusals in words. Quantities and states only — every amount on
 * these screens is the server's, and nothing here adds one up.
 */

/** A job's contract type — the accepted quotation's (`LUMP_SUM` | `ITEM_RATE`), or null when the job has none. */
export const contractTypeOf = (job) => job?.quotation?.contractType ?? null;

/** An omission (a variation's negative line) keeps its quoted quantity: it is never measured (422 LINE_NOT_MEASURED). */
export const isOmission = (line) => Number(line?.quotedQty) < 0;

/** Whether a line has the server's measured quantity. */
export const isMeasured = (line) => line?.measuredQty !== null && line?.measuredQty !== undefined;

/**
 * Whether the contract bills this line at its measured quantity — the API's rule for closing the measurement: an
 * ITEM_RATE job measures every line but an omission; a LUMP_SUM job only its provisional lines.
 *
 * @param {{ quotedQty: number, isProvisional?: boolean }} line
 * @param {'LUMP_SUM'|'ITEM_RATE'|null} contractType
 */
export function mustMeasure(line, contractType) {
  if (!line || isOmission(line)) return false;
  return contractType === 'ITEM_RATE' || Boolean(line.isProvisional);
}

/**
 * Where a job's final measurement stands: closed (when, by whom), how many of the lines the contract measures have
 * the server's quantity, and those still to measure — the API decides on close (422 MEASUREMENT_INCOMPLETE).
 *
 * @param {object} job  `GET /admin/jobs/:id` (or `/tech/jobs/:id`) — `lines`, `quotation.contractType`,
 *   `measurementClosedAt`, `measurementClosedBy`
 */
export function measurementState(job) {
  const contractType = contractTypeOf(job);
  const lines = job?.lines ?? [];
  const required = lines.filter((l) => mustMeasure(l, contractType));
  return {
    contractType,
    closed: Boolean(job?.measurementClosedAt),
    closedAt: job?.measurementClosedAt ?? null,
    closedBy: job?.measurementClosedBy?.name ?? null,
    required: required.length,
    measured: required.filter(isMeasured).length,
    missing: required.filter((l) => !isMeasured(l)),
  };
}

/**
 * Why a line cannot be measured now, or null when it can (the API: 422 MEASUREMENT_CLOSED, 422 LINE_NOT_MEASURED).
 * @param {object} line
 * @param {{ closed: boolean }} state  `measurementState(job)`
 */
export function measureLock(line, state) {
  if (isOmission(line)) return 'An omission keeps its quoted quantity — it is not measured.';
  if (state?.closed) return 'The measurement is closed. Reopen it to change a quantity.';
  return null;
}

/** An API refusal as `{ status, code, message, details }` (RTK Query's `error`), or null for none. */
export function apiRefusal(err) {
  if (!err) return null;
  const e = err?.data?.error ?? {};
  return {
    status: err.status ?? null,
    code: e.code ?? null,
    message: e.message ?? 'Please try again.',
    details: Array.isArray(e.details) ? e.details : [],
  };
}

/**
 * Whether a payment stage may be raised as a running bill from the office (L-D3): a MILESTONE stage no live invoice has
 * taken. The advance comes with the Accept, and ON_COMPLETION with the final bill (422 STAGE_NOT_MILESTONE).
 * @param {{ trigger: string, billed: boolean }} stage  a row of `GET /admin/jobs/:id/progress`'s `stages`
 */
export const stageRaisable = (stage) => stage?.trigger === 'MILESTONE' && !stage.billed;

/** Job states the final bill may be raised in — the API bills only finished work. */
const FINISHED = ['COMPLETED', 'VERIFIED'];

/**
 * The job page's "Raise final bill…" — shown to `invoices:write` on a BOQ job; off, with why, until the job is finished,
 * and once the job has been invoiced.
 *
 * @param {object} job
 * @param {(capability: string) => boolean} can
 * @returns {{ show: boolean, disabledReason?: string }}
 */
export function finalBillAction(job, can) {
  if (!job || !can?.('invoices:write') || !(job.lines?.length > 0)) return { show: false };
  if (job.invoicedAt) return { show: true, disabledReason: 'The final bill has been raised.' };
  if (!FINISHED.includes(job.status)) return { show: true, disabledReason: 'Complete the job first — the final bill follows the handover.' };
  if (!job.isBillable && job.isBillable !== undefined) return { show: true, disabledReason: 'This job is marked non-billable.' };
  return { show: true };
}

/** Words for a blocking reason of the final bill's preview, when the server sends only its code. */
export const FINAL_BILL_BLOCKING = {
  MEASUREMENT_INCOMPLETE: 'The measurement is not finished.',
  FINAL_BELOW_BILLED: 'The stage bills already come to more than the final contract. A credit note would be needed, and those are not supported yet.',
  FINAL_ALREADY_BILLED: 'This job already has its final bill.',
};
