import { afterEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router-dom';
import JobDetailPage from '@/pages/admin/JobDetailPage/JobDetailPage';
import ResourceListPage from '@/pages/admin/ResourceListPage';
import ResourceEditPage from '@/pages/admin/ResourceEditPage';
import { renderWithProviders, signedInAs } from '@/test/renderWithProviders';
import { json, mockApi, page } from '@/test/mockApi';

afterEach(() => vi.unstubAllGlobals());

/**
 * Phase L7 — the job on site, in the office: BOQ & progress (earned value behind the money wall, the next running
 * bill), Materials / Labour (planned vs issued vs logged, over plan, a purchase list from the shortfall), the site
 * diary, the variations, the OVER_PLAN warning when issuing, and the purchase lists' moves. The mocked server answers in
 * the contract's shapes; every amount is its paisa.
 */

const toasts = (store) => store.getState().ui.toasts;
const toastTitles = (store) => toasts(store).map((t) => t.title);

const LINES = [
  { id: 'l1', source: 'QUOTATION', number: 'A.1', section: 'Waterproofing', description: 'Crystalline slurry, two coats', unit: 'sq.ft', quotedQty: 240, rate: 22_000, progressPct: 50, isProvisional: false, sortOrder: 0 },
  { id: 'l2', source: 'QUOTATION', number: 'A.2', section: 'Waterproofing', description: 'Drain chamber', unit: 'nos', quotedQty: 2, rate: 405_000, progressPct: 100, isProvisional: true, sortOrder: 1 },
  { id: 'l3', source: 'VARIATION', number: 'B.1', section: 'Variation VO-2083-0001', description: 'Exterior weather coat (omitted)', unit: 'sq.ft', quotedQty: -100, rate: 3_350, progressPct: 0, isProvisional: false, sortOrder: 2 },
];

const JOB = {
  id: 'j9', number: 'JOB-2083-0090', title: 'Terrace waterproofing — QT-2083-0031', type: 'RENOVATION', status: 'IN_PROGRESS', priority: 'NORMAL',
  isBillable: true, invoicedAt: null, createdAt: '2026-09-20T04:00:00.000Z', plannedDays: 8,
  scheduledStart: '2026-09-21T04:15:00.000Z', scheduledEnd: '2026-09-29T04:15:00.000Z', actualStart: '2026-09-21T04:30:00.000Z', actualEnd: null,
  customer: { id: 'c1', name: 'राबिन महर्जन', phone: '9841234567', email: null, preferredLocale: 'ne' },
  site: { id: 's1', label: 'Home', address: 'Jhamsikhel', area: 'Lalitpur', lat: null, lng: null },
  quotation: { id: 'q9', number: 'QT-2083-0031', total: 8_237_700, status: 'CONVERTED' },
  lead: null, survey: null, project: null, parentJob: null, childJobs: [], createdBy: null, warranty: null,
  assignments: [], tasks: [], photos: [], materials: [], timeLogs: [], events: [],
  lines: LINES,
  requirements: [
    { id: 'r1', kind: 'MATERIAL', materialId: 'mat1', tradeId: null, description: 'Crystalline slurry', unit: 'kg', qty: 120, packs: 5, source: 'TAKEOFF' },
    { id: 'r3', kind: 'LABOUR', materialId: null, tradeId: 'tr1', description: 'Mason', unit: 'day', qty: 7.5, packs: null, source: 'TAKEOFF' },
  ],
  advance: { required: true, gateOn: true, paid: true, overridden: false, override: null, awaitingAdvance: false, invoice: null },
};

/** What SALES or MANAGER reads: each line's rate, value and earned value, and the totals — all the server's paisa. */
const PROGRESS = {
  sections: [
    {
      title: 'Waterproofing',
      lines: [
        { id: 'l1', number: 'A.1', source: 'QUOTATION', description: 'Crystalline slurry, two coats', unit: 'sq.ft', quotedQty: 240, progressPct: 50, isProvisional: false, rate: 22_000, value: 5_280_000, earned: 2_640_000 },
        { id: 'l2', number: 'A.2', source: 'QUOTATION', description: 'Drain chamber', unit: 'nos', quotedQty: 2, progressPct: 100, isProvisional: true, rate: 405_000, value: 810_000, earned: 810_000 },
      ],
    },
    {
      title: 'Variation VO-2083-0001',
      lines: [{ id: 'l3', number: 'B.1', source: 'VARIATION', description: 'Exterior weather coat (omitted)', unit: 'sq.ft', quotedQty: -100, progressPct: 0, isProvisional: false, rate: 3_350, value: -335_000, earned: 0 }],
    },
  ],
  totals: { value: 5_755_000, earned: 3_450_000, earnedPct: 59.95 },
  stages: [
    { id: 'st1', label: 'Advance', basisPoints: 5000, trigger: 'ON_ACCEPT', cumulativeBp: 5000, billed: true, due: false },
    { id: 'st2', label: 'Waterproofing done', basisPoints: 4000, trigger: 'MILESTONE', cumulativeBp: 9000, billed: false, due: false },
    { id: 'st0', label: 'Slab laid', basisPoints: 1000, trigger: 'MILESTONE', cumulativeBp: 5500, billed: false, due: true },
  ],
  nextBill: { stageId: 'st0', label: 'Slab laid', basisPoints: 1000 },
};
/** What a dispatcher reads: the same without a single amount. */
const PROGRESS_NO_MONEY = {
  ...PROGRESS,
  sections: PROGRESS.sections.map((s) => ({ ...s, lines: s.lines.map(({ rate: _r, value: _v, earned: _e, ...l }) => l) })),
  totals: { earnedPct: 59.95 },
};

const PVA = {
  materials: [
    { materialId: 'mat1', code: 'WP-CRYST', name: 'Crystalline slurry', unit: 'kg', planned: 120, issued: 130.5, received: 100, variance: 10.5, overPlan: true },
    { materialId: 'mat2', code: 'PT-EXT', name: 'Exterior emulsion', unit: 'litre', planned: 40, issued: 20, received: 0, variance: -20, overPlan: false },
  ],
  labour: [
    { tradeId: 'tr1', code: 'MASON', name: 'Mason', plannedDays: 7.5, loggedDays: 9.25 },
    { tradeId: 'tr2', code: 'HELPER', name: 'Helper', plannedDays: 5, loggedDays: 2.5 },
  ],
  technicianHours: 36.5,
  workdayHours: 8,
};

const DIARY = {
  days: [
    {
      id: 'd2', jobId: 'j9', day: '2026-09-27', weather: 'HEAVY_RAIN', lostHours: 4, lostReason: 'RAIN',
      headcount: [{ tradeId: 'tr1', count: 3, tradeName: 'Mason' }, { tradeId: 'tr2', count: 2, tradeName: 'Helper' }],
      progress: [{ jobLineId: 'l1', progressPct: 50, number: 'A.1', description: 'Crystalline slurry, two coats' }],
      received: [{ materialId: 'mat1', description: 'Crystalline slurry', qty: 100, unit: 'kg', challanNo: 'CH-4512' }],
      issues: 'छानाबाट पानी चुहियो', note: null, photoMediaIds: ['med1'], createdBy: { id: 'u1', name: 'Suresh Technician' }, updatedAt: '2026-09-27T11:00:00.000Z',
    },
    {
      id: 'd1', jobId: 'j9', day: '2026-09-26', weather: 'SUNNY', lostHours: 0, lostReason: null,
      headcount: [{ tradeId: 'tr1', count: 4, tradeName: 'Mason' }], progress: [], received: [], issues: null, note: null,
      photoMediaIds: [], createdBy: { id: 'u1', name: 'Suresh Technician' }, updatedAt: '2026-09-26T11:00:00.000Z',
    },
  ],
  media: { med1: { id: 'med1', url: '/uploads/med1.jpg', variants: { 400: '/uploads/med1-400.webp' } } },
};

const VARIATIONS = [
  { id: 'v2', number: 'VO-2083-0002', version: 1, status: 'PENDING_APPROVAL', kind: 'VARIATION', total: 1_200_000, createdAt: '2026-09-27T04:00:00.000Z', sentAt: null, decidedAt: null },
  { id: 'v1', number: 'VO-2083-0001', version: 1, status: 'CONVERTED', kind: 'VARIATION', total: -378_550, createdAt: '2026-09-24T04:00:00.000Z', sentAt: '2026-09-24T06:00:00.000Z', decidedAt: '2026-09-25T06:00:00.000Z' },
];

const renderJob = (role, { tab = '', handler = () => undefined, job = JOB } = {}) => {
  const calls = mockApi(async (call) => {
    const custom = await handler(call);
    if (custom) return custom;
    const { method, path } = call;
    if (method === 'GET' && path === `/admin/jobs/${job.id}`) return json({ data: job });
    if (path === `/admin/jobs/${job.id}/progress`) return json({ data: role === 'DISPATCHER' ? PROGRESS_NO_MONEY : PROGRESS });
    if (path === `/admin/jobs/${job.id}/planned-vs-actual`) return json({ data: PVA });
    if (path === `/admin/jobs/${job.id}/diary`) return json({ data: DIARY });
    if (path === `/admin/jobs/${job.id}/variations`) {
      return json({ data: role === 'DISPATCHER' ? VARIATIONS.map(({ total: _t, ...v }) => v) : VARIATIONS });
    }
    if (path === '/admin/materials') return page([{ id: 'mat1', code: 'WP-CRYST', name: 'Crystalline slurry', unit: 'kg' }]);
    return undefined;
  });
  const view = renderWithProviders(
    <Routes>
      <Route path="/admin/jobs/:id" element={<JobDetailPage />} />
      <Route path="/admin/quotations/:id" element={<p>Builder</p>} />
      <Route path="/admin/purchase-lists/:id" element={<p>Purchase list</p>} />
    </Routes>,
    { path: '*', initialPath: `/admin/jobs/${job.id}${tab}`, preloadedState: signedInAs(role) },
  );
  return { calls, ...view };
};

describe('the job on site (Phase L7) — tabs', () => {
  it('adds BOQ & progress, Materials / Labour, Site diary and Variations on a BOQ job', async () => {
    renderJob('DISPATCHER');
    await screen.findByRole('heading', { name: /JOB-2083-0090/ });
    const tabs = screen.getAllByRole('tab').map((t) => t.textContent.replace(/\s*\(\d+\)$/, ''));
    expect(tabs.slice(0, 6)).toEqual(['Overview', 'Plan', 'BOQ & progress', 'Materials / Labour', 'Site diary', 'Variations']);
  });

  it('keeps the BOQ tabs off an inspection, and its diary and variations too', async () => {
    renderJob('DISPATCHER', { job: { ...JOB, type: 'INSPECTION', lines: [], quotation: null, requirements: [] } });
    await screen.findByRole('heading', { name: /JOB-2083-0090/ });
    const tabs = screen.getAllByRole('tab').map((t) => t.textContent);
    for (const name of ['BOQ & progress', 'Materials / Labour', 'Site diary', 'Variations']) expect(tabs).not.toContain(name);
  });
});

describe('BOQ & progress', () => {
  it('shows lines by section with their progress, a variation’s lines marked, and — for SALES — the server’s earned value', async () => {
    renderJob('SALES', { tab: '?tab=progress' });
    const tab = await screen.findByTestId('job-progress');
    expect(within(tab).getByRole('region', { name: 'Waterproofing' })).toBeInTheDocument();
    const variation = within(tab).getByRole('region', { name: 'Variation VO-2083-0001' });
    expect(within(variation).getByText('Variation')).toBeInTheDocument();
    expect(within(variation).getByText('-100 sq.ft')).toHaveClass('text-destructive');
    expect(screen.getByTestId('line-progress-l1')).toHaveTextContent('50%');
    expect(screen.getByTestId('earned-pct')).toHaveTextContent('59.95%');
    const value = screen.getByTestId('earned-value');
    expect(value).toHaveTextContent('Rs. 57,550.00');
    expect(value).toHaveTextContent('Rs. 34,500.00');
    // An omission's value is below zero: "− Rs.", never "Rs. -".
    expect(within(variation).getByText('− Rs. 3,350.00')).toBeInTheDocument();
    expect(screen.getAllByRole('columnheader', { name: 'Earned' }).length).toBeGreaterThan(0);
  });

  it('prompts for the next running bill once earned value passes a milestone, linking the invoices', async () => {
    renderJob('ADMIN', { tab: '?tab=progress' });
    const prompt = await screen.findByTestId('next-bill');
    expect(prompt).toHaveTextContent('Earned value has passed Slab laid (10%) — raise the running bill');
    expect(within(prompt).getByRole('link', { name: 'Open invoices' })).toHaveAttribute('href', '/admin/invoices');
    const stages = screen.getByRole('region', { name: 'Payment stages' });
    expect(within(stages).getByText('Due now')).toBeInTheDocument();
    expect(within(stages).getByText('Billed')).toBeInTheDocument();
  });

  it('gives a dispatcher progress and quantities, never earned value — even when an answer carries it', async () => {
    renderJob('DISPATCHER', { tab: '?tab=progress' });
    await screen.findByTestId('job-progress');
    expect(screen.getByTestId('earned-pct')).toHaveTextContent('59.95%');
    expect(screen.queryByTestId('earned-value')).not.toBeInTheDocument();
    expect(screen.queryByRole('columnheader', { name: 'Earned' })).not.toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/Rs\./);
    // The prompt still says a bill is due — but a dispatcher is not sent to the invoices.
    expect(screen.getByTestId('next-bill')).toHaveTextContent('Tell accounts.');
  });

  it('shows no money to a dispatcher even from a doctored answer that has it', async () => {
    renderJob('DISPATCHER', { tab: '?tab=progress', handler: ({ path }) => (path === '/admin/jobs/j9/progress' ? json({ data: PROGRESS }) : undefined) });
    await screen.findByTestId('job-progress');
    expect(screen.queryByTestId('earned-value')).not.toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/Rs\./);
  });
});

