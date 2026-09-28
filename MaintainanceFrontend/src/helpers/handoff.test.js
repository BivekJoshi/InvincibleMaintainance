import { describe, expect, it } from 'vitest';
import {
  ADVANCE_LOCK_REASON, advanceInvoiceOf, advanceRefusal, advanceState, awaitingAdvanceOf, canOverrideAdvance, crewDays,
  crewVerdict, defaultCrewSize, formatQty, plannedEnd,
} from '@/helpers/handoff';
import { jobActions, jobWaitingFor } from '@/helpers/jobActions';
import { invoiceStageLine } from '@/helpers/finance';
import { can as roleCan } from '@/helpers/permissions';

const ctx = (role) => ({ can: (c) => roleCan(role, c) });
const ADVANCE = {
  required: true, gateOn: true, paid: false, overridden: false, override: null, awaitingAdvance: true,
  invoice: { id: 'inv-adv', number: 'INV-2083-0077', status: 'SENT', total: 4_118_850, paidAmount: 0, balance: 4_118_850 },
};

describe('the advance gate, as the office reads it (Phase L6)', () => {
  it('reads a detail’s advance or a list row’s flag', () => {
    expect(awaitingAdvanceOf({ advance: ADVANCE })).toBe(true);
    expect(awaitingAdvanceOf({ advance: { ...ADVANCE, awaitingAdvance: false } })).toBe(false);
    // The detail wins over a stale row flag.
    expect(awaitingAdvanceOf({ awaitingAdvance: true, advance: { ...ADVANCE, awaitingAdvance: false } })).toBe(false);
    expect(awaitingAdvanceOf({ awaitingAdvance: true })).toBe(true);
    expect(awaitingAdvanceOf({ status: 'DRAFT' })).toBe(false);
    expect(awaitingAdvanceOf(null)).toBe(false);
    expect(advanceInvoiceOf({ advanceInvoice: { id: 'i', number: 'INV-1', status: 'SENT' } })).toMatchObject({ number: 'INV-1' });
    expect(advanceInvoiceOf({ advance: ADVANCE })).toMatchObject({ number: 'INV-2083-0077' });
  });

  it('names each state of the advance', () => {
    expect(advanceState(null)).toBeNull();
    expect(advanceState({ required: false })).toBeNull();
    expect(advanceState(ADVANCE)).toMatchObject({ kind: 'awaiting', title: 'Waiting for the advance — scheduling is locked' });
    expect(advanceState({ ...ADVANCE, paid: true, awaitingAdvance: false, invoice: { ...ADVANCE.invoice, status: 'PAID' } }).kind).toBe('paid');
    expect(advanceState({ ...ADVANCE, overridden: true, awaitingAdvance: false }).kind).toBe('overridden');
    expect(advanceState({ ...ADVANCE, awaitingAdvance: false, invoice: { ...ADVANCE.invoice, status: 'VOID' } }).kind).toBe('void');
    expect(advanceState({ ...ADVANCE, gateOn: false, awaitingAdvance: false }).kind).toBe('unpaid');
  });

  it('offers the override to jobs:advance-override holders only, and only while the gate holds', () => {
    const job = { advance: ADVANCE };
    expect(canOverrideAdvance(job, ctx('MANAGER').can)).toBe(true);
    expect(canOverrideAdvance(job, ctx('ADMIN').can)).toBe(true);
    expect(canOverrideAdvance(job, ctx('DISPATCHER').can)).toBe(false);
    expect(canOverrideAdvance({ advance: { ...ADVANCE, awaitingAdvance: false } }, ctx('MANAGER').can)).toBe(false);
  });

  it('reads the 422 ADVANCE_UNPAID, and nothing else', () => {
    const err = {
      status: 422,
      data: { error: { code: 'ADVANCE_UNPAID', message: 'Job JOB-1 waits for its advance', details: { invoiceId: 'inv-adv', invoiceNumber: 'INV-2083-0077', balance: 4_118_850 } } },
    };
    expect(advanceRefusal(err)).toEqual({ message: 'Job JOB-1 waits for its advance', invoiceId: 'inv-adv', invoiceNumber: 'INV-2083-0077', balance: 4_118_850 });
    // A convert that would date the job answers before the invoice exists: no id yet.
    expect(advanceRefusal({ data: { error: { code: 'ADVANCE_UNPAID', message: 'x', details: { invoiceId: null, balance: 5 } } } }))
      .toMatchObject({ invoiceId: null, balance: 5 });
    expect(advanceRefusal({ data: { error: { code: 'VALIDATION_ERROR', message: 'x', details: [] } } })).toBeNull();
    expect(advanceRefusal(new Error('boom'))).toBeNull();
  });

  it('holds schedule, assign, the moves on and complete — never hold or cancel', () => {
    const held = { id: 'j1', status: 'DRAFT', assignments: [], tasks: [], scheduledStart: null, awaitingAdvance: true };
    const actions = jobActions(held, ctx('DISPATCHER'));
    expect(actions.find((a) => a.key === 'schedule')).toMatchObject({ label: 'Schedule', disabledReason: ADVANCE_LOCK_REASON });
    expect(actions.find((a) => a.key === 'assign').disabledReason).toBe(ADVANCE_LOCK_REASON);
    expect(actions.find((a) => a.to === 'CANCELLED').disabledReason).toBeUndefined();
    expect(jobWaitingFor(held)).toBe('Waiting for the customer’s advance');

    const onHold = { ...held, status: 'ON_HOLD', assignments: [{ technicianId: 't1', isLead: true }] };
    const moves = jobActions(onHold, ctx('ADMIN'));
    expect(moves.find((a) => a.to === 'IN_PROGRESS').disabledReason).toBe(ADVANCE_LOCK_REASON);
    expect(moves.find((a) => a.to === 'CANCELLED').disabledReason).toBeUndefined();

    const working = { ...onHold, status: 'IN_PROGRESS', tasks: [] };
    expect(jobActions(working, ctx('ADMIN')).find((a) => a.key === 'complete').disabledReason).toBe(ADVANCE_LOCK_REASON);
    expect(jobActions(working, ctx('ADMIN')).find((a) => a.to === 'ON_HOLD').disabledReason).toBeUndefined();

    // Paid (or overridden): nothing is held.
    const free = jobActions({ ...held, awaitingAdvance: false }, ctx('DISPATCHER'));
    expect(free.find((a) => a.key === 'schedule').disabledReason).toBeUndefined();
  });
});

