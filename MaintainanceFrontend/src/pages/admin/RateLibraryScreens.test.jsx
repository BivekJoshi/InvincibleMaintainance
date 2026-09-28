import { afterEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router-dom';
import ResourceListPage from '@/pages/admin/ResourceListPage';
import ResourceEditPage from '@/pages/admin/ResourceEditPage';
import { renderWithProviders, signedInAs } from '@/test/renderWithProviders';
import { json, mockApi, page } from '@/test/mockApi';

afterEach(() => vi.unstubAllGlobals());

const toastTitles = (store) => store.getState().ui.toasts.map((t) => t.title);
/** A cell of the recipe grid by row and column key. */
const recipeCell = () => {
  const grid = screen.getByRole('grid', { name: 'Recipe' });
  return (row, key) => grid.querySelector(`[data-cell="${row}:${key}"]`);
};

/** What the API's `stripCosts` removes for a caller without costs:read (MaintainanceBackend/src/utils/moneyWall.js). */
const COST_KEYS = new Set(['cost', 'unitCost', 'lineCost', 'costAmount', 'costTotal', 'costBreakdown', 'costComplete', 'margin', 'marginPct', 'overheadPct', 'profitPct', 'purchaseRate', 'dayWage']);
function withoutCosts(value) {
  if (Array.isArray(value)) return value.map(withoutCosts);
  if (value === null || typeof value !== 'object') return value;
  return Object.fromEntries(Object.entries(value).filter(([k]) => !COST_KEYS.has(k)).map(([k, v]) => [k, withoutCosts(v)]));
}

const CEMENT = { id: 'm-cem', code: 'CEM-OPC', name: 'OPC cement', unit: 'kg', packSize: 50, packLabel: 'bag', purchaseRate: 1500 };
const MASON = { id: 'tr-mason', code: 'MASON', name: 'Mason (राजमिस्त्री)', dayWage: 150000 };

const MANUAL = {
  id: 'r1', code: 'WP-TERRACE', name: 'Terrace membrane waterproofing', category: 'Waterproofing', unit: 'sq.ft', rate: 27550,
  rateMode: 'MANUAL', recipeQty: 1, components: [], derivedRate: null, outOfDate: false, isActive: true, sortOrder: 0,
  overheadPct: null, profitPct: null, roundTo: null, unitCost: null, costBreakdown: null, margin: null,
};

/**
 * The plaster recipe, per 10 sq.m, as MANAGER sees it. At today's prices: cement 32 kg × Rs 15 × 1.05 = Rs 504,
 * mason 1.5 days × Rs 1,500 = Rs 2,250, scaffolding Rs 200 → Rs 295.40 a sq.m direct, + 10% overhead = Rs 324.94;
 * + 15% profit = Rs 373.68, rounded up to the rupee = Rs 374.00 — but the rate is still Rs 380.00: out of date.
 */
const PLASTER = {
  id: 'r2', code: 'PLASTER-INT', name: 'Internal plaster 12 mm', category: 'Plaster', unit: 'sq.m', rate: 38000,
  rateMode: 'DERIVED', recipeQty: 10, derivedRate: 37400, outOfDate: true, isActive: true, sortOrder: 1,
  overheadPct: 10, profitPct: 15, roundTo: 100, unitCost: 31000,
  costBreakdown: { material: 5040, labour: 22500, equipment: 2000, other: 0, direct: 29540, overhead: 2954, unitCost: 32494, complete: true },
  margin: { amount: 5506, pct: 14.49 },
  components: [
    { id: 'c1', kind: 'MATERIAL', materialId: 'm-cem', tradeId: null, description: null, unit: 'kg', qty: 32, wastagePct: 5, sortOrder: 0, material: CEMENT, lineCost: 50400 },
    { id: 'c2', kind: 'LABOUR', materialId: null, tradeId: 'tr-mason', description: null, unit: 'day', qty: 1.5, wastagePct: 0, sortOrder: 1, trade: MASON, lineCost: 225000 },
    { id: 'c3', kind: 'EQUIPMENT', materialId: null, tradeId: null, description: 'Scaffolding hire', unit: 'lump', qty: 1, wastagePct: 0, cost: 20000, sortOrder: 2, lineCost: 20000 },
  ],
};

const DERIVED_ANSWER = {
  costBreakdown: PLASTER.costBreakdown,
  derivedRate: 37400,
  // The server's margins (money.js#margin): at the form's Rs 380 and at the derived Rs 374.
  margin: { amount: 5506, pct: 14.49 },
  derivedMargin: { amount: 4906, pct: 13.12 },
  lines: [{ index: 0, lineCost: 50400 }, { index: 1, lineCost: 225000 }, { index: 2, lineCost: 20000 }],
};

/** The app's rate library, trades and terms library routes, as AppRoutes mounts them. */
function Screens() {
  return (
    <Routes>
      {['rate-card', 'trades', 'materials', 'quotation-terms'].flatMap((resource) => [
        <Route key={resource} path={`/admin/${resource}`} element={<ResourceListPage resource={resource} />} />,
        <Route key={`${resource}-new`} path={`/admin/${resource}/new`} element={<ResourceEditPage resource={resource} />} />,
        <Route key={`${resource}-id`} path={`/admin/${resource}/:id`} element={<ResourceEditPage resource={resource} />} />,
      ])}
    </Routes>
  );
}

/** Renders as `role`, answering with the API's rows as that role would get them (cost stripped without costs:read). */
function renderAs(role, initialPath, handler = () => undefined) {
  const seesCost = role === 'MANAGER' || role === 'ADMIN';
  const shape = (body) => (seesCost ? body : withoutCosts(body));
  const calls = mockApi(async (call) => {
    const custom = await handler(call);
    if (custom) return custom;
    const { method, path } = call;
    if (method === 'GET' && path === '/admin/rate-card') return page(shape([MANUAL, PLASTER]));
    if (method === 'GET' && path === '/admin/rate-card/r2') return json({ data: shape(PLASTER) });
    if (method === 'GET' && path.endsWith('/history')) return page([]);
    if (method === 'GET' && path === '/admin/rate-card/r9') return json({ data: shape({ ...PLASTER, id: 'r9', code: 'PLASTER-EXT' }) });
    if (method === 'POST' && path === '/admin/rate-card/derive') return json({ data: DERIVED_ANSWER });
    if (method === 'GET' && path === '/admin/materials') return page(shape([CEMENT]));
    if (method === 'GET' && path === '/admin/trades') return page(shape([MASON]));
    return undefined;
  });
  const view = renderWithProviders(<Screens />, { path: '*', initialPath, preloadedState: signedInAs(role) });
  return { calls, ...view };
}

describe('the rate library list', () => {
  it('shows each rate’s mode and flags an out-of-date one with what its recipe gives; MANAGER sees cost and margin', async () => {
    renderAs('MANAGER', '/admin/rate-card');
    expect(await screen.findByText('Internal plaster 12 mm')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Rate library' })).toBeInTheDocument();
    const plaster = screen.getByText('Internal plaster 12 mm').closest('tr');
    expect(within(plaster).getByText('Recipe')).toBeInTheDocument();
    expect(within(plaster).getByText('Out of date')).toBeInTheDocument();
    expect(within(plaster).getByText('Rs. 374.00')).toBeInTheDocument();
    expect(within(plaster).getByText('Rs. 380.00')).toBeInTheDocument();
    expect(within(plaster).getByText('Rs. 324.94')).toBeInTheDocument();
    expect(within(plaster).getByText('14.49%')).toBeInTheDocument();
    const manual = screen.getByText('Terrace membrane waterproofing').closest('tr');
    expect(within(manual).getByText('Manual')).toBeInTheDocument();
    expect(within(manual).queryByText('Out of date')).not.toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: /Cost/ })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: /Margin/ })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /New Rate/ })).toBeInTheDocument();
  });

  it('shows SALES the selling rates and the out-of-date flag, but no cost, no margin and nothing to change', async () => {
    renderAs('SALES', '/admin/rate-card');
    expect(await screen.findByText('Internal plaster 12 mm')).toBeInTheDocument();
    expect(screen.getByText('Out of date')).toBeInTheDocument();
    expect(screen.getByText('Rs. 374.00')).toBeInTheDocument();
    expect(screen.queryByRole('columnheader', { name: /Cost/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('columnheader', { name: /Margin/ })).not.toBeInTheDocument();
    expect(screen.queryByText('Rs. 324.94')).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /New Rate/ })).not.toBeInTheDocument();
    // Nothing to do in bulk: no Update to derived rate, no Delete, so no selection at all.
    expect(screen.queryByRole('checkbox', { name: /^Select / })).not.toBeInTheDocument();
    expect(screen.getByRole('switch', { name: /PLASTER-INT/ })).toBeDisabled();
  });

  it('“Update to derived rate” previews what would change, asks, then applies exactly those rates', async () => {
    const user = userEvent.setup();
    const preview = { items: [{ id: 'r2', code: 'PLASTER-INT', name: 'Internal plaster 12 mm', rate: 38000, derivedRate: 37400, delta: -600 }], applied: 0 };
    const { calls, store } = renderAs('MANAGER', '/admin/rate-card', ({ method, path, body }) => {
      if (method === 'POST' && path === '/admin/rate-card/reprice') return json({ data: body.apply ? { ...preview, applied: 1 } : preview });
      return undefined;
    });
    await screen.findByText('Internal plaster 12 mm');
    await user.click(screen.getByRole('checkbox', { name: 'Select PLASTER-INT · Internal plaster 12 mm' }));
    await user.click(screen.getByRole('checkbox', { name: 'Select WP-TERRACE · Terrace membrane waterproofing' }));
    await user.click(screen.getByRole('button', { name: 'Update to derived rate' }));

    const reprices = () => calls.filter((c) => c.method === 'POST' && c.path === '/admin/rate-card/reprice');
    const dialog = await screen.findByRole('alertdialog', { name: 'Update PLASTER-INT to its derived rate?' });
    expect(reprices()).toHaveLength(1);
    expect(reprices()[0].body).toEqual({ ids: expect.arrayContaining(['r1', 'r2']), apply: false });
    expect(reprices()[0].body.ids).toHaveLength(2);
    const row = within(dialog).getByRole('rowheader', { name: /PLASTER-INT/ }).closest('tr');
    expect(within(row).getByText('Rs. 380.00')).toBeInTheDocument();
    expect(within(row).getByText('Rs. 374.00')).toBeInTheDocument();
    expect(within(row).getByText('−Rs. 6.00')).toBeInTheDocument();
    expect(within(dialog).getByText(/1 other selected rate is left as it/)).toBeInTheDocument();

    await user.click(within(dialog).getByRole('button', { name: 'Update the rate' }));
    await waitFor(() => expect(reprices()).toHaveLength(2));
    expect(reprices()[1].body).toEqual({ ids: ['r2'], apply: true });
    await waitFor(() => expect(toastTitles(store)).toContain('1 rate updated to its derived rate'));
  });

  it('writes nothing when the preview is declined, and says so when nothing would change', async () => {
    const user = userEvent.setup();
    let items = [{ id: 'r2', code: 'PLASTER-INT', name: 'Internal plaster 12 mm', rate: 38000, derivedRate: 37400, delta: -600 }];
    const { calls, store } = renderAs('MANAGER', '/admin/rate-card', ({ method, path }) => (
      method === 'POST' && path === '/admin/rate-card/reprice' ? json({ data: { items, applied: 0 } }) : undefined));
    await screen.findByText('Internal plaster 12 mm');
    await user.click(screen.getByRole('checkbox', { name: 'Select PLASTER-INT · Internal plaster 12 mm' }));
    await user.click(screen.getByRole('button', { name: 'Update to derived rate' }));
    const dialog = await screen.findByRole('alertdialog');
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());

    items = [];
    await user.click(screen.getByRole('button', { name: 'Update to derived rate' }));
    await waitFor(() => expect(toastTitles(store)).toContain('Nothing to update'));
    expect(calls.filter((c) => c.path === '/admin/rate-card/reprice').map((c) => c.body.apply)).toEqual([false, false]);
  });
});

