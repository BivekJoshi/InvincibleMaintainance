/** Mirrors the backend's src/shared/enums.js. Keep the two in step. */

export const ROLES = ['ADMIN', 'EDITOR', 'SALES', 'MANAGER', 'DISPATCHER', 'TECHNICIAN', 'ACCOUNTANT', 'SURVEYOR'];

/** Roles that work off a Technician profile and use the /tech app. */
export const FIELD_ROLES = ['TECHNICIAN', 'SURVEYOR'];

/**
 * Roles that belong in the back office. ADMIN and DISPATCHER appear in both —
 * they run dispatch from a desk and can also "view as" a technician in the field.
 */
export const OFFICE_ROLES = ['ADMIN', 'EDITOR', 'SALES', 'MANAGER', 'DISPATCHER', 'ACCOUNTANT'];

/** What each role is for, in the office's words — the users screen and the role matrix. */
export const ROLE_DESCRIPTIONS = {
  ADMIN: 'Everything, including users, settings and the audit log',
  EDITOR: 'The website: pages, services, projects, blog and media',
  SALES: 'Leads, customers and quotations (prepares and submits them at selling rates)',
  MANAGER: 'Everything sales does, plus approving quotations, the rate library, cost and margin',
  DISPATCHER: 'Jobs, technicians, dispatch and materials',
  TECHNICIAN: 'The field app: the jobs assigned to them',
  ACCOUNTANT: 'Invoices, payments, expenses and finance reports',
  SURVEYOR: 'The field app: site visits and survey quantities, never prices',
};

/** MessageLog channels and delivery states (plain strings in the API). */
export const MESSAGE_CHANNELS = ['sms', 'email'];
export const MESSAGE_STATUSES = ['queued', 'sent', 'failed'];

export const LEAD_STATUSES = ['NEW', 'CONTACTED', 'INSPECTION_SCHEDULED', 'QUOTED', 'WON', 'LOST'];
export const LEAD_SOURCES = ['web_form', 'estimator', 'booking', 'call', 'whatsapp', 'viber', 'walk_in', 'referral', 'other'];
export const PRIORITIES = ['LOW', 'NORMAL', 'HIGH', 'URGENT'];

/**
 * Where a lead may move next. Mirrors the API's `shared/stateMachines.js` (a parity test
 * holds them together); the API still asserts every move, this only decides what the
 * screens offer — the status menu and the board's drop targets.
 */
export const LEAD_TRANSITIONS = {
  NEW: ['CONTACTED', 'LOST'],
  CONTACTED: ['INSPECTION_SCHEDULED', 'QUOTED', 'WON', 'LOST'],
  INSPECTION_SCHEDULED: ['QUOTED', 'WON', 'LOST'],
  QUOTED: ['WON', 'LOST'],
  WON: [],
  LOST: ['CONTACTED'],
};

/** Plain words for a lead's status. */
export const LEAD_STATUS_LABELS = {
  NEW: 'New',
  CONTACTED: 'Contacted',
  INSPECTION_SCHEDULED: 'Visit booked',
  QUOTED: 'Quoted',
  WON: 'Won',
  LOST: 'Lost',
};

export const LEAD_SOURCE_LABELS = {
  web_form: 'Website form',
  estimator: 'Price estimator',
  booking: 'Online booking',
  call: 'Phone call',
  whatsapp: 'WhatsApp',
  viber: 'Viber',
  walk_in: 'Walk-in',
  referral: 'Referral',
  other: 'Other',
};

/** Activities staff log by hand; every one but `note` is contact and stops the response clock. */
export const LOGGABLE_ACTIVITY_TYPES = ['call', 'sms', 'whatsapp', 'email', 'visit', 'note'];
export const CONTACT_ACTIVITY_TYPES = ['call', 'sms', 'whatsapp', 'email', 'visit'];
export const ACTIVITY_LABELS = {
  call: 'Call', sms: 'SMS', whatsapp: 'WhatsApp', email: 'Email', visit: 'Visit', note: 'Note',
  status_change: 'Status', assignment: 'Assignment',
};

/**
 * What a contact attempt came to (Phase L1). Every outcome ends with a next action or the
 * lead closed; the API's `lead.service#addActivity` holds the rules, `leadOutcomeIssues` in
 * `form/schemas/lead.schema.js` mirrors them.
 */
