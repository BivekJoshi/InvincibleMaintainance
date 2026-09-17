import { z } from 'zod';
import { optionalText, rupees } from './fields';
import { JOB_PHOTO_KINDS, JOB_TYPES, PRIORITIES } from '@/config/constants';

/**
 * The job forms. Mirrors MaintainanceBackend/src/shared/schemas/ops.js (`jobSchema`,
 * `jobScheduleSchema`, `jobAssignSchema`, `jobStatusSchema`, `jobCompleteSchema`, `jobTaskSchema`,
 * `jobPhotoSchema`, `jobMaterialSchema`, `timeLogCreateSchema`) — change both together. Times are
 * the UTC ISO strings the datetime field produces; money is in rupees.
 */

const instant = (label) => z.string({ required_error: `Choose the ${label}` }).min(1, `Choose the ${label}`);
const optionalInstant = z.string().optional();
const technicianIds = z.array(z.string()).max(20, 'At most 20 technicians');
const endAfterStart = (v) => !v.scheduledStart || !v.scheduledEnd || new Date(v.scheduledEnd) > new Date(v.scheduledStart);
const leadIsOnJob = (v) => !v.leadTechnicianId || (v.technicianIds ?? []).includes(v.leadTechnicianId);

/** New job. A quotation must be the customer's and accepted; the API checks both. */
export const jobCreateSchema = z.object({
  customerId: z.string({ required_error: 'Choose the customer' }).min(1, 'Choose the customer'),
  siteId: z.string().optional().nullable(),
  quotationId: z.string().optional().nullable(),
  templateId: z.string().optional().nullable(),
  type: z.enum(JOB_TYPES).default('REPAIR'),
  title: z.string().trim().min(2, 'Give the job a title').max(250),
  description: optionalText,
  priority: z.enum(PRIORITIES).default('NORMAL'),
  scheduledStart: optionalInstant,
  scheduledEnd: optionalInstant,
  isBillable: z.coerce.boolean().default(true),
  technicianIds: technicianIds.optional(),
  leadTechnicianId: z.string().optional(),
})
  .refine(endAfterStart, { message: 'End time must be after the start time', path: ['scheduledEnd'] })
  .refine((v) => !v.scheduledEnd || v.scheduledStart, { message: 'Give a start time too', path: ['scheduledStart'] })
  .refine(leadIsOnJob, { message: 'The lead must be one of the technicians on the job', path: ['leadTechnicianId'] });

/** Edit details — never the status. */
export const jobUpdateSchema = z.object({
  type: z.enum(JOB_TYPES),
  title: z.string().trim().min(2).max(250),
  description: optionalText,
  priority: z.enum(PRIORITIES),
  isBillable: z.coerce.boolean(),
});

/** The Schedule dialog — the board's non-drag path. At least one technician once people are chosen. */
export const jobScheduleSchema = z.object({
  scheduledStart: instant('start'),
  scheduledEnd: instant('end'),
  technicianIds: technicianIds.min(1, 'Choose at least one technician'),
  leadTechnicianId: z.string().optional(),
  note: z.string().trim().max(1000).optional(),
  notifyCustomer: z.coerce.boolean().default(true),
})
  .refine(endAfterStart, { message: 'End time must be after the start time', path: ['scheduledEnd'] })
  .refine((v) => new Date(v.scheduledEnd) - new Date(v.scheduledStart) <= 14 * 86_400_000, {
    message: 'A visit cannot be longer than 14 days', path: ['scheduledEnd'],
  })
  .refine(leadIsOnJob, { message: 'The lead must be one of the technicians on the job', path: ['leadTechnicianId'] });

export const jobAssignSchema = z.object({
  technicianIds: technicianIds.min(1, 'Choose at least one technician'),
  leadTechnicianId: z.string().optional(),
  note: z.string().trim().max(1000).optional(),
}).refine(leadIsOnJob, { message: 'The lead must be one of the technicians on the job', path: ['leadTechnicianId'] });

/** Hold, cancel and reopen ask why; the first two need an answer. */
export const jobNoteSchema = z.object({ note: z.string().trim().max(2000).optional() });
export const jobRequiredNoteSchema = z.object({
  note: z.string().trim().min(3, 'Say why, in a few words').max(2000),
});

export const jobCompleteSchema = z.object({
  note: z.string().trim().max(4000).optional(),
  signatureMediaId: z.string().optional().nullable(),
  customerRating: z.coerce.number().int().min(1).max(5).optional(),
  customerFeedback: z.string().trim().max(2000).optional(),
  warrantyDays: z.coerce.number().int().min(0).max(3650).optional(),
  warrantyScope: z.string().trim().max(2000).optional(),
});

export const jobTaskSchema = z.object({
  title: z.string().trim().min(2, 'Give the item a title').max(300),
  note: z.string().trim().max(2000).optional(),
});

export const jobPhotoSchema = z.object({
  kind: z.enum(JOB_PHOTO_KINDS).default('DURING'),
  caption: z.string().trim().max(300).optional(),
});

/** Issue from stock. `rate` is the billed rate in rupees; empty means the material's sell rate. */
export const jobMaterialSchema = z.object({
  materialId: z.string({ required_error: 'Choose the material' }).min(1, 'Choose the material'),
  qty: z.coerce.number({ invalid_type_error: 'Enter the quantity' }).min(0.001, 'Enter the quantity').max(1_000_000),
  rate: rupees.max(1_000_000_000).optional(),
  isBillable: z.coerce.boolean().default(true),
});

/** Labour recorded by the office. Give an end time or a duration. */
export const timeLogSchema = z.object({
  technicianId: z.string({ required_error: 'Choose the technician' }).min(1, 'Choose the technician'),
  startedAt: instant('start'),
  endedAt: z.string().optional(),
  minutes: z.coerce.number().int().min(1).max(24 * 60).optional(),
  note: z.string().trim().max(500).optional(),
})
  .refine((v) => v.endedAt || v.minutes, { message: 'Give an end time or a duration in minutes', path: ['minutes'] })
  .refine((v) => !v.endedAt || new Date(v.endedAt) > new Date(v.startedAt), { message: 'End time must be after the start time', path: ['endedAt'] });

/** "Publish case study": what the draft starts from. The rest is edited in the project editor. */
export const caseStudyStartSchema = z.object({
  title: z.string().trim().min(3).max(200).optional().or(z.literal('')).transform((v) => v || undefined),
  includeClientName: z.coerce.boolean().default(false),
});