describe('Materials / Labour', () => {
  it('compares planned, issued and received per material and planned with logged days per trade, flagging what is over plan', async () => {
    renderJob('DISPATCHER', { tab: '?tab=planned' });
    await screen.findByTestId('job-planned-actual');
    const slurry = screen.getByRole('row', { name: /Crystalline slurry/ });
    expect(within(slurry).getByText('120 kg')).toBeInTheDocument();
    expect(within(slurry).getByText('130.5 kg')).toBeInTheDocument();
    expect(within(slurry).getByText('100 kg')).toBeInTheDocument();
    expect(screen.getByTestId('over-plan-mat1')).toHaveTextContent('Over plan by 10.5 kg');
    expect(screen.getByText('1 over plan')).toBeInTheDocument();
    expect(within(screen.getByRole('row', { name: /Exterior emulsion/ })).getByText('20 litre still to issue')).toBeInTheDocument();
    expect(screen.getByTestId('logged-tr1')).toHaveTextContent('9.25');
    expect(within(screen.getByRole('row', { name: /Mason/ })).getByText('Over plan')).toBeInTheDocument();
    expect(within(screen.getByRole('row', { name: /Helper/ })).getByText('Within plan')).toBeInTheDocument();
    expect(screen.getByTestId('technician-hours')).toHaveTextContent('36.5 h');
    expect(document.body.textContent).not.toMatch(/Rs\./);
  });

  it('creates a purchase list from the shortfall and opens it', async () => {
    const user = userEvent.setup();
    const { calls, store } = renderJob('DISPATCHER', {
      tab: '?tab=planned',
      handler: ({ method, path }) => (method === 'POST' && path === '/admin/jobs/j9/purchase-lists/from-shortfall'
        ? json({ data: { id: 'pl1', number: 'PL-2083-0001', status: 'DRAFT', items: [{ id: 'i1' }], itemCount: 1 } }, 201)
        : undefined),
    });
    await user.click(await screen.findByRole('button', { name: /Create purchase list from shortfall/ }));
    await waitFor(() => expect(calls.some((c) => c.method === 'POST' && c.path === '/admin/jobs/j9/purchase-lists/from-shortfall')).toBe(true));
    expect(await screen.findByText('Purchase list')).toBeInTheDocument();
    expect(toastTitles(store)).toContain('PL-2083-0001 drafted');
  });

  it('says “nothing is short” in words, not as an error', async () => {
    const user = userEvent.setup();
    const { store } = renderJob('DISPATCHER', {
      tab: '?tab=planned',
      handler: ({ method, path }) => (method === 'POST' && path === '/admin/jobs/j9/purchase-lists/from-shortfall'
        ? json({ error: { code: 'NO_SHORTFALL', message: 'Job JOB-2083-0090 is not short of any planned material' } }, 422)
        : undefined),
    });
    await user.click(await screen.findByRole('button', { name: /Create purchase list from shortfall/ }));
    await waitFor(() => expect(toasts(store)).toEqual([expect.objectContaining({ title: 'Nothing is short', variant: 'default' })]));
  });

  it('offers no purchase list to a role that cannot write materials', async () => {
    renderJob('SALES', { tab: '?tab=planned' });
    await screen.findByTestId('job-planned-actual');
    expect(screen.queryByRole('button', { name: /Create purchase list from shortfall/ })).not.toBeInTheDocument();
  });

  it('issues past the plan with a warning toast — the issue still happens', async () => {
    const user = userEvent.setup();
    const { calls, store } = renderJob('DISPATCHER', {
      tab: '?tab=materials',
      handler: ({ method, path }) => (method === 'POST' && path === '/admin/jobs/j9/materials'
        ? json({
          data: { id: 'jm9', qty: 10.5, rate: 123_450, material: { id: 'mat1', code: 'WP-CRYST', name: 'Crystalline slurry', unit: 'kg' } },
          meta: { warnings: [{ code: 'OVER_PLAN', materialId: 'mat1', name: 'Crystalline slurry', unit: 'kg', planned: 120, issued: 130.5 }] },
        }, 201)
        : undefined),
    });
    await user.click(await screen.findByRole('button', { name: /Issue from stock/ }));
    const dialog = await screen.findByRole('dialog', { name: 'Issue material to JOB-2083-0090' });
    await user.click(within(dialog).getByRole('combobox', { name: /Material/ }));
    await user.click(await screen.findByRole('option', { name: 'WP-CRYST · Crystalline slurry (kg)' }));
    await user.type(within(dialog).getByLabelText(/Quantity/), '10.5');
    await user.click(within(dialog).getByRole('button', { name: 'Issue' }));

    await waitFor(() => expect(calls.find((c) => c.method === 'POST' && c.path === '/admin/jobs/j9/materials')?.body).toMatchObject({ materialId: 'mat1', qty: 10.5 }));
    await waitFor(() => expect(toasts(store)).toEqual(expect.arrayContaining([
      expect.objectContaining({ variant: 'success', title: '10.5 kg of Crystalline slurry issued' }),
      expect.objectContaining({ variant: 'warning', title: 'More than the plan', description: 'Crystalline slurry: 130.5 kg issued to this job against 120 kg planned.' }),
    ])));
  }, 15_000);
});

