import { z } from 'zod';
import { isActive, listQuery, optionalRupees, optionalText, rupees, sortOrder, unit } from './common.js';
import {
  AMC_BILLING_CYCLES, AMC_STATUSES, CLAIM_STATUSES, INVOICE_KINDS, INVOICE_STATUSES, LOST_TIME_REASONS,
  PURCHASE_LIST_STATUSES, WEATHER, JOB_PHOTO_KINDS, JOB_STATUSES, JOB_TYPES,
  MESSAGE_CHANNELS, MESSAGE_STATUSES, PAYMENT_METHODS, PRIORITIES, REMINDER_STATUSES, REVENUE_GROUPS, ROLES,
  STOCK_MOVEMENT_TYPES, WARRANTY_STATUSES,
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
  // Left out, REPAIR — or, for a job made from a quotation, the service's jobType (Phase L6).
  type: z.enum(JOB_TYPES).optional(),
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
/** Converting an approved quotation (Phase L6: the hand-off). The type defaults to the service's jobType. */
export const quotationToJobSchema = z.object({
  type: z.enum(JOB_TYPES).optional(),
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

/**
 * POST /public/visits/:token/respond (Phase L5): the customer confirms the window, or asks for another
 * time — a note ("after 3 pm, or Saturday") helps the office pick one.
 */
export const visitResponseSchema = z.object({
  answer: z.enum(['confirm', 'reschedule']),
  note: z.string().trim().max(500).optional(),
}).strict();

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
/**
 * POST /admin/jobs/:id/schedule. Without `scheduledEnd` the job's planned days set it (Phase L6). A window runs
 * 90 days at most — a renovation runs weeks (it was 14).
 */
export const jobScheduleSchema = z.object({
  scheduledStart: z.coerce.date(),
  scheduledEnd: z.coerce.date().optional(),
  technicianIds: z.array(z.string().min(1)).min(1, 'Choose at least one technician').max(20).optional(),
  leadTechnicianId: z.string().min(1).optional(),
  note: z.string().trim().max(1000).optional(),
  notifyCustomer: z.boolean().default(true),
}).refine((v) => !v.scheduledEnd || v.scheduledEnd > v.scheduledStart, {
  message: 'End time must be after the start time', path: ['scheduledEnd'],
}).refine((v) => !v.scheduledEnd || v.scheduledEnd - v.scheduledStart <= 90 * 86_400_000, {
  message: 'A job cannot be scheduled for longer than 90 days', path: ['scheduledEnd'],
});

/** POST /admin/jobs/:id/advance-override (L-D3) — the reason is required and kept. */
export const advanceOverrideSchema = z.object({ reason: z.string().trim().min(5, 'Say why the work may start before the advance').max(500) }).strict();

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
  /** How it is bought: 50 (kg) a bag; 1 when the unit already is the pack. The take-off rounds up to packs. */
  packSize: z.coerce.number().positive().max(100_000).nullable().optional(),
  packLabel: z.string().trim().max(20).nullable().optional(),
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

/**
 * A quoted job bills its quotation: `includeMaterials` / `includeLabour` apply to an unquoted job
 * (default on) and are refused on a quoted one. `vatApplied` and `discount` default to the quotation's.
 */
export const invoiceFromJobSchema = z.object({
  dueDate: z.coerce.date().optional(),
  includeMaterials: z.boolean().optional(),
  includeLabour: z.boolean().optional(),
  vatApplied: z.boolean().optional(),
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

/** An expense (a registry resource since Phase I). approvedBy is the server's: the user who records it. */
export const expenseSchema = z.object({
  category: z.string().trim().min(2).max(80),
  amount: rupees,
  jobId: z.string().optional().nullable(),
  vendor: z.string().trim().max(160).optional().nullable(),
  billMediaId: z.string().optional().nullable(),
  spentAt: z.coerce.date().optional(),
  note: optionalText,
});

/** GET /admin/expenses — Kathmandu days on spentAt. */
export const expenseListQuery = listQuery.extend({
  category: z.string().trim().max(80).optional(),
  jobId: z.string().optional(),
  from: day.optional(),
  to: day.optional(),
}).passthrough();

/** GET /admin/invoices — `from`/`to` are Kathmandu days on issuedAt. */
export const invoiceListQuery = z.object({
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  sort: z.enum(['number', '-number', 'issuedAt', '-issuedAt', 'dueDate', '-dueDate', 'total', '-total', 'createdAt', '-createdAt']).optional(),
  q: z.string().trim().max(200).optional(),
  status: z.enum(INVOICE_STATUSES).optional(),
  /** ADVANCE, RUNNING, FINAL (Phase L6) or STANDARD. */
  kind: z.enum(INVOICE_KINDS).optional(),
  customerId: z.string().optional(),
  overdueOnly: flag.optional(),
  from: day.optional(),
  to: day.optional(),
});

/** GET /admin/payments — `from`/`to` are Kathmandu days on receivedAt. */
export const paymentListQuery = z.object({
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  sort: z.enum(['receivedAt', '-receivedAt', 'amount', '-amount']).optional(),
  q: z.string().trim().max(200).optional(),
  method: z.enum(PAYMENT_METHODS).optional(),
  customerId: z.string().optional(),
  from: day.optional(),
  to: day.optional(),
});

/**
 * Every report (Phase I): Kathmandu days (the last 30 by default), a grouping where the report has one, and
 * `format=csv` for the download.
 */
export const reportQuery = z.object({
  from: day.optional(),
  to: day.optional(),
  groupBy: z.enum(REVENUE_GROUPS).optional(),
  format: z.enum(['csv']).optional(),
});

// ── aftercare

/** PUT /admin/warranties/:id — the scope and the end date. The status is the server's; voiding has its own route. */
export const warrantyUpdateSchema = z.object({
  scope: z.string().trim().max(2000).optional(),
  endsAt: z.coerce.date().optional(),
}).strict();

export const warrantyVoidSchema = z.object({ reason: z.string().trim().min(3).max(500) }).strict();

export const warrantyListQuery = listQuery.extend({
  status: z.enum(WARRANTY_STATUSES).optional(),
  customerId: z.string().optional(),
  activeOnly: flag.optional(),
  /** Active warranties ending within this many days. */
  expiringDays: z.coerce.number().int().min(1).max(365).optional(),
}).passthrough();

export const warrantyClaimListQuery = listQuery.extend({
  status: z.enum(CLAIM_STATUSES).optional(),
}).passthrough();

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

/** The visit schedule's inputs — on create, and on its preview (Phase I). At most 5 years, 260 visits. */
const amcScheduleFields = {
  startDate: z.coerce.date(),
  endDate: z.coerce.date(),
  visitsPerYear: z.coerce.number().int().min(1).max(52).default(4),
};
const endAfterStart = [(v) => v.endDate > v.startDate, { message: 'End date must be after the start date', path: ['endDate'] }];
const atMostFiveYears = [(v) => v.endDate - v.startDate <= 5 * 366 * 86_400_000, { message: 'A contract runs five years at most', path: ['endDate'] }];

const amcContractFields = {
  customerId: z.string().min(1),
  siteId: z.string().optional().nullable(),
  planName: z.string().trim().min(2).max(160),
  coveredServices: z.array(z.string().trim().min(1).max(120)).max(50).optional(),
  amount: rupees,
  billingCycle: z.enum(AMC_BILLING_CYCLES).default('annual'),
  notes: optionalText,
};

export const amcContractSchema = z.object({ ...amcContractFields, ...amcScheduleFields })
  .refine(...endAfterStart).refine(...atMostFiveYears);

export const amcSchedulePreviewSchema = z.object(amcScheduleFields).strict()
  .refine(...endAfterStart).refine(...atMostFiveYears);

/**
 * PUT /admin/amc-contracts/:id — everything but the schedule, which was laid down on create: a new schedule is
 * a renewal (a new contract). The status moves by hand only between active and cancelled.
 */
export const amcContractUpdateSchema = z.object({
  siteId: amcContractFields.siteId,
  planName: amcContractFields.planName.optional(),
  coveredServices: amcContractFields.coveredServices,
  amount: rupees.optional(),
  billingCycle: z.enum(AMC_BILLING_CYCLES).optional(),
  notes: optionalText,
  status: z.enum(['active', 'cancelled']).optional(),
}).strict();

export const amcContractListQuery = listQuery.extend({
  status: z.enum(AMC_STATUSES).optional(),
  customerId: z.string().optional(),
  /** Active contracts ending within this many days — the renewals-due preset. */
  renewalsDays: z.coerce.number().int().min(1).max(365).optional(),
}).passthrough();

export const serviceReminderSchema = z.object({
  customerId: z.string().min(1),
  jobId: z.string().optional().nullable(),
  serviceId: z.string().optional().nullable(),
  dueAt: z.coerce.date(),
  channel: z.enum(['sms', 'email']).default('sms'),
  message: z.string().trim().min(5).max(1000),
});

export const serviceReminderListQuery = listQuery.extend({
  status: z.enum(REMINDER_STATUSES).optional(),
  customerId: z.string().optional(),
  from: day.optional(),
  to: day.optional(),
}).passthrough();

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

// ── the field app's offline queue (Phase H2: moved here from the route)

const SURVEY_KINDS = ['survey_draft', 'survey_submit'];

// ── site diary (Phase L7)

/** A Kathmandu day in a path: `/tech/jobs/:id/diary/2026-09-28`. */
export const diaryParams = z.object({ id: z.string().min(1), day });

/**
 * One day's diary — a FULL replace (PUT and the `diary_save` sync kind), so a replay lands on the same state.
 * Headcount per trade (daily-wage labour are not users), progress per job line, deliveries with the challan,
 * lost hours with a reason. No money anywhere (D1).
 */
export const diarySchema = z.object({
  weather: z.enum(WEATHER).nullable().optional(),
  headcount: z.array(z.object({ tradeId: z.string().min(1), count: z.coerce.number().int().min(0).max(200) }).strict()).max(40).default([]),
  progress: z.array(z.object({ jobLineId: z.string().min(1), progressPct: z.coerce.number().min(0).max(100) }).strict()).max(500).default([]),
  received: z.array(z.object({
    materialId: z.string().min(1).nullable().optional(),
    description: z.string().trim().min(1).max(200),
    qty: z.coerce.number().positive().max(1_000_000),
    unit: z.string().trim().max(20).nullable().optional(),
    challanNo: z.string().trim().max(60).nullable().optional(),
  }).strict()).max(50).default([]),
  issues: z.string().trim().max(4000).nullable().optional(),
  lostHours: z.coerce.number().min(0).max(24).default(0),
  lostReason: z.enum(LOST_TIME_REASONS).nullable().optional(),
  photoMediaIds: z.array(z.string().min(1)).max(30).default([]),
  note: z.string().trim().max(2000).nullable().optional(),
}).strict().refine((v) => !(v.lostHours > 0) || v.lostReason, { message: 'Say why the hours were lost', path: ['lostReason'] });

/** `diary_save` carries the day in its payload. */
export const diarySyncPayload = diarySchema.innerType().extend({ day }).strict();

// ── purchase lists (Phase L7)

const purchaseItem = z.object({
  materialId: z.string().min(1),
  qty: z.coerce.number().positive().max(1_000_000),
  packs: z.coerce.number().int().min(0).max(1_000_000).nullable().optional(),
  note: z.string().trim().max(300).nullable().optional(),
}).strict();

export const purchaseListSchema = z.object({
  jobId: z.string().min(1).nullable().optional(),
  supplierId: z.string().min(1).nullable().optional(),
  note: optionalText,
  items: z.array(purchaseItem).min(1, 'Add at least one material').max(200),
});

export const purchaseListListQuery = listQuery.extend({
  status: z.enum(PURCHASE_LIST_STATUSES).optional(),
  jobId: z.string().optional(),
  supplierId: z.string().optional(),
}).passthrough();

/** Receiving: each item's quantity received (default: as ordered). */
export const purchaseReceiveSchema = z.object({
  items: z.array(z.object({ itemId: z.string().min(1), receivedQty: z.coerce.number().min(0).max(1_000_000) }).strict()).max(200).optional(),
  note: optionalText,
}).strict();

export const purchaseCancelSchema = z.object({ reason: z.string().trim().min(3).max(500) }).strict();

/**
 * POST /tech/sync — the offline queue: 1–200 mutations, each with an idempotency key and the time it was made.
 * A survey mutation addresses a surveyId; every other kind a jobId.
 */
export const techSyncSchema = z.object({
  mutations: z.array(z.object({
    idempotencyKey: z.string().min(8).max(80),
    at: z.coerce.date(),
    kind: z.enum(['status', 'task', 'material', 'time_start', 'time_stop', 'complete', 'diary_save', ...SURVEY_KINDS]),
    jobId: z.string().min(1).optional(),
    surveyId: z.string().min(1).optional(),
    taskId: z.string().optional(),
    payload: z.record(z.any()).default({}),
  }).refine(
    // jobId went optional so survey mutations could address a surveyId instead.
    // Without this, a malformed job mutation would sail through validation and
    // fail somewhere in the service layer with a far less useful message.
    (m) => (SURVEY_KINDS.includes(m.kind) ? Boolean(m.surveyId) : Boolean(m.jobId)),
    { message: 'A survey mutation needs a surveyId; every other kind needs a jobId' },
  )).min(1).max(200),
});

