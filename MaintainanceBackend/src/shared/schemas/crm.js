import { z } from 'zod';
import {
  id, isActive, nepaliPhone, optionalEmail, optionalPhone, optionalRupees, optionalText,
  preferredLocale, rupees, sortOrder, unit,
} from './common.js';
import {
  BOOKING_SLOT_KEYS, CUSTOMER_TYPES, LEAD_SOURCES, LEAD_STATUSES, LOGGABLE_ACTIVITY_TYPES, PRIORITIES,
  QUOTATION_DECISIONS, QUOTATION_STAGES, QUOTATION_STATUSES,
} from '../enums.js';

/** A booking may be made for today or up to 90 days out — never for the past. */
const preferredDate = z.coerce.date()
  .refine((d) => d.getTime() > Date.now() - 86_400_000, 'Choose a date from today onwards')
  .refine((d) => d.getTime() < Date.now() + 90 * 86_400_000, 'Choose a date within the next 90 days');

/** Public lead form — deliberately minimal, matching the site's "Free Consultation" block. */
export const publicLeadSchema = z.object({
  name: z.string().trim().min(2, 'Please enter your name').max(120),
  phone: nepaliPhone,
  email: optionalEmail,
  address: z.string().trim().max(400).optional(),
  area: z.string().trim().max(120).optional(),
  serviceId: z.string().optional(),
  message: z.string().trim().max(4000).optional(),
  sourcePage: z.string().trim().max(300).optional(),
  utmSource: z.string().trim().max(120).optional(),
  utmMedium: z.string().trim().max(120).optional(),
  utmCampaign: z.string().trim().max(120).optional(),
  estimatedAmount: optionalRupees,
  estimatePayload: z.record(z.any()).optional(),
  // The site's language when they enquired; their SMS and email follow it.
  preferredLocale: preferredLocale.optional(),
  // Set by the online booking flow; a plain enquiry leaves both empty.
  preferredAt: preferredDate.optional(),
  preferredSlot: z.enum(BOOKING_SLOT_KEYS).optional(),
  // Photos of the site, uploaded before the lead exists (POST /public/lead-photos).
  photoIds: z.array(z.string().min(1)).max(5).optional(),
  turnstileToken: z.string().max(4000).optional(),
  // Honeypot — must stay empty. Bots fill every field they find.
  website: z.string().max(0, 'Rejected').optional(),
  // Milliseconds the form was on screen; humans take longer than 2s.
  elapsedMs: z.coerce.number().int().min(0).optional(),
});

export const adminLeadCreateSchema = z.object({
  name: z.string().trim().min(2).max(120),
  phone: nepaliPhone,
  altPhone: optionalPhone,
  email: optionalEmail,
  address: z.string().trim().max(400).optional(),
  area: z.string().trim().max(120).optional(),
  serviceId: z.string().optional().nullable(),
  message: optionalText,
  source: z.enum(LEAD_SOURCES).default('call'),
  priority: z.enum(PRIORITIES).default('NORMAL'),
  assignedToId: z.string().optional().nullable(),
  estimatedAmount: optionalRupees,
  preferredLocale: preferredLocale.default('en'),
});

// `.partial()` keeps a default, which would reset the language on every edit that leaves it out.
export const leadUpdateSchema = adminLeadCreateSchema.extend({ preferredLocale: preferredLocale.optional() }).partial();

export const leadStatusSchema = z.object({
  status: z.enum(LEAD_STATUSES),
  lostReason: z.string().trim().max(500).optional(),
  note: z.string().trim().max(2000).optional(),
}).refine((v) => v.status !== 'LOST' || Boolean(v.lostReason), {
  message: 'A reason is required when marking a lead as lost', path: ['lostReason'],
});

export const leadAssignSchema = z.object({
  assignedToId: z.string().nullable(),
  note: z.string().trim().max(1000).optional(),
});

export const leadNoteSchema = z.object({ note: z.string().trim().min(1).max(4000) });