describe('Site diary', () => {
  it('lists each day filed — weather, crew, time lost, lines marked — and opens one onto its details and photos', async () => {
    const user = userEvent.setup();
    renderJob('DISPATCHER', { tab: '?tab=diary' });
    const heavy = (await screen.findByTestId('diary-crew-2026-09-27')).closest('tr');
    expect(within(heavy).getByText('Heavy rain')).toBeInTheDocument();
    expect(within(heavy).getByTestId('diary-crew-2026-09-27')).toHaveTextContent('5');
    expect(within(heavy).getByText('4 h · Rain')).toBeInTheDocument();
    expect(within(heavy).getByText('A.1 50%')).toBeInTheDocument();
    expect(within(heavy).getByText('Suresh Technician')).toBeInTheDocument();

    await user.click(within(heavy).getByRole('button', { name: /Show details|Expand|details/i }));
    const details = await screen.findByTestId('diary-details-2026-09-27');
    expect(details).toHaveTextContent('Mason × 3');
    expect(details).toHaveTextContent('Crystalline slurry — 100 kg · challan CH-4512');
    expect(within(details).getByText('छानाबाट पानी चुहियो')).toBeInTheDocument();
    expect(within(details).getByRole('img', { name: 'Site diary 2026-09-27, photo 1' })).toHaveAttribute('src', '/uploads/med1-400.webp');
  });
});

