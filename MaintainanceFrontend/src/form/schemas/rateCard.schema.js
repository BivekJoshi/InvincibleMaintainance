import { z } from 'zod';
import { rupees } from './fields';
import { UNITS } from '@/config/constants';

/**
 * Mirrors `rateCardItemSchema` in MaintainanceBackend/src/shared/schemas/crm.js. Money is in
 * rupees (the API stores paisa); the code is upper-cased on both sides, so the form shows
 * the code the API will keep.
 */
export const rateCardItemSchema = z.object({
  code: z.string().trim().min(2).max(40).regex(/^[A-Za-z0-9_-]+$/, 'Use letters, numbers, dash or underscore')
    .transform((v) => v.toUpperCase()),
  name: z.string().trim().min(2).max(200),
  description: z.string().trim().max(20000).optional().or(z.literal('')).transform((v) => v || undefined),
  category: z.string().trim().max(80).optional(),
  unit: z.enum(UNITS),
  rate: rupees.max(1_000_000_000),
  sortOrder: z.coerce.number().int().min(0).max(100000).default(0),
  isActive: z.coerce.boolean().default(true),
});