export const LEAD_OUTCOMES = [
  'no_answer', 'wrong_number', 'call_back', 'book_visit', 'quote_without_visit', 'price_shopping', 'not_now', 'not_interested',
];
export const LEAD_OUTCOME_LABELS = {
  no_answer: 'No answer / switched off',
  wrong_number: 'Wrong number',
  call_back: 'Call back at…',
  book_visit: 'Interested — book a visit',
  quote_without_visit: 'Interested — quote without a visit',
  price_shopping: 'Price shopping',
  not_now: 'Not now (revisit later)',
  not_interested: 'Not interested',
};
/** Outcomes where the customer was reached: a NEW lead becomes CONTACTED. */
export const REACHED_OUTCOMES = ['call_back', 'book_visit', 'quote_without_visit', 'price_shopping', 'not_now', 'not_interested'];

/** What the owner does next, and when (`Lead.nextActionAt`). */
export const NEXT_ACTION_TYPES = ['CALL', 'BOOK_VISIT', 'VISIT', 'SEND_QUOTE', 'FOLLOW_UP'];
export const NEXT_ACTION_LABELS = {
  CALL: 'Call',
  BOOK_VISIT: 'Book the visit',
  VISIT: 'Site visit',
  SEND_QUOTE: 'Send the quotation',
  FOLLOW_UP: 'Follow up',
};

/** Why a lead was lost — required with LOST; the free-text reason stays alongside. */
export const LOST_CATEGORIES = [
  'PRICE', 'COMPETITOR', 'UNREACHABLE', 'POSTPONED', 'BUDGET', 'OWN_LABOUR', 'OUT_OF_SCOPE', 'OUT_OF_AREA', 'DUPLICATE_SPAM', 'OTHER',
];
export const LOST_CATEGORY_LABELS = {
  PRICE: 'Price too high',
  COMPETITOR: 'Went with a competitor',
  UNREACHABLE: 'Could not reach',
  POSTPONED: 'Postponed indefinitely',
  BUDGET: 'No budget',
  OWN_LABOUR: 'Using own mistri / thekedar',
  OUT_OF_SCOPE: 'Work we don’t do',
  OUT_OF_AREA: 'Outside our area',
  DUPLICATE_SPAM: 'Duplicate or spam',
  OTHER: 'Other',
};

/** `Lead.qualification` — what sales learns on the first call, before anyone drives out. */
export const PROPERTY_TYPES = ['house', 'apartment', 'commercial', 'land', 'other'];
export const PROPERTY_TYPE_LABELS = {
  house: 'House', apartment: 'Apartment', commercial: 'Commercial', land: 'Land', other: 'Other',
};
/** Labels, not amounts: the customer's own words on budget. Never arithmetic. */
export const BUDGET_BANDS = ['under_25k', '25k_1l', '1l_5l', '5l_25l', 'over_25l'];
export const BUDGET_BAND_LABELS = {
  under_25k: 'Under Rs 25,000',
  '25k_1l': 'Rs 25,000 – 1 lakh',
  '1l_5l': 'Rs 1 – 5 lakh',
  '5l_25l': 'Rs 5 – 25 lakh',
  over_25l: 'Over Rs 25 lakh',
};
export const DECISION_MAKERS = ['self', 'family', 'owner_abroad', 'landlord', 'company'];
export const DECISION_MAKER_LABELS = {
  self: 'Self',
  family: 'Family',
  owner_abroad: 'Owner abroad (decides remotely)',
  landlord: 'Landlord',
  company: 'Company',
};

export const CUSTOMER_TYPES = ['individual', 'company'];

/** The languages a customer is written to. The back office itself stays English (D7). */
export const PREFERRED_LOCALE_OPTIONS = [
  { value: 'en', label: 'English' },
  { value: 'ne', label: 'नेपाली' },
];

/** How often the shell's counters refresh: the notification badge and the SLA breach badge. */
export const SHELL_POLL_MS = 60_000;

export const JOB_STATUSES = [
  'DRAFT', 'SCHEDULED', 'ASSIGNED', 'EN_ROUTE', 'IN_PROGRESS', 'ON_HOLD', 'COMPLETED', 'VERIFIED', 'CANCELLED',
];
export const JOB_TYPES = ['INSPECTION', 'REPAIR', 'INSTALLATION', 'RENOVATION', 'AMC_VISIT', 'WARRANTY'];

