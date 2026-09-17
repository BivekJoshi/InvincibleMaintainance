import { z } from 'zod';
import { rupees } from './fields';
import { parseRupees } from '@/helpers/format';

/**
 * Mirrors `quotationItem` / `quotationUpdateSchema` and the approval bodies in
 * MaintainanceBackend/src/shared/schemas/crm.js. Rates and the discount are in **rupees**
 * (the API stores paisa and computes every total).
 */

const optionalText = z.string().trim().max(20000).optional().or(z.literal('')).transform((v) => v || undefined);

export const quotationLineSchema = z.object({
  rateCardItemId: z.string().optional().nullable(),
  description: z.string().trim().min(1, 'Describe the work').max(500),
  unit: z.string().trim().max(20).optional(),
  qty: z.coerce.number({ invalid_type_error: 'Enter a quantity' }).min(0.01, 'At least 0.01').max(1_000_000),
  // Typed with grouping or a `Rs.` prefix, as the money field accepts.
  rate: z.preprocess(
    (v) => (typeof v === 'string' ? (parseRupees(v) ?? (v.trim() ? Number.NaN : undefined)) : v),
    z.number({ required_error: 'Enter a rate', invalid_type_error: 'Enter a rate in rupees' }).min(0, 'Cannot be negative').max(1_000_000_000),
  ),
  sortOrder: z.coerce.number().int().min(0).optional(),
});

/** A row the user added and left completely empty is not a line. */
const isBlankLine = (l) => !String(l?.description ?? '').trim() && !String(l?.rate ?? '').trim() && !l?.rateCardItemId;

/** The builder's form: a draft's lines and terms. `PUT /admin/quotations/:id`. */
export const quotationFormSchema = z.object({
  items: z.preprocess(
    (v) => (Array.isArray(v) ? v.filter((l) => !isBlankLine(l)).map((l, i) => ({ ...l, sortOrder: i })) : v),
    z.array(quotationLineSchema).min(1, 'Add at least one line').max(200),
  ),
  discount: rupees.max(1_000_000_000).optional(),
  vatApplied: z.boolean(),
  validUntil: z.string().optional().nullable()
    .refine((v) => !v || new Date(v).getTime() > Date.now(), 'Choose a date in the future'),
  terms: optionalText,
  internalNote: optionalText,
});

/** Send back and pull back need a reason (3–1000); an approval's remark is optional. */
export const quotationNoteSchema = (required) => z.object({
  note: required
    ? z.string().trim().min(3, 'Say what needs to change').max(1000)
    : z.string().trim().max(1000).optional().transform((v) => v || undefined),
});

/**
 * The customer's answer on the link. Mirrors `quotationDecisionSchema`: a change request
 * says what to change (5–1000 characters); a decline reason is optional.
 */
export const quotationChangeRequestSchema = z.object({
  note: z.string().trim().min(5, 'Tell us a little more (at least 5 characters)').max(1000, 'Please keep it under 1000 characters'),
});
export const quotationDeclineSchema = z.object({
  note: z.string().trim().max(1000, 'Please keep it under 1000 characters').optional(),
});
