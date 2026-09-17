import { z } from 'zod';
import { email, optionalPhone, personName } from './fields';
import { ROLES } from '@/config/constants';

/**
 * A staff account, as the users sheet edits it. Mirrors the API's `createUserSchema` /
 * `updateUserSchema` (`shared/schemas/auth.js`) minus the password, which admins never
 * set: a new account gets an email to choose one.
 */
export const userSchema = z.object({
  name: personName,
  email: email.toLowerCase(),
  phone: optionalPhone,
  role: z.enum(ROLES, { errorMap: () => ({ message: 'Pick a role' }) }),
  isActive: z.boolean(),
});

export const userDefaults = { name: '', email: '', phone: '', role: 'SALES', isActive: true };
