import { afterEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import InvoiceDetailPage from '@/pages/admin/InvoiceDetailPage/InvoiceDetailPage';
import InvoicesPage from '@/pages/admin/InvoicesPage';
import InvoicePrintPage from '@/pages/admin/InvoicePrintPage';
import PaymentsPage from '@/pages/admin/PaymentsPage';
import FinanceReportsPage from '@/pages/admin/FinanceReportsPage/FinanceReportsPage';
import ReportsPage from '@/pages/admin/ReportsPage/ReportsPage';
import ResourceListPage from '@/pages/admin/ResourceListPage';
import ResourceEditPage from '@/pages/admin/ResourceEditPage';
import InvoicePublicPage from '@/pages/public/InvoicePublicPage/InvoicePublicPage';
import { INVOICE_LOCKED_MESSAGE } from '@/pages/admin/InvoiceDetailPage/sections/InvoiceEditForm';
import { renderWithProviders, signedInAs } from '@/test/renderWithProviders';
import { json, mockApi } from '@/test/mockApi';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

/**
 * The README fixture (MaintainanceBackend/README.md, tests/money.test.js): 3 lines × 210.5 sq.ft at Rs. 220, 95 and
 * 45, a Rs. 1,500 discount and 13 % VAT. By hand: 46,310.00 + 19,997.50 + 9,472.50 = 75,780.00; less 1,500.00 is
 * 74,280.00 taxable; 13 % of that is 9,656.40; the total is 83,936.40. The mocked server sends exactly these paisa.
 */
const LINES = [
  { id: 'it1', description: 'Terrace waterproofing membrane', unit: 'sq.ft', qty: 210.5, rate: 22_000, amount: 4_631_000, jobId: 'j1' },
  { id: 'it2', description: 'Crystalline primer coat', unit: 'sq.ft', qty: 210.5, rate: 9_500, amount: 1_999_750, jobId: 'j1' },
  { id: 'it3', description: 'Protective screed', unit: 'sq.ft', qty: 210.5, rate: 4_500, amount: 947_250, jobId: 'j1' },
];
const CUSTOMER = { id: 'c1', name: 'सीता गुरुङ', phone: '+977 9841500005', preferredLocale: 'ne', panVatNo: '609876543' };
const SENT = {
  id: 'inv1', number: 'INV-2083-0042', status: 'SENT', customer: CUSTOMER,
  // 18:15 UTC on 16 July is midnight of 17 July in Kathmandu — 2083 Shrawan 1; due 1 Aug (Shrawan 16).
  issuedAt: '2026-07-16T18:15:00.000Z', dueDate: '2026-07-31T18:15:00.000Z',
  subtotal: 7_578_000, discount: 150_000, vatApplied: true, vatRate: 13, vatAmount: 965_640, total: 8_393_640,
  paidAmount: 0, balance: 8_393_640,
  items: LINES, payments: [], jobs: [{ id: 'j1', number: 'JOB-2083-0011', title: 'Terrace waterproofing' }],
  quotation: null, publicToken: 'tok-1', publicUrl: 'http://localhost:5400/invoice/tok-1', sentAt: '2026-07-17T04:00:00.000Z',
  note: null, terms: 'Payable within 15 days.', voidReason: null,
};
const DRAFT = { ...SENT, status: 'DRAFT', publicToken: null, publicUrl: null, sentAt: null };

const openInvoice = (record, role = 'ACCOUNTANT', extra = () => undefined) => {
  const calls = mockApi((call) => extra(call) ?? (call.method === 'GET' && call.path === `/admin/invoices/${record.id}` ? json({ data: record }) : undefined));
  const view = renderWithProviders(<InvoiceDetailPage />, {
    path: '/admin/invoices/:id', initialPath: `/admin/invoices/${record.id}`, preloadedState: signedInAs(role),
  });
  return { calls, ...view };
};

describe('the invoice document shows the server’s money, to the paisa (Phase I2)', () => {
  it('renders the README fixture — lines, subtotal, discount, 13% VAT and total — exactly as sent, dates in AD and BS', async () => {
    openInvoice(SENT);
    const doc = await screen.findByTestId('invoice-document');
    for (const amount of ['Rs. 46,310.00', 'Rs. 19,997.50', 'Rs. 9,472.50']) expect(within(doc).getByText(amount)).toBeInTheDocument();
    const totals = within(doc).getByText('Subtotal').closest('dl');
    const row = (label) => within(totals).getByText(label).parentElement;
    expect(row('Subtotal')).toHaveTextContent('Rs. 75,780.00');
    expect(row('Discount')).toHaveTextContent('− Rs. 1,500.00');
    expect(row('VAT (13%)')).toHaveTextContent('Rs. 9,656.40');
    expect(row('Total')).toHaveTextContent('Rs. 83,936.40');
    expect(row('Amount due')).toHaveTextContent('Rs. 83,936.40');
    expect(within(doc).getByTestId('invoice-issued')).toHaveTextContent('Issued 17 Jul 2026 (2083-04-01 BS)');
    expect(within(doc).getByTestId('invoice-due')).toHaveTextContent('Due 01 Aug 2026 (2083-04-16 BS)');
    expect(within(doc).getByText(/PAN\/VAT 609876543/)).toBeInTheDocument();
    // The header's figures are the same server numbers.
    const figures = screen.getByTestId('invoice-figures');
    expect(within(figures).getAllByText('Rs. 83,936.40')).toHaveLength(2);
  });

  it('never works a figure out itself: a server VAT one paisa off is shown one paisa off', async () => {
    openInvoice({ ...SENT, vatAmount: 965_641, total: 8_393_641, balance: 8_393_641 });
    const doc = await screen.findByTestId('invoice-document');
    expect(within(doc).getByText('Rs. 9,656.41')).toBeInTheDocument();
    expect(within(doc).getAllByText('Rs. 83,936.41')).toHaveLength(2);
    expect(within(doc).queryByText('Rs. 9,656.40')).not.toBeInTheDocument();
  });

  it('never shows a negative balance — an overpaid row reads as settled', async () => {
    openInvoice({ ...SENT, status: 'PAID', paidAmount: 8_443_640, balance: -50_000 });
    const doc = await screen.findByTestId('invoice-document');
    expect(within(doc).getByText('Settled').parentElement).toHaveTextContent('Rs. 0.00');
    expect(within(screen.getByTestId('invoice-figures')).getByText('Rs. 0.00')).toBeInTheDocument();
    expect(screen.queryByText(/-Rs\.|Rs\. -|−Rs\. 500/)).not.toBeInTheDocument();
  });

  it('prints the same document without the status badge', async () => {
    mockApi(({ method, path }) => (method === 'GET' && path === '/admin/invoices/inv1' ? json({ data: SENT }) : undefined));
    renderWithProviders(<InvoicePrintPage />, { path: '/admin/invoices/:id/print', initialPath: '/admin/invoices/inv1/print', preloadedState: signedInAs('ACCOUNTANT') });
    const sheet = await screen.findByTestId('print-sheet');
    expect(within(sheet).getByText('Rs. 9,656.40')).toBeInTheDocument();
    expect(within(sheet).queryByText('Sent')).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Back to INV-2083-0042/ })).toHaveAttribute('href', '/admin/invoices/inv1');
  });

  it('the customer’s page renders the same document, with the balance the server sends — never one it works out', async () => {
    const { payments: _p, jobs: _j, ...publicInvoice } = SENT;
    // Total less paid would be Rs. 82,936.40; the server says 82,936.41, and that is what the customer reads.
    mockApi(({ path }) => (path === '/public/invoices/tok-1'
      ? json({ data: { ...publicInvoice, balance: 8_293_641, paidAmount: 100_000, payments: [{ amount: 100_000, method: 'ESEWA', receivedAt: '2026-09-20T05:00:00.000Z', voidedAt: null }] } })
      : undefined));
    renderWithProviders(<InvoicePublicPage />, { path: '/invoice/:token', initialPath: '/invoice/tok-1' });
    const doc = await screen.findByTestId('invoice-document');
    expect(within(doc).getByText('Amount due').parentElement).toHaveTextContent('Rs. 82,936.41');
    expect(within(doc).queryByText('Rs. 82,936.40')).not.toBeInTheDocument();
    expect(within(doc).getByTestId('invoice-payments')).toHaveTextContent('20 Sept 2026 (2083-06-04 BS) · eSewa');
  });

  it('the customer’s page of a void invoice owes nothing — the server’s balance of 0', async () => {
    mockApi(({ path }) => (path === '/public/invoices/tok-1'
      ? json({ data: { ...SENT, status: 'VOID', voidReason: 'Issued twice', balance: 0, payments: [] } })
      : undefined));
    renderWithProviders(<InvoicePublicPage />, { path: '/invoice/:token', initialPath: '/invoice/tok-1' });
    const doc = await screen.findByTestId('invoice-document');
    expect(within(doc).getByText('This invoice is void — nothing is owed on it')).toBeInTheDocument();
    expect(within(doc).queryByText('Amount due')).not.toBeInTheDocument();
  });
});

