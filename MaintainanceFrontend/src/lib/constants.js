/** Mirrors the backend's src/shared/enums.js. Keep the two in step. */

export const ROLES = ['ADMIN', 'EDITOR', 'SALES', 'DISPATCHER', 'TECHNICIAN', 'ACCOUNTANT'];

export const LEAD_STATUSES = ['NEW', 'CONTACTED', 'INSPECTION_SCHEDULED', 'QUOTED', 'WON', 'LOST'];
export const LEAD_SOURCES = ['web_form', 'estimator', 'call', 'whatsapp', 'viber', 'walk_in', 'referral', 'other'];
export const PRIORITIES = ['LOW', 'NORMAL', 'HIGH', 'URGENT'];

export const JOB_STATUSES = [
  'DRAFT', 'SCHEDULED', 'ASSIGNED', 'EN_ROUTE', 'IN_PROGRESS', 'ON_HOLD', 'COMPLETED', 'VERIFIED', 'CANCELLED',
];
export const JOB_TYPES = ['INSPECTION', 'REPAIR', 'INSTALLATION', 'RENOVATION', 'AMC_VISIT', 'WARRANTY'];
export const QUOTATION_STATUSES = ['DRAFT', 'SENT', 'APPROVED', 'REJECTED', 'EXPIRED', 'CONVERTED'];
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
