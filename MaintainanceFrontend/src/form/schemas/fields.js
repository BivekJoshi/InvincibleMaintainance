import { z } from 'zod';
import { NEPAL_PHONE, normalisePhone } from '@/config/locale';

/**
 * Field-level building blocks shared by every form. Compose these rather than
 * re-typing a validation rule — a phone number that is valid on the booking
 * wizard has to be valid on the enquiry form too.
 */

export const personName = z.string().trim().min(2, 'Please enter your name').max(120);

/** Accepts `+977 9808338255`, `977-9808338255` or `9808338255`; emits the bare digits. */
export const nepaliPhone = z.string().trim()
  .transform(normalisePhone)
  .refine((v) => NEPAL_PHONE.test(v), 'Enter a valid Nepali number, e.g. 9808338255');

export const email = z.string().trim().min(1, 'Email is required').email('Enter a valid email address');
export const password = z.string().min(1, 'Password is required');

export const address = z.string().trim().max(400);
export const requiredAddress = address.min(4, 'Where should the engineer come?');

export const message = z.string().trim().max(4000).optional();
export const optionalId = z.string().optional();

/** Money arrives from inputs in rupees; the API converts to integer paisa. */
export const rupees = z.coerce.number().min(0, 'Cannot be negative').finite();
