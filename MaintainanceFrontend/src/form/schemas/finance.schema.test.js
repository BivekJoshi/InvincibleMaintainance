import { describe, expect, it } from 'vitest';
import {
  expenseSchema, invoiceCreateSchema, invoiceEditSchema, invoiceFromJobFormSchema, paymentFormSchema, voidReasonSchema,
} from '@/form/schemas/finance.schema';
// The API's own rules. Outside `src/`, so `@/` cannot reach them.
import {
  expenseSchema as apiExpense, invoiceFromJobSchema as apiFromJob, invoiceSchema as apiInvoice,
  invoiceUpdateSchema as apiInvoiceUpdate, invoiceVoidSchema as apiInvoiceVoid, paymentSchema as apiPayment,
  paymentVoidSchema as apiPaymentVoid,
} from '../../../../MaintainanceBackend/src/shared/schemas/ops.js';

/** Each body goes through both schemas, and both must agree. */
const both = (ours, theirs, cases) => it.each(cases)('%j → %s on both sides', (body, ok) => {
  expect(ours.safeParse(body).success, 'the form').toBe(ok);
  expect(theirs.safeParse(body).success, 'the API').toBe(ok);
});

/** The draft's lines as the lineItems field holds them — rupees, a client key, a job — and what the form sends. */
const ROWS = [
  { _key: 'it1', rowType: 'ITEM', description: 'Terrace waterproofing membrane', unit: 'sq.ft', qty: 210.5, rate: 220, jobId: 'j1' },
  { _key: 'it2', rowType: 'ITEM', description: 'वाटरप्रुफिङ प्राइमर', unit: 'sq.ft', qty: '210.5', rate: '1,250.50' },
  { _key: 'blank', rowType: 'ITEM', description: '', unit: '', qty: '', rate: '' },
];

describe('finance forms mirror the API (Phase I)', () => {
  it('the draft’s edit form sends lines, in rupees, that the API takes — blank rows dropped, Indian grouping read', () => {
    const out = invoiceEditSchema.parse({ items: ROWS, discount: 1500, vatApplied: true, dueDate: null, note: '', terms: 'छ महिना' });
    expect(out.items).toEqual([
      { description: 'Terrace waterproofing membrane', unit: 'sq.ft', qty: 210.5, rate: 220, jobId: 'j1' },
      { description: 'वाटरप्रुफिङ प्राइमर', unit: 'sq.ft', qty: 210.5, rate: 1250.5 },
    ]);
    // A cleared date is left out, never sent as null (the API's z.coerce.date() would read 1970).
    expect(out).not.toHaveProperty('dueDate', null);
    expect(out.dueDate).toBeUndefined();
    expect(apiInvoiceUpdate.safeParse(out).success).toBe(true);
    const created = invoiceCreateSchema.parse({ customerId: 'c1', items: ROWS, vatApplied: false });
    expect(apiInvoice.safeParse(created).success).toBe(true);
  });

  it('refuses what the API refuses: no lines, a line without a description, quantity or rate, a negative rate', () => {
    for (const items of [
      [],
      [{ description: '', qty: 1, rate: 10 }],
      [{ description: 'Labour', qty: '', rate: 10 }],
      [{ description: 'Labour', qty: 0, rate: 10 }],
      [{ description: 'Labour', qty: 1, rate: '' }],
      [{ description: 'Labour', qty: 1, rate: -5 }],
    ]) {
      expect(invoiceEditSchema.safeParse({ items, vatApplied: true }).success, JSON.stringify(items)).toBe(false);
    }
    expect(apiInvoiceUpdate.safeParse({ items: [] }).success).toBe(false);
    expect(apiInvoiceUpdate.safeParse({ items: [{ description: 'Labour', qty: 0, rate: 10 }] }).success).toBe(false);
  });

  describe('invoice from a job', () => {
    both(invoiceFromJobFormSchema, apiFromJob, [
      [{}, true],
      [{ includeMaterials: true, includeLabour: false, vatApplied: true, discount: 500 }, true],
      [{ discount: -1 }, false],
    ]);
  });

  describe('a payment (the balance here is Rs. 83,936.40)', () => {
    const form = paymentFormSchema(8_393_640);
    both(form, apiPayment, [
      [{ amount: 1000, method: 'ESEWA', reference: 'ESW-7781' }, true],
      [{ amount: 83936.4, method: 'CASH' }, true],
      [{ amount: 0, method: 'CASH' }, false],
      [{ amount: 100, method: 'CARD' }, false],
      [{ amount: 100 }, false],
    ]);
    it('and no more than the balance, to the paisa — the one check the UI makes against a figure', () => {
      expect(form.safeParse({ amount: 83936.41, method: 'CASH' }).success).toBe(false);
      expect(form.safeParse({ amount: 83936.4, method: 'CASH' }).success).toBe(true);
      expect(paymentFormSchema(-100).safeParse({ amount: 0.01, method: 'CASH' }).success).toBe(false);
    });
  });

  describe('a void reason', () => {
    both(voidReasonSchema, apiInvoiceVoid, [[{ reason: 'Wrong customer' }, true], [{ reason: 'no' }, false], [{ reason: 'भुल' }, true]]);
    both(voidReasonSchema, apiPaymentVoid, [[{ reason: 'The cheque bounced' }, true], [{ reason: '  ' }, false]]);
  });

  describe('an expense', () => {
    both(expenseSchema, apiExpense, [
      [{ category: 'Transport', amount: 1250.5, jobId: null, vendor: 'साझा यातायात', billMediaId: null }, true],
      [{ category: 'Tools', amount: 0 }, true],
      [{ category: 'T', amount: 10 }, false],
      [{ category: 'Transport', amount: -1 }, false],
    ]);
  });
});
