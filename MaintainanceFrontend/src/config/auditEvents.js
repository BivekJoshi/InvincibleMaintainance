/**
 * The API's named business moments (`AUDIT_EVENTS` in its `shared/enums.js`), worded for
 * a record's History tab. A parity test keeps the two lists equal, so a new event cannot
 * reach the screen as a raw `thing.happened`.
 */
export const AUDIT_EVENT_LABELS = {
  'lead.created': 'Lead created',
  'lead.status_changed': 'Status changed',
  'lead.assigned': 'Assigned',
  'lead.merged': 'Duplicates merged in',
  'lead.converted': 'Converted',
  'lead.activity_logged': 'Activity logged',

  'customer.email_confirmed': 'Email confirmed from a lead',

  'quotation.created': 'Quotation created',
  'quotation.sent': 'Quotation sent',
  'quotation.customer_approved': 'Customer approved the quotation',
  'quotation.customer_rejected': 'Customer declined the quotation',
  'quotation.expired': 'Quotation expired',
  'quotation.revised': 'Quotation revised',

  'job.created': 'Job created',
  'job.status_changed': 'Job status changed',
  'job.assigned': 'Job assigned',
  'job.scheduled': 'Job scheduled',
  'job.completed': 'Job completed',
  'job.verified': 'Job verified',

  'invoice.created': 'Invoice created',
  'invoice.sent': 'Invoice sent',
  'invoice.voided': 'Invoice voided',
  'payment.recorded': 'Payment recorded',
  'payment.voided': 'Payment voided',

  'survey.submitted': 'Survey submitted',
  'survey.returned': 'Survey sent back',
  'survey.quoted': 'Survey quoted',

  'auth.login': 'Signed in',
  'auth.login_failed': 'Sign-in failed',
  'auth.locked': 'Account locked',
  'auth.logout': 'Signed out',
  'auth.password_changed': 'Password changed',
  'auth.password_reset_requested': 'Password link sent',
  'auth.unlocked': 'Account unlocked',
  'auth.sessions_revoked': 'Signed out everywhere',

  'settings.changed': 'Settings changed',
  'export.csv': 'Exported',
  'cms.deleted': 'Deleted',
  'cms.restored': 'Restored',
  'cms.purged': 'Deleted for good',
  'user.created': 'User created',
  'user.disabled': 'User disabled',
  'user.role_changed': 'Role changed',
  'message.retried': 'Message sent again',

  'quotation.submitted': 'Quotation submitted for approval',
  'quotation.auto_approved': 'Quotation approved automatically',
  'quotation.office_approved': 'Quotation approved by the office',
  'quotation.sent_back': 'Quotation sent back',
  'quotation.pulled_back': 'Quotation pulled back',
  'quotation.customer_changes_requested': 'Customer asked for changes',
  'quotation.superseded': 'Quotation superseded',
};

/** Plain words for a model row's table, for rows that are not a named event. */
export const AUDIT_MODEL_LABELS = {
  Lead: 'lead',
  LeadNote: 'note',
  Customer: 'customer',
  CustomerSite: 'site',
  Quotation: 'quotation',
  QuotationItem: 'quotation line',
  Job: 'job',
  JobAssignment: 'assignment',
  JobTask: 'checklist item',
  JobPhoto: 'photo',
  JobMaterial: 'material',
  TimeLog: 'time entry',
  Invoice: 'invoice',
  InvoiceItem: 'invoice line',
  Payment: 'payment',
  ProjectImage: 'gallery picture',
  Translation: 'Nepali copy',
  RateCardItem: 'rate',
  User: 'user',
  Setting: 'setting',
  MessageTemplate: 'message template',
};

/** Each event prefix under a heading, in the order the audit screen's event filter lists them. */
export const AUDIT_EVENT_GROUPS = [
  { prefix: 'lead', label: 'Leads' },
  { prefix: 'customer', label: 'Customers' },
  { prefix: 'quotation', label: 'Quotations' },
  { prefix: 'survey', label: 'Site surveys' },
  { prefix: 'job', label: 'Jobs' },
  { prefix: 'invoice', label: 'Invoices' },
  { prefix: 'payment', label: 'Payments' },
  { prefix: 'auth', label: 'Sign-in' },
  { prefix: 'user', label: 'Users' },
  { prefix: 'message', label: 'Messages' },
  { prefix: 'settings', label: 'Settings' },
  { prefix: 'cms', label: 'Content' },
  { prefix: 'export', label: 'Exports' },
];

/**
 * The event filter's options: for each group, "Every … event" (`prefix.*`, which the API
 * reads as a prefix) and then each event by name.
 *
 * @returns {{ value: string, label: string, group: string }[]}
 */
export function auditEventOptions() {
  const names = Object.keys(AUDIT_EVENT_LABELS);
  return AUDIT_EVENT_GROUPS.flatMap(({ prefix, label }) => {
    const events = names.filter((n) => n.startsWith(`${prefix}.`)).sort();
    return [
      { value: `${prefix}.*`, label: `Every ${label.toLowerCase()} event`, group: label },
      ...events.map((n) => ({ value: n, label: AUDIT_EVENT_LABELS[n], group: label })),
    ];
  });
}

/** The sign-in events, for the login activity screen. */
export const AUTH_EVENT_NAMES = Object.keys(AUDIT_EVENT_LABELS).filter((n) => n.startsWith('auth.'));
