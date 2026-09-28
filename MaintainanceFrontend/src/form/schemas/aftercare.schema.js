import { z } from 'zod';
import { optionalText } from './fields';
import { AMC_BILLING_CYCLES } from '@/config/constants';

/**
 * Aftercare's forms (Phase I). Mirrors MaintainanceBackend/src/shared/schemas/ops.js — `warrantyUpdateSchema`,
 * `warrantyVoidSchema`, `warrantyClaimDecisionSchema`, `amcContractSchema`, `amcSchedulePreviewSchema`,
 * `amcContractUpdateSchema` and `serviceReminderSchema`; `aftercare.schema.test.js` runs the same bodies through
 * both. Change them together. Money is in rupees (the API stores paisa); dates are the UTC ISO strings the date
 * fields hold. Unlike the API's `.strict()` bodies these strip what they do not name, because a form starts from
 * the whole record — so a request never carries a status or a schedule the API would refuse.
 */

/** A picked day or time: the ISO string a date field holds. */
const isoDate = (message) => z.string({ required_error: message, invalid_type_error: message })
  .min(1, message)
  .refine((v) => !Number.isNaN(Date.parse(v)), message);
const optionalIsoDate = z.string().optional().nullable()
  .refine((v) => !v || !Number.isNaN(Date.parse(v)), 'Pick a date')
  .transform((v) => v || undefined);

/** A relation or select left empty is sent as null (unlinked). */
const optionalId = z.string().optional().nullable().transform((v) => v || null);

// ── warranties

/** `PUT /admin/warranties/:id` — the scope and the end date only. */
export const warrantyEditSchema = z.object({
  scope: z.string().trim().max(2000).optional(),
  endsAt: isoDate('Pick the last day of cover'),
});

/** `POST /admin/warranties/:id/void` — why the certificate stops covering the work. */
export const warrantyVoidSchema = z.object({
  reason: z.string({ required_error: 'Say why, in a few words' }).trim().min(3, 'Say why, in a few words').max(500),
});

// ── claims (`PATCH /admin/warranty-claims/:id`)

/** Accept: the free job's start is optional — without one it waits unscheduled in the dispatch queue. */
export const claimAcceptSchema = z.object({
  scheduledStart: optionalIsoDate,
});

/** Reject: the customer is sent the reason, so one is required. */
export const claimRejectSchema = z.object({
  rejectReason: z.string({ required_error: 'Say why — the customer is sent this reason' })
    .trim().min(1, 'Say why — the customer is sent this reason').max(500),
});

// ── AMC contracts

const planName = z.string({ required_error: 'Name the plan' }).trim().min(2, 'Name the plan').max(160);
const coveredServices = z.array(z.string().trim().min(1).max(120)).max(50).optional();
/** The contract's price in rupees. An empty field holds undefined and an unreadable one NaN — both refused. */
const amount = z.coerce.number({ invalid_type_error: 'Enter the amount in rupees, e.g. 24,000' })
  .min(0, 'Cannot be negative').max(1_000_000_000, 'Too large').finite();
const billingCycle = z.enum(AMC_BILLING_CYCLES);
const FIVE_YEARS_MS = 5 * 366 * 86_400_000;

/** The schedule's three inputs, as `POST /admin/amc-contracts/preview` takes them. */
const scheduleFields = {
  startDate: isoDate('Pick the start date'),
  endDate: isoDate('Pick the end date'),
  visitsPerYear: z.coerce.number({ invalid_type_error: 'How many visits a year?' }).int('Whole visits').min(1, 'At least one').max(52, 'At most 52').default(4),
};
const endAfterStart = (v) => !v.startDate || !v.endDate || Date.parse(v.endDate) > Date.parse(v.startDate);
const atMostFiveYears = (v) => !v.startDate || !v.endDate || Date.parse(v.endDate) - Date.parse(v.startDate) <= FIVE_YEARS_MS;

export const amcContractSchema = z.object({
  customerId: z.string({ required_error: 'Choose the customer', invalid_type_error: 'Choose the customer' }).min(1, 'Choose the customer'),
  siteId: optionalId,
  planName,
  coveredServices,
  ...scheduleFields,
  amount,
  billingCycle: billingCycle.default('annual'),
  notes: optionalText,
})
  .refine(endAfterStart, { message: 'End date must be after the start date', path: ['endDate'] })
  .refine(atMostFiveYears, { message: 'A contract runs five years at most', path: ['endDate'] });

/** The preview's body, from the create form's values — or null while they cannot make a schedule yet. */
export const amcSchedulePreviewSchema = z.object(scheduleFields)
  .refine(endAfterStart, { message: 'End date must be after the start date', path: ['endDate'] })
  .refine(atMostFiveYears, { message: 'A contract runs five years at most', path: ['endDate'] });

/** `PUT /admin/amc-contracts/:id` — everything but the schedule, which a renewal replaces. */
export const amcContractEditSchema = z.object({
  siteId: optionalId,
  planName,
  coveredServices,
  amount,
  billingCycle,
  notes: optionalText,
});

// ── service reminders

export const serviceReminderSchema = z.object({
  customerId: z.string({ required_error: 'Choose the customer', invalid_type_error: 'Choose the customer' }).min(1, 'Choose the customer'),
  jobId: optionalId,
  serviceId: optionalId,
  dueAt: isoDate('When should it go out?'),
  channel: z.enum(['sms', 'email']).default('sms'),
  message: z.string({ required_error: 'Write the message' }).trim().min(5, 'At least 5 characters').max(1000, 'At most 1000 characters'),
});
