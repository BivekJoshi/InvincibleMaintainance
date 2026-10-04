import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import InvoicePublicPage from './InvoicePublicPage';
import { renderWithProviders } from '@/test/renderWithProviders';
import { json, mockApi, notFound } from '@/test/mockApi';
import uiReducer from '@/redux/slices/uiSlice';
import { resetI18nWarnings } from '@/helpers/i18n';
import { INVOICE_KINDS, INVOICE_STATUSES, PAYMENT_METHODS } from '@/config/constants';

/**
 * The customer's invoice page in both languages (Phase J1). The figures, the office's page and the print are held by
 * `pages/admin/FinanceScreens.test.jsx`, the stage line by `HandoffScreens.test.jsx`, the deductions by
 * `CloseoutScreens.test.jsx`; here, the words — every one in Nepali, amounts in रु., dates with वि.सं. — and the
 * statuses, kinds and payment methods, whose words are looked up at run time.
 */

/** What GET /public/invoices/:token answers: a final bill with a deduction, part paid, an eSewa payment and a voided cheque. */
const INVOICE = {
  number: 'INV-2083-0130', status: 'PARTIAL', kind: 'FINAL', paymentStage: null,
  customer: { name: 'सीता गुरुङ', phone: '9841500005', panVatNo: '609876543' },
  // 18:15 UTC on 16 July is midnight of 17 July in Kathmandu — 2083 Shrawan 1; due 1 Aug (Shrawan 16).
  issuedAt: '2026-07-16T18:15:00.000Z', dueDate: '2026-07-31T18:15:00.000Z',
  subtotal: 2_436_000, discount: 36_000, vatApplied: true, vatRate: 13, vatAmount: 312_000, total: 2_712_000,
  paidAmount: 1_000_000, balance: 1_712_000,
  letterhead: { companyName: 'Gharjatan Home Services', phones: ['01-5407720'], email: 'info@gharjatan.com.np', panVatNo: '301234567' },
  items: [
    { id: 'f1', kind: 'ITEM', description: 'A.1 Crystalline slurry, two coats', unit: 'sq.ft', qty: 240, rate: 22_000, amount: 5_280_000 },
    { id: 'f3', kind: 'DEDUCTION', description: 'Less: advance INV-2083-0077', unit: 'lump', qty: 1, rate: -2_844_000, amount: -2_844_000 },
  ],
  payments: [
    { id: 'p1', amount: 1_000_000, method: 'ESEWA', receivedAt: '2026-09-20T05:00:00.000Z', voidedAt: null },
    { id: 'p2', amount: 500_000, method: 'CHEQUE', receivedAt: '2026-09-18T05:00:00.000Z', voidedAt: '2026-09-19T05:00:00.000Z' },
  ],
  quotation: { number: 'QT-2083-0031' }, terms: 'Payable within 15 days.', voidReason: null,
};

const open = (invoice, locale = 'en') => {
  mockApi(({ path }) => {
    if (path === '/public/invoices/tok-1') return invoice ? json({ data: invoice }) : notFound('Invoice');
    if (path === '/public/bootstrap') return json({ data: { settings: { 'contact.phonePrimary': '01-5407720' } } });
    return undefined;
  });
  return renderWithProviders(<InvoicePublicPage />, {
    path: '/invoice/:token', initialPath: '/invoice/tok-1',
    preloadedState: { ui: { ...uiReducer(undefined, { type: '@@init' }), locale, toasts: [] } },
  });
};