describe('Variations', () => {
  it('lists the job’s variations with their totals for SALES, and New variation starts one against the job in the builder', async () => {
    const user = userEvent.setup();
    const { calls } = renderJob('SALES', {
      tab: '?tab=variations',
      handler: ({ method, path }) => (method === 'POST' && path === '/admin/quotations'
        ? json({ data: { id: 'v3', number: 'VO-2083-0003', kind: 'VARIATION', jobId: 'j9', status: 'DRAFT' } }, 201)
        : undefined),
    });
    const row = await screen.findByRole('row', { name: /VO-2083-0001/ });
    expect(within(row).getByText('Accepted · on the job')).toBeInTheDocument();
    expect(within(row).getByText('− Rs. 3,785.50')).toBeInTheDocument();
    expect(within(screen.getByRole('row', { name: /VO-2083-0002/ })).getByText('Needs approval')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /New variation/ }));
    await waitFor(() => expect(calls.find((c) => c.method === 'POST' && c.path === '/admin/quotations')?.body).toEqual({ jobId: 'j9', items: [] }));
    expect(await screen.findByText('Builder')).toBeInTheDocument();
  });

  it('shows a dispatcher the variations and their state — no total, no New variation', async () => {
    renderJob('DISPATCHER', { tab: '?tab=variations' });
    await screen.findByRole('row', { name: /VO-2083-0001/ });
    expect(screen.queryByRole('columnheader', { name: 'Total' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /New variation/ })).not.toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/Rs\./);
  });
});

