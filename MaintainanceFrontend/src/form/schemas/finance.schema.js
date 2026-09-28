import { z } from 'zod';
import { optionalText, rupees } from './fields';
import { PAYMENT_METHODS } from '@/config/constants';
import { formatNpr, rupeesToPaisa } from '@/helpers/format';
import { isBlankBoqRow, qtyOf, rateOf } from '@/helpers/boq';

/**
 * Mirrors the finance bodies in MaintainanceBackend/src/shared/schemas/ops.js — `invoiceItem`, `invoiceSchema`,
 * `invoiceUpdateSchema`, `invoiceFromJobSchema`, `paymentSchema`, the void reasons and `expenseSchema` (Phase I).
 * Change both together. Money is **rupees** here, as the requests carry it; the API stores paisa and works out
 * every amount, total, VAT and balance.
 */

const blank = (v) => v === undefined || v === null || String(v).trim() === '';
const issue = (ctx, path, message) => ctx.addIssue({ code: z.ZodIssueCode.custom, path, message });
const MAX_RUPEES = 1_000_000_000;
/** An optional date or time (UTC ISO from the date fields); cleared is left out, never sent as null (1970 to the API). */
const optionalInstant = z.string().optional().nullable().transform((v) => v || undefined);

/** Money in rupees, 0 – 1,00,00,00,000 (the API's `rupees`). */
const amount = rupees.max(MAX_RUPEES, 'Too large');

/**
 * One invoice line as the `lineItems` field edits it (the `invoice` variant: description, unit, qty, rate in
 * rupees; `jobId` rides along when the line bills a job). A row left empty is allowed — the list drops it — so an
 * error's index is the row the grid shows.
 */
export const invoiceLineRowSchema = z.object({
  _key: z.string().optional(),
  id: z.string().optional().nullable(),
  description: z.string().max(500, 'At most 500 characters').optional().nullable(),
  unit: z.string().max(20, 'At most 20 characters').optional().nullable(),
  qty: z.any().optional(),
  rate: z.any().optional(),
  jobId: z.string().optional().nullable(),
}).passthrough().superRefine((row, ctx) => {
  if (isBlankBoqRow(row)) return;
  if (blank(row.description)) issue(ctx, ['description'], 'Describe the line');
  const qty = qtyOf(row.qty);
  if (qty === undefined) issue(ctx, ['qty'], 'Enter a quantity');
  else if (!Number.isFinite(qty)) issue(ctx, ['qty'], 'Enter a number');
  else if (qty < 0.01) issue(ctx, ['qty'], 'At least 0.01');
  else if (qty > 1_000_000) issue(ctx, ['qty'], 'Too large');
  const rate = rateOf(row.rate);
  if (rate === undefined) issue(ctx, ['rate'], 'Enter a rate');
  else if (!Number.isFinite(rate)) issue(ctx, ['rate'], 'Enter a rate in rupees');
  else if (rate < 0) issue(ctx, ['rate'], 'Cannot be negative');
  else if (rate > MAX_RUPEES) issue(ctx, ['rate'], 'Too large');
});

/** A line as the request carries it: rupees kept, no client key. */
export function invoiceLineBody(row) {
  const unit = String(row.unit ?? '').trim();
  return {
    description: String(row.description ?? '').trim(),
    ...(unit ? { unit } : {}),
    qty: qtyOf(row.qty),
    rate: rateOf(row.rate),
    ...(row.jobId ? { jobId: row.jobId } : {}),
  };
}

/** The rows → the request's `items`: blanks dropped, 1 – 200 lines (the API's bounds). */
export const invoiceLinesSchema = z.array(invoiceLineRowSchema)
  .refine((rows) => rows.some((r) => !isBlankBoqRow(r)), 'Add at least one line')
  .refine((rows) => rows.filter((r) => !isBlankBoqRow(r)).length <= 200, 'At most 200 lines')
  .transform((rows) => rows.filter((r) => !isBlankBoqRow(r)).map(invoiceLineBody));

/** What a DRAFT's edit form sends — `PUT /admin/invoices/:id` (the API's `invoiceUpdateSchema`). */
export const invoiceEditSchema = z.object({
  items: invoiceLinesSchema,
  discount: amount.optional(),
  vatApplied: z.boolean(),
  dueDate: optionalInstant,
  note: optionalText,
  terms: optionalText,
});

/**
 * A stage or closing bill's draft (Phase L6, `kind` ADVANCE, RUNNING or FINAL): its lines, discount and VAT are locked
 * — the API answers 422 INVOICE_LINES_LOCKED to any of them — so the form sends only the header.
 */
export const invoiceHeaderEditSchema = invoiceEditSchema.pick({ dueDate: true, note: true, terms: true });

/** The manual invoice — `POST /admin/invoices` (`invoiceSchema`): the same, for a customer. */
export const invoiceCreateSchema = invoiceEditSchema.extend({
  customerId: z.string({ required_error: 'Pick the customer' }).min(1, 'Pick the customer'),
});

/**
 * `POST /admin/invoices/from-job/:jobId` (`invoiceFromJobSchema`). `includeMaterials` / `includeLabour` belong to an
 * unquoted job only — the sheet leaves them out for a quoted one (the API answers 422 QUOTED_JOB_BILLS_SCOPE).
 */
export const invoiceFromJobFormSchema = z.object({
  dueDate: optionalInstant,
  includeMaterials: z.boolean().optional(),
  includeLabour: z.boolean().optional(),
  vatApplied: z.boolean().optional(),
  discount: amount.optional(),
});

/** A reason, 3 – 500 characters — voiding an invoice or a payment. */
export const voidReasonSchema = z.object({
  reason: z.string().trim().min(3, 'Say why, in a few words').max(500, 'At most 500 characters'),
});

/**
 * A payment (`paymentSchema`): more than zero and **no more than the balance** — the server's `balance`, in paisa,
 * the one check the UI makes against a figure (the API answers 400 for more). The amount is typed in rupees and
 * compared in paisa, so Rs. 1,000.10 against a balance of 1,00,010 paisa is exact.
 *
 * @param {number} balance  paisa, from the invoice the server sent
 */
export function paymentFormSchema(balance) {
  const owed = Math.max(0, Number(balance) || 0);
  return z.object({
    amount: amount
      .refine((v) => v > 0, 'More than zero')
      .refine((v) => rupeesToPaisa(v) <= owed, `No more than the balance, ${formatNpr(owed)}`),
    method: z.enum(PAYMENT_METHODS, { errorMap: () => ({ message: 'How was it paid?' }) }),
    reference: z.string().trim().max(120, 'At most 120 characters').optional().or(z.literal('')).transform((v) => v || undefined),
    receivedAt: optionalInstant,
    note: optionalText,
  });
}

/** An expense (a registry resource, `expenseSchema`). `approvedBy` is the server's: whoever records it. */
export const expenseSchema = z.object({
  category: z.string().trim().min(2, 'At least 2 characters').max(80, 'At most 80 characters'),
  amount,
  jobId: z.string().optional().nullable(),
  vendor: z.string().trim().max(160, 'At most 160 characters').optional().nullable(),
  billMediaId: z.string().optional().nullable(),
  spentAt: optionalInstant,
  note: optionalText,
});