describe('payments on an invoice (Phase I2)', () => {
  it('records a partial eSewa payment, then voids it — struck through, and the balance goes back up', async () => {
    const user = userEvent.setup();
    let state = SENT;
    const { calls } = openInvoice(SENT, 'ACCOUNTANT', ({ method, path, body }) => {
      if (method === 'GET' && path === '/admin/invoices/inv1') return json({ data: state });
      if (method === 'POST' && path === '/admin/invoices/inv1/payments') {
        const payment = { id: 'p1', amount: 100_000, method: body.method, reference: body.reference, receivedAt: '2026-09-20T05:00:00.000Z', voidedAt: null, voidReason: null };
        // The server's answer: 83,936.40 − 1,000.00 = 82,936.40 (hand-computed).
        state = { ...SENT, status: 'PARTIAL', paidAmount: 100_000, balance: 8_293_640, payments: [payment] };
        return json({ data: payment }, 201);
      }
      if (method === 'POST' && path === '/admin/invoices/inv1/payments/p1/void') {
        const voided = { ...state.payments[0], voidedAt: '2026-09-21T05:00:00.000Z', voidReason: body.reason };
        state = { ...SENT, status: 'SENT', paidAmount: 0, balance: 8_393_640, payments: [voided] };
        return json({ data: voided });
      }
      return undefined;
    });
    const figures = await screen.findByTestId('invoice-figures');

    await user.click(screen.getByRole('button', { name: 'Record payment' }));
    const sheet = await screen.findByRole('dialog', { name: /Record a payment — INV-2083-0042/ });
    await user.type(within(sheet).getByLabelText(/Amount received/), '1,000');
    await user.click(within(sheet).getByRole('combobox', { name: /Method/ }));
    await user.click(await screen.findByRole('option', { name: 'eSewa' }));
    await user.type(within(sheet).getByLabelText(/Reference/), 'ESW-7781');
    await user.click(within(sheet).getByRole('button', { name: 'Record payment' }));

    await waitFor(() => expect(within(figures).getByText('Rs. 82,936.40')).toBeInTheDocument());
    const post = calls.find((c) => c.method === 'POST' && c.path === '/admin/invoices/inv1/payments');
    // Rupees go to the API, as typed.
    expect(post.body).toMatchObject({ amount: 1000, method: 'ESEWA', reference: 'ESW-7781' });
    expect(screen.getByTestId('invoice-status')).toHaveTextContent('Part paid');

    await user.click(screen.getByRole('tab', { name: 'Payments (1)' }));
    await user.click(await screen.findByRole('button', { name: /Actions for Rs\. 1,000\.00 by eSewa/ }));
    await user.click(await screen.findByRole('menuitem', { name: 'Void payment…' }));
    const dialog = await screen.findByRole('dialog', { name: 'Void the Rs. 1,000.00 payment?' });
    await user.type(within(dialog).getByLabelText(/Why is it void/), 'Entered twice');
    await user.click(within(dialog).getByRole('button', { name: 'Void payment' }));

    await waitFor(() => expect(within(figures).getAllByText('Rs. 83,936.40')).toHaveLength(2));
    expect(calls.find((c) => c.path === '/admin/invoices/inv1/payments/p1/void').body).toEqual({ reason: 'Entered twice' });
    expect(screen.getByTestId('invoice-status')).toHaveTextContent('Sent');
    expect(await screen.findByTestId('voided-amount')).toHaveTextContent('Rs. 1,000.00');
    expect(screen.getByTestId('voided-amount').tagName).toBe('DEL');
    expect(screen.getByText('Entered twice')).toBeInTheDocument();
  });

  it('the payment sheet refuses more than the balance, and sends nothing', async () => {
    const user = userEvent.setup();
    const { calls } = openInvoice(SENT);
    await user.click(await screen.findByRole('button', { name: 'Record payment' }));
    const sheet = await screen.findByRole('dialog', { name: /Record a payment/ });
    const amount = within(sheet).getByLabelText(/Amount received/);
    await user.type(amount, '83,936.41');
    await user.click(within(sheet).getByRole('button', { name: 'Record payment' }));
    expect(await within(sheet).findByText('No more than the balance, Rs. 83,936.40')).toBeInTheDocument();
    expect(calls.some((c) => c.method === 'POST')).toBe(false);

    // The balance itself, to the paisa, is allowed.
    await user.clear(amount);
    await user.type(amount, '83,936.40');
    await user.click(within(sheet).getByRole('button', { name: 'Record payment' }));
    await waitFor(() => expect(calls.find((c) => c.method === 'POST')?.body).toMatchObject({ amount: 83936.4, method: 'CASH' }));
  });

  it('a void invoice owes nothing and offers no payment', async () => {
    openInvoice({ ...SENT, status: 'VOID', voidReason: 'Issued to the wrong customer' });
    const doc = await screen.findByTestId('invoice-document');
    expect(within(doc).getByText('This invoice is void — nothing is owed on it')).toBeInTheDocument();
    expect(within(doc).queryByText('Amount due')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Record payment' })).not.toBeInTheDocument();
    expect(within(screen.getByTestId('invoice-figures')).getByText('Void — nothing owed')).toBeInTheDocument();
  });
});

describe('only a draft is edited (Phase I2)', () => {
  it('a sent invoice has no edit controls — no Edit tab, no lines grid, no Send — and says why', async () => {
    openInvoice(SENT);
    await screen.findByTestId('invoice-document');
    expect(screen.queryByRole('tab', { name: 'Edit' })).not.toBeInTheDocument();
    expect(screen.queryByRole('grid', { name: 'Invoice lines' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Send to customer/ })).not.toBeInTheDocument();
    expect(screen.getByTestId('locked-note')).toHaveTextContent('can no longer be edited');
    expect(screen.getByTestId('public-link')).toHaveTextContent('http://localhost:5400/invoice/tok-1');
  });

  it('a draft opens on its lines (the lineItems grid, rupees in, the server’s amounts shown), and a 422 INVOICE_LOCKED is told in words', async () => {
    const user = userEvent.setup();
    const { calls } = openInvoice(DRAFT, 'ACCOUNTANT', ({ method, path }) => (method === 'PUT' && path === '/admin/invoices/inv1'
      ? json({ error: { code: 'INVOICE_LOCKED', message: 'Invoice INV-2083-0042 is sent: only a draft can be edited.' } }, 422)
      : undefined));
    const grid = await screen.findByRole('grid', { name: 'Invoice lines' });
    expect(screen.getByRole('tab', { name: 'Edit', selected: true })).toBeInTheDocument();
    expect(within(grid).getByText('Rs. 46,310.00')).toBeInTheDocument();
    expect(within(grid).getByText('220.00')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Send to customer/ })).toBeEnabled();

    await user.click(screen.getByRole('button', { name: 'Save draft' }));
    expect(await screen.findByText(INVOICE_LOCKED_MESSAGE)).toBeInTheDocument();
    const put = calls.find((c) => c.method === 'PUT');
    expect(put.body.items).toEqual([
      { description: 'Terrace waterproofing membrane', unit: 'sq.ft', qty: 210.5, rate: 220, jobId: 'j1' },
      { description: 'Crystalline primer coat', unit: 'sq.ft', qty: 210.5, rate: 95, jobId: 'j1' },
      { description: 'Protective screed', unit: 'sq.ft', qty: 210.5, rate: 45, jobId: 'j1' },
    ]);
    expect(put.body).toMatchObject({ discount: 1500, vatApplied: true, terms: 'Payable within 15 days.' });
  });

  it('a reader without invoices:write sees a draft read-only', async () => {
    openInvoice(DRAFT, 'SALES');
    await screen.findByTestId('invoice-document');
    expect(screen.queryByRole('tab', { name: 'Edit' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Send to customer/ })).not.toBeInTheDocument();
  });
});