// ── purchase lists (Phase L7)

const MATERIAL = { id: 'mat1', code: 'WP-CRYST', name: 'Crystalline slurry', unit: 'kg', packSize: 25, packLabel: 'bag' };
const DRAFT_LIST = {
  id: 'pl1', number: 'PL-2083-0001', status: 'DRAFT', job: { id: 'j9', number: 'JOB-2083-0090', title: 'Terrace' }, jobId: 'j9',
  supplier: { id: 'sup1', name: 'Hardware Pasal', phone: null }, supplierId: 'sup1', orderedAt: null, receivedAt: null, cancelReason: null,
  note: 'Shortfall for job JOB-2083-0090', createdAt: '2026-09-27T04:00:00.000Z', deletedAt: null,
  items: [{ id: 'i1', materialId: 'mat1', material: MATERIAL, qty: 75, packs: 3, receivedQty: null, note: 'Short by 70' }],
  itemCount: 1,
};
const ORDERED_LIST = { ...DRAFT_LIST, id: 'pl2', number: 'PL-2083-0002', status: 'ORDERED', orderedAt: '2026-09-27T05:00:00.000Z' };

const renderLists = (role, { initialPath = '/admin/purchase-lists', handler = () => undefined, lists = [DRAFT_LIST, ORDERED_LIST] } = {}) => {
  const calls = mockApi(async (call) => {
    const custom = await handler(call);
    if (custom) return custom;
    const { method, path } = call;
    if (method === 'GET' && path === '/admin/purchase-lists') return page(lists);
    const one = lists.find((l) => path === `/admin/purchase-lists/${l.id}`);
    if (method === 'GET' && one) return json({ data: one });
    if (path.endsWith('/history')) return page([]);
    return undefined;
  });
  const view = renderWithProviders(
    <Routes>
      <Route path="/admin/purchase-lists" element={<ResourceListPage resource="purchase-lists" />} />
      <Route path="/admin/purchase-lists/:id" element={<ResourceEditPage resource="purchase-lists" />} />
    </Routes>,
    { path: '*', initialPath, preloadedState: signedInAs(role) },
  );
  return { calls, ...view };
};

