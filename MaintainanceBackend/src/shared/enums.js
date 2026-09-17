export const ROLES = ['ADMIN', 'EDITOR', 'SALES', 'MANAGER', 'DISPATCHER', 'TECHNICIAN', 'ACCOUNTANT', 'SURVEYOR'];

/** Roles that work off a Technician profile and use the /tech app. */
export const FIELD_ROLES = ['TECHNICIAN', 'SURVEYOR'];

export const LEAD_STATUSES = ['NEW', 'CONTACTED', 'INSPECTION_SCHEDULED', 'QUOTED', 'WON', 'LOST'];
export const LEAD_SOURCES = ['web_form', 'estimator', 'booking', 'call', 'whatsapp', 'viber', 'walk_in', 'referral', 'other'];

/** Visit windows a customer can pick when booking online. Times are Asia/Kathmandu. */
export const BOOKING_SLOTS = [
  { key: 'morning', label: 'Morning', window: '8:00 – 12:00', startHour: 8, endHour: 12 },
  { key: 'afternoon', label: 'Afternoon', window: '12:00 – 16:00', startHour: 12, endHour: 16 },
  { key: 'evening', label: 'Evening', window: '16:00 – 19:00', startHour: 16, endHour: 19 },
];
export const BOOKING_SLOT_KEYS = BOOKING_SLOTS.map((s) => s.key);
export const PRIORITIES = ['LOW', 'NORMAL', 'HIGH', 'URGENT'];
export const ACTIVITY_TYPES = ['call', 'sms', 'email', 'whatsapp', 'visit', 'note', 'status_change', 'assignment'];
/** Activities staff log by hand. Every one but `note` is contact, and stamps firstResponseAt. */
export const LOGGABLE_ACTIVITY_TYPES = ['call', 'sms', 'whatsapp', 'email', 'visit', 'note'];
export const CONTACT_ACTIVITY_TYPES = ['call', 'sms', 'whatsapp', 'email', 'visit'];
export const CUSTOMER_TYPES = ['individual', 'company'];

export const SURVEY_STATUSES = ['DRAFT', 'SUBMITTED', 'IN_REVIEW', 'RETURNED', 'QUOTED', 'CANCELLED'];
export const SURVEY_ITEM_KINDS = ['LABOUR', 'MATERIAL', 'SERVICE', 'OTHER'];
/** Suggestions for the field app's metric picker — free text, because instruments differ. */
export const SURVEY_METRICS = [
  'moisture', 'crack_width', 'crack_length', 'area', 'depth', 'slope', 'temperature',
  'humidity', 'voltage', 'pressure', 'observation',
];

/** APPROVED means the customer accepted; OFFICE_APPROVED is the internal approval. */
export const QUOTATION_STATUSES = [
  'DRAFT', 'PENDING_APPROVAL', 'OFFICE_APPROVED', 'SENT', 'CHANGES_REQUESTED',
  'APPROVED', 'REJECTED', 'EXPIRED', 'SUPERSEDED', 'CONVERTED',
];

/** `GET /admin/quotations?stage=` — the work queues of the quotation screen. `all` includes superseded versions. */
export const QUOTATION_STAGES = {
  drafts: ['DRAFT'],
  approval: ['PENDING_APPROVAL'],
  ready: ['OFFICE_APPROVED'],
  with_customer: ['SENT'],
  changes_requested: ['CHANGES_REQUESTED'],
  won: ['APPROVED', 'CONVERTED'],
  lost: ['REJECTED', 'EXPIRED'],
  all: null,
};

/** What a customer may answer on the quotation link. */
export const QUOTATION_DECISIONS = ['approve', 'request_changes', 'reject'];
export const JOB_TYPES = ['INSPECTION', 'REPAIR', 'INSTALLATION', 'RENOVATION', 'AMC_VISIT', 'WARRANTY'];
export const JOB_STATUSES = [
  'DRAFT', 'SCHEDULED', 'ASSIGNED', 'EN_ROUTE', 'IN_PROGRESS', 'ON_HOLD', 'COMPLETED', 'VERIFIED', 'CANCELLED',
];
export const JOB_PHOTO_KINDS = ['BEFORE', 'DURING', 'AFTER', 'ISSUE', 'SIGNATURE'];
export const INVOICE_STATUSES = ['DRAFT', 'SENT', 'PARTIAL', 'PAID', 'OVERDUE', 'VOID'];
export const PAYMENT_METHODS = ['CASH', 'BANK', 'ESEWA', 'KHALTI', 'FONEPAY', 'CHEQUE'];
export const STOCK_MOVEMENT_TYPES = ['PURCHASE', 'ISSUE_TO_JOB', 'RETURN', 'ADJUSTMENT', 'WASTAGE'];
export const WARRANTY_STATUSES = ['ACTIVE', 'EXPIRED', 'VOID', 'CLAIMED'];
export const UNITS = ['sq.ft', 'rft', 'nos', 'hour', 'day', 'lump', 'kg', 'litre', 'bag', 'set'];
export const LOCALES = ['en', 'ne'];

