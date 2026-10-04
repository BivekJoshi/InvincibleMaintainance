import { z } from 'zod';
import { id, listQuery, optionalText, unit } from './common.js';
import {
  INSPECTION_QUESTION_TYPES, PRIORITIES, SURVEY_ITEM_KINDS, SURVEY_METRICS, SURVEY_PHOTO_KINDS, SURVEY_STATUSES,
} from '../enums.js';
import { measurementRow, quotationRow } from './crm.js';

/**
 * The site survey is the one document in the system a field user writes.
 * Nothing here accepts a rate, an amount or any other money field — the surveyor
 * reports what and how much, and survey.service.js#priceSurvey attaches price at
 * review time from the rate card and material sell rates.
 *
 * `.strict()` on the line schemas is what enforces that: a client that posts
 * `rate` or `amount` is rejected, rather than having the field silently ignored.
 */

/** An inspection-template question's key: `moisture_pct`, `dpc_visible`. Unique within its template. */
export const questionKey = z.string().trim().regex(/^[a-z0-9_]{1,40}$/, 'Use a-z, 0-9 and underscore (up to 40)');

const reading = z.object({
  /** The template question this answers (Phase L5). The server computes `flagged` from its flag. */
  questionKey: questionKey.nullable().optional(),
  /** Accepted and ignored: `flagged` is the server's, worked out from the template (Phase L5). */
  flagged: z.any().optional(),
  label: z.string().trim().min(1, 'Say what was measured').max(200),
  metric: z.string().trim().min(1).max(60).default('observation'),
  value: z.coerce.number().finite().optional(),
  unit: z.string().trim().max(20).optional(),
  textValue: z.string().trim().max(2000).optional(),
  location: z.string().trim().max(200).optional(),
  mediaId: z.string().optional(),
  lat: z.coerce.number().min(-90).max(90).optional(),
  lng: z.coerce.number().min(-180).max(180).optional(),
  takenAt: z.coerce.date().optional(),
  sortOrder: z.coerce.number().int().min(0).max(10000).optional(),
})
  .strict()
  .refine(
    (r) => r.value !== undefined || (r.textValue && r.textValue.length > 0),
    { message: 'A reading needs either a measured value or an observation', path: ['value'] },
  );

const item = z.object({
  kind: z.enum(SURVEY_ITEM_KINDS).default('MATERIAL'),
  materialId: z.string().optional(),
  rateCardItemId: z.string().optional(),
  serviceId: z.string().optional(),
  description: z.string().trim().min(1, 'Describe the line').max(500),
  unit,
  /** With `measurements`, the server derives it (quantity.js#measurementQty) and this is only a fallback. */
  qty: z.coerce.number().positive('Quantity must be greater than zero').max(1_000_000).optional(),
  /** The measurement sheet (Phase L5): rows by room — nos × L × B × H, deductions subtract. */
  measurements: z.array(measurementRow).max(200).nullable().optional(),
  wastagePct: z.coerce.number().min(0).max(100).default(0),
  isOptional: z.coerce.boolean().default(false),
  note: z.string().trim().max(2000).optional(),
  sortOrder: z.coerce.number().int().min(0).max(10000).optional(),
}).strict().refine(
  (it) => it.qty !== undefined || it.measurements?.length,
  { message: 'Enter the quantity, or measure it', path: ['qty'] },
);

/** "Arrived": the phone's GPS fix, which becomes the site's pin (Phase L5). */
const sitePin = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
  /** Metres, as the phone reports it. Kept in the audit trail, not on the site. */
  accuracy: z.coerce.number().min(0).max(100_000).optional(),
}).strict();

const surveyFields = {
  problemSummary: optionalText,
  diagnosis: optionalText,
  recommendation: optionalText,
  accessNotes: optionalText,
  riskNotes: optionalText,
  areaValue: z.coerce.number().min(0).max(10_000_000).optional(),
  areaUnit: z.string().trim().max(20).optional(),
  estimatedDays: z.coerce.number().min(0).max(3650).optional(),
  urgency: z.enum(PRIORITIES).optional(),
};

/** PUT /tech/surveys/:id and the `survey_draft` sync kind — a full replace of readings and items. */
export const surveySaveSchema = z.object({
  ...surveyFields,
  readings: z.array(reading).max(200).optional(),
  items: z.array(item).max(200).optional(),
  sitePin: sitePin.optional(),
}).strict();

export const surveySubmitSchema = z.object({
  ...surveyFields,
  readings: z.array(reading).max(200).optional(),
  items: z.array(item).max(200).optional(),
  sitePin: sitePin.optional(),
  note: z.string().trim().max(2000).optional(),
}).strict();

/** The form fields sent with POST /tech/surveys/:id/photos (multipart). */
export const surveyPhotoFields = z.object({
  kind: z.enum(SURVEY_PHOTO_KINDS).default('ISSUE'),
  caption: z.string().trim().max(300).optional(),
  area: z.string().trim().max(80).optional(),
});

// ── inspection templates (Phase L5)

/** A form's empty number box arrives as '' — that is "no threshold", not zero. */
const threshold = z.preprocess((v) => (v === '' || v === null ? undefined : v), z.coerce.number().finite().optional());

