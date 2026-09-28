import { describe, expect, it } from 'vitest';
import { labourState, nextBillPrompt, overPlanText, pctText, seesEarnedValue } from '@/helpers/execution';
import { can as roleCan } from '@/helpers/permissions';

describe('the job on site, in words (Phase L7)', () => {
  it('shows earned value to those who read quotations or invoices — never to dispatch or the field', () => {
    const holders = ['ADMIN', 'SALES', 'MANAGER', 'ACCOUNTANT', 'DISPATCHER', 'TECHNICIAN', 'SURVEYOR', 'EDITOR']
      .filter((role) => seesEarnedValue((c) => roleCan(role, c)));
    expect(holders.sort()).toEqual(['ACCOUNTANT', 'ADMIN', 'MANAGER', 'SALES']);
  });

  it('words the OVER_PLAN warning, planned or not', () => {
    expect(overPlanText({ name: 'Crystalline slurry', unit: 'kg', planned: 120, issued: 130.5 }))
      .toBe('Crystalline slurry: 130.5 kg issued to this job against 120 kg planned.');
    expect(overPlanText({ name: 'Grout', unit: 'kg', planned: 0, issued: 4 })).toBe('Grout is not in this job’s plan — 4 kg issued to it now.');
  });

  it('prompts for the next running bill by the stage’s label and share', () => {
    expect(nextBillPrompt({ stageId: 's2', label: 'Slab laid', basisPoints: 1000 })).toBe('Earned value has passed Slab laid (10%) — raise the running bill');
    expect(nextBillPrompt(null)).toBeNull();
    expect(pctText(59.95)).toBe('59.95%');
    expect(pctText(100)).toBe('100%');
  });

  it('compares logged labour days with the plan', () => {
    expect(labourState({ plannedDays: 7.5, loggedDays: 9.25 })).toBe('over');
    expect(labourState({ plannedDays: 5, loggedDays: 5 })).toBe('done');
    expect(labourState({ plannedDays: 5, loggedDays: 2.5 })).toBe('under');
    expect(labourState({ plannedDays: 0, loggedDays: 1 })).toBe('unplanned');
  });
});
