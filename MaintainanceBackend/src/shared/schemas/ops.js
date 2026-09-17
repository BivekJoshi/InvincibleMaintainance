import { z } from 'zod';
import { isActive, listQuery, optionalRupees, optionalText, rupees, sortOrder, unit } from './common.js';
import {
  INVOICE_STATUSES, JOB_PHOTO_KINDS, JOB_STATUSES, JOB_TYPES, MESSAGE_CHANNELS, MESSAGE_STATUSES, PAYMENT_METHODS,
  PRIORITIES, ROLES, STOCK_MOVEMENT_TYPES,
} from '../enums.js';

export const technicianSchema = z.object({
  userId: z.string().min(1),
  employeeCode: z.string().trim().max(30).optional(),
  skills: z.array(z.string().trim().max(60)).max(40).optional(),
  certifications: z.array(z.string().trim().max(120)).max(40).optional(),
  serviceAreas: z.array(z.string().trim().max(80)).max(60).optional(),
  hourlyRate: optionalRupees,
  dailyCapacity: z.coerce.number().int().min(1).max(20).default(4),
  isAvailable: z.coerce.boolean().default(true),
});

export const jobTemplateSchema = z.object({
  serviceId: z.string().optional().nullable(),
  name: z.string().trim().min(2).max(200),
  description: optionalText,
  tasks: z.array(z.object({
    title: z.string().trim().min(2).max(300),
    description: z.string().trim().max(1000).optional(),
  })).min(1).max(100),
  isActive,
});

export const jobSchema = z.object({
  type: z.enum(JOB_TYPES).default('REPAIR'),
  customerId: z.string().min(1),
  siteId: z.string().optional().nullable(),
  leadId: z.string().optional().nullable(),
  quotationId: z.string().optional().nullable(),
  parentJobId: z.string().optional().nullable(),
  templateId: z.string().optional().nullable(),
  title: z.string().trim().min(2).max(250),
  description: optionalText,
  priority: z.enum(PRIORITIES).default('NORMAL'),
  scheduledStart: z.coerce.date().optional(),
  scheduledEnd: z.coerce.date().optional(),
  isBillable: z.coerce.boolean().default(true),
  technicianIds: z.array(z.string()).max(20).optional(),
  leadTechnicianId: z.string().optional(),
}).refine((v) => !v.scheduledStart || !v.scheduledEnd || v.scheduledEnd > v.scheduledStart, {
  message: 'End time must be after the start time', path: ['scheduledEnd'],
});

export const jobUpdateSchema = z.object({
  type: z.enum(JOB_TYPES).optional(),
  siteId: z.string().optional().nullable(),
  title: z.string().trim().min(2).max(250).optional(),
  description: optionalText,
  priority: z.enum(PRIORITIES).optional(),
  scheduledStart: z.coerce.date().nullable().optional(),
  scheduledEnd: z.coerce.date().nullable().optional(),
  isBillable: z.coerce.boolean().optional(),
});

/** POST /admin/quotations/:id/convert-to-job — only what the quotation does not already know. */
export const quotationToJobSchema = z.object({
  type: z.enum(JOB_TYPES).default('REPAIR'),
  title: z.string().trim().min(2).max(250).optional(),
  description: optionalText,
  priority: z.enum(PRIORITIES).default('NORMAL'),
  scheduledStart: z.coerce.date().optional(),
  scheduledEnd: z.coerce.date().optional(),
  templateId: z.string().optional().nullable(),
  technicianIds: z.array(z.string()).max(20).optional(),
  leadTechnicianId: z.string().optional(),
}).refine((v) => !v.scheduledStart || !v.scheduledEnd || v.scheduledEnd > v.scheduledStart, {
  message: 'End time must be after the start time', path: ['scheduledEnd'],
});

