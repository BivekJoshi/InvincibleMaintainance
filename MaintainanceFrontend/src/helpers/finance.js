import { formatNpr, kathmanduDay } from '@/helpers/format';
import { bsToAd, fiscalYear } from '@/helpers/nepaliDate';
import { INVOICE_KIND_LABELS } from '@/config/constants';

/**
 * The finance screens without a DOM (Phase I). Pure; every figure these read is the server's — nothing here adds,
 * multiplies or works out VAT.
 */

const DAY = 86_400_000;

/** What an invoice can take a payment in: sent and not settled or void (the API refuses the rest). */
export const PAYABLE_STATUSES = ['SENT', 'PARTIAL', 'OVERDUE'];

/** The payments that still count — a voided one stays in the list, struck through, and counts for nothing. */
export const standingPayments = (invoice) => (invoice?.payments ?? []).filter((p) => !p.voidedAt);

/**
 * What an invoice's state allows, for the detail page's action bar — each with why it is off when it is shown but
 * cannot be used. The API is the authority; this only saves a refused click.
 *
 * @param {object} invoice  the API's invoice (`status`, `total`, `balance`, `payments`)
 * @param {{ can: (capability: string) => boolean }} who
 * @returns {{ key: 'edit'|'send'|'recordPayment'|'void', label: string, disabledReason?: string }[]}
 */
export function invoiceActions(invoice, { can }) {
  if (!invoice) return [];
  const { status } = invoice;
  const actions = [];
  const write = can('invoices:write');
  if (write && status === 'DRAFT') {
    actions.push({ key: 'edit', label: 'Edit' });
    actions.push({
      key: 'send',
      label: 'Send to customer',
      ...(invoice.total > 0 ? {} : { disabledReason: 'Price the lines first — the total is Rs. 0.00.' }),
    });
  }
  if (can('payments:write') && PAYABLE_STATUSES.includes(status)) {
    actions.push({
      key: 'recordPayment',
      label: 'Record payment',
      ...(invoice.balance > 0 ? {} : { disabledReason: 'Nothing is owed on this invoice.' }),
    });
  }
  if (write && status !== 'VOID') {
    actions.push({
      key: 'void',
      label: 'Void invoice',
      ...(standingPayments(invoice).length
        ? { disabledReason: 'It has payments against it — void those first.' }
        : {}),
    });
  }
  return actions;
}

/**
 * Whether a draft's lines, discount and VAT are fixed (Phase L6): a stage or closing bill — any `kind` but STANDARD —
 * bills what the quotation and its stage bills say; `PUT` takes only its due date, note and terms (422
 * INVOICE_LINES_LOCKED otherwise). An invoice from before L6 has no kind and is a STANDARD one.
 */
export const invoiceLinesLocked = (invoice) => Boolean(invoice?.kind) && invoice.kind !== 'STANDARD';

/** Whether the edit controls are shown: a DRAFT only, to `invoices:write` (the API answers 422 INVOICE_LOCKED otherwise). */
export const canEditInvoice = (invoice, { can }) => Boolean(invoice) && invoice.status === 'DRAFT' && can('invoices:write');

/**
 * How a finished job will be billed — the API's one rule (defect #16): a quoted job bills **its quotation**, an
 * unquoted one **what it used** (billable materials at their issued rate, and logged labour).
 *
 * Phase L6: a quoted job whose advance was billed gets a **final** bill — the quotation less the advance (the
 * server's "Less: advance INV-…" line), never the whole again. The detail says so by the advance's number; the
 * amount is the server's once the draft exists.
 *
 * @param {{ quotation?: { number: string, total: number }|null, advanceInvoice?: { number: string, status: string }|null }} job
 *   a row of `GET /admin/jobs`
 */
export function billingRuleOf(job) {
  if (job?.quotation) {
    const advance = job.advanceInvoice && !['DRAFT', 'VOID'].includes(job.advanceInvoice.status) ? job.advanceInvoice : null;
    const accepted = job.quotation.total != null ? `${formatNpr(job.quotation.total)} as accepted` : 'as accepted';
    return {
      kind: 'quotation',
      label: `Bills quotation ${job.quotation.number}`,
      detail: advance ? `${accepted}, less the advance ${advance.number}` : accepted,
    };
  }
  return { kind: 'actuals', label: 'Bills what it used', detail: 'Billable materials and logged labour' };
}

