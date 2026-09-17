import { z } from 'zod';
import { id } from './common.js';

/** The caller's own admin-shell preferences: the quick-links bar and sticky notes. */

export const MAX_SHORTCUTS = 12;
export const MAX_NOTES = 100;

export const NOTE_COLORS = ['yellow', 'blue', 'green', 'pink', 'purple'];
export const noteColor = z.enum(NOTE_COLORS);

/**
 * An in-app admin path: `/admin`, `/admin/...` or `/admin?...`. Never a scheme, a
 * protocol-relative `//host`, a backslash or whitespace, so a shortcut can only ever
 * navigate inside the back office.
 */
export const ADMIN_PATH_RE = /^\/admin(?:[/?]|$)/;
export const adminPath = z
  .string()
  .trim()
  .min(1)
  .max(300)
  .refine(
    (v) => ADMIN_PATH_RE.test(v) && !v.includes('//') && !/[\s\\]/.test(v) && !/^[a-z][a-z0-9+.-]*:/i.test(v),
    'Enter an admin path that starts with /admin',
  );

const label = z.string().trim().min(1).max(40);
const icon = z.string().trim().max(40).regex(/^[A-Za-z0-9]+$/, 'Icon names are letters and digits only');

const atLeastOne = (v) => Object.values(v).some((x) => x !== undefined);
const atLeastOneMessage = { message: 'Change at least one field' };

export const shortcutCreateSchema = z.object({
  label,
  to: adminPath,
  icon: icon.optional(),
});

export const shortcutUpdateSchema = z
  .object({ label: label.optional(), icon: icon.optional() })
  .refine(atLeastOne, atLeastOneMessage);

export const shortcutOrderSchema = z.object({
  ids: z.array(id).min(1).max(MAX_SHORTCUTS),
});

const noteBody = z.string().trim().min(1).max(2000);

export const noteCreateSchema = z.object({
  body: noteBody,
  color: noteColor.default('yellow'),
  isPinned: z.boolean().optional(),
});

export const noteUpdateSchema = z
  .object({ body: noteBody.optional(), color: noteColor.optional(), isPinned: z.boolean().optional() })
  .refine(atLeastOne, atLeastOneMessage);