describe('the rate library form', () => {
  it('shows MANAGER the recipe with its costs, and the live Cost vs rate card from the server', async () => {
    const { calls } = renderAs('MANAGER', '/admin/rate-card/r2');
    expect(await screen.findByDisplayValue('PLASTER-INT')).toBeInTheDocument();

    // Above the form: out of date, and what the recipe gives today. (The recipe grid's drag announcer is a status too.)
    expect(screen.getAllByRole('status').find((el) => el.textContent.includes('Out of date')))
      .toHaveTextContent('Out of date. At today’s prices the recipe gives Rs. 374.00 a sq.m; the rate is Rs. 380.00.');
    // The rate follows the recipe.
    expect(screen.getByLabelText('Rate')).toBeDisabled();
    expect(screen.getByText('Set from the recipe when you save.')).toBeInTheDocument();

    // The recipe's lines (a grid since L3), named from the records they carry.
    const cell = recipeCell();
    expect(cell(0, 'item')).toHaveTextContent('CEM-OPC · OPC cement (kg)');
    expect(cell(0, 'qty')).toHaveTextContent('32');
    expect(cell(0, 'wastagePct')).toHaveTextContent('5');
    expect(screen.getByText('Bought as bag = 50 kg')).toBeInTheDocument();
    expect(cell(1, 'item')).toHaveTextContent('MASON · Mason (राजमिस्त्री)');
    expect(cell(1, 'qty')).toHaveTextContent('1.5');
    expect(cell(1, 'unit')).toHaveTextContent('man-days');
    expect(cell(2, 'item')).toHaveTextContent('Scaffolding hire');
    expect(cell(2, 'cost')).toHaveTextContent('200.00');
    expect(screen.getByText(/Quantities below make/)).toHaveTextContent('Quantities below make 10 sq.m of the work.');
    expect(screen.getByLabelText(/Overhead %/)).toHaveValue(10);
    expect(screen.getByLabelText(/Profit %/)).toHaveValue(15);
    expect(screen.getByLabelText(/Round up to/)).toHaveValue('1.00');

    // The card asks the server, in rupees, and shows its answer against the rate.
    const card = (await screen.findByRole('heading', { name: 'Cost vs rate' })).closest('section');
    await waitFor(() => expect(within(card).getByText('Rs. 324.94')).toBeInTheDocument());
    expect(calls.find((c) => c.path === '/admin/rate-card/derive').body).toEqual({
      recipeQty: 10, overheadPct: 10, profitPct: 15, roundTo: 1, rate: 380,
      components: [
        { kind: 'MATERIAL', materialId: 'm-cem', qty: 32, wastagePct: 5 },
        { kind: 'LABOUR', tradeId: 'tr-mason', qty: 1.5 },
        { kind: 'EQUIPMENT', description: 'Scaffolding hire', qty: 1, cost: 200 },
      ],
    });
    expect(within(card).getByText('Rs. 50.40')).toBeInTheDocument();
    expect(within(card).getByText('Rs. 225.00')).toBeInTheDocument();
    expect(within(card).getByText('Rs. 29.54')).toBeInTheDocument();
    expect(within(card).getAllByText('Rs. 374.00').length).toBeGreaterThanOrEqual(1);
    expect(within(card).getByText('Rs. 55.06 · 14.49%')).toBeInTheDocument();
    expect(within(card).getByText('Rs. 49.06 · 13.12%')).toBeInTheDocument();
    expect(within(card).getByText(/Saving sets the rate to Rs\. 374\.00 a sq\.m/)).toBeInTheDocument();
    // Lines already saved name their material without asking the materials list.
    expect(calls.some((c) => c.path.startsWith('/admin/materials/'))).toBe(false);
  });

  it('shows SALES the recipe’s quantities read-only, with no cost anywhere and no call for one', async () => {
    const { calls } = renderAs('SALES', '/admin/rate-card/r2');
    expect(await screen.findByDisplayValue('PLASTER-INT')).toBeDisabled();
    const cell = recipeCell();
    expect(cell(0, 'item')).toHaveTextContent('CEM-OPC · OPC cement (kg)');
    expect(cell(0, 'qty')).toHaveTextContent('32');
    expect(cell(1, 'qty')).toHaveTextContent('1.5');
    expect(cell(2, 'item')).toHaveTextContent('Scaffolding hire');
    expect(screen.getByRole('status')).toHaveTextContent('Out of date');
    // Read-only: a cell does not open for editing.
    await userEvent.setup().click(cell(0, 'qty'));
    await userEvent.setup().keyboard('{Enter}');
    expect(within(screen.getByRole('grid', { name: 'Recipe' })).queryByRole('textbox')).not.toBeInTheDocument();

    expect(screen.queryByRole('heading', { name: 'Cost vs rate' })).not.toBeInTheDocument();
    expect(screen.queryByRole('columnheader', { name: /Cost \/ unit/ })).not.toBeInTheDocument();
    expect(cell(2, 'cost')).toBeNull();
    expect(screen.queryByLabelText(/Overhead %/)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/Profit %/)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/Round up to/)).not.toBeInTheDocument();
    expect(screen.queryByText('Rs. 324.94')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Save changes' })).not.toBeInTheDocument();
    expect(calls.some((c) => c.path === '/admin/rate-card/derive')).toBe(false);
    expect(calls.some((c) => c.path.startsWith('/admin/materials') || c.path.startsWith('/admin/trades'))).toBe(false);
  });

  it('creates a rate from a recipe: a material with wastage, a trade’s man-days and a cost in rupees; a line left empty is dropped', async () => {
    const user = userEvent.setup();
    const { calls, store } = renderAs('MANAGER', '/admin/rate-card/new', ({ method, path, body }) => (
      method === 'POST' && path === '/admin/rate-card' ? json({ data: { ...PLASTER, id: 'r9', code: body.code } }, 201) : undefined));
    await user.type(await screen.findByLabelText(/^Code/), 'plaster-ext');
    await user.type(screen.getByLabelText(/^Work/), 'बाहिरी प्लास्टर — external plaster');
    await user.click(screen.getByRole('combobox', { name: /Rate set by/ }));
    await user.click(await screen.findByRole('option', { name: 'Worked out from the recipe' }));
    const recipeQty = screen.getByLabelText(/Recipe is for/);
    await user.clear(recipeQty);
    await user.type(recipeQty, '10');

    // The recipe is a grid (Phase L3): an added line is selected on its "What" cell, Enter opens the picker,
    // and the rest is typed cell by cell — Tab moves across, typing overwrites, Enter saves.
    await user.click(screen.getByRole('button', { name: /Add material/ }));
    await user.keyboard('{Enter}');
    await user.click(await screen.findByRole('option', { name: 'CEM-OPC · OPC cement (kg)' }));
    expect(screen.getByText('Bought as bag = 50 kg')).toBeInTheDocument();
    await user.keyboard('{ArrowRight}32{Tab}5{Enter}');

    await user.click(screen.getByRole('button', { name: /Add labour/ }));
    await user.keyboard('{Enter}');
    await user.click(await screen.findByRole('option', { name: 'MASON · Mason (राजमिस्त्री)' }));
    await user.keyboard('{ArrowRight}1.5{Enter}');
    await user.click(screen.getByRole('button', { name: /Add labour/ })); // left empty

    await user.click(screen.getByRole('button', { name: /Add equipment or other cost/ }));
    await user.keyboard('Scaffolding hire{Tab}{Tab}1{Tab}1,200.50{Enter}');
    const cell = recipeCell();
    expect(cell(0, 'qty')).toHaveTextContent('32');
    expect(cell(3, 'cost')).toHaveTextContent('1,200.50');

    const card = screen.getByRole('heading', { name: 'Cost vs rate' }).closest('section');
    await waitFor(() => expect(within(card).getByText('Rs. 324.94')).toBeInTheDocument());

    await user.click(screen.getByRole('button', { name: 'Create Rate' }));
    await waitFor(() => expect(calls.find((c) => c.method === 'POST' && c.path === '/admin/rate-card')).toBeTruthy());
    const { body } = calls.find((c) => c.method === 'POST' && c.path === '/admin/rate-card');
    expect(body).toMatchObject({
      code: 'PLASTER-EXT', name: 'बाहिरी प्लास्टर — external plaster', unit: 'sq.ft', rateMode: 'DERIVED', recipeQty: 10,
      overheadPct: null, profitPct: null, roundTo: null, isActive: true,
      components: [
        { kind: 'MATERIAL', materialId: 'm-cem', qty: 32, wastagePct: 5 },
        { kind: 'LABOUR', tradeId: 'tr-mason', qty: 1.5 },
        { kind: 'EQUIPMENT', description: 'Scaffolding hire', qty: 1, cost: 1200.5 },
      ],
    });
    expect(body).not.toHaveProperty('rate');
    expect(body.components[0]).not.toHaveProperty('material');
    await waitFor(() => expect(toastTitles(store)).toContain('Rate created'));
    // A whole recipe typed key by key: longer than the default 5 s when the full suite runs in parallel.
  }, 20_000);

  it('refuses a rate from the recipe without a recipe, and a typed rate without a rate', async () => {
    const user = userEvent.setup();
    const { calls } = renderAs('MANAGER', '/admin/rate-card/new');
    await user.type(await screen.findByLabelText(/^Code/), 'X-1');
    await user.type(screen.getByLabelText(/^Work/), 'Something');
    await user.click(screen.getByRole('button', { name: 'Create Rate' }));
    expect(await screen.findByText('Enter the rate')).toBeInTheDocument();

    await user.click(screen.getByRole('combobox', { name: /Rate set by/ }));
    await user.click(await screen.findByRole('option', { name: 'Worked out from the recipe' }));
    await user.click(screen.getByRole('button', { name: 'Create Rate' }));
    expect(await screen.findByText('A rate from the recipe needs its recipe — add a line')).toBeInTheDocument();
    expect(calls.some((c) => c.method === 'POST' && c.path === '/admin/rate-card')).toBe(false);
  });
});

