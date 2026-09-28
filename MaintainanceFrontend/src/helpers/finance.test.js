import { describe, it, expect } from 'vitest';
import {
  billingRuleOf, canEditInvoice, csvFileName, defaultReportRange, invoiceActions, invoiceLinesLocked, reportRangePresets,
  standingPayments,
} from '@/helpers/finance';
import { can as roleCan } from '@/helpers/permissions';
import {
  fiscalYearOf, formatBalance, formatDateAdBs, formatDateBs, formatNpr, formatRupees, formatSignedNpr,
} from '@/helpers/format';
import {
  INVOICE_KINDS, INVOICE_KIND_LABELS, INVOICE_STATUSES, PAYMENT_METHODS, PAYMENT_METHOD_LABELS, INVOICE_STATUS_LABELS,
} from '@/config/constants';
import { INVOICE_TABS, REPORT_GROUPS } from '@/config/admin/financeViews';
import { ADMIN_NAV } from '@/config/admin/adminNav';
// The API's own lists. Outside `src/`, so `@/` cannot reach them.
import * as API_ENUMS from '../../../MaintainanceBackend/src/shared/enums.js';

const as = (role) => ({ can: (capability) => roleCan(role, capability) });
const keys = (list) => list.map((a) => a.key);

describe('money on screen — Nepali grouping and never a negative balance', () => {
  it('groups rupees the Nepali (en-IN) way, to the paisa', () => {
    expect(formatNpr(1_234_567_890)).toBe('Rs. 1,23,45,678.90');
    expect(formatNpr(1_234_567_890, { symbol: false })).toBe('1,23,45,678.90');
    expect(formatRupees(12345678.9)).toBe('1,23,45,678.90');
    expect(formatNpr(8_393_640)).toBe('Rs. 83,936.40');
    expect(formatNpr(1)).toBe('Rs. 0.01');
  });

  it('shows a balance as the server sent it, and never below zero', () => {
    expect(formatBalance(8_293_640)).toBe('Rs. 82,936.40');
    expect(formatBalance(0)).toBe('Rs. 0.00');
    expect(formatBalance(-50_000)).toBe('Rs. 0.00');
    expect(formatBalance(undefined)).toBe('Rs. 0.00');
  });

  it('writes a deduction line with a leading minus, never "Rs. -" (Phase L6: a final bill’s "Less: advance")', () => {
    expect(formatSignedNpr(-3_645_000)).toBe('− Rs. 36,450.00');
    expect(formatSignedNpr(-3_645_000, { symbol: false })).toBe('− 36,450.00');
    expect(formatSignedNpr(3_645_000)).toBe('Rs. 36,450.00');
    expect(formatSignedNpr(0)).toBe('Rs. 0.00');
  });
});

describe('BS beside AD, by the Kathmandu day (the Shrawan 1 fiscal-year boundary)', () => {
  it('converts the day it was in Kathmandu, not the UTC day', () => {
    // 18:15 UTC on 16 July is midnight of 17 July in Kathmandu — 2083 Shrawan 1, a new fiscal year.
    expect(formatDateBs('2026-07-16T18:15:00.000Z')).toBe('2083-04-01');
    expect(formatDateBs('2026-07-16T18:14:59.000Z')).toBe('2083-03-32');
    expect(fiscalYearOf('2026-07-16T18:15:00.000Z')).toBe('2083/84');
    expect(fiscalYearOf('2026-07-16T18:14:59.000Z')).toBe('2082/83');
  });

  it('writes the long form in English and Nepali, and AD with BS for a document', () => {
    expect(formatDateBs('2026-07-17', { long: true })).toBe('1 Shrawan 2083');
    expect(formatDateBs('2026-07-17', { long: true, locale: 'ne' })).toBe('1 साउन 2083');
    expect(formatDateAdBs('2026-07-16T18:15:00.000Z')).toBe('17 Jul 2026 (2083-04-01 BS)');
    expect(formatDateAdBs(null)).toBe('—');
    expect(formatDateBs(null)).toBe('');
    expect(formatDateBs('1900-01-01')).toBe('');
  });
});

