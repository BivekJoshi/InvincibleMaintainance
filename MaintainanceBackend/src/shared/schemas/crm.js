import { z } from 'zod';
import {
  id, isActive, nepaliPhone, optionalEmail, optionalPhone, optionalRupees, optionalText,
  preferredLocale, rupees, sortOrder, unit,
} from './common.js';
import {
  BOOKING_SLOT_KEYS, BUDGET_BANDS, CONTACT_ACTIVITY_TYPES, CUSTOMER_TYPES, DECISION_MAKERS, LEAD_OUTCOMES, LEAD_SOURCES,
  LEAD_STATUSES, LOGGABLE_ACTIVITY_TYPES, LOST_CATEGORIES, NEXT_ACTION_TYPES, PRIORITIES, PROPERTY_TYPES,
  QUOTATION_DECISIONS, QUOTATION_ROW_TYPES, QUOTATION_STAGES, QUOTATION_STATUSES, RATE_MODES, RECIPE_COMPONENT_KINDS,
  SURVEY_ITEM_KINDS,
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

/**
 * What sales learns on the first call (`Lead.qualification`), so nobody drives 12 km for a Rs 5,000 job or
 * waits on an owner who decides from abroad. Every field is optional; the budget band is a label, not money.
 */
export const leadQualification = z.object({
  propertyType: z.enum(PROPERTY_TYPES).optional(),
  floors: z.coerce.number().int().min(0).max(60).optional(),
  buildingAgeYears: z.coerce.number().int().min(0).max(300).optional(),
  budgetBand: z.enum(BUDGET_BANDS).optional(),
  decisionMaker: z.enum(DECISION_MAKERS).optional(),
  note: z.string().trim().max(500).optional(),
}).strict();

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
  qualification: leadQualification.nullable().optional(),
});

// `.partial()` keeps a default, which would reset the language on every edit that leaves it out.
export const leadUpdateSchema = adminLeadCreateSchema.extend({ preferredLocale: preferredLocale.optional() }).partial();

const lostReason = z.string().trim().max(500).optional();
const otherNeedsReason = [
  (v) => v.lostCategory !== 'OTHER' || Boolean(v.lostReason),
  { message: 'Say why, when the reason is Other', path: ['lostReason'] },
];

/** LOST says why (a category, required) and may add detail (the free text). */
export const leadStatusSchema = z.object({
  status: z.enum(LEAD_STATUSES),
  lostCategory: z.enum(LOST_CATEGORIES).optional(),
  lostReason,
  note: z.string().trim().max(2000).optional(),
}).refine((v) => v.status !== 'LOST' || Boolean(v.lostCategory), {
  message: 'Choose why the lead was lost', path: ['lostCategory'],
}).refine(...otherNeedsReason);

/** What happens next on a lead, and when. */
export const nextActionInput = z.object({
  at: z.coerce.date(),
  type: z.enum(NEXT_ACTION_TYPES),
  note: z.string().trim().max(300).optional(),
});

/** PATCH /admin/leads/:id/next-action — `at: null` clears it; a time needs a type. */
export const leadNextActionSchema = z.object({
  at: z.coerce.date().nullable(),
  type: z.enum(NEXT_ACTION_TYPES).optional(),
  note: z.string().trim().max(300).optional(),
}).refine((v) => v.at === null || Boolean(v.type), { message: 'Say what the next action is', path: ['type'] });

export const leadAssignSchema = z.object({
  assignedToId: z.string().nullable(),
  note: z.string().trim().max(1000).optional(),
});

export const leadNoteSchema = z.object({ note: z.string().trim().min(1).max(4000) });

/**
 * status_change and assignment entries are written by the system, never typed in.
 *
 * A contact may carry what it came to (`outcome`) — and then it ends with a next action or the lead
 * closed (`close`), which lead.service#addActivity enforces, with defaults per outcome.
 */
