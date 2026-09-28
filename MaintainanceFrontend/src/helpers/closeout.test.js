import { describe, expect, it } from 'vitest';
import {
  FINAL_BILL_BLOCKING, apiRefusal, contractTypeOf, finalBillAction, isMeasured, isOmission, measureLock, measurementState,
  mustMeasure, stageRaisable,
} from '@/helpers/closeout';
import { can as canFor } from '@/helpers/permissions';

const line = (patch = {}) => ({ id: 'l', quotedQty: 10, isProvisional: false, measuredQty: null, ...patch });
const canAs = (role) => (capability) => canFor(role, capability);

describe('closeout — which lines the contract measures (the API’s rule)', () => {
  it('ITEM_RATE measures every line but an omission; LUMP_SUM only a provisional line', () => {
    expect(mustMeasure(line(), 'ITEM_RATE')).toBe(true);
    expect(mustMeasure(line({ quotedQty: -40 }), 'ITEM_RATE')).toBe(false);
    expect(mustMeasure(line(), 'LUMP_SUM')).toBe(false);
    expect(mustMeasure(line({ isProvisional: true }), 'LUMP_SUM')).toBe(true);
    expect(mustMeasure(line({ isProvisional: true, quotedQty: -1 }), 'LUMP_SUM')).toBe(false);
    expect(isOmission(line({ quotedQty: -0.5 }))).toBe(true);
    expect(isMeasured(line({ measuredQty: 0 }))).toBe(true);
    expect(isMeasured(line())).toBe(false);
  });

  it('says where a job’s measurement stands — counts, never money', () => {
    const job = {
      quotation: { contractType: 'ITEM_RATE' },
      measurementClosedAt: null,
      lines: [line({ id: 'a', measuredQty: 252 }), line({ id: 'b' }), line({ id: 'c', quotedQty: -100 })],
    };
    expect(contractTypeOf(job)).toBe('ITEM_RATE');
    const state = measurementState(job);
    expect(state).toMatchObject({ contractType: 'ITEM_RATE', closed: false, required: 2, measured: 1 });
    expect(state.missing.map((l) => l.id)).toEqual(['b']);
    expect(measurementState({ ...job, quotation: { contractType: 'LUMP_SUM' } }).required).toBe(0);
    const closed = measurementState({ ...job, measurementClosedAt: '2026-09-27T09:00:00.000Z', measurementClosedBy: { name: 'Dispatch Desk' } });
    expect(closed).toMatchObject({ closed: true, closedBy: 'Dispatch Desk' });
    expect(measureLock(job.lines[2], state)).toMatch(/omission/);
    expect(measureLock(job.lines[1], closed)).toMatch(/closed/);
    expect(measureLock(job.lines[1], state)).toBeNull();
    expect(contractTypeOf({})).toBeNull();
  });
});

describe('closeout — bills', () => {
  it('a running bill is a MILESTONE stage nobody has billed', () => {
    expect(stageRaisable({ trigger: 'MILESTONE', billed: false })).toBe(true);
    expect(stageRaisable({ trigger: 'MILESTONE', billed: true })).toBe(false);
    expect(stageRaisable({ trigger: 'ON_ACCEPT', billed: false })).toBe(false);
    expect(stageRaisable({ trigger: 'ON_COMPLETION', billed: false })).toBe(false);
  });

  it('the final bill is offered to invoices:write on a BOQ job, off until it is finished, and once invoiced', () => {
    const job = { status: 'COMPLETED', isBillable: true, invoicedAt: null, lines: [line()] };
    expect(finalBillAction(job, canAs('ACCOUNTANT'))).toEqual({ show: true });
    expect(finalBillAction(job, canAs('DISPATCHER'))).toEqual({ show: false });
    expect(finalBillAction({ ...job, lines: [] }, canAs('ACCOUNTANT'))).toEqual({ show: false });
    expect(finalBillAction({ ...job, status: 'IN_PROGRESS' }, canAs('ACCOUNTANT')).disabledReason).toMatch(/Complete the job first/);
    expect(finalBillAction({ ...job, invoicedAt: '2026-10-20T04:00:00.000Z' }, canAs('ADMIN')).disabledReason).toMatch(/has been raised/);
    expect(finalBillAction({ ...job, isBillable: false }, canAs('ADMIN')).disabledReason).toMatch(/non-billable/);
    expect(Object.keys(FINAL_BILL_BLOCKING)).toEqual(['MEASUREMENT_INCOMPLETE', 'FINAL_BELOW_BILLED', 'FINAL_ALREADY_BILLED']);
  });

  it('reads an API refusal', () => {
    expect(apiRefusal(null)).toBeNull();
    expect(apiRefusal({ status: 422, data: { error: { code: 'MEASUREMENT_INCOMPLETE', message: '1 line(s)', details: [{ lineId: 'l2' }] } } }))
      .toEqual({ status: 422, code: 'MEASUREMENT_INCOMPLETE', message: '1 line(s)', details: [{ lineId: 'l2' }] });
    expect(apiRefusal({ status: 'FETCH_ERROR' })).toEqual({ status: 'FETCH_ERROR', code: null, message: 'Please try again.', details: [] });
  });
});
