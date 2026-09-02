import { z } from 'zod';
import { email, optionalPhone } from './common.js';
import { ROLES } from '../enums.js';

const password = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(128)
  .refine((v) => /[a-z]/.test(v) && /[A-Z0-9]/.test(v), 'Use a mix of upper/lowercase letters or numbers');

export const loginSchema = z.object({
  email,
  password: z.string().min(1, 'Password is required'),
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

export const createUserSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email,
  phone: optionalPhone,
  password,
  role: z.enum(ROLES),
  isActive: z.coerce.boolean().default(true),
  avatarId: z.string().optional(),
});

export const updateUserSchema = createUserSchema.partial().omit({ password: true }).extend({
  password: password.optional(),
});