/** Kathmandu's calendar day `n` days before `now` (`n = 0` is today). */
export const kathmanduDaysAgo = (n, now = Date.now()) => kathmanduDay(new Date(now - n * DAY).toISOString());

/** The reports' default range: the last 30 Kathmandu days, today included — what the API assumes without one. */
export const defaultReportRange = (now = Date.now()) => ({ from: kathmanduDaysAgo(29, now), to: kathmanduDaysAgo(0, now) });

/**
 * The date-range presets over a report, as Kathmandu days. "This fiscal year" starts on Shrawan 1 of the BS year
 * today falls in (the fiscal year turns there — 17 July 2026 for FY 2083/84), through today.
 *
 * @param {number} [now]
 * @returns {{ key: string, label: string, from: string, to: string }[]}
 */
export function reportRangePresets(now = Date.now()) {
  const today = kathmanduDaysAgo(0, now);
  const fy = fiscalYear(new Date(`${today}T00:00:00.000Z`));
  const fyStart = bsToAd(fy, 4, 1).toISOString().slice(0, 10);
  return [
    { key: '30d', label: 'Last 30 days', from: kathmanduDaysAgo(29, now), to: today },
    { key: '90d', label: 'Last 90 days', from: kathmanduDaysAgo(89, now), to: today },
    { key: 'fy', label: `This fiscal year (${fy}/${String((fy + 1) % 100).padStart(2, '0')})`, from: fyStart, to: today },
  ];
}

/**
 * The file name a CSV download is saved under: the API's `Content-Disposition` name when it sends one, else
 * `<name>-<from>-<to>.csv`.
 *
 * @param {string|null|undefined} disposition
 * @param {string} name
 * @param {{ from?: string, to?: string }} [range]
 */
export function csvFileName(disposition, name, { from, to } = {}) {
  const star = /filename\*=UTF-8''([^;]+)/i.exec(disposition ?? '');
  if (star) {
    try { return decodeURIComponent(star[1]); } catch { /* fall through */ }
  }
  const plain = /filename="?([^";]+)"?/i.exec(disposition ?? '');
  if (plain) return plain[1];
  return `${[name, from, to].filter(Boolean).join('-')}.csv`;
}

/** When a stage falls due, in the words under an invoice's number. */
const STAGE_WHEN = { ON_ACCEPT: 'on acceptance', MILESTONE: 'at a milestone', ON_COMPLETION: 'on completion' };

/**
 * The payment stage an invoice bills, as one line (Phase L6): "Advance — on acceptance (50%)", "Advance — Mobilisation
 * (40%)", "Running bill — Running bill 1 (30%)". The stage's own label is left out when it only repeats the kind (the
 * default schedule's first stage is called "Advance"). The share is the stage's basis points as a percentage — a
 * share, not money. Null for an ordinary invoice.
 *
 * @param {{ kind?: string, paymentStage?: { label?: string, basisPoints?: number, trigger?: string }|null }} invoice
 * @returns {string|null}
 */
export function invoiceStageLine(invoice) {
  const stage = invoice?.paymentStage ?? null;
  const kind = invoice?.kind && invoice.kind !== 'STANDARD' ? invoice.kind : null;
  if (!stage && !kind) return null;
  const heading = INVOICE_KIND_LABELS[kind] ?? 'Payment stage';
  const own = stage?.label?.trim();
  const label = own && own.toLowerCase() !== heading.toLowerCase()
    ? own
    : STAGE_WHEN[stage?.trigger ?? (kind === 'ADVANCE' ? 'ON_ACCEPT' : '')] ?? null;
  const share = stage?.basisPoints != null ? ` (${Number((stage.basisPoints / 100).toFixed(2))}%)` : '';
  return label ? `${heading} — ${label}${share}` : `${heading}${share}`;
}
