import { z } from 'zod';

/** The longest note a customer can leave with "Need another time" — the API's limit. */
export const VISIT_NOTE_MAX = 500;

/**
 * `POST /public/visits/:token/respond` (Phase L5) — mirrors the API's `visitResponseSchema` in
 * `MaintainanceBackend/src/shared/schemas/ops.js`: the answer, and an optional note of at most 500 characters.
 */
export const visitResponseSchema = z.object({
  answer: z.enum(['confirm', 'reschedule']),
  note: z.string().trim().max(VISIT_NOTE_MAX).optional(),
}).strict();