/**
 * Where a job may move next. Mirrors the API's `shared/stateMachines.js` (the parity test in
 * `crmMirror.test.js`); the API asserts every move, this only decides what a screen offers.
 */
export const JOB_TRANSITIONS = {
  DRAFT: ['SCHEDULED', 'ASSIGNED', 'CANCELLED'],
  SCHEDULED: ['ASSIGNED', 'EN_ROUTE', 'CANCELLED'],
  ASSIGNED: ['EN_ROUTE', 'IN_PROGRESS', 'SCHEDULED', 'CANCELLED'],
  EN_ROUTE: ['IN_PROGRESS', 'ON_HOLD', 'CANCELLED'],
  IN_PROGRESS: ['ON_HOLD', 'COMPLETED', 'CANCELLED'],
  ON_HOLD: ['IN_PROGRESS', 'SCHEDULED', 'CANCELLED'],
  COMPLETED: ['VERIFIED', 'IN_PROGRESS'],
  VERIFIED: [],
  CANCELLED: [],
};

/** A job's status in the office's words. */
export const JOB_STATUS_LABELS = {
  DRAFT: 'Not scheduled',
  SCHEDULED: 'Scheduled',
  ASSIGNED: 'Assigned',
  EN_ROUTE: 'On the way',
  IN_PROGRESS: 'In progress',
  ON_HOLD: 'On hold',
  COMPLETED: 'Completed',
  VERIFIED: 'Verified',
  CANCELLED: 'Cancelled',
};

export const JOB_TYPE_LABELS = {
  INSPECTION: 'Site inspection',
  REPAIR: 'Repair',
  INSTALLATION: 'Installation',
  RENOVATION: 'Renovation',
  AMC_VISIT: 'AMC visit',
  WARRANTY: 'Warranty work',
};

/**
 * The kinds a job photo is filed under. SIGNATURE is the customer's sign-off, taken at completion; SKETCH (Phase L5)
 * a photo of the surveyor's paper sketch.
 */
export const JOB_PHOTO_KINDS = ['BEFORE', 'DURING', 'AFTER', 'ISSUE', 'SIGNATURE', 'SKETCH'];
export const JOB_PHOTO_KIND_LABELS = {
  BEFORE: 'Before', DURING: 'During', AFTER: 'After', ISSUE: 'Issue found', SIGNATURE: 'Signature', SKETCH: 'Sketch',
};
/** What a survey photo may be filed as (`POST /tech/surveys/:id/photos` `kind`); ISSUE is the API's default. */
export const SURVEY_PHOTO_KINDS = ['ISSUE', 'SKETCH'];

/** How stock moves. ISSUE_TO_JOB happens only from a job (the API refuses it on its own). */
export const STOCK_MOVEMENT_TYPES = ['PURCHASE', 'ISSUE_TO_JOB', 'RETURN', 'ADJUSTMENT', 'WASTAGE'];
export const STOCK_MOVEMENT_LABELS = {
  PURCHASE: 'Purchase', ISSUE_TO_JOB: 'Issued to a job', RETURN: 'Returned', ADJUSTMENT: 'Adjustment', WASTAGE: 'Wastage',
};
/** What "Record movement" offers. */
export const MANUAL_STOCK_MOVEMENTS = ['PURCHASE', 'RETURN', 'ADJUSTMENT', 'WASTAGE'];
export const SURVEY_STATUSES = ['DRAFT', 'SUBMITTED', 'IN_REVIEW', 'RETURNED', 'QUOTED', 'CANCELLED'];
/**
 * The survey list's work queues (`?stage=`), sent to the API as a comma-separated `status`.
 * `sort` is the queue's own order — what has waited longest comes first where waiting matters.
 */
export const SURVEY_STAGE_TABS = [
  { value: 'to_price', label: 'To price', statuses: ['SUBMITTED', 'IN_REVIEW'], counted: true, sort: 'submittedAt' },
  { value: 'returned', label: 'Sent back', statuses: ['RETURNED'], counted: true },
  { value: 'in_field', label: 'In the field', statuses: ['DRAFT'] },
  { value: 'quoted', label: 'Quoted', statuses: ['QUOTED'] },
  { value: 'all', label: 'All', statuses: null },
];
/** A survey waiting this long to be priced is flagged. */
export const SURVEY_WAIT_WARN_HOURS = 48;
export const SURVEY_ITEM_KINDS = ['LABOUR', 'MATERIAL', 'SERVICE', 'OTHER'];
export const SURVEY_METRICS = [
  'moisture', 'crack_width', 'crack_length', 'area', 'depth', 'slope', 'temperature',
  'humidity', 'voltage', 'pressure', 'observation',
];