describe('the crew calculator — labour days ÷ crew, rounded up (Phase L6)', () => {
  it('rounds a part day up to a whole one', () => {
    expect(crewDays(12.5, 2)).toBe(7);
    expect(crewDays(12.5, 3)).toBe(5);
    expect(crewDays(12, 3)).toBe(4);
    expect(crewDays(12.5, 1)).toBe(13);
    expect(crewDays('7.5', '2')).toBe(4);
  });

  it('is not fooled by float noise in a sum of days', () => {
    // 0.1 + 0.2 + … sums land a hair above a whole number: 12.000000000000002 ÷ 2 is 6, not 7.
    expect(crewDays(0.1 * 3 * 40, 2)).toBe(6);
    expect(crewDays(12.000000000000002, 2)).toBe(6);
  });

  it('has nothing to divide without labour or a crew', () => {
    expect(crewDays(0, 2)).toBe(0);
    expect(crewDays(10, 0)).toBe(0);
    expect(crewDays(10, 'x')).toBe(0);
  });

  it('starts from the people assigned, else two', () => {
    expect(defaultCrewSize({ crew: { size: 3 } })).toBe(3);
    expect(defaultCrewSize({ crew: { size: 0 } })).toBe(2);
    expect(defaultCrewSize(null)).toBe(2);
  });

  it('compares the duration with the planned days', () => {
    expect(crewVerdict(7, 8)).toEqual({ tone: 'success', text: 'Fits the plan — 7 of 8 planned days.' });
    expect(crewVerdict(13, 8)).toMatchObject({ tone: 'warning', text: expect.stringMatching(/^5 days over the 8 planned days/) });
    expect(crewVerdict(4, null).tone).toBe('muted');
    expect(crewVerdict(0, 8).tone).toBe('muted');
  });
});

describe('quantities and the planned window (Phase L6)', () => {
  it('writes a quantity without float noise, in Indian grouping', () => {
    expect(formatQty(1234.5)).toBe('1,234.5');
    expect(formatQty('240.000')).toBe('240');
    expect(formatQty(0.1 + 0.2)).toBe('0.3');
    expect(formatQty(null)).toBe('—');
  });

  it('ends a planned window plannedDays after the start, as the API does', () => {
    expect(plannedEnd('2026-10-05T04:15:00.000Z', 8)).toBe('2026-10-13T04:15:00.000Z');
    expect(plannedEnd('2026-10-05T04:15:00.000Z', 1.5)).toBe('2026-10-06T16:15:00.000Z');
    expect(plannedEnd('2026-10-05T04:15:00.000Z', null)).toBeNull();
    expect(plannedEnd(null, 8)).toBeNull();
  });
});

describe('an invoice’s payment stage in words (Phase L6)', () => {
  it('names the advance by its stage, without repeating the kind', () => {
    expect(invoiceStageLine({ kind: 'ADVANCE', paymentStage: { label: 'Advance', basisPoints: 5000, trigger: 'ON_ACCEPT' } }))
      .toBe('Advance — on acceptance (50%)');
    expect(invoiceStageLine({ kind: 'ADVANCE', paymentStage: { label: 'Mobilisation', basisPoints: 4000, trigger: 'ON_ACCEPT' } }))
      .toBe('Advance — Mobilisation (40%)');
    expect(invoiceStageLine({ kind: 'ADVANCE', paymentStage: null })).toBe('Advance — on acceptance');
    expect(invoiceStageLine({ kind: 'RUNNING', paymentStage: { label: 'Running bill 1', basisPoints: 3333, trigger: 'MILESTONE' } }))
      .toBe('Running bill — Running bill 1 (33.33%)');
    expect(invoiceStageLine({ kind: 'STANDARD', paymentStage: null })).toBeNull();
    expect(invoiceStageLine({})).toBeNull();
  });
});
