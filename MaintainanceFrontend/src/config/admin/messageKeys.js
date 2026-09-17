/**
 * The messages the system sends, by template key: who receives each and when. A key the
 * code sends but nobody has written a template for still goes out, in the code's own
 * English words; a Nepali template missing falls back to the English one (D7).
 *
 * `audience` — `customer` messages go in the customer's language; `staff` ones stay English.
 */
export const MESSAGE_KEYS = {
  lead_ack: { audience: 'customer', when: 'A website enquiry or booking arrives — thanks the customer.' },
  lead_new: { audience: 'staff', when: 'A new lead arrives — to the on-call phone and the sales inbox.' },
  lead_sla_breach: { audience: 'staff', when: 'A lead passes its 2-hour response time — to its owner.' },
  quotation_sent: { audience: 'customer', when: 'A quotation is sent — with the link to accept it.' },
  quotation_accepted: { audience: 'customer', when: 'The customer accepts — confirms the work is booked.' },
  quotation_changes_received: { audience: 'customer', when: 'The customer asks for changes — confirms we have them.' },
  quotation_submitted: { audience: 'staff', when: 'A quotation needs approval — to managers.' },
  quotation_accepted_staff: { audience: 'staff', when: 'A customer accepted — to sales and dispatch.' },
  quotation_changes_requested_staff: { audience: 'staff', when: 'A customer asked for changes — to sales.' },
  quotation_rejected_staff: { audience: 'staff', when: 'A customer declined — to sales.' },
  survey_returned: { audience: 'staff', when: 'The office sends a survey back — to the surveyor.' },
  job_assigned: { audience: 'staff', when: 'A job is assigned — to each technician.' },
  job_en_route: { audience: 'customer', when: 'The technician sets off.' },
  job_completed: { audience: 'customer', when: 'The job is finished.' },
  invoice_sent: { audience: 'customer', when: 'An invoice is sent — with the link to view it.' },
  invoice_overdue: { audience: 'customer', when: 'An invoice is past its due date.' },
  warranty_claim_accepted: { audience: 'customer', when: 'A warranty claim is accepted.' },
  warranty_claim_rejected: { audience: 'customer', when: 'A warranty claim is declined.' },
  amc_visit_due: { audience: 'customer', when: 'A maintenance-contract visit is coming up.' },
  service_reminder: { audience: 'customer', when: 'A scheduled service reminder.' },
  password_reset: { audience: 'staff', when: 'Someone asks for a password reset, or an admin sends one. The link works once, for an hour.' },
  account_invite: { audience: 'staff', when: 'An admin creates an account — the link to choose a password (72 hours).' },
};

/**
 * Example values for the preview, by placeholder name. Anything not here starts empty and
 * is reported as missing until a value is typed.
 */
export const SAMPLE_VARS = {
  appName: 'Ghar Jatan',
  name: 'Sita Rai',
  customerName: 'Sita Rai',
  leadName: 'Sita Rai',
  staffName: 'Hari KC',
  phone: '9808338255',
  address: 'Jhamsikhel, Lalitpur',
  service: 'Seepage treatment',
  message: 'Damp patch on the kitchen wall',
  number: 'QT-2083-0001',
  version: '2',
  total: 'NPR 45,200',
  amount: 'NPR 12,000',
  balance: 'NPR 33,200',
  date: '2 Kartik 2083',
  dueDate: '15 Kartik 2083',
  planName: 'Home care plan',
  reason: 'The damage is outside the warranty',
  note: 'Please add the terrace',
  title: 'New quotation to approve',
  body: 'QT-2083-0001 v2 · NPR 45,200',
  hours: '72',
  link: 'https://gharjatan.com.np/quotation/abc123',
};

/** The placeholder names in texts, in order of first use — the API's own rule (`notify.service.js`). */
export function placeholdersIn(...texts) {
  const found = new Set();
  for (const text of texts) {
    for (const [, key] of String(text ?? '').matchAll(/\{\{\s*([\w.]+)\s*\}\}/g)) found.add(key);
  }
  return [...found];
}

/** Sample values for these placeholders (a dotted path uses its last part). */
export function sampleVarsFor(placeholders = []) {
  const out = {};
  for (const key of placeholders) {
    const value = SAMPLE_VARS[key] ?? SAMPLE_VARS[key.split('.').at(-1)];
    out[key] = value ?? '';
  }
  return out;
}

/** `{ 'quotation.number': 'x' }` → `{ quotation: { number: 'x' } }`, the shape the API renders from. */
export function nestVars(flat) {
  const out = {};
  for (const [path, value] of Object.entries(flat)) {
    const parts = path.split('.');
    let node = out;
    parts.slice(0, -1).forEach((p) => { node = (node[p] = typeof node[p] === 'object' && node[p] ? node[p] : {}); });
    node[parts.at(-1)] = value;
  }
  return out;
}

/** The four variants a key can have, in the editor's order. */
export const TEMPLATE_VARIANTS = [
  { channel: 'sms', locale: 'en', label: 'SMS · English' },
  { channel: 'sms', locale: 'ne', label: 'SMS · नेपाली' },
  { channel: 'email', locale: 'en', label: 'Email · English' },
  { channel: 'email', locale: 'ne', label: 'Email · नेपाली' },
];

export const variantValue = ({ channel, locale }) => `${channel}-${locale}`;

/** The editor of one message key (`new` is the new-template form). */
export const templateHref = (key) => `/admin/platform/message-templates/${encodeURIComponent(key)}`;