export const jobStatusSchema = z.object({
  status: z.enum(JOB_STATUSES),
  note: z.string().trim().max(2000).optional(),
  lat: z.coerce.number().min(-90).max(90).optional(),
  lng: z.coerce.number().min(-180).max(180).optional(),
}).refine((v) => v.status !== 'ON_HOLD' || Boolean(v.note), {
  message: 'A reason is required when putting a job on hold', path: ['note'],
}).refine((v) => v.status !== 'CANCELLED' || Boolean(v.note), {
  message: 'A reason is required when cancelling a job', path: ['note'],
});

export const jobAssignSchema = z.object({
  technicianIds: z.array(z.string().min(1)).min(1).max(20),
  leadTechnicianId: z.string().optional(),
  note: z.string().trim().max(1000).optional(),
});

/** `/admin/jobs/:id/<child>/:childId` — both ids checked before the service looks. */
const childParams = (name) => z.object({ id: z.string().min(1), [name]: z.string().min(1).max(64) });
export const jobTaskParams = childParams('taskId');
export const jobPhotoParams = childParams('photoId');
export const jobMaterialParams = childParams('jobMaterialId');
export const jobTimeLogParams = childParams('logId');

export const jobTaskSchema = z.object({
  title: z.string().trim().min(2).max(300),
  note: z.string().trim().max(2000).optional(),
  sortOrder,
});

export const jobTaskUpdateSchema = z.object({
  isDone: z.coerce.boolean().optional(),
  isSkipped: z.coerce.boolean().optional(),
  note: z.string().trim().max(2000).optional(),
  title: z.string().trim().min(2).max(300).optional(),
});

export const jobPhotoSchema = z.object({
  mediaId: z.string().min(1),
  kind: z.enum(JOB_PHOTO_KINDS).default('DURING'),
  caption: z.string().trim().max(300).optional(),
});

export const jobMaterialSchema = z.object({
  materialId: z.string().min(1),
  qty: z.coerce.number().min(0.001).max(1_000_000),
  rate: optionalRupees,
  isBillable: z.coerce.boolean().default(true),
});

export const timeLogStartSchema = z.object({ note: z.string().trim().max(500).optional() });
export const timeLogStopSchema = z.object({ note: z.string().trim().max(500).optional() });

/** Labour recorded by the office. Give an end time or a duration. */
export const timeLogCreateSchema = z.object({
  technicianId: z.string().min(1),
  startedAt: z.coerce.date(),
  endedAt: z.coerce.date().optional(),
  minutes: z.coerce.number().int().min(1).max(24 * 60).optional(),
  note: z.string().trim().max(500).optional(),
})
  .refine((v) => v.endedAt || v.minutes, { message: 'Give an end time or a duration in minutes', path: ['minutes'] })
  .refine((v) => !v.endedAt || v.endedAt > v.startedAt, { message: 'End time must be after the start time', path: ['endedAt'] });

export const jobCompleteSchema = z.object({
  note: z.string().trim().max(4000).optional(),
  signatureMediaId: z.string().optional(),
  customerRating: z.coerce.number().int().min(1).max(5).optional(),
  customerFeedback: z.string().trim().max(2000).optional(),
  warrantyDays: z.coerce.number().int().min(0).max(3650).optional(),
  warrantyScope: z.string().trim().max(2000).optional(),
});

/** `true` / `false` in a query string. `z.coerce.boolean()` reads the string 'false' as true. */
const flag = z.enum(['true', 'false']).transform((v) => v === 'true');
const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use a date like 2026-09-18');

/** GET /admin/technicians — paginated (at most 100 a page). */
export const technicianListQuery = listQuery.pick({ page: true, limit: true, q: true, deleted: true }).extend({
  sort: z.enum([
    'employeeCode', '-employeeCode', 'name', '-name', 'rating', '-rating',
    'dailyCapacity', '-dailyCapacity', 'isAvailable', '-isAvailable', 'createdAt', '-createdAt',
  ]).optional(),
  role: z.enum(ROLES).optional(),
  available: flag.optional(),
  skill: z.string().trim().max(60).optional(),
  area: z.string().trim().max(80).optional(),
});