export const leadActivitySchema = z.object({
  type: z.enum(LOGGABLE_ACTIVITY_TYPES),
  summary: z.string().trim().min(1).max(1000),
  meta: z.record(z.any()).optional(),
  outcome: z.enum(LEAD_OUTCOMES).optional(),
  nextAction: nextActionInput.optional(),
  close: z.object({ lostCategory: z.enum(LOST_CATEGORIES), lostReason }).refine(...otherNeedsReason).optional(),
}).refine((v) => !v.outcome || CONTACT_ACTIVITY_TYPES.includes(v.type), {
  message: 'An outcome belongs to a call, a message or a visit', path: ['outcome'],
}).refine((v) => !v.close || Boolean(v.outcome), {
  message: 'Closing a lead from the timeline needs the outcome that closed it', path: ['close'],
}).refine((v) => !(v.nextAction && v.close), {
  message: 'Book a next action or close the lead — not both', path: ['close'],
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
  /** Open leads by their next action: due in the Kathmandu day, past due, or none booked. */
  nextAction: z.enum(['due_today', 'overdue', 'none']).optional(),
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

// Stored upper-case, so `seep-chem` and `SEEP-CHEM` are one code (the column is unique).
const upperCode = z.string().trim().min(2).max(40).regex(/^[A-Za-z0-9_-]+$/, 'Use letters, numbers, dash or underscore')
  .transform((v) => v.toUpperCase());

/**
 * One line of a recipe (L-D1). A material is measured in its own unit and a trade in man-days; equipment
 * and other costs carry their own cost per unit (rupees in, paisa stored). The server fills the unit.
 */
export const recipeComponent = z.object({
  kind: z.enum(RECIPE_COMPONENT_KINDS),
  materialId: z.string().min(1).nullable().optional(),
  tradeId: z.string().min(1).nullable().optional(),
  description: z.string().trim().max(200).nullable().optional(),
  qty: z.coerce.number().positive().max(1_000_000),
  wastagePct: z.coerce.number().min(0).max(100).optional(),
  cost: rupees.nullable().optional(),
}).superRefine((c, ctx) => {
  const need = (path, message) => ctx.addIssue({ code: z.ZodIssueCode.custom, path: [path], message });
  if (c.kind === 'MATERIAL' && !c.materialId) need('materialId', 'Choose the material');
  if (c.kind === 'LABOUR' && !c.tradeId) need('tradeId', 'Choose the trade');
  if (['EQUIPMENT', 'OTHER'].includes(c.kind)) {
    if (!c.description) need('description', 'Say what it is');
    if (c.cost == null) need('cost', 'What does one unit cost?');
  }
});

/** No defaults here: an update that leaves a field out keeps it (the create applies MANUAL and 1). */
const rateCardFields = z.object({
  code: upperCode,
  name: z.string().trim().min(2).max(200),
  description: optionalText,
  category: z.string().trim().max(80).optional(),
  unit,
  /** Rupees. Required when MANUAL; a DERIVED item's rate comes from its recipe. */
  rate: rupees.optional(),
  rateMode: z.enum(RATE_MODES).optional(),
  /** The recipe is written for this many units of work — DoR norms are "per 10 sq.m". */
  recipeQty: z.coerce.number().positive().max(100_000).optional(),
  /** null = the settings default. */
  overheadPct: z.coerce.number().min(0).max(200).nullable().optional(),
  profitPct: z.coerce.number().min(0).max(500).nullable().optional(),
  /** Rupees; the derived rate rounds UP to a multiple of it. null = the setting. */
  roundTo: rupees.nullable().optional(),
  components: z.array(recipeComponent).max(40).optional(),
  sortOrder,
  isActive,
});

/** POST /admin/rate-card. A DERIVED item needs its recipe; a MANUAL one its rate. */
export const rateCardItemSchema = rateCardFields
  .refine((v) => v.rateMode === 'DERIVED' || v.rate != null, { message: 'Enter the rate', path: ['rate'] })
  .refine((v) => v.rateMode !== 'DERIVED' || (v.components?.length ?? 0) > 0, {
    message: 'A derived rate needs its recipe', path: ['components'],
  });

/** PUT /admin/rate-card/:id — partial; the service checks the merged item. */
export const rateCardItemUpdateSchema = rateCardFields.partial();

/**
 * POST /admin/rate-card/derive — a recipe's cost and derived rate, computed by the server, nothing saved.
 * `rate` (rupees, optional) is the rate on the form, so the margin at it comes from the server too.
 */
export const rateCardDeriveSchema = rateCardFields.pick({ recipeQty: true, overheadPct: true, profitPct: true, roundTo: true, rate: true })
  .extend({ components: z.array(recipeComponent).min(1).max(40) });

/** POST /admin/rate-card/reprice — `apply: false` previews and writes nothing. */
export const rateCardRepriceSchema = z.object({
  ids: z.array(z.string().min(1)).min(1).max(500).optional(),
  apply: z.boolean(),
});

/** A trade and its day wage (rupees in, paisa stored) — /admin/trades. */
export const tradeSchema = z.object({
  code: upperCode,
  name: z.string().trim().min(2).max(120),
  dayWage: rupees.default(0),
  sortOrder,
  isActive,
});

const dimension = z.coerce.number().min(0).max(100_000).nullable().optional();

/** One measurement-book row: nos × L × B × H over the dimensions given; `deduct` subtracts (a door, a window). */
export const measurementRow = z.object({
  area: z.string().trim().max(80).nullable().optional(),
  description: z.string().trim().max(200).nullable().optional(),
  nos: dimension,
  l: dimension,
  b: dimension,
  h: dimension,
  deduct: z.coerce.boolean().optional(),
});

/**
 * One BOQ row (Phase L3), rates in RUPEES. A SECTION's title and a NOTE's text are its description. An ITEM
 * needs a rate and a quantity or measurements; its quantity must come out above zero (the service answers
 * 422 NEGATIVE_LINE otherwise). `id` is a stored row's, so its frozen recipe and cost are kept. Cost fields
 * are not part of the row: a client-sent unitCost, costAmount or recipe is dropped here, never trusted.
 */
export const quotationRow = z.object({
  id: z.string().min(1).optional(),
  rowType: z.enum(QUOTATION_ROW_TYPES).default('ITEM'),
  rateCardItemId: z.string().min(1).nullable().optional(),
  materialId: z.string().min(1).nullable().optional(),
  kind: z.enum(SURVEY_ITEM_KINDS).nullable().optional(),
  description: z.string().trim().min(1).max(500),
  spec: z.string().trim().max(2000).nullable().optional(),
  unit: z.string().trim().max(20).nullable().optional(),
  qty: z.coerce.number().min(-1_000_000).max(1_000_000).optional(),
  measurements: z.array(measurementRow).max(200).nullable().optional(),
  wastagePct: z.coerce.number().min(0).max(100).optional(),
  rate: rupees.optional(),
  isOptional: z.coerce.boolean().optional(),
  isProvisional: z.coerce.boolean().optional(),
  sortOrder: z.coerce.number().int().min(0).optional(),
}).superRefine((row, ctx) => {
  if (row.rowType !== 'ITEM') return;
  if (row.rate == null) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['rate'], message: 'Enter the rate' });
  if (row.qty == null && !row.measurements?.length) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['qty'], message: 'Enter the quantity, or measure it' });
  }
});

