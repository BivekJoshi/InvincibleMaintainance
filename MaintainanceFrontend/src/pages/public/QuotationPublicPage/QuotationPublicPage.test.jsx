import { afterEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import QuotationPublicPage from './QuotationPublicPage';
import { renderWithProviders } from '@/test/renderWithProviders';
import { json, mockApi } from '@/test/mockApi';
import uiReducer from '@/redux/slices/uiSlice';

afterEach(() => vi.unstubAllGlobals());

const ALL = ['approve', 'request_changes', 'reject'];
const QUOTATION = {
  number: 'QT-2083-0012', version: 2, status: 'SENT', validUntil: '2026-10-01T18:14:00.000Z',
  subtotal: 6090000, discount: 0, vatApplied: true, vatRate: 13, vatAmount: 791700, total: 6881700,
  terms: null, decisionNote: null, requestedChanges: 'कृपया बार्दलीको भित्ता पनि थप्नुहोस्।',
  customer: { name: 'Anjali Karki' }, site: { label: 'Home', address: 'Baneshwor' },
  items: [{ id: 'i1', description: 'Seepage treatment', unit: 'sq.ft', qty: 240, rate: 22000, amount: 5280000, sortOrder: 0 }],
  replaced: null, actions: ALL,
};

const open = (quotation, decide = () => json({ data: { ...quotation, status: 'CONVERTED', actions: [], job: { id: 'j1', number: 'JOB-2083-0006' } } })) => {
  const calls = mockApi((call) => {
    if (call.method === 'GET' && call.path === '/public/quotations/tok-1') return json({ data: quotation });
    if (call.method === 'POST' && call.path === '/public/quotations/tok-1/decide') return decide(call);
    return undefined;
  });
  renderWithProviders(<QuotationPublicPage />, {
    path: '/quotation/:token', initialPath: '/quotation/tok-1',
    routes: [{ path: '/quotation/tok-2', element: <p>Newer version</p> }],
  });
  return calls;
};

describe('the customer quotation page', () => {
  it('offers Accept, Ask for changes and Decline, and Accept repeats the total before recording it', async () => {
    const user = userEvent.setup();
    const calls = open(QUOTATION);
    expect(await screen.findByText('QT-2083-0012')).toBeInTheDocument();
    expect(screen.getByText('कृपया बार्दलीको भित्ता पनि थप्नुहोस्।')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Ask for changes' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Decline' })).toBeInTheDocument();
    // No login, no code, no name.
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Accept' }));
    const dialog = await screen.findByRole('dialog', { name: 'Accept this quotation?' });
    expect(within(dialog).getByTestId('accept-total')).toHaveTextContent('68,817');
    await user.click(within(dialog).getByRole('button', { name: 'Yes, accept' }));

    await waitFor(() => expect(calls.find((c) => c.method === 'POST')?.body).toEqual({ decision: 'approve' }));
    expect(await screen.findByText('Thank you — quotation accepted')).toBeInTheDocument();
    expect(screen.getByText(/call you to schedule the work/)).toBeInTheDocument();
    expect(screen.getByText(/JOB-2083-0006/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Accept' })).not.toBeInTheDocument();
  });

  it('asks for a message before sending a change request, in Nepali, then says what happens next', async () => {
    const user = userEvent.setup();
    const note = 'कृपया रङ पनि परिवर्तन गर्नुहोस्।';
    const calls = open(QUOTATION, ({ body }) => json({ data: { ...QUOTATION, status: 'CHANGES_REQUESTED', decisionNote: body.note, actions: [] } }));
    await user.click(await screen.findByRole('button', { name: 'Ask for changes' }));
    const dialog = await screen.findByRole('dialog', { name: 'What would you like changed?' });
    await user.click(within(dialog).getByRole('button', { name: 'Send my request' }));
    expect(await within(dialog).findByText(/at least 5 characters/)).toBeInTheDocument();
    expect(calls.some((c) => c.method === 'POST')).toBe(false);

    await user.type(within(dialog).getByRole('textbox', { name: /Your message/ }), note);
    await user.click(within(dialog).getByRole('button', { name: 'Send my request' }));
    await waitFor(() => expect(calls.find((c) => c.method === 'POST')?.body).toEqual({ decision: 'request_changes', note }));
    expect(await screen.findByText('Thank you — we have your request')).toBeInTheDocument();
    expect(screen.getByText(/send you an updated quotation/)).toBeInTheDocument();
    expect(screen.getByText(note)).toBeInTheDocument();
  });

  it('declines without a reason', async () => {
    const user = userEvent.setup();
    const calls = open(QUOTATION, () => json({ data: { ...QUOTATION, status: 'REJECTED', actions: [] } }));
    await user.click(await screen.findByRole('button', { name: 'Decline' }));
    const dialog = await screen.findByRole('dialog', { name: 'Decline this quotation?' });
    await user.click(within(dialog).getByRole('button', { name: 'Decline' }));
    await waitFor(() => expect(calls.find((c) => c.method === 'POST')?.body).toEqual({ decision: 'reject' }));
    expect(await screen.findByText('Quotation declined')).toBeInTheDocument();
  });

  it('points a replaced quotation at the newer version and offers no answer', async () => {
    const user = userEvent.setup();
    open({ ...QUOTATION, status: 'SUPERSEDED', actions: [], replaced: { token: 'tok-2' } });
    expect(await screen.findByText('There is a newer version of this quotation')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Accept' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('link', { name: 'Open the latest version' }));
    expect(await screen.findByText('Newer version')).toBeInTheDocument();
  });

  it('offers a call on an expired quotation', async () => {
    open({ ...QUOTATION, status: 'EXPIRED', actions: [] });
    expect(await screen.findByText('This quotation has expired')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /^Call / })).toHaveAttribute('href', expect.stringMatching(/^tel:/));
    expect(screen.queryByRole('button', { name: 'Decline' })).not.toBeInTheDocument();
  });

  it('shows an earlier change request as sent', async () => {
    open({ ...QUOTATION, status: 'CHANGES_REQUESTED', decisionNote: 'Smaller area please', actions: [] });
    expect(await screen.findByText('Thank you — we have your request')).toBeInTheDocument();
    expect(screen.getByText('Smaller area please')).toBeInTheDocument();
  });

  it('shows the recorded state when the answer arrives too late', async () => {
    const user = userEvent.setup();
    let expired = false;
    mockApi((call) => {
      if (call.method === 'GET') return json({ data: expired ? { ...QUOTATION, status: 'EXPIRED', actions: [] } : QUOTATION });
      expired = true;
      return json({ error: { code: 'QUOTATION_EXPIRED', message: 'This quotation has expired. Please contact us for a fresh quote.' } }, 422);
    });
    renderWithProviders(<QuotationPublicPage />, { path: '/quotation/:token', initialPath: '/quotation/tok-1' });
    await user.click(await screen.findByRole('button', { name: 'Accept' }));
    await user.click(await screen.findByRole('button', { name: 'Yes, accept' }));
    expect(await screen.findByText('This quotation has expired')).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent(/expired/);
  });
});

