import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import QuotationBuilderPage from '@/pages/admin/QuotationBuilderPage/QuotationBuilderPage';
import { renderWithProviders, signedInAs } from '@/test/renderWithProviders';
import { json, mockApi, page } from '@/test/mockApi';

afterEach(() => vi.unstubAllGlobals());

const toastTitles = (store) => store.getState().ui.toasts.map((t) => t.title);
const COST_KEYS = ['unitCost', 'costAmount', 'cost', 'overheadPct', 'profitPct', 'costTotal', 'costComplete', 'margin'];
/** What the API sends a reader without costs:read: the same record with every cost key gone. */
function withoutCosts(value) {
  if (Array.isArray(value)) return value.map(withoutCosts);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.entries(value).filter(([k]) => !COST_KEYS.includes(k)).map(([k, v]) => [k, withoutCosts(v)]));
}

const RECIPE = {
  v: 1, rateCardItemId: 'rc1', code: 'WP-TERRACE', name: 'Terrace membrane waterproofing', recipeQty: 10, complete: true,
  takenAt: '2026-09-20T04:00:00.000Z', overheadPct: 10, profitPct: 15, unitCost: 21000,
  components: [
    { kind: 'MATERIAL', materialId: 'm1', description: 'Acrylic waterproof coating', unit: 'litre', qty: 4, wastagePct: 5, cost: 62000 },
    { kind: 'LABOUR', tradeId: 't1', description: 'Mason (राजमिस्त्री)', qty: 0.5, cost: 150000 },
  ],
};

/** A 1-section BOQ with a note, a priced row with its recipe, and a measured optional row — as MANAGER reads it. */
const BOQ = {
  id: 'q7', number: 'QT-2083-0077', version: 1, status: 'DRAFT', subtotal: 5500000, discount: 0,
  vatApplied: true, vatRate: 13, vatAmount: 715000, total: 6215000, validUntil: '2026-10-30T18:14:00.000Z', terms: 'Half in advance.',
  internalNote: null, createdById: 'someone', makerChecker: true, autoApproved: false,
  customer: { id: 'c1', name: 'सीता गुरुङ', phone: '9841500005', preferredLocale: 'ne' },
  site: { id: 's1', address: 'Budhanilkantha' }, lead: null, createdBy: { id: 'someone', name: 'Rajesh Sales' },
  versions: [{ id: 'q7', number: 'QT-2083-0077', version: 1, status: 'DRAFT' }], messages: [], survey: null, createdAt: '2026-09-16T04:00:00.000Z',
  items: [
    { id: 's1', rowType: 'SECTION', number: 'A', description: 'Waterproofing', spec: null, qty: 0, rate: 0, amount: 0 },
    {
      id: 'r1', rowType: 'ITEM', number: 'A.1', description: 'Terrace membrane', spec: 'Two coats, 2 mm', kind: 'SERVICE', rateCardItemId: 'rc1',
      unit: 'sq.ft', netQty: 200, qty: 200, wastagePct: 0, rate: 27500, amount: 5500000, isOptional: false, isProvisional: false,
      recipe: RECIPE, unitCost: 21000, costAmount: 4200000,
    },
    { id: 'n1', rowType: 'NOTE', number: null, description: 'Rates include scaffolding.', qty: 0, rate: 0, amount: 0 },
    {
      id: 'r2', rowType: 'ITEM', number: 'A.2', description: 'Parapet coping', kind: 'OTHER', unit: 'rft', netQty: 40, qty: 40,
      measurements: [{ area: 'Roof', description: 'North parapet', nos: 1, l: 40 }], wastagePct: 0, rate: 50000, amount: 2000000,
      isOptional: true, isProvisional: false, recipe: null, unitCost: null, costAmount: null,
    },
  ],
  boq: {
    sections: [{ index: 0, number: 'A', title: 'Waterproofing', subtotal: 5500000 }],
    optionalTotal: 2000000,
    cost: { costTotal: 4200000, costComplete: true, margin: { amount: 1300000, pct: 23.64 } },
  },
};

const TAKEOFF = {
  materials: [{ materialId: 'm1', code: 'WP-ACRYL', name: 'Acrylic waterproof coating', unit: 'litre', qty: 84, packSize: 20, packLabel: '20 L drum', packs: 5, onHand: 60, shortfall: 24, costAmount: 5208000 }],
  labour: [{ tradeId: 't1', code: 'MASON', name: 'Mason (राजमिस्त्री)', days: 10, costAmount: 1500000 }],
  other: [],
  rowsWithoutRecipe: [{ id: 'r2', number: 'A.2', description: 'Parapet coping' }],
};

