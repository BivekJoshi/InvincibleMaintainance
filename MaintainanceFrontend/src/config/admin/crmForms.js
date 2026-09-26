import {
  BUDGET_BANDS, BUDGET_BAND_LABELS, CONTACT_ACTIVITY_TYPES, CUSTOMER_TYPES, DECISION_MAKERS, DECISION_MAKER_LABELS,
  LEAD_OUTCOMES, LEAD_OUTCOME_LABELS, LEAD_SOURCES, LEAD_SOURCE_LABELS, LOGGABLE_ACTIVITY_TYPES, LOST_CATEGORIES,
  LOST_CATEGORY_LABELS, ACTIVITY_LABELS, NEXT_ACTION_LABELS, NEXT_ACTION_TYPES, PREFERRED_LOCALE_OPTIONS, PRIORITIES,
  PROPERTY_TYPES, PROPERTY_TYPE_LABELS,
} from '@/config/constants';
import {
  OUTCOME_NEXT_TYPE, OUTCOMES_CLOSING, OUTCOMES_NEEDING_TIME, OUTCOMES_NEXT_OR_CLOSE, WRONG_NUMBER_CHOICES,
} from '@/form/schemas/lead.schema';
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

/** `{ value, label }` options from an enum and its words. */
const optionsOf = (values, labels) => values.map((value) => ({ value, label: labels[value] }));

export const NEXT_ACTION_OPTIONS = optionsOf(NEXT_ACTION_TYPES, NEXT_ACTION_LABELS);
export const LOST_CATEGORY_OPTIONS = optionsOf(LOST_CATEGORIES, LOST_CATEGORY_LABELS);

/**
 * The next action the API sets for an outcome when none is sent (`pipeline.noAnswerRetryMinutes` is 120 by
 * default), in words — the composer shows it so "leave it" is an informed choice.
 */
export const OUTCOME_DEFAULT_NEXT = {
  no_answer: 'Call again after the no-answer delay (2 hours by default)',
  book_visit: 'Book the visit — now',
  quote_without_visit: 'Send the quotation — now',
  price_shopping: 'Follow up in 3 days',
};

/** The three next-action inputs. The type may stay on the one the outcome suggests. */
const nextActionFields = (outcome) => [
  { name: 'nextActionAt', type: 'datetime', label: 'When', required: true, span: 'half', defaultTime: '10:00' },
  {
    name: 'nextActionType', type: 'select', label: 'Next action', span: 'half', options: NEXT_ACTION_OPTIONS,
    noneLabel: `${NEXT_ACTION_LABELS[OUTCOME_NEXT_TYPE[outcome]]} (suggested)`,
  },
  { name: 'nextActionNote', type: 'text', label: 'Note for next time', maxLength: 300, placeholder: 'Optional — e.g. ask for the owner' },
];

/** The lost category and its reason; the reason is required only for "Other". */
const closeFields = (category) => [
  { name: 'lostCategory', type: 'select', label: 'Why was it lost?', required: true, span: 'half', options: LOST_CATEGORY_OPTIONS },
  {
    name: 'lostReason', type: 'textarea', label: 'In their words', required: category === 'OTHER', rows: 2, maxLength: 500,
    placeholder: category === 'OTHER' ? 'Say why' : 'Optional',
  },
];

/**
 * The activity composer's fields for what is picked so far — the type, and for a contact the outcome
 * and whatever that outcome needs: a time (call back, not now), an optional different next action
 * (the rest), the lost category (not interested), or "next action or close" (wrong number).
 *
 * @param {{ type?: string, outcome?: string, overrideNext?: boolean, resolution?: string, lostCategory?: string }} picked
 * @param {{ open?: boolean }} [lead]  a closed lead (WON / LOST) takes plain entries, no outcome
 */