/** status_change and assignment entries are written by the system, never typed in. */
export const leadActivitySchema = z.object({
  type: z.enum(LOGGABLE_ACTIVITY_TYPES),
  summary: z.string().trim().min(1).max(1000),
  meta: z.record(z.any()).optional(),
});

export const leadBulkAssignSchema = z.object({
  ids: z.array(id).min(1).max(100).transform((v) => [...new Set(v)]),
  assignedToId: z.string().nullable(),
  note: z.string().trim().max(1000).optional(),
});

export const leadMergeSchema = z.object({
  primaryId: z.string().min(1),
  duplicateIds: z.array(z.string().min(1)).min(1).max(20),
});

/**
 * Which customer the lead becomes. A phone number is shared by families and tenants and
 * gets recycled, so a match is never taken on trust: when a customer already has this
 * phone and neither `customerId` nor `createNewCustomer` is given, convert answers 409
 * CUSTOMER_MATCH with the candidates. `confirmEmail` saves the lead's email onto the
 * chosen existing customer; nothing else does.
 */
export const leadConvertSchema = z.object({
  customerId: z.string().optional(),
  createNewCustomer: z.coerce.boolean().optional(),
  confirmEmail: z.coerce.boolean().default(false),
  /** Sets the linked customer's language; a new customer otherwise takes the lead's. */
  preferredLocale: preferredLocale.optional(),
  site: z.object({
    label: z.string().trim().min(1).max(120).default('Primary site'),
    address: z.string().trim().min(3).max(400),
    area: z.string().trim().max(120).optional(),
  }).optional(),
  createQuotation: z.coerce.boolean().default(false),
  createInspectionJob: z.coerce.boolean().default(false),
  scheduledStart: z.coerce.date().optional(),
  scheduledEnd: z.coerce.date().optional(),
  /** Technician.id of the surveyor to send. Assigning one also creates the survey. */
  surveyorId: z.string().optional(),
}).refine((v) => !(v.customerId && v.createNewCustomer), {
  message: 'Choose an existing customer or a new one, not both', path: ['customerId'],
});

/** `boolean` query flags arrive as strings; z.coerce.boolean() would read 'false' as true. */
const flag = z.enum(['true', 'false']).transform((v) => v === 'true');

export const leadListQuery = z.object({
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  sort: z.string().optional(),
  q: z.string().trim().max(200).optional(),
  status: z.enum(LEAD_STATUSES).optional(),
  priority: z.enum(PRIORITIES).optional(),
  source: z.enum(LEAD_SOURCES).optional(),
  /** A user id, `me` (the caller — resolved in the route) or `none` (unassigned). */
  assignedToId: z.string().optional(),
  serviceId: z.string().optional(),
  slaRisk: z.enum(['at_risk', 'breached', 'ok']).optional(),
  /** Leads that name a visit day (online bookings, and bookings folded onto an enquiry). */
  requestedVisit: flag.optional(),
  from: z.string().optional(),
  to: z.string().optional(),
  /** Export only: the rows picked in the table, comma separated. */
  ids: z.string().max(2600).optional()
    .transform((v) => (v ? v.split(',').map((x) => x.trim()).filter(Boolean).slice(0, 100) : undefined)),
});

export const assigneeQuery = z.object({
  q: z.string().trim().max(200).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
});

export const customerSchema = z.object({
  type: z.enum(CUSTOMER_TYPES).default('individual'),
  name: z.string().trim().min(2).max(160),
  phone: nepaliPhone,
  altPhone: optionalPhone,
  email: optionalEmail,
  panVatNo: z.string().trim().max(30).optional(),
  notes: optionalText,
  tags: z.array(z.string().trim().min(1).max(40)).max(20).optional(),
  preferredLocale: preferredLocale.default('en'),
});

export const customerUpdateSchema = customerSchema.extend({ preferredLocale: preferredLocale.optional() }).partial();

export const customerListQuery = z.object({
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  sort: z.string().optional(),
  q: z.string().trim().max(200).optional(),
  type: z.enum(CUSTOMER_TYPES).optional(),
  tag: z.string().trim().max(40).optional(),
  /** Customers with a job still open. */
  hasOpenJobs: flag.optional(),
  /** Customers with an unpaid invoice — honoured only for callers who can read invoices. */
  owing: flag.optional(),
});

