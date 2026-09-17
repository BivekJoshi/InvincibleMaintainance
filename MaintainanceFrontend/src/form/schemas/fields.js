import { z } from 'zod';
import { NEPAL_PHONE, SUPPORTED_LOCALES, normalisePhone } from '@/config/locale';

/**
 * Field-level building blocks shared by every form. Compose these rather than
 * re-typing a validation rule — a phone number that is valid on the booking
 * wizard has to be valid on the enquiry form too.
 */

export const personName = z.string().trim().min(2, 'Please enter your name').max(120);

/**
 * A mobile (`+977 9808338255`, `977-9808338255`, `9808338255`) or a landline with its
 * area code (`01-5407720`); emits it without spaces or the country code.
 */
export const nepaliPhone = z.string().trim()
  .transform(normalisePhone)
  .refine((v) => NEPAL_PHONE.test(v), 'Enter a valid Nepali number, e.g. 9808338255 or 01-5407720');

/** An optional second number: empty is fine, anything typed must be a Nepali number. */
export const optionalPhone = z.union([nepaliPhone, z.literal('')]).optional().transform((v) => v || undefined);

export const email = z.string().trim().min(1, 'Email is required').email('Enter a valid email address');

/**
 * A contact's optional email, trimmed and lower-cased as the API stores it — a later
 * customer account finds its history by this address, so `Sita@X.com ` and `sita@x.com`
 * must be the same one.
 */
export const optionalEmail = z.union([
  z.string().trim().email('Enter a valid email address').toLowerCase(),
  z.literal(''),
]).optional().transform((v) => v || undefined);

/** The language a customer is written to. */
export const preferredLocale = z.enum(SUPPORTED_LOCALES);
export const password = z.string().min(1, 'Password is required');

export const address = z.string().trim().max(400);
export const requiredAddress = address.min(4, 'Where should the engineer come?');

export const message = z.string().trim().max(4000).optional();
export const optionalId = z.string().optional();
export const optionalText = z.string().trim().max(20000).optional().or(z.literal('')).transform((v) => v || undefined);

/** Money arrives from inputs in rupees; the API converts to integer paisa. */
export const rupees = z.coerce.number().min(0, 'Cannot be negative').finite();
