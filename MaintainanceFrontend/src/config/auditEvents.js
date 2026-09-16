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
  'auth.password_reset_requested': 'Password reset requested',

  'settings.changed': 'Settings changed',
  'export.csv': 'Exported',
  'cms.deleted': 'Deleted',
  'cms.restored': 'Restored',
  'cms.purged': 'Deleted for good',
  'user.created': 'User created',
  'user.disabled': 'User disabled',
  'user.role_changed': 'Role changed',

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
};
