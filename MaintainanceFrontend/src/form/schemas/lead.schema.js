import { z } from 'zod';
import {
  personName, nepaliPhone, optionalPhone, optionalEmail, preferredLocale, address, message, optionalId, optionalText,
  rupees,
} from './fields';
import {
  BUDGET_BANDS, CONTACT_ACTIVITY_TYPES, DECISION_MAKERS, LEAD_OUTCOMES, LEAD_OUTCOME_LABELS, LEAD_SOURCES,
  LOGGABLE_ACTIVITY_TYPES, LOST_CATEGORIES, NEXT_ACTION_TYPES, PRIORITIES, PROPERTY_TYPES,
} from '@/config/constants';
import { fromKathmanduParts } from '@/helpers/format';

/** The public enquiry form. Mirrors the API's `publicLeadSchema` (the fields it asks for). */
export const leadSchema = z.object({
  name: personName,
  phone: nepaliPhone,
  email: optionalEmail,
  address: address.optional(),
  serviceId: optionalId,
  message,
});

export const leadDefaults = { name: '', phone: '', email: '', address: '', serviceId: '', message: '' };

/**
 * A lead typed in by staff — a call, a walk-in, a WhatsApp message. Mirrors the API's
 * `adminLeadCreateSchema`; the edit sheet uses the same fields.
 */
export const adminLeadSchema = z.object({
  name: z.string().trim().min(2, 'Enter the customer’s name').max(120),
  phone: nepaliPhone,
  altPhone: optionalPhone,
  email: optionalEmail,
  address: z.string().trim().max(400).optional(),
  area: z.string().trim().max(120).optional(),
  serviceId: z.string().optional().nullable(),
  message: optionalText,
  source: z.enum(LEAD_SOURCES),
  priority: z.enum(PRIORITIES),
  assignedToId: z.string().optional().nullable(),
  estimatedAmount: rupees.max(1_000_000_000).optional(),
  preferredLocale,
});

export const adminLeadDefaults = { source: 'call', priority: 'NORMAL', preferredLocale: 'en' };

/** An optional free-text line: blank is left out of the request. */
const blankToUndefined = (max) => z.string().trim().max(max).optional().or(z.literal('')).transform((v) => v || undefined);

/** "Other" says nothing on its own, so it needs the reason in words. */
const OTHER_NEEDS_REASON = 'Say why — “Other” needs a reason';

/**
 * Marking a lead lost: the category is required (the lost report groups by it); the free text is
 * optional except with OTHER. Mirrors the API's `leadStatusSchema` for `status: 'LOST'` (and its
 * activity `close`).
 */
export const lostReasonSchema = z.object({
  lostCategory: z.enum(LOST_CATEGORIES, { errorMap: () => ({ message: 'Pick why the lead was lost' }) }),
  lostReason: blankToUndefined(500),
}).superRefine((v, ctx) => {
  if (v.lostCategory === 'OTHER' && !v.lostReason) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['lostReason'], message: OTHER_NEEDS_REASON });
  }
});

/** Outcomes that must say when to try again. */
export const OUTCOMES_NEEDING_TIME = ['call_back', 'not_now'];
/** Outcomes that close the lead (not interested), or may (a wrong number with no other way in). */
export const OUTCOMES_CLOSING = ['not_interested'];
export const OUTCOMES_NEXT_OR_CLOSE = ['wrong_number'];

/**
 * The server's outcome rules (`lead.service#addActivity`), as a list of problems with a request
 * body `{ type, outcome?, nextAction?, close? }`. Both activity schemas below report these, so the
 * composer refuses exactly what the API would answer with 422 NEXT_ACTION_REQUIRED.
 *
 * @returns {{ path: (string|number)[], message: string }[]}
 */
