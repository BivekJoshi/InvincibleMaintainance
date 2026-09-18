import { z } from 'zod';
import { id, listQuery, optionalText, unit } from './common.js';
import { PRIORITIES, SURVEY_ITEM_KINDS, SURVEY_METRICS, SURVEY_STATUSES } from '../enums.js';

/**
 * The site survey is the one document in the system a field user writes.
 * Nothing here accepts a rate, an amount or any other money field — the surveyor
 * reports what and how much, and survey.service.js#priceSurvey attaches price at
 * review time from the rate card and material sell rates.
 *
 * `.strict()` on the line schemas is what enforces that: a client that posts
 * `rate` or `amount` is rejected, rather than having the field silently ignored.
 */

const reading = z.object({
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
  qty: z.coerce.number().positive('Quantity must be greater than zero').max(1_000_000),
  wastagePct: z.coerce.number().min(0).max(100).default(0),
  isOptional: z.coerce.boolean().default(false),
  note: z.string().trim().max(2000).optional(),
  sortOrder: z.coerce.number().int().min(0).max(10000).optional(),
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

/** PUT /tech/surveys/:id — a full replace of readings and items. */
export const surveySaveSchema = z.object({
  ...surveyFields,
  readings: z.array(reading).max(200).optional(),
  items: z.array(item).max(200).optional(),
}).strict();

export const surveySubmitSchema = z.object({
  ...surveyFields,
  readings: z.array(reading).max(200).optional(),
  items: z.array(item).max(200).optional(),
  note: z.string().trim().max(2000).optional(),
}).strict();

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
export const surveyQuotationSchema = z.object({
  items: z.array(z.object({
    rateCardItemId: z.string().nullish(),
    description: z.string().trim().min(1).max(500),
    unit: z.string().trim().max(20).optional(),
    qty: z.coerce.number().positive().max(1_000_000),
    rate: z.coerce.number().min(0).max(1_000_000_000),
    sortOrder: z.coerce.number().int().min(0).max(10000).optional(),
  })).min(1).max(200).optional(),
  discount: z.coerce.number().min(0).max(1_000_000_000).optional(),
  vatApplied: z.coerce.boolean().optional(),
  validUntil: z.coerce.date().optional(),
  terms: optionalText,
  internalNote: optionalText,
  includeOptional: z.coerce.boolean().default(false),
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
