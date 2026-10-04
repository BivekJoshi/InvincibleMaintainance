import { z } from 'zod';
import { vKey } from '@/form/zodMessages';
import { email, password } from './fields';

export const loginSchema = z.object({ email, password });

export const loginDefaults = { email: '', password: '' };

/** The shortest password the API accepts — the reset page says it, as well as checking it. */
export const PASSWORD_MIN = 8;

/**
 * Mirrors the API's password rule (`shared/schemas/auth.js`). The length limits carry no words of their own — the
 * error map says "At least 8 characters" in the page's language; the other messages are keys (Phase J1).
 */
export const newPassword = z.string()
  .min(PASSWORD_MIN)
  .max(128)
  .refine((v) => /[a-z]/.test(v) && /[A-Z0-9]/.test(v), vKey('passwordMix'));

/** The page a reset or invite link opens. */
export const resetPasswordSchema = z.object({
  password: newPassword,
  confirm: z.string().min(1, vKey('passwordAgain')),
}).refine((v) => v.password === v.confirm, { path: ['confirm'], message: vKey('passwordsDiffer') });

export const forgotPasswordSchema = z.object({ email });
