import {
  CUSTOMER_TYPES, LEAD_SOURCES, LEAD_SOURCE_LABELS, LOGGABLE_ACTIVITY_TYPES, ACTIVITY_LABELS, PREFERRED_LOCALE_OPTIONS,
  PRIORITIES,
} from '@/config/constants';
import { titleCase } from '@/helpers/format';

/**
 * The CRM screens' forms as data, for `<ResourceForm>`: the lead sheet, the customer and
 * site sheets, and the small forms (activity, lost reason, assign). Each pairs with a
 * schema in `form/schemas/lead.schema.js` or `customer.schema.js`.
 */

/** Who a lead can be given to: `GET /admin/leads/assignees`. */
export const ASSIGNEE_RELATION = {
  path: '/admin/leads/assignees',
  labelKey: (u) => `${u.name} · ${titleCase(u.role)}`,
};

/** Services a salesperson can read (`services:read`). */
export const SERVICE_RELATION = { path: '/admin/services', labelKey: 'name' };

const PHONE_HINT = 'Mobile 98XXXXXXXX, or a landline with its area code — 01-5407720.';

export const languageField = {
  name: 'preferredLocale',
  type: 'select',
  label: 'Preferred language',
  required: true,
  options: PREFERRED_LOCALE_OPTIONS,
  description: 'Every SMS and email to this person uses it.',
  span: 'half',
};

export const leadFields = [
  { name: 'name', type: 'text', label: 'Name', required: true, span: 'half', maxLength: 120 },
  { name: 'phone', type: 'text', label: 'Phone', required: true, span: 'half', inputType: 'tel', description: PHONE_HINT },
  { name: 'altPhone', type: 'text', label: 'Other phone', span: 'half', inputType: 'tel' },
  { name: 'email', type: 'text', label: 'Email', span: 'half', inputType: 'email' },
  { name: 'address', type: 'text', label: 'Address', maxLength: 400 },
  { name: 'area', type: 'text', label: 'Area', span: 'half', maxLength: 120, placeholder: 'e.g. Baneshwor' },
  { name: 'serviceId', type: 'relation', label: 'Service', span: 'half', relation: SERVICE_RELATION, placeholder: 'General enquiry' },
  {
    name: 'source', type: 'select', label: 'How they reached us', required: true, span: 'half',
    options: LEAD_SOURCES.map((s) => ({ value: s, label: LEAD_SOURCE_LABELS[s] })),
  },
  { name: 'priority', type: 'select', label: 'Priority', required: true, span: 'half', options: PRIORITIES },
  { name: 'assignedToId', type: 'relation', label: 'Owner', span: 'half', relation: ASSIGNEE_RELATION, placeholder: 'Me' },
  languageField,
  { name: 'estimatedAmount', type: 'money', label: 'Estimated value (Rs)', span: 'half' },
  { name: 'message', type: 'textarea', label: 'What they need', rows: 4 },
];

/** Editing keeps the source the lead came in with; the owner is changed with Assign. */
export const leadEditFields = leadFields.filter((f) => f.name !== 'assignedToId');

export const customerFields = [
  { name: 'type', type: 'select', label: 'Type', required: true, span: 'half', options: CUSTOMER_TYPES },
  languageField,
  { name: 'name', type: 'text', label: 'Name', required: true, maxLength: 160 },
  { name: 'phone', type: 'text', label: 'Phone', required: true, span: 'half', inputType: 'tel', description: PHONE_HINT },
  { name: 'altPhone', type: 'text', label: 'Other phone', span: 'half', inputType: 'tel' },
  {
    name: 'email', type: 'text', label: 'Email', span: 'half', inputType: 'email',
    description: 'A later customer account finds its history by this address — change it only when the customer confirms it.',
  },
  { name: 'panVatNo', type: 'text', label: 'PAN / VAT no.', span: 'half', maxLength: 30 },
  { name: 'tags', type: 'stringList', label: 'Tags', addLabel: 'Add tag', maxItems: 20 },
  { name: 'notes', type: 'textarea', label: 'Notes', rows: 3 },
];

export const siteFields = [
  { name: 'label', type: 'text', label: 'Name', required: true, span: 'half', placeholder: 'Home, Office…' },
  { name: 'area', type: 'text', label: 'Area', span: 'half' },
  { name: 'address', type: 'text', label: 'Address', required: true },
  { name: 'lat', type: 'number', label: 'Latitude', span: 'half', step: 'any', min: -90, max: 90 },
  { name: 'lng', type: 'number', label: 'Longitude', span: 'half', step: 'any', min: -180, max: 180 },
  { name: 'accessNotes', type: 'textarea', label: 'Access notes', rows: 2, placeholder: 'Gate code, parking, who to ask for' },
  { name: 'isPrimary', type: 'switch', label: 'Primary site', description: 'Visits and quotations use it unless told otherwise.' },
];

export const activityFields = [
  {
    name: 'type', type: 'select', label: 'What happened', required: true, span: 'half',
    options: LOGGABLE_ACTIVITY_TYPES.map((t) => ({ value: t, label: ACTIVITY_LABELS[t] })),
  },
  { name: 'summary', type: 'textarea', label: 'Summary', required: true, rows: 2, maxLength: 1000, placeholder: 'Called — will send photos tonight' },
];

export const lostReasonFields = [
  { name: 'lostReason', type: 'textarea', label: 'Why was it lost?', required: true, rows: 3, maxLength: 500, placeholder: 'Went with another company' },
];

export const assignFields = [
  { name: 'assignedToId', type: 'relation', label: 'Owner', relation: ASSIGNEE_RELATION, placeholder: 'Unassigned' },
  { name: 'note', type: 'text', label: 'Note', maxLength: 1000, placeholder: 'Optional — why' },
];

export const convertSiteFields = [
  { name: 'label', type: 'text', label: 'Site name', required: true, span: 'half' },
  { name: 'area', type: 'text', label: 'Area', span: 'half' },
  { name: 'address', type: 'text', label: 'Address', required: true },
  {
    name: 'createQuotation', type: 'switch', label: 'Start a draft quotation',
    description: 'One line priced from the service’s starting price, VAT included. Edit it before sending.',
  },
];
