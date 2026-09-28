import { z } from 'zod';
import { optionalEmail, optionalPhone, optionalText, rupees } from './fields';
import { MANUAL_STOCK_MOVEMENTS, UNITS } from '@/config/constants';

/**
 * The operations registry resources and the stock movement form. Mirrors
 * MaintainanceBackend/src/shared/schemas/ops.js — change both together. Money is in rupees
 * (the API stores paisa).
 */

const sortOrder = z.coerce.number().int().min(0).max(100000).default(0);
const isActive = z.coerce.boolean().default(true);
const optionalId = z.string().optional().nullable();
const list = (max, itemMax) => z.array(z.string().trim().max(itemMax)).max(max).optional();

export const technicianSchema = z.object({
  userId: z.string({ required_error: 'Choose the person' }).min(1, 'Choose the person'),
  employeeCode: z.string().trim().max(30).optional(),
  skills: list(40, 60),
  certifications: list(40, 120),
  serviceAreas: list(60, 80),
  hourlyRate: rupees.max(1_000_000_000).optional(),
  dailyCapacity: z.coerce.number().int().min(1, 'At least one job a day').max(20, 'At most 20 jobs a day').default(4),
  isAvailable: z.coerce.boolean().default(true),
});

/** A checklist line; a row left blank is dropped before validation, as the objectList field drops it on save. */
const templateTask = z.object({
  title: z.string().trim().min(2, 'Give the step a title').max(300),
  description: z.string().trim().max(1000).optional().or(z.literal('')).transform((v) => v || undefined),
});

export const jobTemplateSchema = z.object({
  serviceId: optionalId,
  name: z.string().trim().min(2).max(200),
  description: optionalText,
  tasks: z.preprocess(
    (rows) => (Array.isArray(rows) ? rows.filter((r) => String(r?.title ?? '').trim() || String(r?.description ?? '').trim()) : rows),
    z.array(templateTask).min(1, 'Add at least one step').max(100),
  ),
  isActive,
});

export const materialSchema = z.object({
  categoryId: optionalId,
  supplierId: optionalId,
  code: z.string().trim().min(2).max(40).regex(/^[A-Za-z0-9_-]+$/, 'Use letters, numbers, dash or underscore'),
  name: z.string().trim().min(2).max(200),
  unit: z.enum(UNITS),
  purchaseRate: rupees.max(1_000_000_000).default(0),
  sellRate: rupees.max(1_000_000_000).default(0),
  /** How it is bought: 50 (kg) a bag, or 1 when the unit already is the pack (Phase L2). Blank clears it. */
  packSize: z.coerce.number().positive('More than 0').max(100_000).nullable().optional(),
  packLabel: z.string().trim().max(20).nullable().optional(),
  reorderLevel: z.coerce.number().min(0).max(1_000_000).default(0),
  sortOrder,
  isActive,
});

export const materialCategorySchema = z.object({
  name: z.string().trim().min(2).max(120),
  sortOrder,
  isActive,
});

export const supplierSchema = z.object({
  name: z.string().trim().min(2).max(160),
  phone: optionalPhone,
  email: optionalEmail,
  address: z.string().trim().max(400).optional(),
  notes: optionalText,
  isActive,
});

/**
 * "Record movement". Stock goes to a job only from the job, so ISSUE_TO_JOB is not offered. An
 * adjustment carries its own sign (−3 counts three missing); every other kind is a quantity.
 */
export const stockMovementSchema = z.object({
  materialId: z.string({ required_error: 'Choose the material' }).min(1, 'Choose the material'),
  type: z.enum(MANUAL_STOCK_MOVEMENTS),
  qty: z.coerce.number().min(-1_000_000).max(1_000_000).refine((v) => v !== 0, 'Quantity cannot be zero'),
  rate: rupees.max(1_000_000_000).optional(),
  reference: z.string().trim().max(120).optional(),
  note: optionalText,
}).refine((v) => v.type === 'ADJUSTMENT' || v.qty > 0, {
  message: 'Enter how much — only an adjustment can be negative', path: ['qty'],
});