const LIBRARY = [{ id: 'rc9', code: 'PLASTER-INT', name: 'Internal plaster repair', unit: 'sq.ft', rate: 9500, rateMode: 'MANUAL', category: 'Repair', components: [] }];

/**
 * A preview answer that follows the request: every item's amount and a subtotal the test does not check by sum,
 * and — when the request carries a schedule (Phase L4) — a made-up amount per stage, so the test can tell the
 * preview's figures from the saved ones.
 */
const previewAnswer = (body) => ({
  ...(body.paymentStages ? {
    paymentStages: body.paymentStages.map((st, i) => ({ ...st, taxable: 0, vat: 0, total: 1_000_000 * (i + 1) + 1 })),
  } : {}),
  items: body.items.map((row, index) => ({ index, rowType: row.rowType, number: null, netQty: row.qty ?? 196, qty: row.qty ?? 196, amount: 111100 })),
  totals: {
    subtotal: 7777700, discount: body.discountPct != null ? 388885 : Math.round((body.discount ?? 0) * 100), vatApplied: true, vatRate: 13,
    vatAmount: 1011101, total: 8788801, optionalTotal: 0, sections: [],
  },
});

function open(role, handler = () => undefined, quotation = BOQ) {
  const seesCost = role === 'MANAGER' || role === 'ADMIN';
  const record = seesCost ? quotation : withoutCosts(quotation);
  const calls = mockApi(async (call) => {
    const custom = await handler(call);
    if (custom) return custom;
    const { method, path, body } = call;
    if (method === 'GET' && path === `/admin/quotations/${quotation.id}`) return json({ data: record });
    if (method === 'GET' && path === `/admin/quotations/${quotation.id}/takeoff`) return json({ data: seesCost ? TAKEOFF : withoutCosts(TAKEOFF) });
    if (method === 'POST' && path === '/admin/quotations/preview') return json({ data: previewAnswer(body) });
    if (path === '/admin/rate-card') return page(LIBRARY);
    if (method === 'PUT' && path === `/admin/quotations/${quotation.id}`) return json({ data: record });
    return undefined;
  });
  const rendered = renderWithProviders(<QuotationBuilderPage />, {
    path: '/admin/quotations/:id', initialPath: `/admin/quotations/${quotation.id}`, preloadedState: signedInAs(role),
  });
  return { calls, ...rendered };
}

const grid = () => screen.getByRole('grid', { name: 'Bill of quantities' });
const cell = (row, key) => grid().querySelector(`[data-cell="${row}:${key}"]`);
const rowHeader = (row) => grid().querySelector(`[data-row="${row}"] [role="rowheader"]`);
const putBody = (calls) => calls.filter((c) => c.method === 'PUT').at(-1)?.body;