/** GET /admin/technicians/users — people a new profile can be for. */
export const linkableUserQuery = listQuery.pick({ page: true, limit: true, q: true });

export const dispatchQuery = z.object({
  date: day.optional(),
  view: z.enum(['day', 'week']).default('day'),
  technicianId: z.string().optional(),
  role: z.enum(ROLES).optional(),
});

/** GET /admin/dispatch/unassigned — most urgent first unless sorted by age. */
export const unassignedQuery = listQuery.pick({ page: true, limit: true, q: true }).extend({
  sort: z.enum(['priority', 'createdAt', '-createdAt']).optional(),
});

/**
 * POST /admin/jobs/:id/schedule — the board's drop and its Schedule dialog. `technicianIds`
 * replaces the assignment when given (the first one leads unless `leadTechnicianId` says).
 */
export const jobScheduleSchema = z.object({
  scheduledStart: z.coerce.date(),
  scheduledEnd: z.coerce.date(),
  technicianIds: z.array(z.string().min(1)).min(1, 'Choose at least one technician').max(20).optional(),
  leadTechnicianId: z.string().min(1).optional(),
  note: z.string().trim().max(1000).optional(),
  notifyCustomer: z.boolean().default(true),
}).refine((v) => v.scheduledEnd > v.scheduledStart, {
  message: 'End time must be after the start time', path: ['scheduledEnd'],
}).refine((v) => v.scheduledEnd - v.scheduledStart <= 14 * 86_400_000, {
  message: 'A visit cannot be longer than 14 days', path: ['scheduledEnd'],
});

/** GET /admin/jobs. `from` / `to` are Kathmandu days; `invoiced=false` is finished billable work not yet invoiced. */
export const jobListQuery = z.object({
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  sort: z.enum([
    'createdAt', '-createdAt', 'scheduledStart', '-scheduledStart', 'number', '-number',
    'priority', '-priority', 'status', '-status', 'updatedAt', '-updatedAt',
  ]).optional(),
  q: z.string().trim().max(200).optional(),
  status: z.enum(JOB_STATUSES).optional(),
  type: z.enum(JOB_TYPES).optional(),
  priority: z.enum(PRIORITIES).optional(),
  technicianId: z.string().optional(),
  customerId: z.string().optional(),
  quotationId: z.string().optional(),
  unassigned: flag.optional(),
  invoiced: flag.optional(),
  from: day.optional(),
  to: day.optional(),
});

// ── materials

export const supplierSchema = z.object({
  name: z.string().trim().min(2).max(160),
  phone: z.string().trim().max(30).optional(),
  email: z.string().trim().max(160).optional(),
  address: z.string().trim().max(400).optional(),
  notes: optionalText,
  isActive,
});

export const materialCategorySchema = z.object({
  name: z.string().trim().min(2).max(120),
  sortOrder,
  isActive,
});

export const materialSchema = z.object({
  categoryId: z.string().optional().nullable(),
  supplierId: z.string().optional().nullable(),
  code: z.string().trim().min(2).max(40).regex(/^[A-Za-z0-9_-]+$/),
  name: z.string().trim().min(2).max(200),
  unit,
  purchaseRate: rupees.default(0),
  sellRate: rupees.default(0),
  reorderLevel: z.coerce.number().min(0).max(1_000_000).default(0),
  sortOrder,
  isActive,
});

/** GET /admin/stock — every material with its derived balance, paginated. */
export const stockQuery = listQuery.pick({ page: true, limit: true, q: true }).extend({
  sort: z.enum(['name', '-name', 'code', '-code', 'balance', '-balance', 'sortOrder']).optional(),
  categoryId: z.string().optional(),
  lowOnly: flag.optional(),
  includeInactive: flag.optional(),
});