// ── purchase lists (Phase L7) — mirrors `purchaseListSchema`, `purchaseReceiveSchema` and `purchaseCancelSchema`

const blankText = (v) => v === undefined || v === null || String(v).trim() === '';
/** A number as a grid cell holds it (a number, or the text typed) → a number; blank → undefined; unreadable → NaN. */
const gridNumber = (v) => {
  if (typeof v === 'number') return v;
  if (blankText(v)) return undefined;
  const cleaned = String(v).replace(/,/g, '').trim();
  return /^-?(\d+\.?\d*|\.\d+)$/.test(cleaned) ? Number(cleaned) : Number.NaN;
};
/** An item row the list's grid added and left empty. */
export const isBlankPurchaseItem = (row) => !row?.materialId && blankText(row?.qty) && blankText(row?.packs) && blankText(row?.note);

/**
 * One item as the grid edits it (the API's row: `material`, `receivedQty`, `id` ride along) → the request's
 * `{ materialId, qty, packs?, note? }`. The quantity is in the material's own unit; packs are the whole packs it is
 * bought in, when it has a pack.
 */
export const purchaseListItemSchema = z.object({
  materialId: z.string({ required_error: 'Choose the material', invalid_type_error: 'Choose the material' }).min(1, 'Choose the material'),
  qty: z.preprocess(gridNumber, z.number({ required_error: 'Enter how much', invalid_type_error: 'Enter a number' })
    .positive('More than 0').max(1_000_000, 'Too large')),
  packs: z.preprocess(gridNumber, z.number({ invalid_type_error: 'Enter a whole number' })
    .int('Whole packs').min(0, 'Cannot be negative').max(1_000_000).nullable().optional()),
  note: z.string().trim().max(300, 'At most 300 characters').nullable().optional(),
}).passthrough().transform(({ materialId, qty, packs, note }) => ({
  materialId, qty, ...(packs != null ? { packs } : {}), ...(note ? { note } : {}),
}));

export const purchaseListSchema = z.object({
  jobId: optionalId,
  supplierId: optionalId,
  note: optionalText,
  items: z.preprocess(
    (rows) => (Array.isArray(rows) ? rows.filter((r) => !isBlankPurchaseItem(r)) : rows),
    z.array(purchaseListItemSchema).min(1, 'Add at least one material').max(200, 'At most 200 items'),
  ),
});

/** Receiving (`POST …/receive`): each item's quantity received — as ordered unless changed; 0 for one that never came. */
export const purchaseReceiveSchema = z.object({
  items: z.array(z.object({
    itemId: z.string().min(1),
    receivedQty: z.preprocess(gridNumber, z.number({ required_error: 'How much came?', invalid_type_error: 'Enter a number' })
      .min(0, 'Cannot be negative').max(1_000_000, 'Too large')),
  }).passthrough().transform(({ itemId, receivedQty }) => ({ itemId, receivedQty }))).max(200),
});

/** The Receive dialog's field for one item — `received_<itemId>`. */
export const receivedFieldName = (itemId) => `received_${itemId}`;

/**
 * The Receive dialog's form: one quantity per item (as ordered to start with; 0 for one that never came) →
 * `{ items: [{ itemId, receivedQty }] }`, `purchaseReceiveSchema`'s body.
 * @param {{ id: string }[]} items  the list's items
 */
export function purchaseReceiveFormSchema(items = []) {
  const quantity = z.preprocess(gridNumber, z.number({ required_error: 'How much came? 0 if none', invalid_type_error: 'Enter a number' })
    .min(0, 'Cannot be negative').max(1_000_000, 'Too large'));
  return z.object(Object.fromEntries(items.map((i) => [receivedFieldName(i.id), quantity])))
    .transform((values) => ({ items: items.map((i) => ({ itemId: i.id, receivedQty: values[receivedFieldName(i.id)] })) }));
}

/** Cancelling a list: why (3–500 characters). */
export const purchaseCancelSchema = z.object({
  reason: z.string().trim().min(3, 'Say why it is cancelled').max(500, 'At most 500 characters'),
});