export function leadOutcomeIssues({ type, outcome, nextAction, close }) {
  if (!outcome) return close ? [{ path: ['close'], message: 'Closing a lead from the timeline needs the outcome that closed it' }] : [];
  if (!CONTACT_ACTIVITY_TYPES.includes(type)) {
    return [{ path: ['outcome'], message: 'A note has no outcome — log a call, SMS, WhatsApp, email or visit' }];
  }
  const issues = [];
  // The outcome's own rule first, so its words win over the generic ones below.
  if (OUTCOMES_NEEDING_TIME.includes(outcome) && !nextAction?.at) {
    issues.push({ path: ['nextAction', 'at'], message: outcome === 'call_back' ? 'When should we call back?' : 'When should we try again?' });
  }
  if (OUTCOMES_CLOSING.includes(outcome) && !close?.lostCategory) {
    issues.push({ path: ['close', 'lostCategory'], message: 'Not interested closes the lead — pick why it was lost' });
  }
  if (OUTCOMES_NEXT_OR_CLOSE.includes(outcome) && !nextAction && !close) {
    issues.push({ path: ['nextAction'], message: 'A wrong number needs a next action (another number?) or the lead closed' });
  }
  if (nextAction && !nextAction.at) issues.push({ path: ['nextAction', 'at'], message: 'Say when' });
  if (nextAction?.at && !nextAction.type) issues.push({ path: ['nextAction', 'type'], message: 'Say what to do next' });
  if (close && !close.lostCategory) issues.push({ path: ['close', 'lostCategory'], message: 'Pick why the lead was lost' });
  if (close?.lostCategory === 'OTHER' && !close.lostReason) {
    issues.push({ path: ['close', 'lostReason'], message: OTHER_NEEDS_REASON });
  }
  if (nextAction && close) issues.push({ path: ['close'], message: 'Book a next action or close the lead — not both' });
  return issues;
}

const nextActionBody = z.object({
  at: z.string().datetime({ offset: true, message: 'Pick a date and time' }),
  type: z.enum(NEXT_ACTION_TYPES),
  note: blankToUndefined(300),
});

const closeBody = z.object({
  lostCategory: z.enum(LOST_CATEGORIES),
  lostReason: blankToUndefined(500),
});

/**
 * `POST /admin/leads/:id/activities` — mirrors the API's `leadActivitySchema`: a typed entry, an optional
 * outcome for a contact, the next action and / or the lead closed, under the outcome rules.
 */
export const leadActivitySchema = z.object({
  type: z.enum(LOGGABLE_ACTIVITY_TYPES),
  summary: z.string().trim().min(1, 'Say what happened').max(1000),
  meta: z.record(z.any()).optional(),
  outcome: z.enum(LEAD_OUTCOMES).optional(),
  nextAction: nextActionBody.optional(),
  close: closeBody.optional(),
}).superRefine((body, ctx) => {
  for (const issue of leadOutcomeIssues(body)) ctx.addIssue({ code: z.ZodIssueCode.custom, ...issue });
});

/** What the outcome composer's "next action or close" choice offers for a wrong number. */
export const WRONG_NUMBER_CHOICES = [
  { value: 'next', label: 'Try another way — set a next action' },
  { value: 'close', label: 'Close the lead as lost' },
];

/** The next action an outcome suggests when staff set the time themselves (the type may be left on it). */
export const OUTCOME_NEXT_TYPE = {
  no_answer: 'CALL',
  wrong_number: 'CALL',
  call_back: 'CALL',
  book_visit: 'BOOK_VISIT',
  quote_without_visit: 'SEND_QUOTE',
  price_shopping: 'FOLLOW_UP',
  not_now: 'FOLLOW_UP',
};

/**
 * The flat values the outcome composer edits → the API body. The summary defaults to the outcome's
 * words, and a next action's type to the one the outcome suggests.
 */
