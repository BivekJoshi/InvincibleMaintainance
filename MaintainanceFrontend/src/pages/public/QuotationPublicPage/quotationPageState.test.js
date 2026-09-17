import { describe, it, expect } from 'vitest';
import { quotationPageState } from './quotationPageState';
import { QUOTATION_PAGE_COPY } from './quotationPageCopy';

const ALL = ['approve', 'request_changes', 'reject'];

describe('the customer quotation page', () => {
  it.each([
    [{ status: 'SENT', actions: ALL }, 'open', ALL],
    [{ status: 'SENT', actions: [] }, 'closed', []],
    [{ status: 'CHANGES_REQUESTED', actions: [] }, 'changes', []],
    [{ status: 'SUPERSEDED', actions: [], replaced: { token: 't2' } }, 'replaced', []],
    [{ status: 'SUPERSEDED', actions: [], replaced: null }, 'replacedPending', []],
    [{ status: 'EXPIRED', actions: [] }, 'expired', []],
    [{ status: 'APPROVED', actions: [] }, 'accepted', []],
    [{ status: 'CONVERTED', actions: [] }, 'accepted', []],
    [{ status: 'REJECTED', actions: [] }, 'declined', []],
    [{ status: 'PENDING_APPROVAL' }, 'closed', []],
  ])('%j → %s', (quotation, kind, actions) => {
    const state = quotationPageState(quotation);
    expect(state.kind).toBe(kind);
    expect(state.actions).toEqual(actions);
  });

  it('links a replaced quotation to the newer one', () => {
    expect(quotationPageState({ status: 'SUPERSEDED', replaced: { token: 'abc' } }).replacedToken).toBe('abc');
  });

  it('never offers an answer the API did not list', () => {
    expect(quotationPageState({ status: 'SENT', actions: ['approve'] }).actions).toEqual(['approve']);
  });

  it('has words for every outcome it can show', () => {
    for (const kind of ['accepted', 'changes', 'declined', 'expired', 'replaced', 'replacedPending', 'closed']) {
      expect(QUOTATION_PAGE_COPY.outcome[kind].title, kind).toBeTruthy();
    }
  });
});