let warn;
beforeEach(() => {
  resetI18nWarnings();
  warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => {
  warn.mockRestore();
  vi.unstubAllGlobals();
});

/** No text was missing: `t()` warns `[i18n] …` for a key with no Nepali (or no words at all). */
const expectNoMissingWords = () => {
  expect(warn.mock.calls.filter(([first]) => String(first).startsWith('[i18n]'))).toEqual([]);
};

describe('the customer’s invoice page (Phase J1)', () => {
  it('reads in English as it always has', async () => {
    open(INVOICE);
    const doc = await screen.findByTestId('invoice-document');
    expect(doc).toHaveTextContent('Invoice');
    expect(doc).toHaveTextContent('For सीता गुरुङ · PAN/VAT 609876543');
    expect(within(doc).getByText('Part paid')).toBeInTheDocument();
    expect(within(doc).getByTestId('invoice-issued')).toHaveTextContent('Issued 17 Jul 2026 (2083-04-01 BS)');
    expect(within(doc).getByTestId('invoice-stage-line')).toHaveTextContent('Final bill');
    expect(within(doc).getByText('Quotation QT-2083-0031')).toBeInTheDocument();
    expect(within(doc).getByText('Amount due').parentElement).toHaveTextContent('Rs. 17,120.00');
    expect(within(doc).getByTestId('invoice-payments')).toHaveTextContent('20 Sept 2026 (2083-06-04 BS) · eSewa');
    expect(within(doc).getByText('Voided')).toBeInTheDocument();
    expect(screen.getByText('Questions about this invoice? Call us and quote INV-2083-0130.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Print' })).toBeInTheDocument();
    expectNoMissingWords();
  });

  it('reads in Nepali with no text missing: रु. amounts, वि.सं. dates, the status, the kind, the method, the deduction', async () => {
    const user = userEvent.setup();
    const print = vi.fn();
    vi.stubGlobal('print', print);
    open(INVOICE, 'ne');
    const doc = await screen.findByTestId('invoice-document');
    expect(doc).toHaveAttribute('lang', 'ne');
    expect(doc).toHaveTextContent('बिल');
    expect(doc).toHaveTextContent('सीता गुरुङ का लागि · प्यान/भ्याट नं. 609876543');
    expect(within(doc).getByTestId('letterhead')).toHaveTextContent('प्यान / भ्याट नं. 301234567');
    expect(within(doc).getByText('आंशिक भुक्तानी')).toBeInTheDocument();
    expect(within(doc).getByTestId('invoice-issued')).toHaveTextContent('जारी मिति 2026 जुलाई 17 (2083-04-01 वि.सं.)');
    expect(within(doc).getByTestId('invoice-due')).toHaveTextContent('भुक्तानी गर्नुपर्ने मिति 2026 अगस्ट 01 (2083-04-16 वि.सं.)');
    expect(within(doc).getByTestId('invoice-stage-line')).toHaveTextContent('अन्तिम बिल');
    expect(within(doc).getByText('दरभाउपत्र QT-2083-0031')).toBeInTheDocument();

    // The lines and the deduction — the office's descriptions as written, the words around them in Nepali.
    expect(within(doc).getByRole('columnheader', { name: 'विवरण' })).toBeInTheDocument();
    const deductions = within(doc).getByTestId('invoice-deductions');
    expect(within(deductions).getByRole('heading', { name: 'घटाइएको — पहिले बिल गरिएको' })).toBeInTheDocument();
    expect(within(deductions).getByRole('row', { name: /Advance INV-2083-0077/ })).toHaveTextContent('− रु. 28,440.00');

    // The totals, the server's figures in रु.
    const row = (label) => within(doc).getByText(label).parentElement;
    expect(row('उप-जम्मा')).toHaveTextContent('रु. 24,360.00');
    expect(row('छुट')).toHaveTextContent('− रु. 360.00');
    expect(row('मूल्य अभिवृद्धि कर (13%)')).toHaveTextContent('रु. 3,120.00');
    expect(row('जम्मा')).toHaveTextContent('रु. 27,120.00');
    expect(row('भुक्तानी भएको')).toHaveTextContent('− रु. 10,000.00');
    expect(row('तिर्न बाँकी रकम')).toHaveTextContent('रु. 17,120.00');

    // What was paid: the method's own name, and a voided cheque struck through.
    const payments = within(doc).getByTestId('invoice-payments');
    expect(within(doc).getByRole('heading', { name: 'प्राप्त भुक्तानी' })).toBeInTheDocument();
    expect(payments).toHaveTextContent('2026 सेप्टेम्बर 20 (2083-06-04 वि.सं.) · eSewa');
    expect(payments).toHaveTextContent('चेक');
    expect(within(payments).getByText('रद्द गरिएको')).toBeInTheDocument();

    expect(screen.getByText('यो बिलबारे केही सोध्नु छ? हामीलाई फोन गर्नुहोस् र बिल नं. INV-2083-0130 बताउनुहोस्।')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'प्रिन्ट गर्नुहोस्' }));
    expect(print).toHaveBeenCalledTimes(1);
    expect(document.body.textContent).not.toMatch(/Rs\.|Amount due|Subtotal/);
    expectNoMissingWords();
  });

  it('names an advance’s stage in Nepali — the kind, when it falls due, the share', async () => {
    open({
      ...INVOICE, status: 'SENT', kind: 'ADVANCE', paymentStage: { label: 'Advance', basisPoints: 5000, trigger: 'ON_ACCEPT' },
      items: [INVOICE.items[0]], payments: [], paidAmount: 0,
    }, 'ne');
    expect(await screen.findByTestId('invoice-stage-line')).toHaveTextContent('अग्रिम — स्वीकृत गर्दा (50%)');
    expect(screen.getByText('पठाइएको')).toBeInTheDocument();
    expectNoMissingWords();
  });

  it('says a void invoice owes nothing, in Nepali', async () => {
    open({ ...INVOICE, status: 'VOID', voidReason: 'दुई पटक जारी भयो', balance: 0, payments: [] }, 'ne');
    const doc = await screen.findByTestId('invoice-document');
    expect(within(doc).getByText('यो बिल रद्द गरिएको छ — यसमा केही तिर्नु पर्दैन')).toBeInTheDocument();
    expect(within(doc).getByText('रद्द')).toBeInTheDocument();
    expect(within(doc).queryByText('तिर्न बाँकी रकम')).not.toBeInTheDocument();
    expectNoMissingWords();
  });

  it('says a settled invoice is settled, and VAT not applied, in Nepali', async () => {
    open({ ...INVOICE, status: 'PAID', vatApplied: false, vatAmount: 0, balance: 0, paidAmount: 2_400_000 }, 'ne');
    const doc = await screen.findByTestId('invoice-document');
    expect(within(doc).getByText('चुक्ता भयो').parentElement).toHaveTextContent('रु. 0.00');
    expect(within(doc).getByText('मूल्य अभिवृद्धि कर (लागू छैन)')).toBeInTheDocument();
    expect(within(doc).getByText('भुक्तानी भयो')).toBeInTheDocument();
    expectNoMissingWords();
  });

  it('says a link it does not know in Nepali, with Try again', async () => {
    open(null, 'ne');
    expect(await screen.findByText('यो भेटिएन। लिङ्क पुरानो वा अधुरो हुन सक्छ।')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'फेरि प्रयास गर्नुहोस्' })).toBeInTheDocument();
    expectNoMissingWords();
  });

  // Keys built at run time — the catalogue scan cannot see them, so every value of each list is rendered here.
  it.each(INVOICE_STATUSES)('words the status %s in both languages', async (status) => {
    for (const locale of ['en', 'ne']) {
      const view = open({ ...INVOICE, status, payments: [] }, locale);
      await screen.findByTestId('invoice-document');
      view.unmount();
    }
    expectNoMissingWords();
  });

  it.each(INVOICE_KINDS.filter((k) => k !== 'STANDARD'))('names the kind %s in both languages', async (kind) => {
    for (const locale of ['en', 'ne']) {
      const view = open({ ...INVOICE, kind, paymentStage: { label: 'Mobilisation', basisPoints: 4000, trigger: 'MILESTONE' } }, locale);
      // The kind in the page's words, then the office's own stage label and its share.
      expect(await screen.findByTestId('invoice-stage-line')).toHaveTextContent(/^\S.* — Mobilisation \(40%\)$/);
      view.unmount();
    }
    expectNoMissingWords();
  });

  it('words every payment method in both languages', async () => {
    const payments = PAYMENT_METHODS.map((method, i) => ({
      id: `p${i}`, amount: 100_000, method, receivedAt: '2026-09-20T05:00:00.000Z', voidedAt: null,
    }));
    for (const locale of ['en', 'ne']) {
      const view = open({ ...INVOICE, payments }, locale);
      const list = await screen.findByTestId('invoice-payments');
      expect(within(list).getAllByRole('listitem')).toHaveLength(PAYMENT_METHODS.length);
      // No method prints as its code.
      for (const method of PAYMENT_METHODS) expect(list.textContent).not.toContain(` · ${method}`);
      view.unmount();
    }
    expectNoMissingWords();
  });
});
