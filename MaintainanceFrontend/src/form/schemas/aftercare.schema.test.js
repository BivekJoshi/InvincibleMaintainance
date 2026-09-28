import { describe, expect, it } from 'vitest';
import {
  amcContractEditSchema, amcContractSchema, amcSchedulePreviewSchema, claimAcceptSchema, claimRejectSchema,
  serviceReminderSchema, warrantyEditSchema, warrantyVoidSchema,
} from '@/form/schemas/aftercare.schema';
// The API's own rules. Outside `src/`, so `@/` cannot reach them.
import {
  amcContractSchema as apiAmcContract, amcContractUpdateSchema as apiAmcUpdate, amcSchedulePreviewSchema as apiPreview,
  serviceReminderSchema as apiReminder, warrantyClaimDecisionSchema as apiDecision, warrantyUpdateSchema as apiWarrantyUpdate,
  warrantyVoidSchema as apiVoid,
} from '../../../../MaintainanceBackend/src/shared/schemas/ops.js';

/** A Kathmandu day's start, as the date field holds it. */
const day = (d) => new Date(`${d}T00:00:00+05:45`).toISOString();

/** Each body goes through both schemas, and both must agree. */
const both = (ours, theirs, cases) => it.each(cases)('%j → %s on both sides', (body, ok) => {
  expect(ours.safeParse(body).success, 'the form').toBe(ok);
  expect(theirs.safeParse(body).success, 'the API').toBe(ok);
});

const CONTRACT = {
  customerId: 'c1', planName: 'Annual Home Care — Standard', coveredServices: ['Plumbing', 'वाटरप्रुफिङ'],
  startDate: day('2026-10-01'), endDate: day('2027-09-30'), visitsPerYear: 4, amount: 24000.5, billingCycle: 'annual',
};

describe('aftercare forms mirror the API (Phase I)', () => {
  describe('warranty edit', () => {
    both(warrantyEditSchema, apiWarrantyUpdate, [
      [{ scope: 'Workmanship — छत', endsAt: day('2026-12-31') }, true],
      [{ scope: 'x'.repeat(2001), endsAt: day('2026-12-31') }, false],
      [{ endsAt: 'not a date' }, false],
    ]);
    it('never sends a status or a reason, which the API refuses', () => {
      const out = warrantyEditSchema.parse({ scope: 'Tiles', endsAt: day('2026-12-31'), status: 'VOID', voidReason: 'x' });
      expect(out).toEqual({ scope: 'Tiles', endsAt: day('2026-12-31') });
      expect(apiWarrantyUpdate.safeParse({ status: 'VOID' }).success).toBe(false);
    });
  });

  describe('warranty void', () => {
    both(warrantyVoidSchema, apiVoid, [
      [{ reason: 'The customer had it redone elsewhere' }, true],
      [{ reason: 'ग्राहकले अरूबाट काम गराए' }, true],
      [{ reason: 'no' }, false],
      [{ reason: '   ' }, false],
      [{}, false],
      [{ reason: 'x'.repeat(501) }, false],
    ]);
  });

  describe('claim decisions', () => {
    const accept = (b) => ({ status: 'accepted', ...claimAcceptSchema.parse(b) });
    it('accepts with or without a start, as the API does', () => {
      expect(apiDecision.safeParse(accept({})).success).toBe(true);
      expect(apiDecision.safeParse(accept({ scheduledStart: '2026-10-02T04:15:00.000Z' })).success).toBe(true);
      expect(claimAcceptSchema.safeParse({ scheduledStart: 'soon' }).success).toBe(false);
    });
    it.each([
      [{ rejectReason: 'The crack is in a wall we did not touch' }, true],
      [{ rejectReason: 'हाम्रो कामको भाग होइन' }, true],
      [{ rejectReason: '' }, false],
      [{ rejectReason: '   ' }, false],
      [{}, false],
      [{ rejectReason: 'x'.repeat(501) }, false],
    ])('reject %j → %s on both sides', (body, ok) => {
      expect(claimRejectSchema.safeParse(body).success).toBe(ok);
      expect(apiDecision.safeParse({ status: 'rejected', ...body }).success).toBe(ok);
    });
  });

  describe('AMC contract', () => {
    both(amcContractSchema, apiAmcContract, [
      [CONTRACT, true],
      [{ ...CONTRACT, siteId: null, notes: 'Renewal of AMC-2083-0001' }, true],
      [{ ...CONTRACT, endDate: CONTRACT.startDate }, false],
      [{ ...CONTRACT, endDate: day('2032-01-01') }, false],
      [{ ...CONTRACT, visitsPerYear: 0 }, false],
      [{ ...CONTRACT, visitsPerYear: 53 }, false],
      [{ ...CONTRACT, amount: -1 }, false],
      [{ ...CONTRACT, billingCycle: 'weekly' }, false],
      [{ ...CONTRACT, planName: 'x' }, false],
      [{ ...CONTRACT, customerId: '' }, false],
    ]);
    it('refuses an empty or unreadable amount (the money field holds undefined or NaN)', () => {
      expect(amcContractSchema.safeParse({ ...CONTRACT, amount: undefined }).success).toBe(false);
      expect(amcContractSchema.safeParse({ ...CONTRACT, amount: Number.NaN }).success).toBe(false);
    });
    both(amcSchedulePreviewSchema, apiPreview, [
      [{ startDate: CONTRACT.startDate, endDate: CONTRACT.endDate, visitsPerYear: 4 }, true],
      [{ startDate: CONTRACT.startDate, endDate: CONTRACT.startDate, visitsPerYear: 4 }, false],
      [{ startDate: CONTRACT.startDate, endDate: CONTRACT.endDate, visitsPerYear: 60 }, false],
    ]);
    it('an edit never carries the schedule, which the API refuses (a new schedule is a renewal)', () => {
      const out = amcContractEditSchema.parse({ ...CONTRACT, status: 'active', id: 'a1', siteId: '' });
      expect(Object.keys(out).sort()).toEqual(['amount', 'billingCycle', 'coveredServices', 'planName', 'siteId']);
      expect(out.siteId).toBeNull();
      expect(apiAmcUpdate.safeParse(out).success).toBe(true);
      expect(apiAmcUpdate.safeParse({ ...out, visitsPerYear: 6 }).success).toBe(false);
    });
  });

  describe('service reminder', () => {
    const R = { customerId: 'c1', dueAt: '2026-10-02T04:15:00.000Z', channel: 'sms', message: 'नमस्ते! मनसुनअघि छत जाँच गरौँ।' };
    both(serviceReminderSchema, apiReminder, [
      [R, true],
      [{ ...R, channel: 'email', jobId: null, serviceId: null }, true],
      [{ ...R, message: 'Hi' }, false],
      [{ ...R, message: 'x'.repeat(1001) }, false],
      [{ ...R, channel: 'viber' }, false],
      [{ ...R, dueAt: 'tomorrow' }, false],
    ]);
  });
});
