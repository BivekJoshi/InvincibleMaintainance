import { describe, it, expect } from 'vitest';
import { can as roleCan } from '@/helpers/permissions';
import { QUOTATION_STATUSES, QUOTATION_TRANSITIONS } from '@/config/constants';
import { isSelfApproval, quotationActions, sentAge, validityWarning, waitingFor } from './quotationActions';

const as = (role, userId = 'me') => ({ can: (c) => roleCan(role, c), userId });
const keys = (status, role, extra = {}) =>
  quotationActions({ status, createdById: 'someone', makerChecker: true, ...extra }, as(role)).map((a) => a.key);

describe('quotation action bar', () => {
  it.each([
    // status, role, keys
    ['DRAFT', 'SALES', ['submit']],
    ['DRAFT', 'MANAGER', ['submit']],
    ['DRAFT', 'ACCOUNTANT', []],
    ['DRAFT', 'DISPATCHER', []],
    ['PENDING_APPROVAL', 'SALES', []],
    ['PENDING_APPROVAL', 'MANAGER', ['approve', 'sendBack']],
    ['PENDING_APPROVAL', 'ADMIN', ['approve', 'sendBack']],
    ['PENDING_APPROVAL', 'ACCOUNTANT', []],
    ['OFFICE_APPROVED', 'SALES', ['send', 'pullBack']],
    ['OFFICE_APPROVED', 'ACCOUNTANT', []],
    ['SENT', 'SALES', ['revise']],
    ['CHANGES_REQUESTED', 'SALES', ['revise']],
    ['CHANGES_REQUESTED', 'MANAGER', ['revise']],
    ['REJECTED', 'SALES', ['revise']],
    ['EXPIRED', 'SALES', ['revise']],
    ['APPROVED', 'SALES', []],
    ['APPROVED', 'DISPATCHER', ['convert']],
    ['APPROVED', 'ADMIN', ['convert']],
    ['CONVERTED', 'ADMIN', []],
    ['SUPERSEDED', 'ADMIN', []],
  ])('%s as %s → %j', (status, role, expected) => {
    expect(keys(status, role)).toEqual(expected);
  });

  it('offers only moves the state machine allows', () => {
    const target = { submit: 'PENDING_APPROVAL', approve: 'OFFICE_APPROVED', sendBack: 'DRAFT', pullBack: 'DRAFT', send: 'SENT', revise: 'SUPERSEDED', convert: 'CONVERTED' };
    for (const status of QUOTATION_STATUSES) {
      for (const a of quotationActions({ status }, as('ADMIN'))) {
        expect(QUOTATION_TRANSITIONS[status], `${status} → ${a.key}`).toContain(target[a.key]);
      }
    }
  });

  it('marks the waiting step primary and asks for notes where the API needs them', () => {
    const [approve, sendBack] = quotationActions({ status: 'PENDING_APPROVAL', createdById: 'x' }, as('MANAGER'));
    expect(approve).toMatchObject({ primary: true, note: 'optional' });
    expect(sendBack).toMatchObject({ note: 'required' });
    expect(quotationActions({ status: 'OFFICE_APPROVED' }, as('SALES'))[1]).toMatchObject({ key: 'pullBack', note: 'required' });
    expect(quotationActions({ status: 'SENT' }, as('SALES'))[0].primary).toBeUndefined();
  });

  it('disables approval of your own quotation while maker-checker is on, and says why', () => {
    const own = { status: 'PENDING_APPROVAL', createdById: 'me', makerChecker: true };
    const [approve] = quotationActions(own, as('MANAGER'));
    expect(approve.disabledReason).toMatch(/another manager/);
    expect(isSelfApproval(own, 'me')).toBe(true);
    expect(waitingFor(own, as('MANAGER'))).toMatch(/a manager/);

    const off = { ...own, makerChecker: false };
    expect(quotationActions(off, as('MANAGER'))[0].disabledReason).toBeUndefined();
    expect(waitingFor(off, as('MANAGER'))).toMatch(/your approval/);
  });

  it('has a waiting line for every status', () => {
    for (const status of QUOTATION_STATUSES) expect(waitingFor({ status }, as('SALES')), status).toBeTruthy();
  });
});

describe('validity and follow-up', () => {
  const now = Date.parse('2026-09-18T06:00:00.000Z');
  const at = (days) => new Date(now + days * 86_400_000).toISOString();

  it('flags a quotation the customer can still answer when it is close to, or past, its date', () => {
    expect(validityWarning({ status: 'SENT', validUntil: at(10) }, now)).toBeNull();
    expect(validityWarning({ status: 'SENT', validUntil: at(2.5) }, now)).toEqual({ tone: 'soon', label: 'Expires in 2 days' });
    expect(validityWarning({ status: 'OFFICE_APPROVED', validUntil: at(1.2) }, now)).toEqual({ tone: 'soon', label: 'Expires in 1 day' });
    expect(validityWarning({ status: 'SENT', validUntil: at(0.2) }, now)).toEqual({ tone: 'soon', label: 'Expires today' });
    expect(validityWarning({ status: 'SENT', validUntil: at(-1) }, now)).toEqual({ tone: 'expired', label: 'Past its validity date' });
  });

  it('says nothing once the customer has answered, or with no date', () => {
    expect(validityWarning({ status: 'APPROVED', validUntil: at(-1) }, now)).toBeNull();
    expect(validityWarning({ status: 'DRAFT', validUntil: at(1) }, now)).toBeNull();
    expect(validityWarning({ status: 'SENT' }, now)).toBeNull();
  });

  it('counts the days a sent quotation has waited', () => {
    expect(sentAge({ status: 'SENT', sentAt: at(-6.5) }, now)).toBe('Sent 6 days ago');
    expect(sentAge({ status: 'SENT', sentAt: at(-1) }, now)).toBe('Sent 1 day ago');
    expect(sentAge({ status: 'SENT', sentAt: at(-0.3) }, now)).toBe('Sent today');
    expect(sentAge({ status: 'CHANGES_REQUESTED', sentAt: at(-6) }, now)).toBeNull();
  });
});
