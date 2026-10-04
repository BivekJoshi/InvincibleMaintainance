import { describe, it, expect } from 'vitest';
import { quotationPageState } from './quotationPageState';
import { DOCUMENTS } from '@/config/i18n/documents';
import { DECLINE_CATEGORIES } from '@/config/constants';
import { createT } from '@/helpers/i18n';

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

  // The page's words are `config/i18n/documents.js` (Phase J1); `config/i18n/catalogues.test.js` holds English and
  // Nepali to the same keys. What this page asks for at run time is checked here.
  it('has words for every outcome it can show, in English and Nepali', () => {
    for (const locale of ['en', 'ne']) {
      const t = createT(DOCUMENTS, locale);
      for (const kind of ['accepted', 'changes', 'declined', 'expired', 'replaced', 'replacedPending', 'closed']) {
        expect(DOCUMENTS[locale].quotationPage.outcome[kind].title, `${locale} ${kind}`).toBeTruthy();
        expect(t.has(`quotationPage.outcome.${kind}.body`), `${locale} ${kind}`).toBe(true);
      }
    }
    // The Nepali words really are Nepali — the page's and the document's.
    expect(DOCUMENTS.ne.quotationPage.buttons.accept).toMatch(/[\u0900-\u097F]/);
    expect(DOCUMENTS.ne.document.schedule.triggers.ON_ACCEPT).toMatch(/[\u0900-\u097F]/);
  });

  it('words every decline reason it offers, in both languages', () => {
    for (const locale of ['en', 'ne']) {
      expect(Object.keys(DOCUMENTS[locale].quotationPage.declineReasons)).toEqual(DECLINE_CATEGORIES);
    }
  });

  it('words every refusal the decide answers with, in both languages (docs/API.md)', () => {
    for (const locale of ['en', 'ne']) {
      for (const code of ['QUOTATION_EXPIRED', 'QUOTATION_ANSWERED', 'QUOTATION_REPLACED', 'QUOTATION_NOT_OPEN']) {
        expect(DOCUMENTS[locale].errors[code], `${locale} ${code}`).toBeTruthy();
      }
    }
  });
});