describe('Purchase lists', () => {
  it('lists each list with its state, job, supplier and items; a row offers the moves its state allows', async () => {
    const user = userEvent.setup();
    renderLists('DISPATCHER');
    const draft = await screen.findByRole('row', { name: /PL-2083-0001/ });
    expect(within(draft).getByText('Draft')).toBeInTheDocument();
    expect(within(draft).getByRole('link', { name: 'JOB-2083-0090' })).toHaveAttribute('href', '/admin/jobs/j9');
    expect(within(draft).getByText('Hardware Pasal')).toBeInTheDocument();
    expect(within(draft).getByText('1 item')).toBeInTheDocument();

    await user.click(within(draft).getByRole('button', { name: 'Actions for PL-2083-0001' }));
    let menu = await screen.findByRole('menu');
    expect(within(menu).getByRole('menuitem', { name: /Mark ordered/ })).toBeInTheDocument();
    expect(within(menu).getByRole('menuitem', { name: /Cancel list/ })).toBeInTheDocument();
    expect(within(menu).queryByRole('menuitem', { name: /Receive/ })).not.toBeInTheDocument();
    expect(within(menu).getByRole('menuitem', { name: /Delete/ })).toBeInTheDocument();
    await user.keyboard('{Escape}');

    const ordered = screen.getByRole('row', { name: /PL-2083-0002/ });
    await user.click(within(ordered).getByRole('button', { name: 'Actions for PL-2083-0002' }));
    menu = await screen.findByRole('menu');
    expect(within(menu).getByRole('menuitem', { name: /Receive into stock/ })).toBeInTheDocument();
    expect(within(menu).queryByRole('menuitem', { name: /Mark ordered/ })).not.toBeInTheDocument();
    // An ordered list is on record: it is cancelled, never deleted.
    expect(within(menu).queryByRole('menuitem', { name: /Delete/ })).not.toBeInTheDocument();
  });

  it('marks a draft ordered after asking', async () => {
    const user = userEvent.setup();
    const { calls, store } = renderLists('DISPATCHER', {
      handler: ({ method, path }) => (method === 'POST' && path === '/admin/purchase-lists/pl1/order' ? json({ data: { ...DRAFT_LIST, status: 'ORDERED' } }) : undefined),
    });
    const draft = await screen.findByRole('row', { name: /PL-2083-0001/ });
    await user.click(within(draft).getByRole('button', { name: 'Actions for PL-2083-0001' }));
    await user.click(await screen.findByRole('menuitem', { name: /Mark ordered/ }));
    const confirm = await screen.findByRole('alertdialog');
    expect(confirm).toHaveTextContent('1 item from Hardware Pasal');
    await user.click(within(confirm).getByRole('button', { name: 'Mark ordered' }));
    await waitFor(() => expect(calls.some((c) => c.method === 'POST' && c.path === '/admin/purchase-lists/pl1/order')).toBe(true));
    await waitFor(() => expect(toastTitles(store)).toContain('PL-2083-0001 ordered'));
  });

  it('receives an ordered list: as ordered sends nothing but the move; less that came sends each quantity', async () => {
    const user = userEvent.setup();
    const { calls, store } = renderLists('DISPATCHER', {
      initialPath: '/admin/purchase-lists/pl2',
      handler: ({ method, path }) => (method === 'POST' && path === '/admin/purchase-lists/pl2/receive' ? json({ data: { ...ORDERED_LIST, status: 'RECEIVED' } }) : undefined),
    });
    // Past its draft the form is read only and says why.
    expect(await screen.findByTestId('record-lock')).toHaveTextContent('Ordered — it can be received or cancelled, not edited.');
    expect(screen.queryByRole('button', { name: 'Save changes' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Delete$/ })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Receive into stock/ }));
    let dialog = await screen.findByRole('dialog', { name: 'Receive PL-2083-0002 into stock' });
    const qty = within(dialog).getByRole('spinbutton', { name: /Crystalline slurry/ });
    expect(qty).toHaveValue(75);
    expect(dialog).toHaveTextContent('Ordered 75 kg — 3 bag. 0 if none came.');
    await user.click(within(dialog).getByRole('button', { name: 'Receive into stock' }));
    await waitFor(() => expect(calls.filter((c) => c.path === '/admin/purchase-lists/pl2/receive').map((c) => c.body)).toEqual([{}]));
    await waitFor(() => expect(toastTitles(store)).toContain('PL-2083-0002 received'));

    await user.click(screen.getByRole('button', { name: /Receive into stock/ }));
    dialog = await screen.findByRole('dialog', { name: 'Receive PL-2083-0002 into stock' });
    const field = within(dialog).getByRole('spinbutton', { name: /Crystalline slurry/ });
    await user.clear(field);
    await user.type(field, '50');
    await user.click(within(dialog).getByRole('button', { name: 'Receive into stock' }));
    await waitFor(() => expect(calls.filter((c) => c.path === '/admin/purchase-lists/pl2/receive').at(-1).body)
      .toEqual({ items: [{ itemId: 'i1', receivedQty: 50 }] }));
  }, 15_000);

  it('cancels only with a reason', async () => {
    const user = userEvent.setup();
    const { calls } = renderLists('DISPATCHER', {
      initialPath: '/admin/purchase-lists/pl2',
      handler: ({ method, path }) => (method === 'POST' && path === '/admin/purchase-lists/pl2/cancel' ? json({ data: { ...ORDERED_LIST, status: 'CANCELLED' } }) : undefined),
    });
    await user.click(await screen.findByRole('button', { name: /Cancel list/ }));
    const dialog = await screen.findByRole('dialog', { name: 'Cancel PL-2083-0002?' });
    await user.click(within(dialog).getByRole('button', { name: 'Cancel the list' }));
    expect(await within(dialog).findByText('Say why it is cancelled')).toBeInTheDocument();
    expect(calls.some((c) => c.path === '/admin/purchase-lists/pl2/cancel')).toBe(false);
    await user.type(within(dialog).getByLabelText(/Why is it cancelled/), 'सप्लायरसँग सामान छैन');
    await user.click(within(dialog).getByRole('button', { name: 'Cancel the list' }));
    await waitFor(() => expect(calls.find((c) => c.path === '/admin/purchase-lists/pl2/cancel')?.body).toEqual({ reason: 'सप्लायरसँग सामान छैन' }));
  });

  it('edits a draft’s items on the kit’s grid and saves them in the API’s shape', async () => {
    const user = userEvent.setup();
    const { calls } = renderLists('DISPATCHER', {
      initialPath: '/admin/purchase-lists/pl1',
      handler: ({ method, path }) => (method === 'PUT' && path === '/admin/purchase-lists/pl1' ? json({ data: DRAFT_LIST }) : undefined),
    });
    const grid = await screen.findByRole('grid', { name: 'Items' });
    expect(grid).toHaveTextContent('WP-CRYST · Crystalline slurry');
    expect(grid).toHaveTextContent('3 bag');
    await user.click(grid.querySelector('[data-cell="0:qty"]'));
    await user.keyboard('100{Enter}');
    await user.click(screen.getByRole('button', { name: 'Save changes' }));
    await waitFor(() => expect(calls.find((c) => c.method === 'PUT')?.body).toMatchObject({
      jobId: 'j9', supplierId: 'sup1', items: [{ materialId: 'mat1', qty: 100, packs: 3, note: 'Short by 70' }],
    }));
  }, 15_000);
});
