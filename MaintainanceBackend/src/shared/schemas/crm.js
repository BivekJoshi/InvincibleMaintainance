import { z } from 'zod';
import {
  isActive, nepaliPhone, optionalEmail, optionalPhone, optionalRupees, optionalText,
  rupees, sortOrder, unit,
} from './common.js';
import { ACTIVITY_TYPES, BOOKING_SLOT_KEYS, LEAD_SOURCES, LEAD_STATUSES, PRIORITIES } from '../enums.js';

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
  // Set by the online booking flow; a plain enquiry leaves both empty.
  preferredAt: preferredDate.optional(),
  preferredSlot: z.enum(BOOKING_SLOT_KEYS).optional(),
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
});

export const leadUpdateSchema = adminLeadCreateSchema.partial();

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

export const leadActivitySchema = z.object({
  type: z.enum(ACTIVITY_TYPES),
  summary: z.string().trim().min(1).max(1000),
  meta: z.record(z.any()).optional(),
});

export const leadMergeSchema = z.object({
  primaryId: z.string().min(1),
  duplicateIds: z.array(z.string().min(1)).min(1).max(20),
});

export const leadConvertSchema = z.object({
  customerId: z.string().optional(),
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
});

export const leadListQuery = z.object({
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  sort: z.string().optional(),
  q: z.string().trim().max(200).optional(),
  status: z.enum(LEAD_STATUSES).optional(),
  priority: z.enum(PRIORITIES).optional(),
  source: z.enum(LEAD_SOURCES).optional(),
  assignedToId: z.string().optional(),
  serviceId: z.string().optional(),
  slaRisk: z.enum(['at_risk', 'breached', 'ok']).optional(),
  from: z.string().optional(),
  to: z.string().optional(),
});

export const customerSchema = z.object({
  type: z.enum(['individual', 'company']).default('individual'),
  name: z.string().trim().min(2).max(160),
  phone: nepaliPhone,
  altPhone: optionalPhone,
  email: optionalEmail,
  panVatNo: z.string().trim().max(30).optional(),
  notes: optionalText,
  tags: z.array(z.string().trim().max(40)).max(20).optional(),
});

export const customerSiteSchema = z.object({
  label: z.string().trim().min(1).max(120),
  address: z.string().trim().min(3).max(400),
  area: z.string().trim().max(120).optional(),
  lat: z.coerce.number().min(-90).max(90).optional(),
  lng: z.coerce.number().min(-180).max(180).optional(),
  accessNotes: optionalText,
  isPrimary: z.coerce.boolean().default(false),
});

export const rateCardItemSchema = z.object({
  code: z.string().trim().min(2).max(40).regex(/^[A-Za-z0-9_-]+$/, 'Use letters, numbers, dash or underscore'),
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

export const quotationDecisionSchema = z.object({
  decision: z.enum(['approve', 'reject']),
  note: z.string().trim().max(2000).optional(),
});

export const estimateSchema = z.object({
  serviceId: z.string().optional(),
  pricingPlanId: z.string().optional(),
  qty: z.coerce.number().min(0.1).max(1_000_000),
}).refine((v) => v.serviceId || v.pricingPlanId, {
  message: 'Choose a service or a pricing plan', path: ['serviceId'],
});