const quotationRows = z.array(quotationRow).max(500);

/** A new quotation. A DRAFT may start with no rows (a blank BOQ); submitting needs a priced row. */
export const quotationSchema = z.object({
  customerId: z.string().min(1),
  siteId: z.string().optional().nullable(),
  leadId: z.string().optional().nullable(),
  validUntil: z.coerce.date().optional(),
  discount: optionalRupees,
  vatApplied: z.coerce.boolean().default(true),
  terms: optionalText,
  internalNote: optionalText,
  items: quotationRows.default([]),
});

export const quotationUpdateSchema = quotationSchema.partial().extend({
  items: quotationRows.optional(),
});

/**
 * POST /admin/quotations/preview — unsaved rows through the same server code as a save, for the builder's
 * live totals. `discountPct` or `targetTotal` (rupees, VAT included) has the server work out the discount.
 */
export const quotationPreviewSchema = z.object({
  quotationId: z.string().min(1).optional(),
  items: quotationRows.default([]),
  discount: optionalRupees,
  discountPct: z.coerce.number().min(0).max(100).optional(),
  targetTotal: optionalRupees,
  vatApplied: z.coerce.boolean().default(true),
}).refine((v) => v.discountPct == null || v.targetTotal == null, {
  message: 'Use a percentage or a target total, not both', path: ['targetTotal'],
});

/** POST /admin/quotations/:id/reprice — `apply: false` previews and writes nothing. */
export const quotationRepriceSchema = z.object({ apply: z.boolean() });

/** POST /admin/quotations/:id/copy — a new DRAFT from this one's rows, for this or another customer. */
export const quotationCopySchema = z.object({
  customerId: z.string().min(1).optional(),
  siteId: z.string().min(1).nullable().optional(),
  leadId: z.string().min(1).nullable().optional(),
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

/** GET /admin/reports/lost — Kathmandu calendar days, on the day each lead was closed. */
export const lostReportQuery = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD').optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD').optional(),
});
