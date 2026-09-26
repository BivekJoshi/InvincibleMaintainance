import { z } from 'zod';
import { email, listQuery, optionalPhone } from './common.js';
import { ROLES, SESSION_CLIENTS } from '../enums.js';

const password = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(128)
  .refine((v) => /[a-z]/.test(v) && /[A-Z0-9]/.test(v), 'Use a mix of upper/lowercase letters or numbers');

export const loginSchema = z.object({
  email,
  password: z.string().min(1, 'Password is required'),
  /** Which app is signing in; it sets how long the session lasts. */
  client: z.enum(SESSION_CLIENTS).default('WEB'),
});

export const forgotPasswordSchema = z.object({ email });

export const resetPasswordSchema = z.object({
  token: z.string().min(20),
  password,
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  password,
});

/**
 * A staff account. The admin screen sends no password: the person gets an email to choose
 * one. `password` stays accepted here for scripts and tests.
 */
export const createUserSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email,
  phone: optionalPhone,
  password: password.optional(),
  role: z.enum(ROLES),
  isActive: z.coerce.boolean().default(true),
  avatarId: z.string().optional(),
});

/** Admins never set a password on an existing account — they send the reset link. */
export const updateUserSchema = createUserSchema.omit({ password: true }).partial().extend({
  isActive: z.boolean().optional(),
  password: z.any().refine((v) => v === undefined, 'Admins do not set passwords. Send a reset link instead.'),
});

/** GET /admin/users */
export const userListQuery = listQuery.pick({ page: true, limit: true, q: true }).extend({
  sort: z.enum(['name', '-name', 'email', '-email', 'role', '-role', 'lastLoginAt', '-lastLoginAt', 'createdAt', '-createdAt']).optional(),
  role: z.enum(ROLES).optional(),
  isActive: z.enum(['true', 'false']).optional(),
});