export const siteParams = z.object({ id, siteId: id });

export const customerSiteSchema = z.object({
  label: z.string().trim().min(1).max(120),
  address: z.string().trim().min(3).max(400),
  area: z.string().trim().max(120).optional(),
  lat: z.coerce.number().min(-90).max(90).optional(),
  lng: z.coerce.number().min(-180).max(180).optional(),
  accessNotes: optionalText,
  isPrimary: z.coerce.boolean().default(false),
});

export const customerSiteUpdateSchema = customerSiteSchema.extend({ isPrimary: z.coerce.boolean().optional() }).partial();

export { historyQuery } from './common.js';

export const rateCardItemSchema = z.object({
  // Stored upper-case, so `seep-chem` and `SEEP-CHEM` are one code (the column is unique).
  code: z.string().trim().min(2).max(40).regex(/^[A-Za-z0-9_-]+$/, 'Use letters, numbers, dash or underscore')
    .transform((v) => v.toUpperCase()),
  name: z.string().trim().min(2).max(200),
  description: optionalText,
  category: z.string().trim().max(80).optional(),
  unit,
  rate: rupees,
  sortOrder,
  isActive,
});

const quotationItem = z.object({
  rateCardItemId: z.string().optional().nullable(),
  description: z.string().trim().min(1).max(500),
  unit: z.string().trim().max(20).optional(),
  qty: z.coerce.number().min(0.01).max(1_000_000),
  rate: rupees,
  sortOrder: z.coerce.number().int().min(0).default(0),
});

export const quotationSchema = z.object({
  customerId: z.string().min(1),
  siteId: z.string().optional().nullable(),
  leadId: z.string().optional().nullable(),
  validUntil: z.coerce.date().optional(),
  discount: optionalRupees,
  vatApplied: z.coerce.boolean().default(true),
  terms: optionalText,
  internalNote: optionalText,
  items: z.array(quotationItem).min(1, 'Add at least one line item').max(200),
});

export const quotationUpdateSchema = quotationSchema.partial().extend({
  items: z.array(quotationItem).min(1).max(200).optional(),
});

export const quotationListQuery = z.object({
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  sort: z.string().optional(),
  q: z.string().trim().max(200).optional(),
  /** A work queue (see QUOTATION_STAGES); `status` narrows further. */
  stage: z.enum(Object.keys(QUOTATION_STAGES)).optional(),
  status: z.enum(QUOTATION_STATUSES).optional(),
  customerId: z.string().optional(),
  leadId: z.string().optional(),
  from: z.string().optional(),
  to: z.string().optional(),
});

/** An approver's optional remark. */
export const quotationApproveSchema = z.object({
  note: z.string().trim().max(1000).optional(),
});

/** Send back (approver) and pull back (sales): the reason is what the next editor reads. */
export const quotationReturnSchema = z.object({
  note: z.string().trim().min(3, 'Say what needs to change').max(1000),
});

/**
 * The customer's answer on the quotation link. No login, no name: one tap and a confirm.
 * A change request must say what to change; a decline may say why; an acceptance
 * carries no message.
 */
export const quotationDecisionSchema = z.object({
  decision: z.enum(QUOTATION_DECISIONS),
  note: z.string().trim().max(1000).optional()
    .transform((v) => v || undefined),
}).superRefine((v, ctx) => {
  if (v.decision === 'request_changes' && (!v.note || v.note.length < 5)) {
    ctx.addIssue({ code: 'custom', path: ['note'], message: 'Tell us what you would like changed (at least 5 characters)' });
  }
});

export const estimateSchema = z.object({
  serviceId: z.string().optional(),
  pricingPlanId: z.string().optional(),
  qty: z.coerce.number().min(0.1).max(1_000_000),
}).refine((v) => v.serviceId || v.pricingPlanId, {
  message: 'Choose a service or a pricing plan', path: ['serviceId'],
});