/** GET /admin/stock/movements — newest first. */
export const stockMovementListQuery = listQuery.pick({ page: true, limit: true, from: true, to: true }).extend({
  materialId: z.string().optional(),
  jobId: z.string().optional(),
  type: z.enum(STOCK_MOVEMENT_TYPES).optional(),
});

/**
 * POST /admin/stock/movements. ISSUE_TO_JOB is refused here: stock goes to a job only through
 * the job (`POST /admin/jobs/:id/materials`), which writes the job's material line with it.
 */
export const stockMovementSchema = z.object({
  materialId: z.string().min(1),
  type: z.enum(STOCK_MOVEMENT_TYPES).refine((v) => v !== 'ISSUE_TO_JOB', 'Issue stock to a job from the job itself'),
  qty: z.coerce.number().min(-1_000_000).max(1_000_000).refine((v) => v !== 0, 'Quantity cannot be zero'),
  rate: optionalRupees,
  jobId: z.string().optional().nullable(),
  reference: z.string().trim().max(120).optional(),
  note: optionalText,
});

// ── finance

const invoiceItem = z.object({
  jobId: z.string().optional().nullable(),
  description: z.string().trim().min(1).max(500),
  unit: z.string().trim().max(20).optional(),
  qty: z.coerce.number().min(0.01).max(1_000_000),
  rate: rupees,
  sortOrder: z.coerce.number().int().min(0).default(0),
});

export const invoiceSchema = z.object({
  customerId: z.string().min(1),
  quotationId: z.string().optional().nullable(),
  dueDate: z.coerce.date().optional(),
  discount: optionalRupees,
  vatApplied: z.coerce.boolean().default(true),
  note: optionalText,
  terms: optionalText,
  items: z.array(invoiceItem).min(1, 'Add at least one line item').max(200),
});

export const invoiceUpdateSchema = invoiceSchema.partial().extend({
  items: z.array(invoiceItem).min(1).max(200).optional(),
});

export const invoiceFromJobSchema = z.object({
  dueDate: z.coerce.date().optional(),
  includeMaterials: z.coerce.boolean().default(true),
  includeLabour: z.coerce.boolean().default(true),
  vatApplied: z.coerce.boolean().default(true),
  discount: optionalRupees,
});

export const paymentSchema = z.object({
  amount: rupees.refine((v) => v > 0, 'Amount must be greater than zero'),
  method: z.enum(PAYMENT_METHODS),
  reference: z.string().trim().max(120).optional(),
  receivedAt: z.coerce.date().optional(),
  note: optionalText,
});

export const invoiceVoidSchema = z.object({ reason: z.string().trim().min(3).max(500) });

/** A payment is never deleted; voiding it keeps the row and says why. */
export const paymentVoidSchema = z.object({ reason: z.string().trim().min(3).max(500) });
export const paymentParams = z.object({ id: z.string().min(1), paymentId: z.string().min(1) });

export const expenseSchema = z.object({
  category: z.string().trim().min(2).max(80),
  amount: rupees,
  jobId: z.string().optional().nullable(),
  vendor: z.string().trim().max(160).optional(),
  billMediaId: z.string().optional(),
  spentAt: z.coerce.date().optional(),
  note: optionalText,
});

export const invoiceListQuery = z.object({
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  sort: z.string().optional(),
  q: z.string().trim().max(200).optional(),
  status: z.enum(INVOICE_STATUSES).optional(),
  customerId: z.string().optional(),
  overdueOnly: z.coerce.boolean().optional(),
  from: z.string().optional(),
  to: z.string().optional(),
});

export const paymentListQuery = z.object({
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  sort: z.string().optional(),
  q: z.string().trim().max(200).optional(),
  method: z.enum(PAYMENT_METHODS).optional(),
  customerId: z.string().optional(),
  from: z.string().optional(),
  to: z.string().optional(),
});

// ── aftercare