describe('the BOQ builder — tabs and the money wall', () => {
  it('numbers sections and rows, shows notes, specs and optional rows, and the server’s figures; SALES sees no margin', async () => {
    open('SALES');
    await screen.findByRole('grid', { name: 'Bill of quantities' });
    expect(screen.getAllByRole('tab').map((t) => t.textContent)).toEqual(['BOQ', 'Take-off', 'Labour', 'Payment & terms', 'Customer view', 'History']);
    expect([0, 1, 2, 3].map((r) => rowHeader(r).textContent)).toEqual(['A', 'A.1', '', 'A.2']);
    expect(cell(0, 'description')).toHaveTextContent('Waterproofing');
    expect(cell(0, 'unit')).toBeNull(); // a section's title spans the row
    expect(cell(0, 'amount')).toHaveTextContent('55,000.00'); // its subtotal, from the server
    expect(cell(1, 'description')).toHaveTextContent('Two coats, 2 mm');
    expect(cell(2, 'description')).toHaveTextContent('Rates include scaffolding.');
    expect(cell(3, 'description')).toHaveTextContent('Optional');
    expect(cell(3, 'amount')).toHaveTextContent('(Rs. 20,000.00)');
    expect(cell(3, 'qty')).toHaveTextContent('40');
    expect(screen.getByTestId('quotation-total')).toHaveTextContent('62,150.00');
    expect(screen.getByTestId('quotation-optional')).toHaveTextContent('20,000.00');
    // L-D4: no margin rail, no cost, for SALES.
    expect(screen.queryByTestId('margin-card')).not.toBeInTheDocument();
    expect(screen.queryByText('Margin')).not.toBeInTheDocument();
  });

  it('shows MANAGER the margin rail from the server', async () => {
    open('MANAGER', undefined, { ...BOQ, status: 'PENDING_APPROVAL' });
    const card = await screen.findByTestId('margin-card');
    expect(within(card).getByTestId('cost-total')).toHaveTextContent('Rs. 42,000.00');
    expect(within(card).getByTestId('margin')).toHaveTextContent('Rs. 13,000.00 · 23.64%');
  });

  it('opens a row’s recipe: quantities for SALES, cost for MANAGER', async () => {
    const user = userEvent.setup();
    open('SALES');
    await screen.findByRole('grid', { name: 'Bill of quantities' });
    await user.click(screen.getByRole('button', { name: 'Actions for row A.1' }));
    await user.click(await screen.findByRole('menuitem', { name: /Recipe/ }));
    const sheet = await screen.findByRole('dialog', { name: /Recipe — A.1 · Terrace membrane/ });
    const recipe = within(sheet).getByRole('grid', { name: 'Recipe' });
    expect(within(recipe).getByText('Acrylic waterproof coating')).toBeInTheDocument();
    // 4 litres per 10 sq.ft, +5 % wastage, for 200 sq.ft → 84 litres.
    expect(recipe.querySelector('[data-cell="0:forRow"]')).toHaveTextContent('84');
    expect(within(sheet).queryByText(/Unit cost/)).not.toBeInTheDocument();
    expect(within(sheet).queryByRole('columnheader', { name: 'Cost / unit' })).not.toBeInTheDocument();
  });

  it('opens a row’s recipe with its cost for MANAGER', async () => {
    const user = userEvent.setup();
    open('MANAGER');
    await screen.findByRole('grid', { name: 'Bill of quantities' });
    await user.click(screen.getByRole('button', { name: 'Actions for row A.1' }));
    await user.click(await screen.findByRole('menuitem', { name: /Recipe/ }));
    const sheet = await screen.findByRole('dialog', { name: /Recipe — A.1/ });
    expect(within(sheet).getByRole('columnheader', { name: 'Cost / unit' })).toBeInTheDocument();
    expect(within(sheet).getByText('Rs. 620.00')).toBeInTheDocument();
    expect(within(sheet).getByText('Rs. 210.00')).toBeInTheDocument();
  });

  it('Take-off: buying units, stock and shortfall, rows without a recipe; Labour: days ÷ crew — and no cost for SALES', async () => {
    const user = userEvent.setup();
    open('SALES');
    await user.click(await screen.findByRole('tab', { name: 'Take-off' }));
    expect(await screen.findByText('Acrylic waterproof coating')).toBeInTheDocument();
    expect(screen.getByText('84 litre')).toBeInTheDocument();
    expect(screen.getByText('5 × 20 L drum')).toBeInTheDocument();
    expect(screen.getByText('60 litre')).toBeInTheDocument();
    expect(screen.getByText('24 litre')).toBeInTheDocument();
    expect(within(screen.getByRole('region', { name: 'Rows without a recipe' })).getByText('Parapet coping')).toBeInTheDocument();
    expect(screen.queryByRole('columnheader', { name: 'Cost' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('tab', { name: 'Labour' }));
    expect(await screen.findByTestId('days-t1')).toHaveTextContent('10');
    expect(screen.getByTestId('duration-t1')).toHaveTextContent('10 days');
    const crew = screen.getByRole('spinbutton', { name: 'Crew size for Mason (राजमिस्त्री)' });
    await user.clear(crew);
    await user.type(crew, '4');
    expect(screen.getByTestId('duration-t1')).toHaveTextContent('2.5 days');
    // The form is still there behind the other tabs.
    await user.click(screen.getByRole('tab', { name: 'BOQ' }));
    expect(cell(1, 'description')).toHaveTextContent('Terrace membrane');
  });

  it('Take-off shows MANAGER the cost column', async () => {
    const user = userEvent.setup();
    open('MANAGER');
    await user.click(await screen.findByRole('tab', { name: 'Take-off' }));
    expect(await screen.findByRole('columnheader', { name: 'Cost' })).toBeInTheDocument();
    expect(screen.getByText('Rs. 52,080.00')).toBeInTheDocument();
  });

  it('Customer view: the saved quotation as the link shows it, in English or Nepali, with no cost', async () => {
    const user = userEvent.setup();
    open('MANAGER');
    await user.click(await screen.findByRole('tab', { name: 'Customer view' }));
    const view = await screen.findByTestId('customer-view');
    // The customer writes in Nepali, so the view starts there.
    expect(within(view).getByText('ऐच्छिक — जम्मामा समावेश छैन')).toBeInTheDocument();
    await user.click(screen.getByRole('radio', { name: 'English' }));
    expect(within(view).getByRole('heading', { name: 'Waterproofing' })).toBeInTheDocument();
    expect(within(view).getByText('Rates include scaffolding.')).toBeInTheDocument();
    expect(within(view).getByText('Optional — not included in the total')).toBeInTheDocument();
    expect(within(view).queryByText(/42,000/)).not.toBeInTheDocument();
  });

  it('keeps the terms on their own tab of the same form', async () => {
    const user = userEvent.setup();
    const { calls } = open('SALES');
    await user.click(await screen.findByRole('tab', { name: 'Payment & terms' }));
    const terms = screen.getByRole('textbox', { name: 'Terms shown to the customer' });
    await user.clear(terms);
    await user.type(terms, '५०% अग्रिम');
    await user.click(screen.getByRole('button', { name: 'Save draft' }));
    await waitFor(() => expect(putBody(calls)).toMatchObject({ terms: '५०% अग्रिम' }));
    expect(putBody(calls).items).toHaveLength(4);
  });
});

describe('the BOQ builder — building by keyboard', () => {
  it('/ searches the rate library on the server and adds the picked item as a priced row', async () => {
    const user = userEvent.setup();
    const { calls } = open('SALES');
    await screen.findByRole('grid', { name: 'Bill of quantities' });
    await user.click(cell(1, 'qty'));
    await user.keyboard('/');
    const dialog = await screen.findByRole('dialog', { name: 'Search the rate library' });
    await user.type(within(dialog).getByRole('combobox', { name: 'Search the rate library' }), 'plaster');
    await waitFor(() => expect(calls.some((c) => c.path === '/admin/rate-card' && c.query.q === 'plaster')).toBe(true));
    expect(calls.find((c) => c.path === '/admin/rate-card').query).toMatchObject({ limit: '20', onlyActive: 'true' });
    await within(dialog).findByText(/Internal plaster repair/);
    await user.keyboard('{Enter}');
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Search the rate library' })).not.toBeInTheDocument());

    // In after the selected row, priced from the library; the quantity is next.
    expect(cell(2, 'description')).toHaveTextContent('Internal plaster repair');
    expect(cell(2, 'rate')).toHaveTextContent('95.00');
    expect(rowHeader(2)).toHaveTextContent('A.2');
    await waitFor(() => expect(cell(2, 'qty')).toHaveFocus());
    await user.keyboard('12{Enter}');

    await user.click(screen.getByRole('button', { name: 'Save draft' }));
    await waitFor(() => expect(putBody(calls)?.items[2]).toEqual({
      rowType: 'ITEM', kind: 'SERVICE', rateCardItemId: 'rc9', description: 'Internal plaster repair', unit: 'sq.ft',
      qty: 12, rate: 95, isOptional: false, isProvisional: false,
    }));
  }, 15_000);

  it('adds a section and rows by keyboard, and pastes rows from Excel with the text rows as sections', async () => {
    const user = userEvent.setup();
    const { calls } = open('SALES');
    await screen.findByRole('grid', { name: 'Bill of quantities' });
    await user.click(cell(3, 'rate'));
    await user.keyboard('{Control>}{Shift>}{Enter}{/Shift}{/Control}');
    await user.keyboard('Flooring{Enter}');
    expect(rowHeader(4)).toHaveTextContent('B');
    await user.keyboard('{Control>}{Enter}{/Control}');
    await user.keyboard('Skirting{Tab}rft{Tab}60{Tab}{Tab}140{Enter}');
    expect(rowHeader(5)).toHaveTextContent('B.1');

    fireEvent.paste(cell(5, 'rate'), {
      clipboardData: { getData: () => 'Tiles\tsq.ft\t1,200\tRs. 1,450\nELECTRICAL\t\t\t\nSocket points\tnos\t8\t950\n' },
    });
    expect([6, 7, 8].map((r) => rowHeader(r).textContent)).toEqual(['B.2', 'C', 'C.1']);
    expect(cell(7, 'description')).toHaveTextContent('ELECTRICAL');
    expect(cell(6, 'qty')).toHaveTextContent('1,200');

    await user.click(screen.getByRole('button', { name: 'Save draft' }));
    await waitFor(() => expect(putBody(calls)?.items.slice(4)).toEqual([
      { rowType: 'SECTION', description: 'Flooring' },
      { rowType: 'ITEM', description: 'Skirting', unit: 'rft', qty: 60, rate: 140, isOptional: false, isProvisional: false },
      { rowType: 'ITEM', description: 'Tiles', unit: 'sq.ft', qty: 1200, rate: 1450, isOptional: false, isProvisional: false },
      { rowType: 'SECTION', description: 'ELECTRICAL' },
      { rowType: 'ITEM', description: 'Socket points', unit: 'nos', qty: 8, rate: 950, isOptional: false, isProvisional: false },
    ]));
  }, 20_000);

  it('measures a row in feet-inches: the sheet previews its total and the saved row carries the measurements', async () => {
    const user = userEvent.setup();
    const { calls } = open('SALES');
    await screen.findByRole('grid', { name: 'Bill of quantities' });
    await user.click(cell(1, 'qty'));
    await user.keyboard('{Control>}m{/Control}');
    const sheet = await screen.findByRole('dialog', { name: 'Measurement sheet — A.1 · Terrace membrane' });
    await user.click(within(sheet).getByRole('button', { name: 'Add measurement' }));
    await user.keyboard('छत{Tab}Main slab{Tab}1{Tab}20\'6"{Tab}10\'{Enter}');
    await user.click(within(sheet).getByRole('button', { name: 'Add measurement' }));
    await user.keyboard('छत{Tab}Tank base{Tab}1{Tab}3\'{Tab}3\'{Tab}{Tab} ');
    expect(within(sheet).getByTestId('measurement-total')).toHaveTextContent('196');
    await user.click(within(sheet).getByRole('button', { name: 'Use these measurements' }));
    await waitFor(() => expect(screen.queryByRole('dialog', { name: /Measurement sheet/ })).not.toBeInTheDocument());

    // The row is measured now: its quantity is the sheet's until the server's preview answers, then the server's.
    expect(cell(1, 'qty')).toHaveTextContent('196');
    await waitFor(() => expect(calls.some((c) => c.path === '/admin/quotations/preview' && c.body.items[1]?.measurements)).toBe(true));
    await user.click(screen.getByRole('button', { name: 'Save draft' }));
    await waitFor(() => expect(putBody(calls)?.items[1]).toMatchObject({
      id: 'r1', rateCardItemId: 'rc1',
      measurements: [
        { area: 'छत', description: 'Main slab', nos: 1, l: 20.5, b: 10 },
        { area: 'छत', description: 'Tank base', nos: 1, l: 3, b: 3, deduct: true },
      ],
    }));
    expect(putBody(calls).items[1]).not.toHaveProperty('qty');
  }, 20_000);

  it('the discount helpers ask the server for the discount and fill it in rupees', async () => {
    const user = userEvent.setup();
    const { calls } = open('SALES');
    await screen.findByRole('grid', { name: 'Bill of quantities' });
    await user.type(screen.getByRole('textbox', { name: 'Discount %' }), '5');
    await user.click(screen.getByRole('button', { name: 'Apply %' }));
    await waitFor(() => expect(screen.getByLabelText('Discount')).toHaveValue('3,888.85'));
    const asked = calls.find((c) => c.path === '/admin/quotations/preview' && c.body.discountPct != null).body;
    expect(asked).toMatchObject({ quotationId: 'q7', discountPct: 5, vatApplied: true });
    expect(asked).not.toHaveProperty('discount');
    expect(asked.items).toHaveLength(4);
  });

  it('reprices a draft from the library: preview, confirm, apply', async () => {
    const user = userEvent.setup();
    const { calls, store } = open('SALES', ({ method, path, body }) => {
      if (method === 'POST' && path === '/admin/quotations/q7/reprice') {
        return json({ data: body.apply
          ? { rows: [], applied: 1, quotation: BOQ }
          : { rows: [{ id: 'r1', number: 'A.1', description: 'Terrace membrane', rate: 27500, newRate: 29000 }], applied: 0 } });
      }
      return undefined;
    });
    await user.click(await screen.findByRole('button', { name: 'Reprice from the library' }));
    const dialog = await screen.findByRole('alertdialog');
    expect(within(dialog).getByText('Terrace membrane')).toBeInTheDocument();
    expect(within(dialog).getByText('Rs. 290.00')).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: 'Reprice' }));
    await waitFor(() => expect(calls.filter((c) => c.path === '/admin/quotations/q7/reprice').map((c) => c.body)).toEqual([{ apply: false }, { apply: true }]));
    await waitFor(() => expect(toastTitles(store)).toContain('1 row repriced'));
  });
});

