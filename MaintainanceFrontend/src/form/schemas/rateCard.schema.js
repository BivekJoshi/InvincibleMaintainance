import { z } from 'zod';
import { rupees } from './fields';
import { parseRupees } from '@/helpers/format';
import { isBlankRecipeRow } from '@/helpers/recipe';
import { RATE_MODES, RECIPE_COMPONENT_KINDS, UNITS } from '@/config/constants';

/**
 * The rate library (Phase L2). Mirrors `rateCardItemSchema`, `recipeComponent` and `tradeSchema` in
 * MaintainanceBackend/src/shared/schemas/crm.js — change both together. Money is in rupees (the API
 * stores paisa); codes are upper-cased on both sides, so the form shows the code the API will keep.
 */

const upperCode = z.string().trim().min(2).max(40).regex(/^[A-Za-z0-9_-]+$/, 'Use letters, numbers, dash or underscore')
  .transform((v) => v.toUpperCase());
const sortOrder = z.coerce.number().int().min(0).max(100000).default(0);
const isActive = z.coerce.boolean().default(true);

/** A recipe line's cost per unit, typed with grouping or `Rs.` as the money field accepts; blank is null. */
const lineCost = z.preprocess(
  (v) => (typeof v === 'string' ? (v.trim() === '' ? null : (parseRupees(v) ?? Number.NaN)) : v),
  z.number({ invalid_type_error: 'Enter an amount in rupees' }).min(0, 'Cannot be negative').max(1_000_000_000).nullable().optional(),
);

/** A blank optional number (`''`) is not a number. */
const optionalNumber = (schema) => z.preprocess((v) => (v === '' ? undefined : v), schema.optional());

/**
 * One recipe line. A material is measured in its own unit and a trade in man-days; equipment and other
 * costs say what they are and what one unit costs.
 */
export const recipeComponentSchema = z.object({
  kind: z.enum(RECIPE_COMPONENT_KINDS),
  materialId: z.string().min(1).nullable().optional(),
  tradeId: z.string().min(1).nullable().optional(),
  description: z.string().trim().max(200).nullable().optional(),
  qty: z.coerce.number({ invalid_type_error: 'Enter a quantity' }).positive('Enter a quantity above 0').max(1_000_000),
  wastagePct: optionalNumber(z.coerce.number().min(0, '0 to 100').max(100, '0 to 100')),
  cost: lineCost,
}).superRefine((c, ctx) => {
  const need = (path, message) => ctx.addIssue({ code: z.ZodIssueCode.custom, path: [path], message });
  if (c.kind === 'MATERIAL' && !c.materialId) need('materialId', 'Choose the material');
  if (c.kind === 'LABOUR' && !c.tradeId) need('tradeId', 'Choose the trade');
  if (c.kind === 'EQUIPMENT' || c.kind === 'OTHER') {
    if (!c.description) need('description', 'Say what it is');
    if (c.cost == null) need('cost', 'What does one unit cost?');
  }
});

export const rateCardItemSchema = z.object({
  code: upperCode,
  name: z.string().trim().min(2).max(200),
  description: z.string().trim().max(20000).optional().or(z.literal('')).transform((v) => v || undefined),
  category: z.string().trim().max(80).optional(),
  unit: z.enum(UNITS),
  rateMode: z.enum(RATE_MODES).default('MANUAL'),
  /** Required when MANUAL; a DERIVED item's rate is set from its recipe by the server. */
  rate: rupees.max(1_000_000_000).optional(),
  recipeQty: z.coerce.number({ invalid_type_error: 'Enter how many units the recipe makes' })
    .positive('More than 0').max(100_000).default(1),
  /** null = the settings default. */
  overheadPct: z.coerce.number().min(0).max(200, 'At most 200%').nullable().optional(),
  profitPct: z.coerce.number().min(0).max(500, 'At most 500%').nullable().optional(),
  roundTo: rupees.max(1_000_000_000).nullable().optional(),
  components: z.preprocess(
    (rows) => (Array.isArray(rows) ? rows.filter((r) => !isBlankRecipeRow(r)) : rows),
    z.array(recipeComponentSchema).max(40, 'At most 40 lines'),
  ).optional(),
  sortOrder,
  isActive,
}).superRefine((v, ctx) => {
  if (v.rateMode !== 'DERIVED' && v.rate == null) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['rate'], message: 'Enter the rate' });
  }
  if (v.rateMode === 'DERIVED' && !(v.components?.length > 0)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['components'], message: 'A rate from the recipe needs its recipe — add a line' });
  }
});

/** A trade and what a day of it costs (`/admin/trades`). No default wage: a form without the field sends none. */
export const tradeSchema = z.object({
  code: upperCode,
  name: z.string().trim().min(2).max(120),
  dayWage: rupees.max(1_000_000_000).optional(),
  sortOrder,
  isActive,
});
