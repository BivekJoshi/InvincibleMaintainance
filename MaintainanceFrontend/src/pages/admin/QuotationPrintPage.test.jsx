import { afterEach, describe, expect, it, vi } from 'vitest';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import QuotationPrintPage from '@/pages/admin/QuotationPrintPage';
import { renderWithProviders, signedInAs } from '@/test/renderWithProviders';
import { json, mockApi } from '@/test/mockApi';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

/** Every key the money wall strips — the print must show none of their values, even to a manager. */
const COST_KEYS = /cost|unitCost|costAmount|margin|recipe|purchaseRate|hourlyRate|dayWage|overheadPct|profitPct/i;

/** A MANAGER's record: the staff shape, cost and all (Phases L3–L4). */
const RECORD = {
  id: 'q7', number: 'QT-2083-0077', version: 2, status: 'OFFICE_APPROVED',
  subtotal: 5500000, discount: 0, vatApplied: true, vatRate: 13, vatAmount: 715000, total: 6215000,
  createdAt: '2026-09-16T04:00:00.000Z', validUntil: '2026-10-30T18:14:00.000Z',
  terms: 'Half in advance.', internalNote: 'Customer is a friend of Hari — keep the price.',
  contractType: 'LUMP_SUM', estimatedDays: 10, exclusions: 'Scaffolding permits.', showMeasurements: true, summaryOnly: false,
  customer: { id: 'c1', name: 'सीता गुरुङ', phone: '9841500005', preferredLocale: 'ne' },
  site: { id: 's1', address: 'Budhanilkantha' },
  letterhead: {
    companyName: 'Gharjatan Home Services', address: 'Baneshwor', city: 'Kathmandu', phones: ['01-5407720'],
    email: 'info@gharjatan.com.np', panVatNo: '609876543',
    logo: { id: 'm1', url: '/uploads/logo.png', alt: 'Gharjatan', variants: { 400: '/uploads/logo-400.webp' } }, tagline: 'Repairs done right',
  },
  dates: { createdAtBs: '2083-05-31', validUntilBs: '2083-07-14', sentAtBs: null },
  totalInWords: { en: 'Rupees Sixty-Two Thousand One Hundred Fifty Only', ne: 'रुपैयाँ बयसट्ठी हजार एक सय पचास मात्र' },
  paymentStages: [
    { id: 'st1', label: 'Advance', basisPoints: 5000, trigger: 'ON_ACCEPT', sortOrder: 0, taxable: 2750000, vat: 357500, total: 3107500 },
    { id: 'st2', label: 'On completion', basisPoints: 5000, trigger: 'ON_COMPLETION', sortOrder: 1, taxable: 2750000, vat: 357500, total: 3107500 },
  ],
  items: [
    { id: 's1', rowType: 'SECTION', number: 'A', description: 'Waterproofing', qty: 0, rate: 0, amount: 0 },
    {
      id: 'r1', rowType: 'ITEM', number: 'A.1', description: 'Terrace membrane', unit: 'sq.ft', netQty: 200, qty: 200, rate: 27500, amount: 5500000,
      isOptional: false, isProvisional: false, unitCost: 21000, costAmount: 4200000,
      recipe: { code: 'WP-TERRACE', unitCost: 21000, overheadPct: 10, profitPct: 15, components: [{ kind: 'LABOUR', cost: 150000 }] },
      measurements: [{ area: 'Roof', description: 'Terrace', nos: 1, l: 20, b: 10 }],
    },
  ],
  boq: {
    sections: [{ index: 0, number: 'A', title: 'Waterproofing', subtotal: 5500000 }],
    optionalTotal: 0,
    cost: { costTotal: 4200000, costComplete: true, margin: { amount: 1300000, pct: 23.64 } },
  },
  costTotal: 4200000, costComplete: true, margin: { amount: 1300000, pct: 23.64 },
};

const open = (role = 'MANAGER') => {
  mockApi(({ method, path }) => (method === 'GET' && path === '/admin/quotations/q7' ? json({ data: RECORD }) : undefined));
  return renderWithProviders(<QuotationPrintPage />, {
    path: '/admin/quotations/:id/print', initialPath: '/admin/quotations/q7/print', preloadedState: signedInAs(role),
  });
};

describe('the quotation print (Phase L4)', () => {
  it('prints the customer’s document — letterhead with logo and PAN/VAT, AD and BS dates, the annex open — with no cost, even for a manager', async () => {
    open('MANAGER');
    const sheet = await screen.findByTestId('print-sheet');
    // The customer's language first.
    expect(within(sheet).getByText('दरभाउपत्र')).toBeInTheDocument();
    await userEvent.setup().click(screen.getByRole('radio', { name: 'English' }));

    const head = within(sheet).getByTestId('letterhead');
    expect(within(head).getByRole('img', { name: 'Gharjatan' })).toHaveAttribute('src', '/uploads/logo-400.webp');
    expect(head).toHaveTextContent('PAN / VAT No. 609876543');
    expect(within(sheet).getByTestId('quotation-date')).toHaveTextContent('16 Sept 2026 (2083-05-31 B.S.)');
    expect(within(sheet).getByTestId('quotation-valid-until')).toHaveTextContent('(2083-07-14 B.S.)');
    expect(within(sheet).getByText('Version 2')).toBeInTheDocument();
    // The status is the office's business, not the paper's.
    expect(within(sheet).queryByText('Approved')).not.toBeInTheDocument();
    // Print shows every figure with its symbol, and the annex without a button.
    expect(within(sheet).getByText('Rs. 55,000.00', { selector: 'td' })).toBeInTheDocument();
    const annex = within(sheet).getByTestId('measurements-annex');
    expect(within(annex).queryByRole('button')).not.toBeInTheDocument();
    expect(within(annex).getByText('Roof — Terrace')).toBeInTheDocument();
    expect(within(sheet).getByTestId('total-in-words')).toHaveTextContent('Rupees Sixty-Two Thousand One Hundred Fifty Only');
    expect(within(sheet).getByTestId('payment-schedule')).toHaveTextContent('Rs. 31,075.00');

    // The money wall: no cost, margin, recipe or internal note anywhere on the page.
    const text = document.body.textContent;
    expect(text).not.toMatch(COST_KEYS);
    for (const figure of ['42,000', '13,000', '23.64', '210.00', '1,500.00', 'WP-TERRACE']) expect(text).not.toContain(figure);
    expect(text).not.toContain('friend of Hari');
    // No app chrome: no navigation, no sidebar.
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
  });

  it('Print calls the browser’s print, and the bar around the sheet is not printed', async () => {
    const print = vi.fn();
    vi.stubGlobal('print', print);
    open('SALES');
    await screen.findByTestId('print-sheet');
    const button = screen.getByRole('button', { name: 'Print' });
    expect(button.closest('.print\\:hidden')).not.toBeNull();
    await userEvent.setup().click(button);
    expect(print).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('link', { name: /Back to QT-2083-0077/ })).toHaveAttribute('href', '/admin/quotations/q7');
    expect(document.title).toBe('QT-2083-0077 v2 — सीता गुरुङ');
  });
});