export function activityBody(values) {
  const { type, outcome, summary, overrideNext, resolution } = values;
  const contact = CONTACT_ACTIVITY_TYPES.includes(type) && outcome ? outcome : undefined;
  const wantsNext = contact && (OUTCOMES_NEEDING_TIME.includes(contact)
    || (OUTCOMES_NEXT_OR_CLOSE.includes(contact) ? resolution === 'next' : !OUTCOMES_CLOSING.includes(contact) && overrideNext));
  const wantsClose = contact && (OUTCOMES_CLOSING.includes(contact) || (OUTCOMES_NEXT_OR_CLOSE.includes(contact) && resolution === 'close'));
  const text = (summary ?? '').trim();
  return {
    type,
    summary: text || (contact ? LEAD_OUTCOME_LABELS[contact].replace(/( at)?…$/, '') : ''),
    ...(contact ? { outcome: contact } : {}),
    ...(wantsNext ? {
      nextAction: {
        at: values.nextActionAt,
        type: values.nextActionType ?? OUTCOME_NEXT_TYPE[contact],
        ...(values.nextActionNote?.trim() ? { note: values.nextActionNote.trim() } : {}),
      },
    } : {}),
    ...(wantsClose ? {
      close: {
        lostCategory: values.lostCategory,
        ...(values.lostReason?.trim() ? { lostReason: values.lostReason.trim() } : {}),
      },
    } : {}),
  };
}

/** Where a request-body path lands in the composer's flat form. */
const FORM_PATHS = {
  'nextAction.at': 'nextActionAt',
  'nextAction.type': 'nextActionType',
  'nextAction.note': 'nextActionNote',
  nextAction: 'resolution',
  'close.lostCategory': 'lostCategory',
  'close.lostReason': 'lostReason',
};

/**
 * The outcome composer's own values: flat, so ResourceForm can lay them out, and checked with the
 * same rules as the request (`leadOutcomeIssues` on `activityBody`), each problem on its field.
 */
export const activityFormSchema = z.object({
  type: z.enum(LOGGABLE_ACTIVITY_TYPES),
  outcome: z.enum(LEAD_OUTCOMES).optional(),
  summary: z.string().trim().max(1000).optional(),
  overrideNext: z.boolean().optional(),
  resolution: z.enum(WRONG_NUMBER_CHOICES.map((c) => c.value)).optional(),
  nextActionAt: z.string().optional(),
  nextActionType: z.enum(NEXT_ACTION_TYPES).optional(),
  nextActionNote: z.string().trim().max(300).optional(),
  lostCategory: z.enum(LOST_CATEGORIES).optional(),
  lostReason: z.string().trim().max(500).optional(),
}).superRefine((values, ctx) => {
  const body = activityBody(values);
  if (!body.summary) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['summary'], message: 'Say what happened' });
  if (OUTCOMES_NEXT_OR_CLOSE.includes(body.outcome) && !values.resolution) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['resolution'], message: 'Set a next action or close the lead' });
    return;
  }
  const seen = new Set();
  for (const issue of leadOutcomeIssues(body)) {
    const path = FORM_PATHS[issue.path.join('.')] ?? issue.path[0];
    if (seen.has(path)) continue;
    seen.add(path);
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: [path], message: issue.message });
  }
});

/** `PATCH /admin/leads/:id/next-action` — set (at + type) or clear (`at: null`). */
export const nextActionSchema = z.object({
  at: z.string({ required_error: 'Say when' }).datetime({ offset: true, message: 'Pick a date and time' }),
  type: z.enum(NEXT_ACTION_TYPES, { errorMap: () => ({ message: 'Say what to do next' }) }),
  note: blankToUndefined(300),
});

/** A whole count from a number box: empty is "not known yet". */
const optionalCount = (max, message) => z.preprocess(
  (v) => (v === '' || v === null || Number.isNaN(v) ? undefined : v),
  z.coerce.number().int('Whole numbers only').min(0, 'Cannot be negative').max(max, message).optional(),
);

/**
 * `Lead.qualification` (PUT /admin/leads/:id) — what sales learns on the first call. Every part is
 * optional: the card says what is still missing. The budget band is a label, never an amount.
 */
