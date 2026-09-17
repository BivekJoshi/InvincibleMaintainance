/** Mirrors the backend's src/shared/enums.js. Keep the two in step. */

export const ROLES = ['ADMIN', 'EDITOR', 'SALES', 'MANAGER', 'DISPATCHER', 'TECHNICIAN', 'ACCOUNTANT', 'SURVEYOR'];

/** Roles that work off a Technician profile and use the /tech app. */
export const FIELD_ROLES = ['TECHNICIAN', 'SURVEYOR'];

/**
 * Roles that belong in the back office. ADMIN and DISPATCHER appear in both —
 * they run dispatch from a desk and can also "view as" a technician in the field.
 */
export const OFFICE_ROLES = ['ADMIN', 'EDITOR', 'SALES', 'MANAGER', 'DISPATCHER', 'ACCOUNTANT'];

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
export const SURVEY_STATUSES = ['DRAFT', 'SUBMITTED', 'IN_REVIEW', 'RETURNED', 'QUOTED', 'CANCELLED'];
export const SURVEY_ITEM_KINDS = ['LABOUR', 'MATERIAL', 'SERVICE', 'OTHER'];
export const SURVEY_METRICS = [
  'moisture', 'crack_width', 'crack_length', 'area', 'depth', 'slope', 'temperature',
  'humidity', 'voltage', 'pressure', 'observation',
];

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
  { value: 'ready', label: 'Ready to send', statuses: ['OFFICE_APPROVED'] },
  { value: 'with_customer', label: 'With customer', statuses: ['SENT'] },
  { value: 'changes_requested', label: 'Customer asked for changes', statuses: ['CHANGES_REQUESTED'], counted: true },
  { value: 'won', label: 'Won', statuses: ['APPROVED', 'CONVERTED'] },
  { value: 'lost', label: 'Declined / Expired', statuses: ['REJECTED', 'EXPIRED'] },
  { value: 'all', label: 'All', statuses: null },
];
export const INVOICE_STATUSES = ['DRAFT', 'SENT', 'PARTIAL', 'PAID', 'OVERDUE', 'VOID'];
export const PAYMENT_METHODS = ['CASH', 'BANK', 'ESEWA', 'KHALTI', 'FONEPAY', 'CHEQUE'];
export const UNITS = ['sq.ft', 'rft', 'nos', 'hour', 'day', 'lump', 'kg', 'litre', 'bag', 'set'];
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