/**
 * An inspection template's question types (Phase L5) — `InspectionTemplate.questions[].type`. A NUMBER question
 * may carry a unit, a metric and a flag `{ above?, below? }`; YES_NO a flag `{ equals: 'yes' | 'no' }`; CHOICE its
 * `options` and a flag `{ values: [...] }`. The server computes a reading's `flagged` from the flag.
 */
export const INSPECTION_QUESTION_TYPES = ['YES_NO', 'NUMBER', 'CHOICE', 'TEXT'];
export const INSPECTION_QUESTION_TYPE_LABELS = {
  YES_NO: 'Yes / no', NUMBER: 'Number', CHOICE: 'Choice', TEXT: 'Text',
};

/** A visit's answer from the customer's `/visit/:token` page (Phase L5), on the inspection job. */
export const VISIT_ANSWERS = ['CONFIRMED', 'RESCHEDULE_REQUESTED'];

/** APPROVED means the customer accepted; OFFICE_APPROVED is the internal approval. */
export const QUOTATION_STATUSES = [
  'DRAFT', 'PENDING_APPROVAL', 'OFFICE_APPROVED', 'SENT', 'CHANGES_REQUESTED',
  'APPROVED', 'REJECTED', 'EXPIRED', 'SUPERSEDED', 'CONVERTED',
];

/**
 * Where a quotation may move next. Mirrors the API's `shared/stateMachines.js` (the parity
 * test in `crmMirror.test.js`); the API asserts every move, this only decides what is offered.
 */
export const QUOTATION_TRANSITIONS = {
  DRAFT: ['PENDING_APPROVAL'],
  PENDING_APPROVAL: ['OFFICE_APPROVED', 'DRAFT'],
  OFFICE_APPROVED: ['SENT', 'DRAFT'],
  SENT: ['APPROVED', 'CHANGES_REQUESTED', 'REJECTED', 'EXPIRED', 'SUPERSEDED'],
  CHANGES_REQUESTED: ['SUPERSEDED'],
  REJECTED: ['SUPERSEDED'],
  EXPIRED: ['SUPERSEDED'],
  APPROVED: ['CONVERTED'],
  SUPERSEDED: [],
  CONVERTED: [],
};

/** A quotation's status in the office's words. */
export const QUOTATION_STATUS_LABELS = {
  DRAFT: 'Draft',
  PENDING_APPROVAL: 'Needs approval',
  OFFICE_APPROVED: 'Ready to send',
  SENT: 'With customer',
  CHANGES_REQUESTED: 'Changes asked',
  APPROVED: 'Accepted',
  REJECTED: 'Declined',
  EXPIRED: 'Expired',
  SUPERSEDED: 'Replaced',
  CONVERTED: 'Accepted · job created',
};

/**
 * The quotation list's tabs — the API's `?stage=` queues (`QUOTATION_STAGES` in its enums).
 * `counted` shows the tab's total — to everyone, or only to holders of `countCapability`
 * (the approval queue is a to-do list for approvers, and a status for everyone else).
 */
