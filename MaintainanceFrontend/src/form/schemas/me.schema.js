import { z } from 'zod';

/** Mirrors the API's `shared/schemas/me.js`: the shell's pinned shortcuts and sticky notes. */
export const MAX_SHORTCUTS = 12;
export const MAX_NOTES = 100;

export const NOTE_COLORS = ['yellow', 'blue', 'green', 'pink', 'purple'];

/** An address inside the back office — never another site, never a protocol-relative URL. */
export const ADMIN_PATH = /^\/admin(?:[/?][^\s#\\]*)?$/;

export const adminPath = z.string().trim().max(300)
  .regex(ADMIN_PATH, 'Pick a back-office page')
  .refine((v) => !v.includes('//'), 'Pick a back-office page');

export const shortcutSchema = z.object({
  label: z.string().trim().min(1, 'Give it a name').max(40, 'At most 40 characters'),
  to: adminPath,
  icon: z.string().regex(/^[A-Za-z0-9]+$/).max(40).optional(),
});

export const noteSchema = z.object({
  body: z.string().trim().min(1, 'Write something first').max(2000, 'At most 2000 characters'),
  color: z.enum(NOTE_COLORS).default('yellow'),
  isPinned: z.boolean().optional(),
});