/**
 * One checklist question. `flag` marks an answer the office must see first: a NUMBER above or below a
 * threshold, a YES_NO equal to `yes` or `no`, a CHOICE among `values`. A TEXT question is never flagged.
 * `required` blocks submit without an answer; `photoRequired` without a photo on the answer (its reading's
 * mediaId). `optionsNe` (Phase J1) words a CHOICE's options in Nepali for the surveyor's phone, one for each option in
 * the same order — display only: the answer recorded is still the option itself.
 */
export const inspectionQuestion = z.object({
  key: questionKey,
  label: z.string().trim().min(1, 'Write the question').max(200),
  labelNe: z.string().trim().max(200).nullable().optional(),
  type: z.enum(INSPECTION_QUESTION_TYPES),
  unit: z.string().trim().max(20).nullable().optional(),
  metric: z.string().trim().max(60).nullable().optional(),
  options: z.array(z.string().trim().min(1).max(80)).max(20).nullable().optional(),
  optionsNe: z.array(z.string().trim().min(1).max(80)).max(20).nullable().optional(),
  flag: z.object({
    above: threshold,
    below: threshold,
    equals: z.enum(['yes', 'no']).optional(),
    values: z.array(z.string().trim().min(1).max(80)).max(20).optional(),
  }).strict().nullable().optional(),
  required: z.coerce.boolean().default(false),
  photoRequired: z.coerce.boolean().default(false),
}).superRefine((q, ctx) => {
  const issue = (path, message) => ctx.addIssue({ code: z.ZodIssueCode.custom, path, message });
  if (q.type === 'CHOICE' && (q.options?.length ?? 0) < 2) issue(['options'], 'A choice needs at least two options');
  if (q.optionsNe?.length) {
    if (q.type !== 'CHOICE') issue(['optionsNe'], 'Only a choice has options to word in Nepali');
    else if (q.optionsNe.length !== (q.options?.length ?? 0)) issue(['optionsNe'], 'Give one Nepali word for each option, in the same order');
  }
  const f = q.flag ?? {};
  if ((f.above !== undefined || f.below !== undefined) && q.type !== 'NUMBER') issue(['flag'], 'Only a number is flagged above or below a value');
  if (f.above !== undefined && f.below !== undefined && f.below > f.above) issue(['flag', 'below'], 'Flag below cannot be higher than flag above');
  if (f.equals && q.type !== 'YES_NO') issue(['flag', 'equals'], 'Only a yes/no question is flagged on yes or no');
  if (f.values?.length) {
    if (q.type !== 'CHOICE') issue(['flag', 'values'], 'Only a choice is flagged on its options');
    else if (f.values.some((v) => !q.options?.includes(v))) issue(['flag', 'values'], 'Flag only options the question offers');
  }
});

export const inspectionQuestions = z.array(inspectionQuestion).min(1, 'Add at least one question').max(60)
  .superRefine((questions, ctx) => {
    const seen = new Set();
    questions.forEach((q, i) => {
      if (seen.has(q.key)) ctx.addIssue({ code: z.ZodIssueCode.custom, path: [i, 'key'], message: `The key "${q.key}" is used twice` });
      seen.add(q.key);
    });
  });

/** /admin/inspection-templates — a registry resource. `serviceId` null is the general checklist. */
export const inspectionTemplateSchema = z.object({
  serviceId: z.string().min(1).nullable().optional(),
  name: z.string().trim().min(1).max(120),
  questions: inspectionQuestions,
  isActive: z.coerce.boolean().default(true),
  sortOrder: z.coerce.number().int().min(0).default(0),
});

export const inspectionTemplateListQuery = listQuery.extend({
  serviceId: z.string().optional(),
}).passthrough();

export const surveyReviewSchema = z.object({
  status: z.enum(['IN_REVIEW', 'RETURNED']),
  note: z.string().trim().max(2000).optional(),
}).refine(
  (v) => v.status !== 'RETURNED' || (v.note && v.note.length > 0),
  { message: 'Say what the surveyor needs to add before sending it back', path: ['note'] },
);

/**
 * POST /admin/surveys/:id/quotation. Rates here are RUPEES, matching every other
 * quotation endpoint — quotation.service.js converts to paisa on the way in.
 * Omit `items` to accept the priced survey as-is.
 */
/**
 * Build a quotation from a survey. `items` are BOQ rows (crm.js#quotationRow, rupees) — kind, material,
 * wastage, optional and spec carried from the survey's lines; without SECTION rows the server groups them
 * by category. Left out, the server prices the survey's lines itself.
 */
export const surveyQuotationSchema = z.object({
  items: z.array(quotationRow).min(1).max(500).optional(),
  discount: z.coerce.number().min(0).max(1_000_000_000).optional(),
  vatApplied: z.coerce.boolean().optional(),
  validUntil: z.coerce.date().optional(),
  terms: optionalText,
  internalNote: optionalText,
  /** Kept for old clients: optional survey lines always become optional rows now (Phase L3). */
  includeOptional: z.coerce.boolean().optional(),
});

export const surveyCreateSchema = z.object({
  surveyorId: id.optional(),
}).strict();

export const surveyListQuery = listQuery.extend({
  /** One status, or several comma separated — a work queue such as `SUBMITTED,IN_REVIEW`. */
  status: z.string().optional()
    .transform((v) => (v ? v.split(',').map((x) => x.trim()).filter(Boolean) : undefined))
    .pipe(z.array(z.enum(SURVEY_STATUSES)).optional()),
  surveyorId: z.string().optional(),
  customerId: z.string().optional(),
});

export const SURVEY_METRIC_SUGGESTIONS = SURVEY_METRICS;