describe('invoiceActions — what an invoice’s state allows', () => {
  const draft = { status: 'DRAFT', total: 8_393_640, balance: 8_393_640, payments: [] };
  const sent = { ...draft, status: 'SENT' };

  it('edits and sends only a draft, to invoices:write', () => {
    expect(keys(invoiceActions(draft, as('ACCOUNTANT')))).toEqual(['edit', 'send', 'void']);
    expect(canEditInvoice(draft, as('ACCOUNTANT'))).toBe(true);
    expect(canEditInvoice(sent, as('ACCOUNTANT'))).toBe(false);
    expect(canEditInvoice(draft, as('SALES'))).toBe(false);
    expect(invoiceActions({ ...draft, total: 0 }, as('ADMIN')).find((a) => a.key === 'send').disabledReason).toMatch(/Rs. 0.00/);
  });

  it('takes a payment on a sent invoice with money owed, to payments:write', () => {
    expect(keys(invoiceActions(sent, as('ACCOUNTANT')))).toEqual(['recordPayment', 'void']);
    const paid = { ...sent, status: 'PAID', balance: 0, payments: [{ id: 'p1', amount: 8_393_640 }] };
    expect(keys(invoiceActions(paid, as('ACCOUNTANT')))).toEqual(['void']);
    const partialSettled = { ...sent, status: 'PARTIAL', balance: 0 };
    expect(invoiceActions(partialSettled, as('ACCOUNTANT')).find((a) => a.key === 'recordPayment').disabledReason).toBeTruthy();
  });

  it('refuses to void an invoice with payments still counted — a voided payment does not count', () => {
    const partial = { ...sent, status: 'PARTIAL', payments: [{ id: 'p1', amount: 100_000, voidedAt: null }] };
    expect(invoiceActions(partial, as('ACCOUNTANT')).find((a) => a.key === 'void').disabledReason).toMatch(/void those first/);
    const voided = { ...sent, payments: [{ id: 'p1', amount: 100_000, voidedAt: '2026-09-20T05:00:00.000Z' }] };
    expect(standingPayments(voided)).toEqual([]);
    expect(invoiceActions(voided, as('ACCOUNTANT')).find((a) => a.key === 'void').disabledReason).toBeUndefined();
    expect(invoiceActions({ ...sent, status: 'VOID' }, as('ADMIN'))).toEqual([]);
  });

  it('offers nothing to a role that only reads', () => {
    expect(invoiceActions(sent, as('SALES'))).toEqual([]);
  });
});

describe('billingRuleOf — the one rule a job is invoiced by', () => {
  it('a quoted job bills its quotation; any other job what it used', () => {
    expect(billingRuleOf({ quotation: { number: 'QT-2083-0007', total: 8_393_640 } })).toEqual({
      kind: 'quotation', label: 'Bills quotation QT-2083-0007', detail: 'Rs. 83,936.40 as accepted',
    });
    expect(billingRuleOf({ quotation: null }).kind).toBe('actuals');
    expect(billingRuleOf(null).kind).toBe('actuals');
  });
});

describe('report ranges — Kathmandu days', () => {
  const now = Date.parse('2026-09-28T04:00:00.000Z'); // 09:45 in Kathmandu

  it('defaults to the last 30 Kathmandu days, today included', () => {
    expect(defaultReportRange(now)).toEqual({ from: '2026-08-30', to: '2026-09-28' });
    // 20:00 UTC is already the next day in Kathmandu.
    expect(defaultReportRange(Date.parse('2026-09-28T20:00:00.000Z')).to).toBe('2026-09-29');
  });

  it('starts "this fiscal year" on Shrawan 1 — 17 July 2026 for FY 2083/84', () => {
    const fy = reportRangePresets(now).find((p) => p.key === 'fy');
    expect(fy).toMatchObject({ from: '2026-07-17', to: '2026-09-28', label: 'This fiscal year (2083/84)' });
    // The day before Shrawan 1 still belongs to FY 2082/83, which began on 16 July 2025.
    const before = reportRangePresets(Date.parse('2026-07-16T12:00:00.000Z')).find((p) => p.key === 'fy');
    expect(before).toMatchObject({ from: '2025-07-16', label: 'This fiscal year (2082/83)' });
  });
});

