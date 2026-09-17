import { z } from 'zod';

/** Mirrors the API's `messageTemplateSchema` (`shared/schemas/ops.js`). */
export const MESSAGE_TEMPLATE_KEY = /^[a-z][a-z0-9_]*$/;

export const messageTemplateSchema = z.object({
  key: z.string().trim().min(2, 'At least 2 characters').max(80)
    .regex(MESSAGE_TEMPLATE_KEY, 'Use lower-case letters, digits and underscores (quotation_sent)'),
  channel: z.enum(['sms', 'email', 'inapp']),
  locale: z.enum(['en', 'ne']),
  subject: z.string().trim().max(250).optional().or(z.literal('')).transform((v) => v || undefined),
  body: z.string().trim().min(2, 'Write the message').max(5000),
  isActive: z.boolean(),
});