export const QUOTATION_STAGE_TABS = [
  { value: 'drafts', label: 'Drafts', statuses: ['DRAFT'] },
  { value: 'approval', label: 'Needs approval', statuses: ['PENDING_APPROVAL'], counted: true, countCapability: 'quotations:approve' },
  { value: 'ready', label: 'Ready to send', statuses: ['OFFICE_APPROVED'], counted: true, countCapability: 'quotations:write' },
  { value: 'with_customer', label: 'With customer', statuses: ['SENT'], counted: true },
  { value: 'changes_requested', label: 'Customer asked for changes', statuses: ['CHANGES_REQUESTED'], counted: true },
  { value: 'won', label: 'Won', statuses: ['APPROVED', 'CONVERTED'] },
  { value: 'lost', label: 'Declined / Expired', statuses: ['REJECTED', 'EXPIRED'] },
  { value: 'all', label: 'All', statuses: null },
];
export const INVOICE_STATUSES = ['DRAFT', 'SENT', 'PARTIAL', 'PAID', 'OVERDUE', 'VOID'];
/** An invoice's state in the office's words (Phase I). The server derives it; the UI never sets it. */
export const INVOICE_STATUS_LABELS = {
  DRAFT: 'Draft', SENT: 'Sent', PARTIAL: 'Part paid', PAID: 'Paid', OVERDUE: 'Overdue', VOID: 'Void',
};
export const PAYMENT_METHODS = ['CASH', 'BANK', 'ESEWA', 'KHALTI', 'FONEPAY', 'CHEQUE'];
export const PAYMENT_METHOD_LABELS = {
  CASH: 'Cash', BANK: 'Bank transfer', ESEWA: 'eSewa', KHALTI: 'Khalti', FONEPAY: 'Fonepay', CHEQUE: 'Cheque',
};
/** How a site team measures and buys (Phase L2 added the metric and pack units). Recipe quantities use each material's own unit. */
export const UNITS = [
  'sq.ft', 'rft', 'nos', 'hour', 'day', 'lump', 'kg', 'litre', 'bag', 'set',
  'sq.m', 'cu.ft', 'cu.m', 'm', 'rmt', 'box', 'tin', 'trip', 'point',
];
/** What a rate-library recipe line is (RateCardComponent.kind). */
export const RECIPE_COMPONENT_KINDS = ['MATERIAL', 'LABOUR', 'EQUIPMENT', 'OTHER'];
export const RECIPE_COMPONENT_LABELS = {
  MATERIAL: 'Material', LABOUR: 'Labour', EQUIPMENT: 'Equipment', OTHER: 'Other',
};
/** MANUAL: the rate is typed (a recipe, if any, only costs it). DERIVED: the recipe sets the rate. */
export const RATE_MODES = ['MANUAL', 'DERIVED'];
export const RATE_MODE_LABELS = { MANUAL: 'Manual', DERIVED: 'Recipe' };
/**
 * How the final bill is worked out (L-D2, Phase L4): LUMP_SUM — the quoted price ± variations the customer
 * approves; ITEM_RATE — the finished work is measured and billed at the quoted rates. The office's words; the
 * sentence the customer reads (en and ne) is `components/documents/quotationDocumentCopy.js#contract`.
 */
export const CONTRACT_TYPES = ['LUMP_SUM', 'ITEM_RATE'];
export const CONTRACT_TYPE_LABELS = { LUMP_SUM: 'Lump sum', ITEM_RATE: 'Item rate (measured)' };
/** When a payment stage falls due (L-D3, Phase L4). The customer's words are in the document copy. */
export const PAYMENT_TRIGGERS = ['ON_ACCEPT', 'MILESTONE', 'ON_COMPLETION'];
export const PAYMENT_TRIGGER_LABELS = { ON_ACCEPT: 'On acceptance (advance)', MILESTONE: 'At a milestone', ON_COMPLETION: 'On completion' };
/**
 * The payment schedules one click away in the builder (Phase L4). Percentages, not money: the server works out
 * each stage's amount. The first is `quotation.defaultPaymentSchedule`'s seeded value.
 */
export const PAYMENT_SCHEDULE_PRESETS = [
  {
    key: '50-40-10',
    label: '50 · 40 · 10',
    stages: [
      { label: 'Advance', pct: 50, trigger: 'ON_ACCEPT' },
      { label: 'Running bill', pct: 40, trigger: 'MILESTONE' },
      { label: 'On completion', pct: 10, trigger: 'ON_COMPLETION' },
    ],
  },
  {
    key: '40-30-20-10',
    label: '40 · 30 · 20 · 10',
    stages: [
      { label: 'Advance', pct: 40, trigger: 'ON_ACCEPT' },
      { label: 'Running bill 1', pct: 30, trigger: 'MILESTONE' },
      { label: 'Running bill 2', pct: 20, trigger: 'MILESTONE' },
      { label: 'On completion', pct: 10, trigger: 'ON_COMPLETION' },
    ],
  },
  {
    key: '100-completion',
    label: '100 on completion',
    stages: [{ label: 'On completion', pct: 100, trigger: 'ON_COMPLETION' }],
  },
];
/**
 * The reasons a customer is offered when declining a quotation (Phase L4) — a customer-friendly subset of
 * `LOST_CATEGORIES`, sent as the decision's `category`; the "Mark lost?" prompt starts from it.
 */
export const DECLINE_CATEGORIES = ['PRICE', 'COMPETITOR', 'POSTPONED', 'BUDGET', 'OWN_LABOUR', 'OTHER'];