describe('the customer quotation page — a bill of quantities (Phase L3)', () => {
  const BOQ = {
    ...QUOTATION,
    items: [
      { id: 's1', rowType: 'SECTION', number: 'A', description: 'Waterproofing', spec: null, qty: 0, rate: 0, amount: 0, isOptional: false, isProvisional: false },
      { id: 'i1', rowType: 'ITEM', number: 'A.1', description: 'Seepage treatment', spec: 'Crystalline slurry, two coats', unit: 'sq.ft', qty: 240, rate: 22000, amount: 5280000, isOptional: false, isProvisional: false },
      { id: 'n1', rowType: 'NOTE', number: null, description: 'मचान दररेटमा समावेश छ।', qty: 0, rate: 0, amount: 0, isOptional: false, isProvisional: false },
      { id: 'i2', rowType: 'ITEM', number: 'A.2', description: 'Parapet coping', spec: null, unit: 'rft', qty: 40, rate: 50000, amount: 2000000, isOptional: true, isProvisional: false },
      { id: 'i3', rowType: 'ITEM', number: 'A.3', description: 'Drain chamber', spec: null, unit: 'nos', qty: 2, rate: 405000, amount: 810000, isOptional: false, isProvisional: true },
    ],
  };
  const rows = () => screen.getAllByRole('row').slice(1);

  it('shows sections as numbered headings, notes as text, a spec under its row, and optional rows as not in the total', async () => {
    open(BOQ);
    expect(await screen.findByRole('heading', { name: 'Waterproofing' })).toBeInTheDocument();
    expect(within(rows()[0]).getByText('A')).toBeInTheDocument();
    expect(within(rows()[1]).getByText('A.1')).toBeInTheDocument();
    expect(within(rows()[1]).getByText('Crystalline slurry, two coats')).toBeInTheDocument();
    expect(rows()[2]).toHaveTextContent('मचान दररेटमा समावेश छ।');
    expect(within(rows()[3]).getByText('Optional — not included in the total')).toBeInTheDocument();
    expect(within(rows()[3]).getByText('(20,000.00)')).toBeInTheDocument();
    expect(within(rows()[4]).getByText('Provisional — settled by measurement')).toBeInTheDocument();
    // The total is the server's — the optional row is not in it.
    expect(screen.getByText('Rs. 68,817.00')).toBeInTheDocument();
  });

  it('reads in Nepali when the site is in Nepali', async () => {
    mockApi((call) => (call.method === 'GET' ? json({ data: BOQ }) : undefined));
    renderWithProviders(<QuotationPublicPage />, {
      path: '/quotation/:token', initialPath: '/quotation/tok-1',
      preloadedState: { ui: { ...uiReducer(undefined, { type: '@@init' }), locale: 'ne' } },
    });
    expect(await screen.findByText('ऐच्छिक — जम्मामा समावेश छैन')).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'विवरण' })).toBeInTheDocument();
    expect(screen.getByText('उप-जम्मा')).toBeInTheDocument();
    expect(screen.getByText('दरभाउपत्र')).toBeInTheDocument();
  });
});