export const qualificationSchema = z.object({
  propertyType: z.enum(PROPERTY_TYPES).optional(),
  floors: optionalCount(60, 'At most 60 floors'),
  buildingAgeYears: optionalCount(300, 'At most 300 years'),
  budgetBand: z.enum(BUDGET_BANDS).optional(),
  decisionMaker: z.enum(DECISION_MAKERS).optional(),
  note: blankToUndefined(500),
});

/**
 * Who opens the door when it is not the customer — the caretaker while the owner is abroad — and how to
 * find the house (Phase L5). Top-level fields of the API's `leadConvertSchema`, stored on the visit's site.
 */
const siteContactShape = {
  siteContactName: blankToUndefined(120),
  siteContactPhone: optionalPhone,
  landmark: blankToUndefined(200),
};

/** The API refuses a number with nobody's name on it. */
function siteContactIssue(values, ctx) {
  if (values.siteContactPhone && !values.siteContactName) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['siteContactName'], message: 'Say whose number this is' });
  }
}

/** The site contact and landmark as request fields: only what was filled. */
export const siteContactBody = ({ siteContactName, siteContactPhone, landmark }) => ({
  ...(siteContactName ? { siteContactName } : {}),
  ...(siteContactPhone ? { siteContactPhone } : {}),
  ...(landmark ? { landmark } : {}),
});

/** The site a convert books against — the API's `leadConvertSchema.site`, plus the site contact and landmark. */
export const convertSiteSchema = z.object({
  label: z.string().trim().min(1).max(120),
  address: z.string().trim().min(3, 'Where is the work?').max(400),
  area: z.string().trim().max(120).optional(),
  createQuotation: z.boolean(),
  ...siteContactShape,
}).superRefine(siteContactIssue);

const HH_MM = /^([01]\d|2[0-3]):[0-5]\d$/;

/** The API's words for a window that ends before it starts; null while the window is in order (or not picked yet). */
export function visitWindowIssue(startTime, endTime) {
  if (!HH_MM.test(startTime ?? '') || !HH_MM.test(endTime ?? '')) return null;
  return endTime <= startTime ? 'The window must end after it starts' : null;
}

/**
 * "Book the site visit" (`ScheduleVisitDialog`, Phase L5): the day and the window's start and end in
 * Kathmandu time (`HH:mm`), the surveyor, the address, and the site contact and landmark. The window
 * cannot cross midnight: an end at or before the start is refused, as the API refuses it.
 * `visitBookingBody` turns the parsed values into the convert request.
 */
export const visitBookingSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Pick the day'),
  startTime: z.string().regex(HH_MM, 'Pick a start time'),
  endTime: z.string().regex(HH_MM, 'Pick an end time'),
  surveyorId: z.string().optional().transform((v) => v || undefined),
  address: z.string().trim().max(400).optional()
    .refine((v) => !v || v.length >= 3, 'Where is the work?')
    .transform((v) => v || undefined),
  ...siteContactShape,
}).superRefine((values, ctx) => {
  const window = visitWindowIssue(values.startTime, values.endTime);
  if (window) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['endTime'], message: window });
  siteContactIssue(values, ctx);
});

/**
 * The booking's parsed values → the inspection fields of `POST /admin/leads/:id/convert`. The instants
 * are built at Kathmandu's fixed +05:45 (`fromKathmanduParts`), never from the browser's clock.
 */
export function visitBookingBody(values) {
  return {
    createInspectionJob: true,
    scheduledStart: fromKathmanduParts(values.date, values.startTime),
    scheduledEnd: fromKathmanduParts(values.date, values.endTime),
    ...(values.surveyorId ? { surveyorId: values.surveyorId } : {}),
    ...(values.address ? { site: { label: 'Primary site', address: values.address } } : {}),
    ...siteContactBody(values),
  };
}