/** The same BOQ with what Phase L4 adds to a staff record (MANAGER's view; `open` strips the cost for others). */
const L4 = {
  ...BOQ,
  contractType: 'LUMP_SUM', estimatedDays: 14, exclusions: null, showMeasurements: true, summaryOnly: false,
  firstViewedAt: null, viewCount: 0, declineCategory: null,
  paymentStages: [
    { id: 'st1', label: 'Advance', basisPoints: 5000, trigger: 'ON_ACCEPT', sortOrder: 0, taxable: 2750000, vat: 357500, total: 3107500 },
    { id: 'st2', label: 'Running bill', basisPoints: 4000, trigger: 'MILESTONE', sortOrder: 1, taxable: 2200000, vat: 286000, total: 2486000 },
    { id: 'st3', label: 'On completion', basisPoints: 1000, trigger: 'ON_COMPLETION', sortOrder: 2, taxable: 550000, vat: 71500, total: 621500 },
  ],
  totalInWords: { en: 'Rupees Sixty-Two Thousand One Hundred Fifty Only', ne: 'रुपैयाँ बयसट्ठी हजार एक सय पचास मात्र' },
  dates: { createdAtBs: '2083-05-31', validUntilBs: '2083-07-14', sentAtBs: null },
  letterhead: { companyName: 'Gharjatan Home Services', address: 'Baneshwor', city: 'Kathmandu', phones: ['01-5407720'], email: null, panVatNo: '609876543', logo: null, tagline: null },
  costTotal: 4200000, costComplete: true, margin: { amount: 1300000, pct: 23.64 },
};