export function activityFieldsFor(picked = {}, { open = true } = {}) {
  const { type, outcome, overrideNext, resolution, lostCategory } = picked;
  const contact = CONTACT_ACTIVITY_TYPES.includes(type);
  const fields = [
    {
      name: 'type', type: 'select', label: 'What happened', required: true, span: 'half',
      options: LOGGABLE_ACTIVITY_TYPES.map((t) => ({ value: t, label: ACTIVITY_LABELS[t] })),
    },
  ];
  if (contact && open) {
    fields.push({
      name: 'outcome', type: 'select', label: 'What came of it', span: 'half', noneLabel: 'Just log it',
      placeholder: 'Pick an outcome', options: optionsOf(LEAD_OUTCOMES, LEAD_OUTCOME_LABELS),
    });
  }
  const chosen = contact && open ? outcome : undefined;
  if (OUTCOMES_NEEDING_TIME.includes(chosen)) {
    fields.push(...nextActionFields(chosen));
  } else if (OUTCOMES_CLOSING.includes(chosen)) {
    fields.push(...closeFields(lostCategory));
  } else if (OUTCOMES_NEXT_OR_CLOSE.includes(chosen)) {
    fields.push({ name: 'resolution', type: 'select', label: 'Then', required: true, options: WRONG_NUMBER_CHOICES });
    if (resolution === 'next') fields.push(...nextActionFields(chosen));
    if (resolution === 'close') fields.push(...closeFields(lostCategory));
  } else if (chosen) {
    fields.push({
      name: 'overrideNext', type: 'switch', label: 'Set a different next action',
      description: `Otherwise: ${OUTCOME_DEFAULT_NEXT[chosen]}.`,
    });
    if (overrideNext) fields.push(...nextActionFields(chosen));
  }
  fields.push({
    name: 'summary', type: 'textarea', label: 'Summary', required: !chosen, rows: 2, maxLength: 1000,
    placeholder: chosen ? `Optional — “${LEAD_OUTCOME_LABELS[chosen]}” if left empty` : 'Called — will send photos tonight',
  });
  return fields;
}

/** The composer's plain form (a note, or a closed lead's entry) — `activityFieldsFor` with nothing picked. */
export const activityFields = activityFieldsFor({ type: 'note' });

export const lostReasonFields = [
  { name: 'lostCategory', type: 'select', label: 'Why was it lost?', required: true, options: LOST_CATEGORY_OPTIONS },
  {
    name: 'lostReason', type: 'textarea', label: 'In their words', rows: 3, maxLength: 500,
    placeholder: 'Optional — required for “Other”. E.g. went with the contractor next door',
  },
];

/** Reschedule / set the next action on the lead page's card. */
export const nextActionFormFields = [
  { name: 'at', type: 'datetime', label: 'When', required: true, span: 'half', defaultTime: '10:00' },
  { name: 'type', type: 'select', label: 'Next action', required: true, span: 'half', options: NEXT_ACTION_OPTIONS },
  { name: 'note', type: 'text', label: 'Note', maxLength: 300, placeholder: 'Optional — what to say or bring' },
];

/** `Lead.qualification`. Budget bands are labels, not amounts. */
export const qualificationFields = [
  { name: 'propertyType', type: 'select', label: 'Property', span: 'half', noneLabel: 'Not known yet', options: optionsOf(PROPERTY_TYPES, PROPERTY_TYPE_LABELS) },
  { name: 'decisionMaker', type: 'select', label: 'Who decides', span: 'half', noneLabel: 'Not known yet', options: optionsOf(DECISION_MAKERS, DECISION_MAKER_LABELS) },
  { name: 'floors', type: 'number', label: 'Floors', span: 'half', min: 0, max: 100, step: 1 },
  { name: 'buildingAgeYears', type: 'number', label: 'Building age (years)', span: 'half', min: 0, max: 300, step: 1 },
  { name: 'budgetBand', type: 'select', label: 'Budget', noneLabel: 'Not known yet', options: optionsOf(BUDGET_BANDS, BUDGET_BAND_LABELS) },
  { name: 'note', type: 'textarea', label: 'Anything else', rows: 2, maxLength: 500, placeholder: 'Access, timing, who to talk to' },
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