describe('trades and materials (Phase L2)', () => {
  const PAINTER = { id: 'tr-p', code: 'PAINTER', name: 'रंगकर्मी Painter', dayWage: 140000, isActive: true, sortOrder: 0 };

  it('shows the day wage to MANAGER and hides it from SALES', async () => {
    const handler = ({ path }) => (path === '/admin/trades' ? page([PAINTER]) : undefined);
    const first = renderAs('MANAGER', '/admin/trades', handler);
    expect(await screen.findByText('रंगकर्मी Painter')).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: /Day wage/ })).toBeInTheDocument();
    expect(screen.getByText('Rs. 1,400.00')).toBeInTheDocument();
    first.unmount();

    renderAs('SALES', '/admin/trades', ({ path }) => (path === '/admin/trades' ? page([withoutCosts(PAINTER)]) : undefined));
    expect(await screen.findByText('रंगकर्मी Painter')).toBeInTheDocument();
    expect(screen.queryByRole('columnheader', { name: /Day wage/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /New Trade/ })).not.toBeInTheDocument();
  });

  it('adds a trade with its day wage in rupees', async () => {
    const user = userEvent.setup();
    const { calls } = renderAs('MANAGER', '/admin/trades/new', ({ method, path }) => (
      method === 'POST' && path === '/admin/trades' ? json({ data: PAINTER }, 201) : undefined));
    await user.type(await screen.findByLabelText(/^Code/), 'painter');
    await user.type(screen.getByLabelText(/^Trade/), 'रंगकर्मी Painter');
    await user.type(screen.getByLabelText(/Day wage/), '1,400');
    await user.click(screen.getByRole('button', { name: 'Create Trade' }));
    await waitFor(() => expect(calls.find((c) => c.method === 'POST' && c.path === '/admin/trades')?.body)
      .toMatchObject({ code: 'PAINTER', name: 'रंगकर्मी Painter', dayWage: 1400, isActive: true }));
  });

  it('keeps how a material is bought: its pack size and name, and clears them when emptied', async () => {
    const user = userEvent.setup();
    const bag = { ...CEMENT, sellRate: 1800, reorderLevel: 0, isActive: true, category: null, supplier: null, categoryId: null, supplierId: null };
    const { calls } = renderAs('DISPATCHER', '/admin/materials', ({ method, path }) => {
      if (method === 'GET' && path === '/admin/materials') return page([bag]);
      if (path === '/admin/materials/m-cem') return json({ data: bag });
      return undefined;
    });
    expect(await screen.findByText('OPC cement')).toBeInTheDocument();
    expect(screen.getByText('= 50 kg')).toBeInTheDocument();

    await user.click(screen.getByText('OPC cement'));
    const size = await screen.findByLabelText(/Pack size/);
    expect(size).toHaveValue(50);
    expect(screen.getByLabelText('Pack')).toHaveValue('bag');
    await user.clear(size);
    await user.clear(screen.getByLabelText('Pack'));
    // A cleared number stays cleared on screen (it is not put back to the saved 50).
    await user.tab();
    expect(size).toHaveValue(null);
    await user.click(screen.getByRole('button', { name: 'Save changes' }));
    await waitFor(() => expect(calls.find((c) => c.method === 'PUT' && c.path === '/admin/materials/m-cem')?.body)
      .toMatchObject({ packSize: null, packLabel: null, purchaseRate: 15, sellRate: 18 }));
  });
});

