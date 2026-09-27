import { z } from 'zod';
import { rupees } from './fields';
import { parseRupees } from '@/helpers/format';
import { boqRowBody, isBlankBoqRow, qtyOf, rateOf } from '@/helpers/boq';
import { isBlankMeasurement, measurementsBody, parseLength } from '@/helpers/measurements';
import { CONTRACT_TYPES, LOST_CATEGORIES, PAYMENT_TRIGGERS, SURVEY_ITEM_KINDS } from '@/config/constants';
import {
  formatShare, isBlankStage, parsePct, scheduleBody, scheduleTotal,
} from '@/helpers/paymentSchedule';

/**
 * Mirrors `quotationRow` / `quotationUpdateSchema` / `quotationPreviewSchema` and the approval bodies in
 * MaintainanceBackend/src/shared/schemas/crm.js (Phase L3). Rates and the discount are in **rupees** (the API
 * stores paisa and computes every amount, total and margin). A request never carries a cost.
 */

const optionalText = z.string().trim().max(20000).optional().or(z.literal('')).transform((v) => v || undefined);
const blank = (v) => v === undefined || v === null || String(v).trim() === '';
const issue = (ctx, path, message) => ctx.addIssue({ code: z.ZodIssueCode.custom, path, message });

/** A length as typed: a number or feet-inches (`12'6"`), 0 – 100,000. */
function checkLength(ctx, value, path) {
  if (blank(value)) return;
  const n = parseLength(value);
  if (!Number.isFinite(n)) issue(ctx, path, 'Use a number, or feet and inches like 12\'6"');
  else if (n < 0 || n > 100_000) issue(ctx, path, 'Between 0 and 100,000');
}

/** One measurement-book row, as typed (lengths may be feet-inches). A blank row is allowed and dropped. */
export const measurementRowSchema = z.object({
  area: z.string().max(80, 'At most 80 characters').optional().nullable(),
  description: z.string().max(200, 'At most 200 characters').optional().nullable(),
  nos: z.any().optional(),
  l: z.any().optional(),
  b: z.any().optional(),
  h: z.any().optional(),
  deduct: z.boolean().optional(),
}).passthrough().superRefine((row, ctx) => {
  if (isBlankMeasurement(row)) return;
  ['nos', 'l', 'b', 'h'].forEach((k) => checkLength(ctx, row[k], [k]));
});

/** A measurement sheet (≤ 200 rows) → the rows the API takes: numbers, blanks dropped. */
export const measurementSheetSchema = z.array(measurementRowSchema)
  .refine((rows) => rows.filter((r) => !isBlankMeasurement(r)).length <= 200, 'At most 200 measurements')
  .transform(measurementsBody);

/** The measurement drawer's form. */
export const measurementSheetFormSchema = z.object({ measurements: measurementSheetSchema });

/**
 * One BOQ row as the builder edits it: `rowType` ITEM | SECTION | NOTE, a description (a section's title, a
 * note's text), a rate in rupees, a quantity typed or measured. A row left empty is allowed here — the list
 * drops it — so an error's index is the row the grid shows.
 */
export const boqRowSchema = z.object({
  _key: z.string().optional(),
  id: z.string().optional().nullable(),
  rowType: z.enum(['ITEM', 'SECTION', 'NOTE']).default('ITEM'),
  description: z.string().max(500, 'At most 500 characters').optional().nullable(),
  spec: z.string().max(2000, 'At most 2000 characters').optional().nullable(),
  kind: z.enum(SURVEY_ITEM_KINDS).optional().nullable(),
  rateCardItemId: z.string().optional().nullable(),
  materialId: z.string().optional().nullable(),
  unit: z.string().max(20, 'At most 20 characters').optional().nullable(),
  qty: z.any().optional(),
  measurements: z.array(measurementRowSchema).optional().nullable(),
  wastagePct: z.any().optional(),
  rate: z.any().optional(),
  isOptional: z.boolean().optional(),
  isProvisional: z.boolean().optional(),
}).passthrough().superRefine((row, ctx) => {
  if (isBlankBoqRow(row)) return;
  const type = row.rowType ?? 'ITEM';
  if (blank(row.description)) {
    issue(ctx, ['description'], type === 'SECTION' ? 'Name the section' : type === 'NOTE' ? 'Write the note' : 'Describe the work');
  }
  if (type !== 'ITEM') return;
  const rate = rateOf(row.rate);
  if (rate === undefined) issue(ctx, ['rate'], 'Enter a rate');
  else if (!Number.isFinite(rate)) issue(ctx, ['rate'], 'Enter a rate in rupees');
  else if (rate > 1_000_000_000) issue(ctx, ['rate'], 'Too large');
  const measured = (row.measurements ?? []).filter((m) => !isBlankMeasurement(m));
  if (measured.length) {
    if (measured.length > 200) issue(ctx, ['measurements'], 'At most 200 measurements');
  } else {
    const qty = qtyOf(row.qty);
    if (qty === undefined) issue(ctx, ['qty'], 'Enter a quantity, or measure it');
    else if (!Number.isFinite(qty)) issue(ctx, ['qty'], 'Enter a number');
    else if (qty <= 0) issue(ctx, ['qty'], 'More than 0');
    else if (qty > 1_000_000) issue(ctx, ['qty'], 'Too large');
  }
  const waste = qtyOf(row.wastagePct);
  if (waste !== undefined && !(Number.isFinite(waste) && waste >= 0 && waste <= 100)) issue(ctx, ['wastagePct'], '0 to 100');
});

