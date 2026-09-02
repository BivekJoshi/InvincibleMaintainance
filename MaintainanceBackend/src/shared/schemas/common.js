import { z } from 'zod';
import { NEPAL_PHONE_RE } from '../../utils/phone.js';
import { LOCALES, UNITS } from '../enums.js';

export const id = z.string().min(1);
export const idParam = z.object({ id });
export const slugParam = z.object({ slug: z.string().min(1) });
export const tokenParam = z.object({ token: z.string().min(20) });

export const listQuery = z.object({
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  sort: z.string().optional(),
  q: z.string().trim().max(200).optional(),
  from: z.string().optional(),
  to: z.string().optional(),
  includeInactive: z.coerce.boolean().optional(),
  includeDeleted: z.coerce.boolean().optional(),
});

export const nepaliPhone = z
  .string()
  .trim()
  .transform((v) => v.replace(/[\s()]/g, '').replace(/^\+?977-?/, ''))
  .refine((v) => NEPAL_PHONE_RE.test(v), 'Enter a valid Nepali phone number (e.g. 9808338255 or 01-5407720)');

export const optionalPhone = z.union([nepaliPhone, z.literal('')]).optional().transform((v) => v || undefined);
export const email = z.string().trim().email('Enter a valid email address');
export const optionalEmail = z.union([email, z.literal('')]).optional().transform((v) => v || undefined);
export const optionalText = z.string().trim().max(20000).optional().or(z.literal('')).transform((v) => v || undefined);
export const url = z.string().trim().max(2000);
export const locale = z.enum(LOCALES);
export const unit = z.enum(UNITS);

/** Money is submitted in RUPEES from the UI and stored as integer paisa. */
export const rupees = z.coerce.number().min(0).max(1_000_000_000);
export const paisa = z.coerce.number().int().min(0);
export const optionalRupees = rupees.optional();

export const sortOrder = z.coerce.number().int().min(0).max(100000).default(0);
export const isActive = z.coerce.boolean().default(true);

export const reorderBody = z.object({
  items: z.array(z.object({ id, sortOrder: z.coerce.number().int().min(0) })).min(1).max(500),
});

export const seoFields = {
  metaTitle: z.string().trim().max(180).optional(),
  metaDescription: z.string().trim().max(400).optional(),
  ogImageId: z.string().optional(),
};

export const bullets = z.array(z.string().trim().min(1).max(500)).max(50).optional();
export const translations = z
  .record(z.string(), z.record(locale, z.string()))
  .optional()
  .describe('{ fieldName: { en: "...", ne: "..." } }');

/**
 * Returns a partial (all-optional) version of a schema, unwrapping `.refine()`
 * wrappers first. Refined schemas are ZodEffects and have no `.partial()`, so a
 * naive `schema.partial()` would make every PUT demand the full object.
 */
export function toPartial(schema) {
  let s = schema;
  while (s && typeof s.partial !== 'function' && typeof s.innerType === 'function') s = s.innerType();
  return s && typeof s.partial === 'function' ? s.partial() : schema;
}
