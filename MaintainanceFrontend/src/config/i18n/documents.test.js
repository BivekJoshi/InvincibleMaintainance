import { describe, expect, it } from 'vitest';
import { DOCUMENTS } from './documents';
import { isPluralForms, lookup } from '@/helpers/i18n';
import {
  CONTRACT_TYPES, DECLINE_CATEGORIES, INVOICE_KINDS, INVOICE_STATUSES, PAYMENT_METHODS, PAYMENT_TRIGGERS,
  QUOTATION_STATUSES, WARRANTY_STATUSES,
} from '@/config/constants';

/**
 * The customer's documents (Phase J1) look their statuses, kinds, triggers, methods and reasons up at run time
 * (`t(`invoice.status.${status}`)`), which `catalogues.test.js`'s source scan cannot see. So every value of each list
 * the API can send a customer has its words here, in English and in Nepali — never the office's `*_LABELS`.
 */

/** The quotation statuses a customer's link can show (`GET /public/quotations/:token` — never a draft or an approval). */
const CUSTOMER_QUOTATION_STATUSES = ['SENT', 'CHANGES_REQUESTED', 'APPROVED', 'REJECTED', 'EXPIRED', 'SUPERSEDED', 'CONVERTED'];

const LISTS = [
  ['quotation.status', CUSTOMER_QUOTATION_STATUSES],
  ['quotationPage.declineReasons', DECLINE_CATEGORIES],
  ['invoice.status', INVOICE_STATUSES],
  ['invoice.kinds', INVOICE_KINDS],
  ['invoice.payments.methods', PAYMENT_METHODS],
  ['invoice.stage.when', PAYMENT_TRIGGERS],
  ['document.schedule.triggers', PAYMENT_TRIGGERS],
  ['document.contract', CONTRACT_TYPES.map((type) => `${type}.name`)],
  ['document.contract', CONTRACT_TYPES.map((type) => `${type}.body`)],
  ['warranty.status', WARRANTY_STATUSES],
];

/** A leaf in `locale`'s own tree — not the English fallback `t()` would print. */
const own = (locale, key) => {
  const leaf = lookup(DOCUMENTS[locale], key);
  return typeof leaf === 'string' || isPluralForms(leaf) ? leaf : undefined;
};

describe('DOCUMENTS — the words of every value the API sends a customer', () => {
  it('knows which quotation statuses a customer can see', () => {
    expect(QUOTATION_STATUSES).toEqual(expect.arrayContaining(CUSTOMER_QUOTATION_STATUSES));
  });

  describe.each(LISTS)('%s', (prefix, values) => {
    it.each(['en', 'ne'])('has words for every value in %s', (locale) => {
      const missing = values.filter((value) => !own(locale, `${prefix}.${value}`));
      expect(missing).toEqual([]);
    });
  });

  it('says them in Nepali in Nepali — only brand names stay as they are', () => {
    const BRANDS = ['ESEWA', 'KHALTI', 'FONEPAY'];
    for (const [prefix, values] of LISTS) {
      for (const value of values.filter((v) => !BRANDS.includes(v))) {
        expect(own('ne', `${prefix}.${value}`), `${prefix}.${value}`).toMatch(/[ऀ-ॿ]/);
      }
    }
  });

  it('words the refusals the pages handle themselves (docs/API.md)', () => {
    for (const code of ['QUOTATION_EXPIRED', 'QUOTATION_ANSWERED', 'QUOTATION_REPLACED', 'QUOTATION_NOT_OPEN', 'VISIT_CLOSED']) {
      expect(own('en', `errors.${code}`), code).toBeTruthy();
      expect(own('ne', `errors.${code}`), code).toMatch(/[ऀ-ॿ]/);
    }
  });
});

/**
 * The customer's pages never show the office's words: no `*_LABELS` from `config/constants.js` in the document
 * components or the four public document pages (the office's `QUOTATION_STATUS_LABELS` says "With customer").
 */
const SOURCES = import.meta.glob([
  '/src/components/documents/*.{js,jsx}',
  '/src/pages/public/{Quotation,Invoice,Warranty,Visit}PublicPage/**/*.{js,jsx}',
  '!/src/**/*.test.{js,jsx}',
], { query: '?raw', import: 'default', eager: true });

describe('the customer’s document pages', () => {
  it('are found', () => {
    expect(Object.keys(SOURCES).length).toBeGreaterThan(20);
  });

  it('take no office label from config/constants.js', () => {
    const offenders = Object.entries(SOURCES)
      .filter(([, source]) => /import\s*\{[^}]*_LABELS[^}]*\}\s*from\s*'@\/config\/constants'/.test(source))
      .map(([file]) => file);
    expect(offenders).toEqual([]);
  });
});
