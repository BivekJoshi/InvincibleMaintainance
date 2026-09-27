import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import QuotationBuilderPage from '@/pages/admin/QuotationBuilderPage/QuotationBuilderPage';
import { renderWithProviders, signedInAs } from '@/test/renderWithProviders';
import { json, mockApi, page } from '@/test/mockApi';

afterEach(() => vi.unstubAllGlobals());

const toastTitles = (store) => store.getState().ui.toasts.map((t) => t.title);
const COST_KEYS = ['unitCost', 'costAmount', 'cost', 'overheadPct', 'profitPct', 'costTotal', 'margin'];
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

/** A preview answer that follows the request: every item's amount and a subtotal the test does not check by sum. */
const previewAnswer = (body) => ({
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