export const warrantyUpdateSchema = z.object({
  scope: z.string().trim().max(2000).optional(),
  endsAt: z.coerce.date().optional(),
  status: z.enum(['ACTIVE', 'EXPIRED', 'VOID', 'CLAIMED']).optional(),
  voidReason: z.string().trim().max(500).optional(),
});

export const warrantyClaimSchema = z.object({
  description: z.string().trim().min(10, 'Describe the problem in at least 10 characters').max(4000),
});

export const warrantyClaimDecisionSchema = z.object({
  status: z.enum(['accepted', 'rejected', 'resolved']),
  rejectReason: z.string().trim().max(500).optional(),
  scheduledStart: z.coerce.date().optional(),
}).refine((v) => v.status !== 'rejected' || Boolean(v.rejectReason), {
  message: 'A reason is required when rejecting a claim', path: ['rejectReason'],
});

export const amcContractSchema = z.object({
  customerId: z.string().min(1),
  siteId: z.string().optional().nullable(),
  planName: z.string().trim().min(2).max(160),
  coveredServices: z.array(z.string()).max(50).optional(),
  startDate: z.coerce.date(),
  endDate: z.coerce.date(),
  visitsPerYear: z.coerce.number().int().min(1).max(52).default(4),
  amount: rupees,
  billingCycle: z.enum(['annual', 'quarterly', 'monthly']).default('annual'),
  notes: optionalText,
}).refine((v) => v.endDate > v.startDate, {
  message: 'End date must be after the start date', path: ['endDate'],
});

export const serviceReminderSchema = z.object({
  customerId: z.string().min(1),
  jobId: z.string().optional().nullable(),
  serviceId: z.string().optional().nullable(),
  dueAt: z.coerce.date(),
  channel: z.enum(['sms', 'email']).default('sms'),
  message: z.string().trim().min(5).max(1000),
});

export const messageTemplateSchema = z.object({
  // The key the code sends by (`quotation_sent`): lower-case words joined by underscores.
  key: z.string().trim().min(2).max(80).regex(/^[a-z][a-z0-9_]*$/, 'Use lower-case letters, digits and underscores'),
  channel: z.enum(['sms', 'email', 'inapp']),
  locale: z.enum(['en', 'ne']).default('en'),
  subject: z.string().trim().max(250).optional(),
  body: z.string().trim().min(2).max(5000),
  isActive,
});

/** GET /admin/message-templates */
export const messageTemplateListQuery = listQuery.pick({ page: true, limit: true, q: true }).extend({
  sort: z.enum(['key', '-key', 'updatedAt', '-updatedAt']).optional(),
  key: z.string().trim().max(80).optional(),
  channel: z.enum(['sms', 'email', 'inapp']).optional(),
  locale: z.enum(['en', 'ne']).optional(),
});

/** GET /admin/message-templates/groups */
export const messageTemplateGroupQuery = listQuery.pick({ page: true, limit: true, q: true }).extend({
  channel: z.enum(['sms', 'email', 'inapp']).optional(),
});

/**
 * POST /admin/message-templates/:id/preview — `subject` / `body` are unsaved text that wins
 * over the stored template. Without an id, `body` is required.
 */
export const messagePreviewSchema = z.object({
  vars: z.record(z.string(), z.unknown()).default({}),
  subject: z.string().max(250).optional(),
  body: z.string().max(5000).optional(),
});
export const messageDraftPreviewSchema = messagePreviewSchema.extend({ body: z.string().min(1).max(5000) });

/** GET /admin/message-logs */
export const messageLogQuery = listQuery.pick({ page: true, limit: true, q: true, from: true, to: true }).extend({
  sort: z.enum(['createdAt', '-createdAt']).optional(),
  channel: z.enum(MESSAGE_CHANNELS).optional(),
  status: z.enum(MESSAGE_STATUSES).optional(),
  templateKey: z.string().trim().max(80).optional(),
  relatedModel: z.string().trim().max(60).optional(),
  relatedId: z.string().trim().max(64).optional(),
});
