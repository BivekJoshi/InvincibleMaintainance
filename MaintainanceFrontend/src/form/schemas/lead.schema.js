import { z } from 'zod';
import {
  personName, nepaliPhone, optionalPhone, optionalEmail, preferredLocale, address, message, optionalId, optionalText,
  rupees,
} from './fields';
import { LEAD_SOURCES, LOGGABLE_ACTIVITY_TYPES, PRIORITIES } from '@/config/constants';

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

/** Marking a lead lost needs a reason (the API refuses LOST without one). */
export const lostReasonSchema = z.object({
  lostReason: z.string().trim().min(3, 'Say why the lead was lost').max(500),
});

/** One entry in the activity composer. */
export const leadActivitySchema = z.object({
  type: z.enum(LOGGABLE_ACTIVITY_TYPES),
  summary: z.string().trim().min(1, 'Say what happened').max(1000),
});

/** The site a convert books against — the API's `leadConvertSchema.site`. */
export const convertSiteSchema = z.object({
  label: z.string().trim().min(1).max(120),
  address: z.string().trim().min(3, 'Where is the work?').max(400),
  area: z.string().trim().max(120).optional(),
  createQuotation: z.boolean(),
});