describe('the terms library (Phase L4)', () => {
  const TERMS = [
    { id: 't1', title: 'Standard repair terms', body: '50% advance, the rest on completion.', bodyNe: '५०% अग्रिम, बाँकी काम सकिएपछि।', isDefault: true, isActive: true, sortOrder: 0 },
    { id: 't2', title: 'Warranty', body: 'One year on workmanship.', bodyNe: null, isDefault: false, isActive: true, sortOrder: 1 },
  ];

  it('lists the terms with the default and whether each has Nepali; SALES reads them and changes nothing', async () => {
    renderAs('SALES', '/admin/quotation-terms', ({ path }) => (path === '/admin/quotation-terms' ? page(TERMS) : undefined));
    expect(await screen.findByText('Standard repair terms')).toBeInTheDocument();
    expect(within(screen.getByRole('row', { name: /Standard repair terms/ })).getByText('Default')).toBeInTheDocument();
    expect(within(screen.getByRole('row', { name: /Standard repair terms/ })).getByText('नेपाली ✓')).toBeInTheDocument();
    expect(within(screen.getByRole('row', { name: /Warranty/ })).getByText('English only')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /New Terms/ })).not.toBeInTheDocument();
  });

  it('MANAGER writes terms in English and Nepali and makes them the default', async () => {
    const user = userEvent.setup();
    const { calls } = renderAs('MANAGER', '/admin/quotation-terms/new', ({ method, path }) => (
      method === 'POST' && path === '/admin/quotation-terms' ? json({ data: { ...TERMS[0], id: 't3' } }, 201) : undefined));
    await user.type(await screen.findByLabelText(/^Title/), 'Painting terms');
    await user.type(screen.getByLabelText(/Terms \(English\)/), 'Two coats. 50% advance.');
    const nepali = screen.getByLabelText('Terms (नेपाली)');
    expect(nepali).toHaveAttribute('lang', 'ne');
    await user.type(nepali, 'दुई कोट। ५०% अग्रिम।');
    await user.click(screen.getByRole('switch', { name: 'Default for new quotations' }));
    await user.click(screen.getByRole('button', { name: 'Create Terms' }));
    await waitFor(() => expect(calls.find((c) => c.method === 'POST' && c.path === '/admin/quotation-terms')?.body).toMatchObject({
      title: 'Painting terms', body: 'Two coats. 50% advance.', bodyNe: 'दुई कोट। ५०% अग्रिम।', isDefault: true, isActive: true,
    }));
  });

  it('refuses terms with no English text', async () => {
    const user = userEvent.setup();
    const { calls } = renderAs('MANAGER', '/admin/quotation-terms/new');
    await user.type(await screen.findByLabelText(/^Title/), 'Empty');
    await user.click(screen.getByRole('button', { name: 'Create Terms' }));
    expect(await screen.findByText('Write the terms')).toBeInTheDocument();
    expect(calls.some((c) => c.method === 'POST')).toBe(false);
  });
});
