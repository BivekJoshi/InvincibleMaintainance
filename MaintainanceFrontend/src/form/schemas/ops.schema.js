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
