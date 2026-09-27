import { describe, it, expect } from 'vitest';
import { quotationPageState } from './quotationPageState';
import { QUOTATION_PAGE_COPY, pageCopy } from './quotationPageCopy';
import { DECLINE_CATEGORIES } from '@/config/constants';

/** Every key path in a copy object (functions and strings are leaves). */
const paths = (value, prefix = '') => (value && typeof value === 'object'
  ? Object.entries(value).flatMap(([k, v]) => paths(v, prefix ? `${prefix}.${k}` : k))
  : [prefix]);

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

  it('has words for every outcome it can show, in English and Nepali', () => {
    for (const locale of ['en', 'ne']) {
      for (const kind of ['accepted', 'changes', 'declined', 'expired', 'replaced', 'replacedPending', 'closed']) {
        expect(QUOTATION_PAGE_COPY[locale].outcome[kind].title, `${locale} ${kind}`).toBeTruthy();
      }
    }
  });

  it('says everything in Nepali that it says in English — the page and the document (Phase L4)', () => {
    const en = paths(QUOTATION_PAGE_COPY.en).sort();
    expect(paths(QUOTATION_PAGE_COPY.ne).sort()).toEqual(en);
    // The Nepali words really are Nepali.
    expect(QUOTATION_PAGE_COPY.ne.buttons.accept).toMatch(/[\u0900-\u097F]/);
    expect(QUOTATION_PAGE_COPY.ne.schedule.triggers.ON_ACCEPT).toMatch(/[\u0900-\u097F]/);
    expect(pageCopy('fr')).toBe(QUOTATION_PAGE_COPY.en);
  });

  it('words every decline reason it offers, in both languages', () => {
    for (const locale of ['en', 'ne']) {
      expect(Object.keys(QUOTATION_PAGE_COPY[locale].declineReasons)).toEqual(DECLINE_CATEGORIES);
    }
  });
});