/** The rows → the request's rows: blanks dropped, rupees kept, measurements as numbers, no client keys or cost. */
export const boqRowsSchema = z.array(boqRowSchema)
  .refine((rows) => rows.filter((r) => !isBlankBoqRow(r)).length <= 500, 'At most 500 rows')
  .transform((rows) => rows.filter((r) => !isBlankBoqRow(r)).map(boqRowBody));

/**
 * One payment stage as the builder edits it (Phase L4): its words, its share **in %** and when it falls due. A row
 * left empty is allowed here — the list drops it — so an error's index is the grid's row.
 */
export const paymentStageRowSchema = z.object({
  _key: z.string().optional(),
  label: z.string().max(80, 'At most 80 characters').optional().nullable(),
  pct: z.any().optional(),
  trigger: z.enum(PAYMENT_TRIGGERS).optional().nullable(),
}).passthrough().superRefine((row, ctx) => {
  if (isBlankStage(row)) return;
  if (blank(row.label)) issue(ctx, ['label'], 'Name the stage');
  const pct = parsePct(row.pct);
  if (pct === undefined) issue(ctx, ['pct'], 'Enter its share in %');
  else if (!Number.isFinite(pct)) issue(ctx, ['pct'], 'Enter a number, e.g. 40');
  else if (pct < 0.01 || pct > 100) issue(ctx, ['pct'], 'Between 0.01 and 100');
  else if (Math.abs(pct * 100 - Math.round(pct * 100)) > 1e-6) issue(ctx, ['pct'], 'At most two decimals');
  if (!row.trigger) issue(ctx, ['trigger'], 'Say when it falls due');
});

/**
 * A quotation's payment schedule (L-D3) → the request's `paymentStages` (`{ label, basisPoints, trigger }`). Mirrors
 * the API's `paymentStages`: 1–10 stages making exactly 100 % (10000 basis points), at most one advance on
 * acceptance. No stages at all sends nothing — the API keeps the schedule it has.
 */
export const paymentScheduleSchema = z.array(paymentStageRowSchema).superRefine((rows, ctx) => {
  const stages = rows.filter((r) => !isBlankStage(r));
  if (!stages.length) return;
  if (stages.length > 10) issue(ctx, [], 'At most 10 stages');
  const { totalBp, readable } = scheduleTotal(stages);
  if (readable && totalBp !== 10000) issue(ctx, [], `The stages add up to ${formatShare(totalBp)} — they must make 100%`);
  if (stages.filter((r) => r.trigger === 'ON_ACCEPT').length > 1) issue(ctx, [], 'Only one stage can be the advance on acceptance');
}).transform((rows) => {
  const body = scheduleBody(rows);
  return body.length ? body : undefined;
});

/** The duration in days, as typed: blank is none (sent as null — the field is `nullable`). */
const estimatedDays = z.preprocess(
  (v) => (blank(v) || Number.isNaN(v) ? null : Number(v)),
  z.number({ invalid_type_error: 'Enter a number of days' }).positive('More than 0 days').max(3650, 'At most 3650 days').nullable().optional(),
);

/**
 * The builder's form: a draft's rows, the contract around them (Phase L4) and its terms. `PUT /admin/quotations/:id`.
 * A draft may have no rows yet. Mirrors `quotationUpdateSchema` (with the contract fields) in the API.
 */
export const quotationFormSchema = z.object({
  items: boqRowsSchema,
  discount: rupees.max(1_000_000_000).optional(),
  vatApplied: z.boolean(),
  validUntil: z.string().optional().nullable()
    .refine((v) => !v || new Date(v).getTime() > Date.now(), 'Choose a date in the future'),
  terms: optionalText,
  internalNote: optionalText,
  contractType: z.enum(CONTRACT_TYPES).optional(),
  estimatedDays,
  exclusions: z.string().trim().max(4000, 'At most 4000 characters').optional().or(z.literal('')).transform((v) => v || undefined),
  paymentStages: paymentScheduleSchema.optional(),
  showMeasurements: z.boolean().optional(),
  summaryOnly: z.boolean().optional(),
});

/** The row drawer's form: the row's words and flags. */
export const boqRowDetailsSchema = z.object({
  description: z.string().trim().min(1, 'Write something').max(500),
  spec: z.string().trim().max(2000).optional().or(z.literal('')).transform((v) => v || ''),
  kind: z.enum(SURVEY_ITEM_KINDS).optional().nullable(),
  isOptional: z.boolean().optional(),
  isProvisional: z.boolean().optional(),
});