describe('csvFileName', () => {
  it('uses the API’s name, else one made from the report and its range', () => {
    expect(csvFileName('attachment; filename="revenue-2026-07-17-2026-09-28.csv"', 'revenue')).toBe('revenue-2026-07-17-2026-09-28.csv');
    expect(csvFileName("attachment; filename*=UTF-8''aging%20now.csv", 'aging')).toBe('aging now.csv');
    expect(csvFileName(null, 'collections', { from: '2026-09-01', to: '2026-09-28' })).toBe('collections-2026-09-01-2026-09-28.csv');
  });
});

describe('the finance words mirror the API', () => {
  it('has a label for every invoice status and payment method the API knows, and a tab for every status', () => {
    expect(INVOICE_STATUSES).toEqual(API_ENUMS.INVOICE_STATUSES);
    expect(PAYMENT_METHODS).toEqual(API_ENUMS.PAYMENT_METHODS);
    expect(Object.keys(INVOICE_STATUS_LABELS).sort()).toEqual([...INVOICE_STATUSES].sort());
    expect(Object.keys(PAYMENT_METHOD_LABELS)).toEqual(PAYMENT_METHODS);
    expect(INVOICE_TABS.map((t) => t.status).filter(Boolean).sort()).toEqual([...INVOICE_STATUSES].sort());
  });

  it('has words for every invoice kind the API knows (Phase L6)', () => {
    expect(INVOICE_KINDS).toEqual(API_ENUMS.INVOICE_KINDS);
    expect(Object.keys(INVOICE_KIND_LABELS)).toEqual(INVOICE_KINDS);
  });
});

describe('invoiceLinesLocked — a stage or closing bill’s money is fixed (Phase L6)', () => {
  it('locks every kind but STANDARD; an invoice from before L6 has no kind and is not locked', () => {
    expect(['ADVANCE', 'RUNNING', 'FINAL'].map((kind) => invoiceLinesLocked({ kind }))).toEqual([true, true, true]);
    expect(invoiceLinesLocked({ kind: 'STANDARD' })).toBe(false);
    expect(invoiceLinesLocked({})).toBe(false);
    expect(invoiceLinesLocked(null)).toBe(false);
  });
});

describe('billingRuleOf — a job billed in stages (Phase L6)', () => {
  it('says the final bill is the quotation less the advance, by the advance’s number', () => {
    const quoted = { quotation: { number: 'QT-2083-0031', total: 8_237_700 } };
    expect(billingRuleOf({ ...quoted, advanceInvoice: { id: 'a', number: 'INV-2083-0077', status: 'PAID' } }).detail)
      .toBe('Rs. 82,377.00 as accepted, less the advance INV-2083-0077');
    // A void advance billed nothing; the whole quotation is billed.
    expect(billingRuleOf({ ...quoted, advanceInvoice: { id: 'a', number: 'INV-2083-0077', status: 'VOID' } }).detail)
      .toBe('Rs. 82,377.00 as accepted');
  });
});

describe('the report screens and their nav items agree', () => {
  it('gives every report group a nav item behind the same capability', () => {
    const items = ADMIN_NAV.flatMap((g) => g.items);
    for (const group of REPORT_GROUPS) {
      const item = items.find((i) => i.to === `/admin/reports/${group.value}`);
      expect(item, group.value).toBeTruthy();
      expect(item.capability).toBe(group.capability);
    }
    expect(REPORT_GROUPS.find((g) => g.value === 'job-margin').capability).toBe('costs:read');
  });
});