/** Home page sections, matching the studied site's anatomy. */
export const HOME_SECTION_KEYS = [
  'hero', 'quick_inquiry', 'services', 'projects', 'offers', 'gallery', 'why_choose',
  'stats', 'seepage', 'interior', 'construction', 'renovation', 'pre_engineered',
  'kitchen', 'pricing', 'other_civil', 'process', 'testimonials', 'cta_form',
];

export const FEATURE_GROUPS = ['why_choose', 'construction', 'pre_engineered', 'kitchen'];
export const LIST_GROUPS = ['renovation_reasons', 'kitchen_steps', 'seepage_checkpoints'];
export const CONTENT_BLOCK_KEYS = ['seepage_explainer', 'interior_design', 'about_intro', 'cta_banner'];

/** Who was on the other end of a write: a signed-in user, the public (a form, a token link) or the system (a task). */
export const ACTOR_TYPES = ['user', 'public', 'system'];

/**
 * Named business moments written to AuditLog.event, next to the automatic
 * model-change rows. The frontend mirrors this list. docs/API.md says when each fires.
 */
export const AUDIT_EVENTS = Object.freeze({
  LEAD_CREATED: 'lead.created',
  LEAD_STATUS_CHANGED: 'lead.status_changed',
  LEAD_ASSIGNED: 'lead.assigned',
  LEAD_MERGED: 'lead.merged',
  LEAD_CONVERTED: 'lead.converted',
  LEAD_ACTIVITY_LOGGED: 'lead.activity_logged',

  CUSTOMER_EMAIL_CONFIRMED: 'customer.email_confirmed',

  QUOTATION_CREATED: 'quotation.created',
  QUOTATION_SUBMITTED: 'quotation.submitted',
  QUOTATION_AUTO_APPROVED: 'quotation.auto_approved',
  QUOTATION_OFFICE_APPROVED: 'quotation.office_approved',
  QUOTATION_SENT_BACK: 'quotation.sent_back',
  QUOTATION_PULLED_BACK: 'quotation.pulled_back',
  QUOTATION_SENT: 'quotation.sent',
  QUOTATION_CUSTOMER_APPROVED: 'quotation.customer_approved',
  QUOTATION_CUSTOMER_CHANGES_REQUESTED: 'quotation.customer_changes_requested',
  QUOTATION_CUSTOMER_REJECTED: 'quotation.customer_rejected',
  QUOTATION_EXPIRED: 'quotation.expired',
  QUOTATION_REVISED: 'quotation.revised',
  QUOTATION_SUPERSEDED: 'quotation.superseded',

  JOB_CREATED: 'job.created',
  JOB_STATUS_CHANGED: 'job.status_changed',
  JOB_ASSIGNED: 'job.assigned',
  JOB_SCHEDULED: 'job.scheduled',
  JOB_COMPLETED: 'job.completed',
  JOB_VERIFIED: 'job.verified',

  INVOICE_CREATED: 'invoice.created',
  INVOICE_SENT: 'invoice.sent',
  INVOICE_VOIDED: 'invoice.voided',
  PAYMENT_RECORDED: 'payment.recorded',
  PAYMENT_VOIDED: 'payment.voided',

  SURVEY_SUBMITTED: 'survey.submitted',
  SURVEY_RETURNED: 'survey.returned',
  SURVEY_QUOTED: 'survey.quoted',

  AUTH_LOGIN: 'auth.login',
  AUTH_LOGIN_FAILED: 'auth.login_failed',
  AUTH_LOCKED: 'auth.locked',
  AUTH_LOGOUT: 'auth.logout',
  AUTH_PASSWORD_CHANGED: 'auth.password_changed',
  AUTH_PASSWORD_RESET_REQUESTED: 'auth.password_reset_requested',
  AUTH_UNLOCKED: 'auth.unlocked',
  AUTH_SESSIONS_REVOKED: 'auth.sessions_revoked',

  SETTINGS_CHANGED: 'settings.changed',
  EXPORT_CSV: 'export.csv',
  CMS_DELETED: 'cms.deleted',
  CMS_RESTORED: 'cms.restored',
  CMS_PURGED: 'cms.purged',
  USER_CREATED: 'user.created',
  USER_DISABLED: 'user.disabled',
  USER_ROLE_CHANGED: 'user.role_changed',
  MESSAGE_RETRIED: 'message.retried',
});

/** The sign-in events: what the login activity screen lists. */
export const AUTH_EVENT_NAMES = Object.values(AUDIT_EVENTS).filter((e) => e.startsWith('auth.'));

/** MessageLog.channel and .status — plain strings in the database. `inapp` messages are Notifications, never logged. */
export const MESSAGE_CHANNELS = ['sms', 'email'];
export const MESSAGE_STATUSES = ['queued', 'sent', 'failed'];
