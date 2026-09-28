import { describe, expect, it } from 'vitest';
import { visitResponseSchema } from '@/form/schemas/visit.schema';
// The API's own rule. Outside `src/`, so `@/` cannot reach it.
import { visitResponseSchema as apiVisitResponseSchema } from '../../../../MaintainanceBackend/src/shared/schemas/ops.js';

const CASES = [
  [{ answer: 'confirm' }, true],
  [{ answer: 'reschedule', note: 'बिहान १० बजेपछि मात्र — please call first' }, true],
  [{ answer: 'reschedule', note: 'x'.repeat(500) }, true],
  [{ answer: 'reschedule', note: 'x'.repeat(501) }, false],
  [{ answer: 'maybe' }, false],
  [{ answer: 'confirm', extra: true }, false],
  [{}, false],
];

describe('the visit answer mirrors the API (Phase L5)', () => {
  it.each(CASES)('%j → %s on both sides', (body, ok) => {
    expect(visitResponseSchema.safeParse(body).success).toBe(ok);
    expect(apiVisitResponseSchema.safeParse(body).success).toBe(ok);
  });
});