describe('the invoice list (Phase I1)', () => {
  const COUNTS = { all: 9, DRAFT: 2, SENT: 3, PARTIAL: 1, OVERDUE: 2, PAID: 1, VOID: 0 };
  const listApi = () => mockApi(({ method, path }) => (method === 'GET' && path === '/admin/invoices'
    ? json({ data: [{ ...SENT, status: 'OVERDUE' }], meta: { page: 1, limit: 20, total: 1, pages: 1, counts: COUNTS } })
    : undefined));

  it('honours the overdue notification’s link, shows each tab’s count from the server, and filters by tab', async () => {
    const user = userEvent.setup();
    const calls = listApi();
    renderWithProviders(<InvoicesPage />, { path: '/admin/invoices', initialPath: '/admin/invoices?overdueOnly=true&from=2026-07-01&to=2026-09-28', preloadedState: signedInAs('ACCOUNTANT') });
    const row = await screen.findByRole('row', { name: /INV-2083-0042/ });
    expect(calls.find((c) => c.path === '/admin/invoices').query).toMatchObject({ overdueOnly: 'true', from: '2026-07-01', to: '2026-09-28', sort: '-issuedAt' });
    expect(within(screen.getByRole('tab', { name: /^Overdue/ })).getByText('2')).toBeInTheDocument();
    expect(within(screen.getByRole('tab', { name: /^All/ })).getByText('9')).toBeInTheDocument();
    // Issued and due in AD and BS; total, paid and balance as the server sent them.
    expect(within(row).getByText('2083-04-01 BS')).toBeInTheDocument();
    expect(within(row).getByText('2083-04-16 BS')).toBeInTheDocument();
    expect(within(row).getAllByText('Rs. 83,936.40')).toHaveLength(2);
    expect(within(row).getByText('Rs. 0.00')).toBeInTheDocument();

    await user.click(screen.getByRole('tab', { name: /^Draft/ }));
    await waitFor(() => expect(calls.some((c) => c.path === '/admin/invoices' && c.query.status === 'DRAFT')).toBe(true));
    expect(calls.at(-1).query).toMatchObject({ status: 'DRAFT', overdueOnly: 'true' });
  });

  it('offers Create from job and the manual New invoice to the accountant', async () => {
    listApi();
    renderWithProviders(<InvoicesPage />, { path: '/admin/invoices', preloadedState: signedInAs('ACCOUNTANT') });
    expect(await screen.findByRole('button', { name: 'Create from job' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'New invoice' })).toBeInTheDocument();
  });

  it('Create from job shows how each job bills, and never sends materials or labour for a quoted one', async () => {
    const user = userEvent.setup();
    const calls = mockApi(({ method, path }) => {
      if (method === 'GET' && path === '/admin/invoices') return json({ data: [], meta: { page: 1, limit: 20, total: 0, pages: 1, counts: {} } });
      if (method === 'GET' && path === '/admin/jobs') {
        return json({
          data: [
            { id: 'j1', number: 'JOB-2083-0011', title: 'Terrace waterproofing', status: 'COMPLETED', customer: CUSTOMER, quotation: { id: 'q1', number: 'QT-2083-0007', total: 8_393_640, status: 'APPROVED' } },
            { id: 'j2', number: 'JOB-2083-0012', title: 'Gutter repair', status: 'VERIFIED', customer: CUSTOMER, quotation: null },
          ],
          meta: { page: 1, limit: 10, total: 2, pages: 1 },
        });
      }
      if (method === 'POST' && path === '/admin/invoices/from-job/j1') return json({ data: { ...DRAFT, id: 'inv9', number: 'INV-2083-0050' } }, 201);
      return undefined;
    });
    renderWithProviders(<InvoicesPage />, {
      path: '/admin/invoices', preloadedState: signedInAs('ACCOUNTANT'),
      routes: [{ path: '/admin/invoices/:id', element: <p>Invoice page</p> }],
    });
    await user.click(await screen.findByRole('button', { name: 'Create from job' }));
    const sheet = await screen.findByRole('dialog', { name: 'Create an invoice from a job' });
    expect(await within(sheet).findByText('Bills quotation QT-2083-0007')).toBeInTheDocument();
    expect(within(sheet).getByText('Rs. 83,936.40 as accepted')).toBeInTheDocument();
    expect(within(sheet).getByText('Bills what it used')).toBeInTheDocument();
    expect(calls.find((c) => c.path === '/admin/jobs').query).toMatchObject({ invoiced: 'false' });

    await user.click(within(sheet).getByText('Gutter repair'));
    expect(await screen.findByRole('switch', { name: /Bill the materials/ })).toBeChecked();
    await user.click(screen.getByRole('button', { name: /Pick another job/ }));
    await user.click(await screen.findByText('Terrace waterproofing'));
    expect(screen.queryByRole('switch', { name: /Bill the materials/ })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Create draft invoice' }));
    expect(await screen.findByText('Invoice page')).toBeInTheDocument();
    const post = calls.find((c) => c.method === 'POST');
    expect(post.path).toBe('/admin/invoices/from-job/j1');
    expect(post.body).not.toHaveProperty('includeMaterials');
    expect(post.body).not.toHaveProperty('includeLabour');
  });
});

describe('payments (Phase I3)', () => {
  it('the footer is the server’s totals by method, not the rows on the page; a voided payment is struck through', async () => {
    const user = userEvent.setup();
    const calls = mockApi(({ method, path }) => (method === 'GET' && path === '/admin/payments' ? json({
      data: [
        { id: 'p1', amount: 100_000, method: 'ESEWA', reference: 'ESW-7781', receivedAt: '2026-09-20T05:00:00.000Z', voidedAt: '2026-09-21T05:00:00.000Z', voidReason: 'Entered twice', invoice: { id: 'inv1', number: 'INV-2083-0042', status: 'SENT', customer: CUSTOMER } },
        { id: 'p2', amount: 50_000, method: 'CASH', reference: null, receivedAt: '2026-09-19T05:00:00.000Z', voidedAt: null, invoice: { id: 'inv2', number: 'INV-2083-0043', status: 'PARTIAL', customer: CUSTOMER } },
      ],
      meta: { page: 1, limit: 20, total: 12, pages: 1, totals: { total: 999_900, count: 7, byMethod: { ESEWA: 500_000, CASH: 499_900 } } },
    }) : undefined));
    renderWithProviders(<PaymentsPage />, { path: '/admin/finance/payments', preloadedState: signedInAs('ACCOUNTANT') });
    const footer = await screen.findByTestId('payment-totals');
    expect(within(footer).getByTestId('payments-total')).toHaveTextContent('Rs. 9,999.00');
    expect(footer).toHaveTextContent('7 payments received');
    expect(within(footer).getByText('eSewa').nextSibling).toHaveTextContent('Rs. 5,000.00');
    expect(within(footer).getByText('Cash').nextSibling).toHaveTextContent('Rs. 4,999.00');
    const voided = screen.getAllByRole('row').find((r) => within(r).queryByText('ESW-7781'));
    expect(within(voided).getByText('Rs. 1,000.00').tagName).toBe('DEL');
    expect(within(voided).getByText('2083-06-04 BS')).toBeInTheDocument();

    await user.type(screen.getByRole('textbox', { name: 'Search' }), 'ESW-7781{Enter}');
    await waitFor(() => expect(calls.some((c) => c.path === '/admin/payments' && c.query.q === 'ESW-7781')).toBe(true));
    expect(calls[0].query).toMatchObject({ sort: '-receivedAt' });
  });
});

describe('expenses — a registry entry (Phase I4)', () => {
  const EXPENSE = {
    id: 'ex1', category: 'Transport', amount: 125_050, spentAt: '2026-09-19T18:15:00.000Z', vendor: 'Sajha Yatayat',
    job: { id: 'j1', number: 'JOB-2083-0011' }, jobId: 'j1', approver: { id: 'u9', name: 'लक्ष्मी अधिकारी' },
    bill: { url: '/uploads/bill.webp', thumb: '/uploads/bill-400.webp' }, billMediaId: 'm1', note: null,
  };

  it('lists with the job, the bill, who recorded it and the server’s total — no on/off switch', async () => {
    const calls = mockApi(({ method, path }) => (method === 'GET' && path === '/admin/expenses' ? json({
      data: [EXPENSE], meta: { page: 1, limit: 20, total: 1, pages: 1, totals: { total: 987_654 } },
    }) : undefined));
    renderWithProviders(<ResourceListPage resource="expenses" />, { path: '/admin/expenses', preloadedState: signedInAs('ACCOUNTANT') });
    const row = await screen.findByRole('row', { name: /Transport/ });
    expect(within(row).getByText('Rs. 1,250.50')).toBeInTheDocument();
    expect(within(row).getByText('JOB-2083-0011')).toHaveAttribute('href', '/admin/jobs/j1');
    expect(within(row).getByText('लक्ष्मी अधिकारी')).toBeInTheDocument();
    expect(within(row).getByText('2083-06-04 BS')).toBeInTheDocument();
    expect(screen.queryAllByRole('switch')).toHaveLength(0);
    // The footer is meta.totals, not the one row on screen.
    expect(screen.getByTestId('expenses-total')).toHaveTextContent('Rs. 9,876.54');
    expect(calls[0].query).toMatchObject({ sort: '-spentAt' });
  });

  it('suggests the categories in use, sends the amount in rupees, and uploads the bill photo to its own endpoint', async () => {
    const user = userEvent.setup();
    const calls = mockApi(({ method, path }) => {
      if (method === 'GET' && path === '/admin/expenses/categories') return json({ data: ['Transport', 'Fuel', 'Tools'] });
      if (method === 'POST' && path === '/admin/expenses/bill') {
        return json({ data: { id: 'm7', url: '/uploads/bills/bill-7.webp', thumb: '/uploads/bills/bill-7-400.webp', alt: 'Expense bill' } }, 201);
      }
      if (method === 'POST' && path === '/admin/expenses') return json({ data: { ...EXPENSE, id: 'ex2' } }, 201);
      return undefined;
    });
    renderWithProviders(<ResourceEditPage resource="expenses" />, {
      path: '/admin/expenses/new', preloadedState: signedInAs('ACCOUNTANT'),
      routes: [{ path: '/admin/expenses/:id', element: <p>Saved</p> }],
    });
    const category = await screen.findByLabelText(/Category/);
    const list = document.getElementById(category.getAttribute('list'));
    await waitFor(() => expect([...list.querySelectorAll('option')].map((o) => o.value)).toEqual(['Transport', 'Fuel', 'Tools']));

    // The accountant has no media:read — the bill is uploaded, never picked from the library.
    expect(screen.getByRole('button', { name: /Choose or take a photo/ })).toBeInTheDocument();
    const photo = new File([new Uint8Array([0xff, 0xd8, 0xff, 0xe0])], 'bill.jpg', { type: 'image/jpeg' });
    await user.upload(screen.getByLabelText('Bill photo: choose or take a photo'), photo);
    const preview = screen.getByTestId('billMediaId-preview');
    await waitFor(() => expect(preview.querySelector('img')).toHaveAttribute('src', '/uploads/bills/bill-7-400.webp'));
    const upload = calls.find((c) => c.path === '/admin/expenses/bill');
    expect(upload.method).toBe('POST');
    expect(upload.body.get('files').name).toBe('bill.jpg');
    expect(calls.some((c) => c.path.startsWith('/admin/media'))).toBe(false);
    expect(screen.getByRole('button', { name: /Replace photo/ })).toBeInTheDocument();

    await user.type(category, 'Transport');
    await user.type(screen.getByLabelText(/^Amount/), '1,250.50');
    await user.type(screen.getByLabelText(/Paid to/), 'साझा यातायात');
    await user.click(screen.getByRole('button', { name: 'Create Expense' }));
    expect(await screen.findByText('Saved')).toBeInTheDocument();
    expect(calls.find((c) => c.method === 'POST' && c.path === '/admin/expenses').body).toMatchObject({
      category: 'Transport', amount: 1250.5, vendor: 'साझा यातायात', jobId: null, billMediaId: 'm7',
    });
  });

  it('a saved expense shows its bill; Remove clears it (sent as null), and a failed upload says why', async () => {
    const user = userEvent.setup();
    const calls = mockApi(({ method, path }) => {
      if (method === 'GET' && path === '/admin/expenses/ex1') return json({ data: EXPENSE });
      if (method === 'POST' && path === '/admin/expenses/bill') return json({ error: { code: 'UNSUPPORTED_MEDIA', message: 'That file is not a picture.' } }, 415);
      if (method === 'PUT' && path === '/admin/expenses/ex1') return json({ data: { ...EXPENSE, billMediaId: null, bill: null } });
      return undefined;
    });
    renderWithProviders(<ResourceEditPage resource="expenses" />, {
      path: '/admin/expenses/:id', initialPath: '/admin/expenses/ex1', preloadedState: signedInAs('ACCOUNTANT'),
    });
    const preview = await screen.findByTestId('billMediaId-preview');
    expect(preview.querySelector('img')).toHaveAttribute('src', '/uploads/bill-400.webp');

    await user.upload(screen.getByLabelText('Bill photo: choose or take a photo'), new File(['%PDF'], 'bill.jpg', { type: 'image/jpeg' }));
    expect(await screen.findByText('That file is not a picture.')).toBeInTheDocument();
    // The saved bill is still the value.
    expect(preview.querySelector('img')).toHaveAttribute('src', '/uploads/bill-400.webp');

    await user.click(screen.getByRole('button', { name: 'Remove' }));
    expect(preview.querySelector('img')).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Save changes' }));
    await waitFor(() => expect(calls.find((c) => c.method === 'PUT')?.body).toMatchObject({ billMediaId: null }));
  });

});

/** Saved files, and the anchor clicks that save them. */
function captureDownloads() {
  const blobs = [];
  Object.assign(URL, { createObjectURL: vi.fn((blob) => { blobs.push(blob); return 'blob:csv'; }), revokeObjectURL: vi.fn() });
  const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
  return { blobs, click };
}
const csvResponse = (text, name) => new Response(text, {
  headers: { 'content-type': 'text/csv; charset=utf-8', 'content-disposition': `attachment; filename="${name}"` },
});

describe('finance reports (Phase I5)', () => {
  it('downloads the revenue CSV with the filters on screen — the range and the grouping', async () => {
    const user = userEvent.setup();
    const { blobs, click } = captureDownloads();
    const calls = mockApi(({ path, query }) => {
      if (path !== '/admin/reports/revenue') return undefined;
      if (query.format === 'csv') return csvResponse('Service,Invoices,Taxable,VAT,Invoiced\r\nWaterproofing,1,74280.00,9656.40,83936.40', 'revenue-2026-07-17-2026-09-28.csv');
      return json({
        data: {
          groupBy: 'service',
          rows: [{ key: 'Waterproofing', label: 'Waterproofing', count: 1, taxable: 7_428_000, vat: 965_640, invoiced: 8_393_640, collected: 100_000, outstanding: 8_293_640 }],
          totals: { count: 1, taxable: 7_428_000, vat: 965_640, invoiced: 8_393_640, collected: 100_000, outstanding: 8_293_640 },
        },
      });
    });
    renderWithProviders(<FinanceReportsPage />, {
      path: '/admin/finance/reports', initialPath: '/admin/finance/reports?report=revenue&from=2026-07-17&to=2026-09-28&groupBy=service',
      preloadedState: signedInAs('ACCOUNTANT'),
    });
    const figures = await screen.findByRole('list', { name: 'Revenue totals' });
    expect(within(figures).getByText('VAT').nextSibling).toHaveTextContent('Rs. 9,656.40');
    expect(screen.getByRole('row', { name: /Waterproofing/ })).toHaveTextContent('Rs. 74,280.00');
    expect(screen.getByTestId('range-bs')).toHaveTextContent('2083-04-01 – 2083-06-12 BS');

    await user.click(screen.getByRole('button', { name: 'Download revenue as CSV' }));
    await waitFor(() => expect(blobs).toHaveLength(1));
    const csvCall = calls.find((c) => c.query.format === 'csv');
    expect(csvCall.query).toEqual({ from: '2026-07-17', to: '2026-09-28', groupBy: 'service', format: 'csv' });
    expect([...new Uint8Array(await blobs[0].arrayBuffer()).slice(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);
    expect((await blobs[0].text()).split('\r\n')[1]).toBe('Waterproofing,1,74280.00,9656.40,83936.40');
    expect(click.mock.contexts[0].download).toBe('revenue-2026-07-17-2026-09-28.csv');
  });

  it('aging drills down from a bucket to its invoices', async () => {
    const user = userEvent.setup();
    const inv = (id, number, bucket, days, owed) => ({
      id, number, customer: { id: 'c1', name: CUSTOMER.name }, issuedAt: '2026-06-01T05:00:00.000Z', dueDate: '2026-06-16T05:00:00.000Z',
      total: owed, paid: 0, outstanding: owed, daysOverdue: days, bucket,
    });
    mockApi(({ path }) => (path === '/admin/reports/aging' ? json({
      data: {
        asOf: '2026-09-28T04:00:00.000Z',
        buckets: { current: 100_000, d0_30: 0, d31_60: 250_000, d61_90: 0, d90_plus: 400_000 },
        total: 750_000,
        byCustomer: [{ customer: { id: 'c1', name: CUSTOMER.name }, total: 750_000, current: 100_000, d0_30: 0, d31_60: 250_000, d61_90: 0, d90_plus: 400_000 }],
        invoices: [inv('a', 'INV-A', 'd90_plus', 120, 400_000), inv('b', 'INV-B', 'd31_60', 45, 250_000), inv('c', 'INV-C', 'current', 0, 100_000)],
      },
    }) : undefined));
    renderWithProviders(<FinanceReportsPage />, { path: '/admin/finance/reports', preloadedState: signedInAs('ACCOUNTANT') });
    const buckets = await screen.findByRole('list', { name: 'Owed by days past due' });
    expect(within(buckets).getByRole('button', { name: /Total owed/ })).toHaveTextContent('Rs. 7,500.00');
    expect(screen.getByRole('row', { name: /INV-A/ })).toBeInTheDocument();

    await user.click(within(buckets).getByRole('button', { name: /31–60 days overdue/ }));
    expect(within(buckets).getByRole('button', { name: /31–60 days overdue/ })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('row', { name: /INV-B/ })).toHaveTextContent('Rs. 2,500.00');
    expect(screen.queryByRole('row', { name: /INV-A/ })).not.toBeInTheDocument();
    expect(screen.getByTestId('aging-drilldown')).toHaveTextContent('· 1');
  });

  it('collections: the server’s total and each method’s amount', async () => {
    mockApi(({ path }) => (path === '/admin/reports/collections' ? json({
      data: {
        total: 350_000, count: 3, byMethod: { ESEWA: 200_000, BANK: 150_000 }, truncated: true,
        payments: [{ id: 'p9', amount: 200_000, method: 'ESEWA', reference: 'ESW-1', receivedAt: '2026-09-20T05:00:00.000Z', invoice: { id: 'inv1', number: 'INV-2083-0042', customer: { id: 'c1', name: CUSTOMER.name } } }],
      },
    }) : undefined));
    renderWithProviders(<FinanceReportsPage />, { path: '/admin/finance/reports', initialPath: '/admin/finance/reports?report=collections', preloadedState: signedInAs('ACCOUNTANT') });
    const tiles = await screen.findByRole('list', { name: 'Collected by method' });
    expect(within(tiles).getByText('Collected').nextSibling).toHaveTextContent('Rs. 3,500.00');
    expect(within(tiles).getByText('eSewa').nextSibling).toHaveTextContent('Rs. 2,000.00');
    expect(within(tiles).getByText('Bank transfer').nextSibling).toHaveTextContent('Rs. 1,500.00');
    expect(screen.getByTestId('collections-truncated')).toBeInTheDocument();
  });

  it('a customer statement: the server’s totals and ledger, with its own CSV', async () => {
    const user = userEvent.setup();
    const { blobs } = captureDownloads();
    const calls = mockApi(({ path, query }) => {
      if (path !== '/admin/customers/c1/statement') return undefined;
      if (query.format === 'csv') return csvResponse('Date,Entry,Invoice,Charged,Paid,Balance', 'statement.csv');
      return json({
        data: {
          customer: CUSTOMER,
          ledger: [
            { at: '2026-07-16T18:15:00.000Z', kind: 'invoice', ref: 'INV-2083-0042', invoiceId: 'inv1', debit: 8_393_640, credit: 0, balance: 8_393_640 },
            { at: '2026-09-20T05:00:00.000Z', kind: 'payment', ref: 'INV-2083-0042', invoiceId: 'inv1', method: 'ESEWA', debit: 0, credit: 100_000, balance: 8_293_640 },
          ],
          totals: { invoiced: 8_393_640, paid: 100_000, outstanding: 8_293_640 },
        },
      });
    });
    renderWithProviders(<FinanceReportsPage />, { path: '/admin/finance/reports', initialPath: '/admin/finance/reports?report=statement&customerId=c1', preloadedState: signedInAs('ACCOUNTANT') });
    const totals = await screen.findByRole('list', { name: 'Account totals' });
    expect(within(totals).getByText('Outstanding').nextSibling).toHaveTextContent('Rs. 82,936.40');
    const payment = screen.getAllByRole('row').find((r) => within(r).queryByText('Payment · eSewa'));
    expect(payment).toHaveTextContent('Rs. 1,000.00');
    expect(payment).toHaveTextContent('Rs. 82,936.40');
    expect(payment).toHaveTextContent('2083-06-04 BS');
    await user.click(screen.getByRole('button', { name: 'Download statement as CSV' }));
    await waitFor(() => expect(blobs).toHaveLength(1));
    expect(calls.find((c) => c.query.format === 'csv').path).toBe('/admin/customers/c1/statement');
  });
});

describe('sales and operations reports (Phase I10)', () => {
  it('downloads a report’s CSV with the range on screen', async () => {
    const user = userEvent.setup();
    const { blobs } = captureDownloads();
    const calls = mockApi(({ path, query }) => {
      if (path !== '/admin/reports/sla') return undefined;
      if (query.format === 'csv') return csvResponse('Who,Leads,Answered,Within 2 h,Kept', 'sla.csv');
      return json({ data: { total: 4, responded: 3, neverResponded: 1, onTime: 2, complianceRate: 50, avgResponseMinutes: 95, medianResponseMinutes: 40, byStaff: [{ staff: 'राम शर्मा', total: 4, responded: 3, onTime: 2, complianceRate: 50 }] } });
    });
    renderWithProviders(<ReportsPage />, {
      path: '/admin/reports/:group', initialPath: '/admin/reports/sales?report=sla&from=2026-09-01&to=2026-09-28', preloadedState: signedInAs('SALES'),
    });
    expect(await screen.findByRole('row', { name: /राम शर्मा/ })).toHaveTextContent('50%');
    expect(screen.getByText('1 h 35 min')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Download sla as CSV' }));
    await waitFor(() => expect(blobs).toHaveLength(1));
    expect(calls.find((c) => c.query.format === 'csv').query).toEqual({ from: '2026-09-01', to: '2026-09-28', format: 'csv' });
  });

  it('job margin is for costs:read only — SALES is sent to its own reports, MANAGER sees the margin', async () => {
    const calls = mockApi(({ path }) => {
      if (path === '/admin/reports/job-margin') {
        return json({ data: { rows: [{ jobId: 'j1', number: 'JOB-2083-0011', title: 'Terrace waterproofing', type: 'REPAIR', invoiced: 8_393_640, cost: 5_000_000, materialCost: 3_000_000, labourCost: 1_500_000, expenseCost: 500_000, margin: 3_393_640, marginPct: 40.4 }], byType: [], totals: { invoiced: 8_393_640, cost: 5_000_000, margin: 3_393_640 } } });
      }
      if (path === '/admin/reports/lead-sources') return json({ data: [] });
      return undefined;
    });
    const sales = renderWithProviders(<ReportsPage />, { path: '/admin/reports/:group', initialPath: '/admin/reports/job-margin', preloadedState: signedInAs('SALES') });
    await waitFor(() => expect(sales.router.state.location.pathname).toBe('/admin/reports/sales'));
    expect(calls.some((c) => c.path === '/admin/reports/job-margin')).toBe(false);
    sales.unmount();

    renderWithProviders(<ReportsPage />, { path: '/admin/reports/:group', initialPath: '/admin/reports/job-margin', preloadedState: signedInAs('MANAGER') });
    const totals = await screen.findByRole('list', { name: 'Margin totals' });
    expect(within(totals).getByText('Margin').nextSibling).toHaveTextContent('Rs. 33,936.40');
    expect(screen.getByRole('row', { name: /JOB-2083-0011/ })).toHaveTextContent('40.4%');
  });

  it('the accountant has no sales or operations reports; the old lost-leads address opens Sales › Lost leads', async () => {
    mockApi(() => undefined);
    const accountant = renderWithProviders(<ReportsPage />, {
      path: '/admin/reports/:group', initialPath: '/admin/reports/sales', preloadedState: signedInAs('ACCOUNTANT'),
      routes: [{ path: '/admin', element: <p>Dashboard</p> }],
    });
    expect(await screen.findByText('Dashboard')).toBeInTheDocument();
    accountant.unmount();

    const sales = renderWithProviders(<ReportsPage />, { path: '/admin/reports/:group', initialPath: '/admin/reports/lost?from=2026-09-01', preloadedState: signedInAs('SALES') });
    await waitFor(() => expect(sales.router.state.location.search).toBe('?from=2026-09-01&report=lost'));
    expect(await screen.findByRole('tab', { name: 'Lost leads', selected: true })).toBeInTheDocument();
  });
});
