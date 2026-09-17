import { z } from 'zod';
import { email, password } from './fields';

export const loginSchema = z.object({ email, password });

export const loginDefaults = { email: '', password: '' };

/** Mirrors the API's password rule (`shared/schemas/auth.js`). */
export const newPassword = z.string()
  .min(8, 'Use at least 8 characters')
  .max(128, 'Use at most 128 characters')
  .refine((v) => /[a-z]/.test(v) && /[A-Z0-9]/.test(v), 'Mix lower-case letters with capitals or numbers');

/** The page a reset or invite link opens. */
export const resetPasswordSchema = z.object({
  password: newPassword,
  confirm: z.string().min(1, 'Type the password again'),
}).refine((v) => v.password === v.confirm, { path: ['confirm'], message: 'The two passwords are different' });

export const forgotPasswordSchema = z.object({ email });