// ── Aftercare (Phase I) — each list mirrors the API's `shared/enums.js` (`config/aftercareMirror.test.js`).
/** A warranty's state. CLAIMED: a claim is open on it; the status is the server's (voiding has its own route). */
export const WARRANTY_STATUSES = ['ACTIVE', 'EXPIRED', 'VOID', 'CLAIMED'];
export const WARRANTY_STATUS_LABELS = { ACTIVE: 'Active', CLAIMED: 'Claim open', EXPIRED: 'Expired', VOID: 'Void' };
/** A warranty claim's life: open → accepted (a free WARRANTY job) | rejected; open or accepted → resolved. */
export const CLAIM_STATUSES = ['open', 'accepted', 'rejected', 'resolved'];
export const CLAIM_STATUS_LABELS = { open: 'Open', accepted: 'Accepted', rejected: 'Rejected', resolved: 'Resolved' };
export const AMC_STATUSES = ['active', 'expired', 'cancelled'];
export const AMC_STATUS_LABELS = { active: 'Active', expired: 'Expired', cancelled: 'Cancelled' };
export const AMC_BILLING_CYCLES = ['annual', 'quarterly', 'monthly'];
export const AMC_BILLING_CYCLE_LABELS = { annual: 'Annual', quarterly: 'Quarterly', monthly: 'Monthly' };
/** An AMC visit: pending until a job is made for it (a week before it is due), then scheduled, completed or missed. */
export const AMC_VISIT_STATUSES = ['pending', 'scheduled', 'completed', 'missed'];
export const AMC_VISIT_STATUS_LABELS = { pending: 'Not booked yet', scheduled: 'Job made', completed: 'Done', missed: 'Missed' };
/** skipped: the customer has no address on that channel; failed: the provider refused it. */
export const REMINDER_STATUSES = ['pending', 'sent', 'failed', 'skipped'];
export const REMINDER_STATUS_LABELS = { pending: 'Pending', sent: 'Sent', failed: 'Failed', skipped: 'Skipped' };
/** A service reminder goes out by one of these (the message log's channels). */
export const REMINDER_CHANNEL_LABELS = { sms: 'SMS', email: 'Email' };

export const LOCALES = [
  { code: 'en', label: 'English' },
  { code: 'ne', label: 'नेपाली' },
];

/** Tailwind classes per status, so a badge never needs a switch statement in a component. */
export const STATUS_STYLES = {
  NEW: 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300',
  CONTACTED: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300',
  INSPECTION_SCHEDULED: 'bg-violet-100 text-violet-800 dark:bg-violet-950 dark:text-violet-300',
  QUOTED: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300',
  WON: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300',
  LOST: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',

  SUBMITTED: 'bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300',
  IN_REVIEW: 'bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300',
  RETURNED: 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300',

  DRAFT: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
  SCHEDULED: 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300',
  ASSIGNED: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-950 dark:text-cyan-300',
  EN_ROUTE: 'bg-teal-100 text-teal-800 dark:bg-teal-950 dark:text-teal-300',
  IN_PROGRESS: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300',
  ON_HOLD: 'bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-300',
  COMPLETED: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300',
  VERIFIED: 'bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300',
  CANCELLED: 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300',

  SENT: 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300',
  APPROVED: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300',
  REJECTED: 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300',
  EXPIRED: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
  CONVERTED: 'bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300',
  PENDING_APPROVAL: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300',
  OFFICE_APPROVED: 'bg-teal-100 text-teal-800 dark:bg-teal-950 dark:text-teal-300',
  CHANGES_REQUESTED: 'bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-300',
  SUPERSEDED: 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400',
  PARTIAL: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300',
  PAID: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300',
  OVERDUE: 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300',
  VOID: 'bg-slate-100 text-slate-500 line-through dark:bg-slate-800',
};

export const PRIORITY_STYLES = {
  LOW: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400',
  NORMAL: 'bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300',
  HIGH: 'bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-300',
  URGENT: 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300',
};

export const SLA_STYLES = {
  ok: 'bg-sla-ok/15 text-sla-ok border-sla-ok/30',
  at_risk: 'bg-sla-warn/15 text-sla-warn border-sla-warn/30',
  breached: 'bg-sla-breach/15 text-sla-breach border-sla-breach/30',
  met: 'bg-sla-ok/15 text-sla-ok border-sla-ok/30',
  none: 'bg-muted text-muted-foreground border-border',
};
