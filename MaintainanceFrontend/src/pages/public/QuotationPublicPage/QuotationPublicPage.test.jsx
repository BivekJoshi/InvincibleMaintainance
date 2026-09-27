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

describe('the customer quotation page — the document (Phase L4)', () => {
  /** What GET /public/quotations/:token answers since Phase L4 — an allowlist: no cost key anywhere. */
  const DOC = {
    ...QUOTATION,
    requestedChanges: null,
    createdAt: '2026-09-26T04:00:00.000Z',
    validUntil: '2026-10-26T18:14:00.000Z',
    subtotal: 7290000, discount: 0, vatApplied: true, vatRate: 13, vatAmount: 947700, total: 8237700,
    terms: 'Materials as per the manufacturer’s warranty.',
    contractType: 'ITEM_RATE',
    estimatedDays: 21,
    exclusions: 'Water and electricity during the work are provided by the owner.',
    summaryOnly: false,
    letterhead: {
      companyName: 'Gharjatan Home Services', address: 'Baneshwor', city: 'Kathmandu', phones: ['01-5407720', '9801234567'],
      email: 'info@gharjatan.com.np', panVatNo: '609876543', logo: null, tagline: 'Repairs done right',
    },
    dates: { createdAtBs: '2083-06-10', validUntilBs: '2083-07-10' },
    totalInWords: {
      en: 'Rupees Eighty-Two Thousand Three Hundred Seventy-Seven Only',
      ne: 'रुपैयाँ बयासी हजार तीन सय सतहत्तर मात्र',
    },
    paymentStages: [
      { label: 'Advance', basisPoints: 5000, trigger: 'ON_ACCEPT', taxable: 3645000, vat: 473850, total: 4118850 },
      { label: 'Running bill', basisPoints: 4000, trigger: 'MILESTONE', taxable: 2916000, vat: 379080, total: 3295080 },
      { label: 'On completion', basisPoints: 1000, trigger: 'ON_COMPLETION', taxable: 729000, vat: 94770, total: 823770 },
    ],
    items: [
      { id: 's1', rowType: 'SECTION', number: 'A', description: 'Waterproofing', spec: null, qty: 0, rate: 0, amount: 0, isOptional: false, isProvisional: false },
      {
        id: 'i1', rowType: 'ITEM', number: 'A.1', description: 'Seepage treatment', spec: null, unit: 'sq.ft', qty: 240, rate: 22000, amount: 5280000,
        isOptional: false, isProvisional: false,
        measurements: [{ area: 'बैठक कोठा', description: 'North wall', nos: 1, l: 20, h: 12 }],
      },
      { id: 'n1', rowType: 'NOTE', number: null, description: 'Scaffolding is included in the rates.', qty: 0, rate: 0, amount: 0, isOptional: false, isProvisional: false },
      { id: 's2', rowType: 'SECTION', number: 'B', description: 'Painting', spec: null, qty: 0, rate: 0, amount: 0, isOptional: false, isProvisional: false },
      { id: 'i2', rowType: 'ITEM', number: 'B.1', description: 'Exterior weather coat', spec: 'Two coats', unit: 'sq.ft', qty: 600, rate: 3350, amount: 2010000, isOptional: false, isProvisional: false },
      { id: 'i3', rowType: 'ITEM', number: 'B.2', description: 'Parapet coping', spec: null, unit: 'rft', qty: 40, rate: 50000, amount: 2000000, isOptional: true, isProvisional: false },
    ],
    boq: {
      sections: [
        { index: 0, number: 'A', title: 'Waterproofing', subtotal: 5280000 },
        { index: 3, number: 'B', title: 'Painting', subtotal: 2010000 },
      ],
      optionalTotal: 2000000,
    },
  };

  const openAt360 = (quotation, locale = 'en', decide) => {
    // A phone: the page lays out for 360 px (the end-to-end run checks nothing scrolls sideways there).
    window.innerWidth = 360;
    window.dispatchEvent(new Event('resize'));
    const calls = mockApi((call) => {
      if (call.method === 'GET' && call.path === '/public/quotations/tok-1') return json({ data: quotation });
      if (call.method === 'POST' && decide) return decide(call);
      return undefined;
    });
    renderWithProviders(<QuotationPublicPage />, {
      path: '/quotation/:token', initialPath: '/quotation/tok-1',
      preloadedState: { ui: { ...uiReducer(undefined, { type: '@@init' }), locale } },
    });
    return calls;
  };

  /** Wide content scrolls inside its own box, never the page: every table sits in an overflow-x container. */
  const expectTablesContained = () => {
    for (const table of document.querySelectorAll('table')) {
      expect(table.closest('.overflow-x-auto'), 'a table that can widen the page').not.toBeNull();
    }
  };

  it('reads as the company’s quotation in English at 360 px: letterhead, AD and BS dates, sections, optional rows, words, contract, schedule', async () => {
    const user = userEvent.setup();
    openAt360(DOC);
    const doc = await screen.findByTestId('quotation-document');

    // The letterhead and the dates, AD with BS from the server.
    const head = within(doc).getByTestId('letterhead');
    expect(head).toHaveTextContent('Gharjatan Home Services');
    expect(head).toHaveTextContent('PAN / VAT No. 609876543');
    expect(within(head).getByRole('link', { name: '9801234567' })).toHaveAttribute('href', 'tel:9801234567');
    expect(within(doc).getByTestId('quotation-date')).toHaveTextContent('26 Sept 2026 (2083-06-10 B.S.)');
    expect(within(doc).getByTestId('quotation-valid-until')).toHaveTextContent('Valid until 26 Oct 2026 (2083-07-10 B.S.)');

    // Sections with their subtotals, notes, the optional row marked and its total apart.
    expect(within(doc).getByRole('heading', { name: 'Waterproofing' })).toBeInTheDocument();
    expect(within(doc).getByRole('heading', { name: 'Painting' })).toBeInTheDocument();
    expect(within(doc).getByText('Scaffolding is included in the rates.')).toBeInTheDocument();
    expect(within(doc).getByText('Optional — not included in the total')).toBeInTheDocument();
    expect(within(doc).getByText('Optional items (not included)')).toBeInTheDocument();
    expect(within(doc).getByText('(Rs. 20,000.00)')).toBeInTheDocument();

    // The total and the words, both the server's — the schedule's footer is the same total, never a sum.
    expect(within(doc).getAllByText('Rs. 82,377.00')).toHaveLength(2);
    expect(within(doc).getByTestId('total-in-words')).toHaveTextContent('Rupees Eighty-Two Thousand Three Hundred Seventy-Seven Only');

    // How the final bill is worked out, the duration, the exclusions.
    expect(within(doc).getByTestId('contract-type')).toHaveTextContent('Item rate');
    expect(within(doc).getByTestId('contract-type')).toHaveTextContent('we measure it when finished and bill the measured quantity at these rates');
    expect(within(doc).getByTestId('estimated-days')).toHaveTextContent('About 21 days');
    expect(within(doc).getByText(/provided by the owner/)).toBeInTheDocument();

    // The payment schedule: each stage's share and the server's amount, in order.
    const schedule = within(doc).getByTestId('payment-schedule');
    const stageRows = within(schedule).getAllByRole('row').slice(1, 4);
    expect(stageRows.map((r) => r.getAttribute('data-trigger'))).toEqual(['ON_ACCEPT', 'MILESTONE', 'ON_COMPLETION']);
    expect(stageRows[0]).toHaveTextContent('Advance');
    expect(stageRows[0]).toHaveTextContent('On acceptance (advance)');
    expect(stageRows[0]).toHaveTextContent('50%');
    expect(stageRows[0]).toHaveTextContent('Rs. 41,188.50');
    expect(stageRows[0]).toHaveTextContent('incl. VAT Rs. 4,738.50');
    expect(stageRows[2]).toHaveTextContent('Rs. 8,237.70');
    expect(within(doc).getByText('Materials as per the manufacturer’s warranty.')).toBeInTheDocument();

    // The measurements annex, collapsed until asked for.
    const annex = within(doc).getByTestId('measurements-annex');
    expect(within(annex).queryByText('North wall', { exact: false })).not.toBeInTheDocument();
    await user.click(within(annex).getByRole('button', { name: 'Show the measurements (1 item)' }));
    expect(within(annex).getByText('बैठक कोठा — North wall')).toBeInTheDocument();
    expect(within(annex).getByText('240')).toBeInTheDocument();
    expect(within(annex).getByText('In the bill: 240 sq.ft')).toBeInTheDocument();

    expect(screen.getByRole('button', { name: 'Accept' })).toBeInTheDocument();
    expectTablesContained();
    // The allowlist holds: nothing on the page names a cost.
    expect(document.body.textContent).not.toMatch(/cost|margin/i);
  });

  it('reads in Nepali at 360 px: the schedule, the words, the contract and the answers', async () => {
    openAt360(DOC, 'ne');
    const doc = await screen.findByTestId('quotation-document');
    expect(within(doc).getByTestId('quotation-date')).toHaveTextContent('मिति: 26 Sept 2026 (वि.सं. 2083-06-10)');
    expect(within(doc).getByTestId('total-in-words')).toHaveTextContent('अक्षरमा रकम: रुपैयाँ बयासी हजार तीन सय सतहत्तर मात्र');
    expect(within(doc).getByTestId('contract-type')).toHaveTextContent('दररेटअनुसार');
    expect(within(doc).getByTestId('estimated-days')).toHaveTextContent('करिब 21 दिन');
    expect(within(doc).getByText('यो मूल्यमा समावेश नभएका कुरा')).toBeInTheDocument();
    const schedule = within(doc).getByTestId('payment-schedule');
    expect(within(schedule).getByRole('heading', { name: 'भुक्तानी तालिका' })).toBeInTheDocument();
    expect(within(schedule).getByText('स्वीकृत गर्दा (अग्रिम)')).toBeInTheDocument();
    expect(within(schedule).getByText('काम सकिएपछि')).toBeInTheDocument();
    expect(within(doc).getByText('ऐच्छिक — जम्मामा समावेश छैन')).toBeInTheDocument();
    expect(within(doc).getByRole('button', { name: 'नापजाँच हेर्नुहोस् (1 काम)' })).toBeInTheDocument();
    // The answers too.
    expect(screen.getByRole('heading', { name: 'यो दरभाउपत्र तपाईंलाई ठीक छ?' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'स्वीकार गर्नुहोस्' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'परिवर्तन माग्नुहोस्' })).toBeInTheDocument();
    expectTablesContained();
  });

  it('shows only the section subtotals when the office chose a summary', async () => {
    const summary = {
      ...DOC,
      summaryOnly: true,
      // The API sends SECTION rows only, and no measurements, for a summary.
      items: DOC.items.filter((i) => i.rowType === 'SECTION'),
    };
    openAt360(summary);
    const doc = await screen.findByTestId('quotation-document');
    const table = within(doc).getByTestId('section-summary');
    const rows = within(table).getAllByRole('row').slice(1);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toHaveTextContent('AWaterproofingRs. 52,800.00');
    expect(rows[1]).toHaveTextContent('BPainting');
    expect(within(doc).queryByText('Seepage treatment')).not.toBeInTheDocument();
    expect(within(doc).queryByText('Optional items (not included)')).not.toBeInTheDocument();
    expect(within(doc).queryByTestId('measurements-annex')).not.toBeInTheDocument();
    // Totals, words and the schedule stay.
    expect(within(doc).getAllByText('Rs. 82,377.00')).toHaveLength(2);
    expect(within(doc).getByTestId('payment-schedule')).toBeInTheDocument();
  });

  it('declines with a reason chip, which is sent as the lost category', async () => {
    const user = userEvent.setup();
    const calls = openAt360(DOC, 'en', () => json({ data: { ...DOC, status: 'REJECTED', actions: [] } }));
    await user.click(await screen.findByRole('button', { name: 'Decline' }));
    const dialog = await screen.findByRole('dialog', { name: 'Decline this quotation?' });
    const chips = within(dialog).getAllByRole('radio');
    expect(chips.map((c) => c.textContent)).toEqual([
      'Too expensive', 'Chose another company', 'Not now / later', 'No budget', 'Doing it ourselves', 'Other reason',
    ]);
    await user.click(within(dialog).getByRole('radio', { name: 'Too expensive' }));
    expect(within(dialog).getByRole('radio', { name: 'Too expensive' })).toHaveAttribute('aria-checked', 'true');
    await user.type(within(dialog).getByRole('textbox'), 'अर्को ठाउँमा सस्तो पाइयो');
    await user.click(within(dialog).getByRole('button', { name: 'Decline' }));
    await waitFor(() => expect(calls.find((c) => c.method === 'POST')?.body).toEqual({
      decision: 'reject', category: 'PRICE', note: 'अर्को ठाउँमा सस्तो पाइयो',
    }));
    expect(await screen.findByText('Quotation declined')).toBeInTheDocument();
  });

  it('offers the decline reasons in Nepali, and a second tap takes a reason back', async () => {
    const user = userEvent.setup();
    const calls = openAt360(DOC, 'ne', () => json({ data: { ...DOC, status: 'REJECTED', actions: [] } }));
    await user.click(await screen.findByRole('button', { name: 'अस्वीकार गर्नुहोस्' }));
    const dialog = await screen.findByRole('dialog', { name: 'यो दरभाउपत्र अस्वीकार गर्ने?' });
    await user.click(within(dialog).getByRole('radio', { name: 'बजेट छैन' }));
    await user.click(within(dialog).getByRole('radio', { name: 'अहिले होइन, पछि' }));
    await user.click(within(dialog).getByRole('radio', { name: 'अहिले होइन, पछि' }));
    await user.click(within(dialog).getByRole('button', { name: 'अस्वीकार गर्नुहोस्' }));
    await waitFor(() => expect(calls.find((c) => c.method === 'POST')?.body).toEqual({ decision: 'reject' }));
    expect(await screen.findByText('दरभाउपत्र अस्वीकार गरियो')).toBeInTheDocument();
  });
});