const TERMS = [
  { id: 't1', title: 'Standard repair terms', body: '50% advance, the rest on completion.', bodyNe: '५०% अग्रिम, बाँकी काम सकिएपछि।', isDefault: true, isActive: true, sortOrder: 0 },
  { id: 't2', title: 'Warranty', body: 'One year on workmanship.', bodyNe: null, isDefault: false, isActive: true, sortOrder: 1 },
];

describe('the BOQ builder — contract, schedule, terms and the customer’s document (Phase L4)', () => {
  const stagesGrid = () => screen.getByRole('grid', { name: 'Payment stages' });
  const stageCell = (row, key) => stagesGrid().querySelector(`[data-cell="${row}:${key}"]`);

  it('Payment & terms: the contract says what it means, the schedule shows the server’s amounts, a preset asks the preview, and a save sends it all', async () => {
    const user = userEvent.setup();
    const { calls } = open('SALES', () => undefined, L4);
    await user.click(await screen.findByRole('tab', { name: 'Payment & terms' }));

    // The contract type, with the sentence the customer reads.
    expect(screen.getByRole('combobox', { name: /Contract type/ })).toHaveTextContent('Lump sum');
    expect(screen.getByText(/The customer reads: “A fixed price for the work quoted/)).toBeInTheDocument();
    await user.click(screen.getByRole('combobox', { name: /Contract type/ }));
    await user.click(await screen.findByRole('option', { name: 'Item rate (measured)' }));
    expect(screen.getByText(/we measure it when finished and bill the measured quantity/)).toBeInTheDocument();

    // The saved stages' amounts, from the server.
    expect(stageCell(0, 'pct')).toHaveTextContent('50%');
    expect(stageCell(0, 'amount')).toHaveTextContent('Rs. 31,075.00');

    // A preset: the preview is asked with the schedule on screen, and its stage amounts replace the saved ones.
    await user.click(screen.getByRole('button', { name: '40 · 30 · 20 · 10' }));
    await waitFor(() => expect(calls.filter((c) => c.path === '/admin/quotations/preview').at(-1)?.body.paymentStages)
      .toEqual([
        { label: 'Advance', basisPoints: 4000, trigger: 'ON_ACCEPT' },
        { label: 'Running bill 1', basisPoints: 3000, trigger: 'MILESTONE' },
        { label: 'Running bill 2', basisPoints: 2000, trigger: 'MILESTONE' },
        { label: 'On completion', basisPoints: 1000, trigger: 'ON_COMPLETION' },
      ]), { timeout: 3000 });
    await waitFor(() => expect(stageCell(3, 'amount')).toHaveTextContent('Rs. 40,000.01'));

    // A schedule that is not whole is never sent, and no stage shows an amount for it.
    await user.click(stageCell(0, 'pct'));
    await user.keyboard('45{Enter}');
    await waitFor(() => expect(stageCell(0, 'amount')).toHaveTextContent('—'), { timeout: 3000 });
    expect(calls.filter((c) => c.path === '/admin/quotations/preview').at(-1).body.paymentStages).toBeUndefined();
    await user.click(stageCell(0, 'pct'));
    await user.keyboard('40{Enter}');

    await user.clear(screen.getByRole('spinbutton', { name: 'Estimated duration (days)' }));
    await user.type(screen.getByRole('spinbutton', { name: 'Estimated duration (days)' }), '21');
    await user.type(screen.getByRole('textbox', { name: 'Not included in the price' }), 'पानी र बिजुली घरधनीको।');
    await user.click(screen.getByRole('button', { name: 'Save draft' }));
    await waitFor(() => expect(putBody(calls)).toMatchObject({
      contractType: 'ITEM_RATE',
      estimatedDays: 21,
      exclusions: 'पानी र बिजुली घरधनीको।',
      paymentStages: [
        { label: 'Advance', basisPoints: 4000, trigger: 'ON_ACCEPT' },
        { label: 'Running bill 1', basisPoints: 3000, trigger: 'MILESTONE' },
        { label: 'Running bill 2', basisPoints: 2000, trigger: 'MILESTONE' },
        { label: 'On completion', basisPoints: 1000, trigger: 'ON_COMPLETION' },
      ],
      showMeasurements: true,
      summaryOnly: false,
    }));
    // A stage never carries an amount, and nothing about cost leaves the browser.
    expect(JSON.stringify(putBody(calls))).not.toMatch(/"total"|"vat"|"taxable"|unitCost|costAmount|costTotal|margin/);
  }, 20_000);

  it('a schedule that does not make 100 % stops the save and opens its tab', async () => {
    const user = userEvent.setup();
    const { calls } = open('SALES', () => undefined, L4);
    await user.click(await screen.findByRole('tab', { name: 'Payment & terms' }));
    await user.click(stageCell(2, 'pct'));
    await user.keyboard('5{Enter}');
    await user.click(screen.getByRole('tab', { name: 'BOQ' }));
    await user.click(screen.getByRole('button', { name: 'Save draft' }));
    expect(await screen.findByText('The stages add up to 95% — they must make 100%')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole('tab', { name: 'Payment & terms' })).toHaveAttribute('aria-selected', 'true'));
    expect(calls.some((c) => c.method === 'PUT')).toBe(false);
  });

  it('the terms picker inserts a library entry — replacing after a question, or below — and offers the Nepali text to a Nepali customer', async () => {
    const user = userEvent.setup();
    const { calls } = open('SALES', ({ path }) => (path === '/admin/quotation-terms' ? page(TERMS) : undefined), L4);
    await user.click(await screen.findByRole('tab', { name: 'Payment & terms' }));
    const picker = await screen.findByTestId('terms-picker');
    const terms = screen.getByRole('textbox', { name: 'Terms shown to the customer' });
    expect(await within(picker).findByText('Standard repair terms')).toBeInTheDocument();
    expect(calls.find((c) => c.path === '/admin/quotation-terms').query).toMatchObject({ onlyActive: 'true' });

    await user.click(within(picker).getByRole('button', { name: 'Use these terms: Standard repair terms' }));
    const ask = await screen.findByRole('alertdialog', { name: 'Replace the terms on this quotation?' });
    await user.click(within(ask).getByRole('button', { name: 'Replace' }));
    await waitFor(() => expect(terms).toHaveValue('50% advance, the rest on completion.'));

    await user.click(within(picker).getByRole('button', { name: 'Add below: Warranty' }));
    expect(terms).toHaveValue('50% advance, the rest on completion.\n\nOne year on workmanship.');

    // The customer reads Nepali, and this entry has a Nepali text; the other has none, so offers none.
    expect(within(picker).queryByRole('button', { name: 'Use the Nepali text: Warranty' })).not.toBeInTheDocument();
    await user.click(within(picker).getByRole('button', { name: 'Use the Nepali text: Standard repair terms' }));
    await user.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Replace' }));
    await waitFor(() => expect(terms).toHaveValue('५०% अग्रिम, बाँकी काम सकिएपछि।'));

    await user.click(screen.getByRole('button', { name: 'Save draft' }));
    await waitFor(() => expect(putBody(calls)).toMatchObject({ terms: '५०% अग्रिम, बाँकी काम सकिएपछि।' }));
  }, 15_000);

  it('Customer view: “Section totals only” and the measurements follow the switches before a save, with no cost for a manager', async () => {
    const user = userEvent.setup();
    const { calls } = open('MANAGER', () => undefined, L4);
    await user.click(await screen.findByRole('tab', { name: 'Customer view' }));
    const view = await screen.findByTestId('customer-view');
    await user.click(screen.getByRole('radio', { name: 'English' }));
    expect(within(view).getByTestId('letterhead')).toHaveTextContent('PAN / VAT No. 609876543');
    expect(within(view).getByTestId('quotation-date')).toHaveTextContent('(2083-05-31 B.S.)');
    expect(within(view).getByTestId('total-in-words')).toHaveTextContent('Rupees Sixty-Two Thousand One Hundred Fifty Only');
    expect(within(view).getByTestId('measurements-annex')).toBeInTheDocument();
    expect(within(view).getByTestId('payment-schedule')).toHaveTextContent('Rs. 31,075.00');

    await user.click(screen.getByRole('switch', { name: 'Section totals only' }));
    expect(within(view).getByTestId('section-summary')).toHaveTextContent('Waterproofing');
    expect(within(view).queryByText('Terrace membrane')).not.toBeInTheDocument();
    expect(within(view).queryByTestId('measurements-annex')).not.toBeInTheDocument();
    // The manager's record carries cost; the document shows none of it.
    expect(within(view).queryByText(/42,000|13,000|23.64/)).not.toBeInTheDocument();
    expect(view.textContent).not.toMatch(/margin|cost/i);

    await user.click(screen.getByRole('button', { name: 'Save draft' }));
    await waitFor(() => expect(putBody(calls)).toMatchObject({ summaryOnly: true, showMeasurements: true }));
  });

  it('the link: “Opened 2×” and when first, and WhatsApp and Viber shares in the customer’s language', async () => {
    const sent = {
      ...L4, status: 'SENT', publicToken: 'tok-9', sentAt: '2026-09-20T04:00:00.000Z',
      viewCount: 2, firstViewedAt: '2026-09-20T09:30:00.000Z',
    };
    open('SALES', () => undefined, sent);
    const views = await screen.findByTestId('link-views');
    expect(views).toHaveTextContent('Opened 2×');
    // 09:30 UTC is 15:15 in Kathmandu.
    expect(views).toHaveTextContent('First opened 20 Sept 2026, 15:15');
    const link = `${window.location.origin}/quotation/tok-9`;
    const whatsapp = screen.getByTestId('share-whatsapp');
    expect(whatsapp.getAttribute('href')).toMatch(/^https:\/\/wa\.me\/9779841500005\?text=/);
    const text = decodeURIComponent(whatsapp.getAttribute('href').split('?text=')[1]);
    expect(text).toContain('नमस्ते सीता गुरुङ');
    expect(text).toContain(link);
    expect(screen.getByTestId('share-viber').getAttribute('href')).toBe(`viber://forward?text=${encodeURIComponent(text)}`);
  });

  it('a link not opened yet says so', async () => {
    open('SALES', () => undefined, { ...L4, status: 'SENT', publicToken: 'tok-9', sentAt: '2026-09-20T04:00:00.000Z' });
    expect(await screen.findByTestId('link-views')).toHaveTextContent('Not opened yet');
  });

  it('Print opens the print route; Excel downloads the workbook through the API', async () => {
    const user = userEvent.setup();
    const blobs = [];
    Object.assign(URL, { createObjectURL: vi.fn((blob) => { blobs.push(blob); return 'blob:xlsx'; }), revokeObjectURL: vi.fn() });
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    const bytes = new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0xff, 0x00, 0x7f]);
    const { calls } = open('SALES', ({ path }) => (path === '/admin/quotations/q7/export.xlsx'
      ? new Response(bytes, { headers: { 'content-type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' } })
      : undefined), L4);
    expect(await screen.findByRole('link', { name: 'Print' })).toHaveAttribute('href', '/admin/quotations/q7/print');
    await user.click(screen.getByRole('button', { name: 'Excel' }));
    await waitFor(() => expect(blobs).toHaveLength(1));
    expect(calls.some((c) => c.path === '/admin/quotations/q7/export.xlsx')).toBe(true);
    // The bytes arrive intact (a zip's signature), as an .xlsx named for the quotation.
    expect([...new Uint8Array(await blobs[0].arrayBuffer())]).toEqual([...bytes]);
    expect(blobs[0].type).toBe('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    expect(click.mock.contexts[0].download).toBe('QT-2083-0077.xlsx');
    click.mockRestore();
  });

  it('a failed export says so', async () => {
    const user = userEvent.setup();
    const { store } = open('SALES', ({ path }) => (path === '/admin/quotations/q7/export.xlsx'
      ? json({ error: { code: 'FORBIDDEN', message: 'You cannot export this quotation.' } }, 403)
      : undefined), L4);
    await user.click(await screen.findByRole('button', { name: 'Excel' }));
    await waitFor(() => expect(store.getState().ui.toasts.map((t) => t.description)).toContain('You cannot export this quotation.'));
  });
});