/** The discount helpers: a percentage off, or the total (VAT included) the customer should pay. */
export const discountHelperSchema = z.object({
  pct: z.preprocess((v) => (blank(v) ? undefined : Number(v)), z.number({ invalid_type_error: 'A number' }).min(0).max(100).optional()),
  target: z.preprocess((v) => (blank(v) ? undefined : parseRupees(v) ?? Number.NaN), z.number({ invalid_type_error: 'Rupees' }).min(0).optional()),
});

/**
 * The approve dialog (Phase L4): an optional remark, and — when the margin is below the minimum or unknown — the
 * approver's explicit acknowledgement, which the API needs as `acknowledgeLowMargin: true` (else 422 LOW_MARGIN).
 * @param {boolean} acknowledge  whether the acknowledgement is asked for
 */
export const approveQuotationSchema = (acknowledge) => z.object({
  note: z.string().trim().max(1000, 'At most 1000 characters').optional().transform((v) => v || undefined),
  acknowledgeLowMargin: acknowledge
    ? z.boolean().refine((v) => v === true, 'Tick this to approve it anyway')
    : z.boolean().optional(),
});

/** Send back and pull back need a reason (3–1000); an approval's remark is optional. */
export const quotationNoteSchema = (required) => z.object({
  note: required
    ? z.string().trim().min(3, 'Say what needs to change').max(1000)
    : z.string().trim().max(1000).optional().transform((v) => v || undefined),
});

const CUSTOMER_MESSAGES = {
  tooShort: 'Tell us a little more (at least 5 characters)',
  tooLong: 'Please keep it under 1000 characters',
};

/**
 * The customer's answer on the link. Mirrors `quotationDecisionSchema`: a change request
 * says what to change (5–1000 characters); a decline reason is optional, and so is its
 * category (Phase L4: one of the lost-lead categories the page offers as chips). The page
 * passes its messages in the customer's language.
 * @param {{ tooShort?: string, tooLong?: string }} [messages]
 */
export const changeRequestSchema = (messages = {}) => {
  const m = { ...CUSTOMER_MESSAGES, ...messages };
  return z.object({ note: z.string().trim().min(5, m.tooShort).max(1000, m.tooLong) });
};
/** @param {{ tooLong?: string }} [messages] */
export const declineSchema = (messages = {}) => z.object({
  note: z.string().trim().max(1000, messages.tooLong ?? CUSTOMER_MESSAGES.tooLong).optional(),
  category: z.enum(LOST_CATEGORIES).optional().nullable(),
});
export const quotationChangeRequestSchema = changeRequestSchema();
export const quotationDeclineSchema = declineSchema();

/**
 * The New quotation sheet (Phase L3): where a quotation starts — a blank BOQ, a submitted survey (built on the
 * survey's review page), or a copy of another quotation. `needsConvert`: a lead that is not a customer yet, whose
 * convert makes the customer and the site first. `needsCustomer`: nothing fixes the customer (the quotations
 * list), so a blank one asks for it.
 * @param {{ needsConvert?: boolean, needsCustomer?: boolean }} [ctx]
 */
export const newQuotationSchema = ({ needsConvert = false, needsCustomer = false } = {}) => z.object({
  source: z.enum(['blank', 'survey', 'copy']),
  customerId: z.string().optional().nullable(),
  siteId: z.string().optional().nullable(),
  surveyId: z.string().optional().nullable(),
  fromQuotationId: z.string().optional().nullable(),
  label: z.string().trim().max(120).optional(),
  address: z.string().trim().max(400).optional(),
  area: z.string().trim().max(120).optional(),
}).superRefine((v, ctx) => {
  if (v.source === 'survey' && !v.surveyId) issue(ctx, ['surveyId'], 'Choose the survey');
  if (v.source === 'copy' && !v.fromQuotationId) issue(ctx, ['fromQuotationId'], 'Choose the quotation to copy');
  if (v.source === 'blank' && needsCustomer && !v.customerId) issue(ctx, ['customerId'], 'Choose the customer');
  if (needsConvert && v.source !== 'survey') {
    if (!v.label) issue(ctx, ['label'], 'Name the site');
    if (!v.address || v.address.length < 3) issue(ctx, ['address'], 'Where is the work?');
  }
});

const termsSortOrder = z.coerce.number().int().min(0).max(100000).default(0);

/**
 * The terms library (Phase L4) — `/admin/quotation-terms`. Mirrors `quotationTermsSchema` in the API's
 * shared/schemas/crm.js: a title, the English body (what a new quotation starts with when it is the default), an
 * optional Nepali body, and the default flag (setting it takes the flag from the others).
 */
export const quotationTermsSchema = z.object({
  title: z.string().trim().min(2, 'At least 2 characters').max(120, 'At most 120 characters'),
  body: z.string().trim().min(1, 'Write the terms').max(8000, 'At most 8000 characters'),
  bodyNe: z.string().trim().max(8000, 'At most 8000 characters').optional().nullable()
    .transform((v) => (v ? v : null)),
  isDefault: z.coerce.boolean().default(false),
  sortOrder: termsSortOrder,
  isActive: z.coerce.boolean().default(true),
});
