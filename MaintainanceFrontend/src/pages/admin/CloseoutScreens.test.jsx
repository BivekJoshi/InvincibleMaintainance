import { afterEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router-dom';
import JobDetailPage from '@/pages/admin/JobDetailPage/JobDetailPage';
import InvoiceDetailPage from '@/pages/admin/InvoiceDetailPage/InvoiceDetailPage';
import InvoicePublicPage from '@/pages/public/InvoicePublicPage/InvoicePublicPage';
import InvoicesPage from '@/pages/admin/InvoicesPage';
import { renderWithProviders, signedInAs } from '@/test/renderWithProviders';
import { json, mockApi } from '@/test/mockApi';

afterEach(() => vi.unstubAllGlobals());

/**
 * Phase L8 — close-out in the office: the running bill from the BOQ & progress tab, the final measurement (the kit's
 * `measurements` field, close and reopen), quoted vs actual cost, the handover dialog (snags, the warranty, Offer AMC),
 * the final bill's preview in the from-job sheet (the server's numbers and what blocks it) and a final bill's
 * deductions in the invoice documents. The mocked server answers in the contract's shapes; every amount is its paisa,
 * and a doctored figure is shown as sent — the screens add nothing up.
 */

const toasts = (store) => store.getState().ui.toasts;
const toastTitles = (store) => toasts(store).map((t) => t.title);
const MONEY_KEYS = /^(rate|amount|total|subtotal|cost|price|value|earned|vat)/i;

/** Every key in a value, at any depth — the money wall's scan of a request body. */
const keysOf = (value) => (Array.isArray(value) ? value.flatMap(keysOf)
  : value && typeof value === 'object' ? Object.entries(value).flatMap(([k, v]) => [k, ...keysOf(v)]) : []);

const CUSTOMER = { id: 'c1', name: 'राबिन महर्जन', phone: '9841234567', email: null, preferredLocale: 'ne' };

const LINES = [
  {
    id: 'l1', source: 'QUOTATION', number: 'A.1', section: 'Waterproofing', description: 'Crystalline slurry, two coats', unit: 'sq.ft',
    quotedQty: 240, rate: 22_000, progressPct: 100, isProvisional: false, sortOrder: 0,
    measurements: [{ area: 'Terrace', description: 'Slab', l: 21, b: 12 }], measuredQty: 252,
  },
  {
    id: 'l2', source: 'QUOTATION', number: 'A.2', section: 'Waterproofing', description: 'Drain chamber', unit: 'nos',
    quotedQty: 2, rate: 405_000, progressPct: 100, isProvisional: true, sortOrder: 1, measurements: null, measuredQty: null,
  },
  {
    id: 'l3', source: 'VARIATION', number: 'B.1', section: 'Variation VO-2083-0001', description: 'Exterior weather coat (omitted)', unit: 'sq.ft',
    quotedQty: -100, rate: 3_350, progressPct: 0, isProvisional: false, sortOrder: 2, measurements: null, measuredQty: null,
  },
];

const JOB = {
  id: 'j9', number: 'JOB-2083-0090', title: 'Terrace waterproofing — QT-2083-0031', type: 'RENOVATION', status: 'IN_PROGRESS', priority: 'NORMAL',
  isBillable: true, invoicedAt: null, createdAt: '2026-09-20T04:00:00.000Z', plannedDays: 8,
  scheduledStart: '2026-09-21T04:15:00.000Z', scheduledEnd: '2026-09-29T04:15:00.000Z', actualStart: '2026-09-21T04:30:00.000Z', actualEnd: null,
  customer: CUSTOMER,
  site: { id: 's1', label: 'Home', address: 'Jhamsikhel', area: 'Lalitpur', lat: null, lng: null },
  quotation: { id: 'q9', number: 'QT-2083-0031', total: 6_881_700, status: 'CONVERTED', contractType: 'ITEM_RATE' },
  measurementClosedAt: null, measurementClosedBy: null,
  lead: null, survey: null, project: null, parentJob: null, childJobs: [], createdBy: null, warranty: null,
  assignments: [{ id: 'as1', isLead: true, technician: { id: 't1', user: { id: 'u5', name: 'Suresh Technician', phone: '9800000002' } } }],
  tasks: [{ id: 'tk1', title: 'Clean the site', isDone: true, isSkipped: false, sortOrder: 0 }],
  photos: [], materials: [], timeLogs: [], events: [], requirements: [],
  lines: LINES,
  advance: { required: true, gateOn: true, paid: true, overridden: false, override: null, awaitingAdvance: false, invoice: null },
};

/** What the office reads on BOQ & progress: SALES / MANAGER / ACCOUNTANT get the money, a dispatcher does not. */
const progressFor = (role) => {
  const money = role !== 'DISPATCHER';
  const line = ({ rate, ...l }, value, earned) => ({
    id: l.id, number: l.number, source: l.source, description: l.description, unit: l.unit, quotedQty: l.quotedQty,
    progressPct: l.progressPct, isProvisional: l.isProvisional, ...(money ? { rate, value, earned } : {}),
  });
  return {
    sections: [
      { title: 'Waterproofing', lines: [line(LINES[0], 5_280_000, 5_280_000), line(LINES[1], 810_000, 810_000)] },
      { title: 'Variation VO-2083-0001', lines: [line(LINES[2], -335_000, 0)] },
    ],
    totals: money ? { value: 5_755_000, earned: 6_090_000, earnedPct: 100 } : { earnedPct: 100 },
    stages: [
      { id: 'st1', label: 'Advance', basisPoints: 5000, trigger: 'ON_ACCEPT', cumulativeBp: 5000, billed: true, due: false },
      { id: 'st0', label: 'Slab laid', basisPoints: 1000, trigger: 'MILESTONE', cumulativeBp: 6000, billed: false, due: true },
      { id: 'st2', label: 'Waterproofing done', basisPoints: 3000, trigger: 'MILESTONE', cumulativeBp: 9000, billed: false, due: false },
      { id: 'st3', label: 'On completion', basisPoints: 1000, trigger: 'ON_COMPLETION', cumulativeBp: 10000, billed: false, due: false },
    ],
    nextBill: { stageId: 'st0', label: 'Slab laid', basisPoints: 1000 },
  };
};

const renderJob = (role, { tab = '', handler = () => undefined, job = JOB } = {}) => {
  const calls = mockApi(async (call) => {
    const custom = await handler(call);
    if (custom) return custom;
    const { method, path } = call;
    if (method === 'GET' && path === `/admin/jobs/${job.id}`) return json({ data: job });
    if (method === 'GET' && path === `/admin/jobs/${job.id}/progress`) return json({ data: progressFor(role) });
    return undefined;
  });
  const view = renderWithProviders(
    <Routes>
      <Route path="/admin/jobs/:id" element={<JobDetailPage />} />
      <Route path="/admin/invoices/:id" element={<p>Invoice page</p>} />
      <Route path="/admin/leads/:id" element={<p>Lead page</p>} />
    </Routes>,
    { path: '*', initialPath: `/admin/jobs/${job.id}${tab}`, preloadedState: signedInAs(role) },
  );
  return { calls, ...view };
};

const RUNNING_DRAFT = { id: 'inv-r', number: 'INV-2083-0120', kind: 'RUNNING', status: 'DRAFT', total: 689_910 };

describe('running bills (Phase L8.1)', () => {
  it('the accountant raises the running bill from the prompt and lands on the new draft', async () => {
    const user = userEvent.setup();
    const { calls, store } = renderJob('ACCOUNTANT', {
      tab: '?tab=progress',
      handler: ({ method, path }) => (method === 'POST' && path === '/admin/jobs/j9/invoices/stage' ? json({ data: RUNNING_DRAFT }, 201) : undefined),
    });
    const prompt = await screen.findByTestId('next-bill');
    expect(prompt).toHaveTextContent('Earned value has passed Slab laid (10%) — raise the running bill');
    await user.click(within(prompt).getByRole('button', { name: /Raise running bill/ }));
    expect(await screen.findByText('Invoice page')).toBeInTheDocument();
    const post = calls.find((c) => c.method === 'POST');
    expect(post.path).toBe('/admin/jobs/j9/invoices/stage');
    expect(post.body).toEqual({ paymentStageId: 'st0' });
    expect(toastTitles(store)).toContain('Running bill INV-2083-0120 drafted');
  });

  it('a milestone not reached yet asks first; STAGE_BILLED is told in the server’s words; only milestones are offered', async () => {
    const user = userEvent.setup();
    const { calls, store } = renderJob('ACCOUNTANT', {
      tab: '?tab=progress',
      handler: ({ method, path }) => (method === 'POST' && path === '/admin/jobs/j9/invoices/stage'
        ? json({ error: { code: 'STAGE_BILLED', message: '"Waterproofing done" is already billed on INV-2083-0119' } }, 409)
        : undefined),
    });
    const stages = await screen.findByRole('region', { name: 'Payment stages' });
    // The advance comes with the Accept and the last stage with the final bill: neither is a running bill.
    expect(within(stages).queryByRole('button', { name: 'Actions for Advance' })).not.toBeInTheDocument();
    expect(within(stages).queryByRole('button', { name: 'Actions for On completion' })).not.toBeInTheDocument();
    await user.click(within(stages).getByRole('button', { name: 'Actions for Waterproofing done' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Raise running bill' }));
    const ask = await screen.findByRole('alertdialog', { name: 'Raise the running bill for Waterproofing done?' });
    expect(ask).toHaveTextContent('The work done by value (100%) has not reached this stage (90%) yet.');
    const progressReads = calls.filter((c) => c.path === '/admin/jobs/j9/progress').length;
    await user.click(within(ask).getByRole('button', { name: 'Raise running bill' }));
    await waitFor(() => expect(toastTitles(store)).toContain('Could not raise the running bill'));
    expect(toasts(store).find((t) => t.title === 'Could not raise the running bill').description)
      .toBe('"Waterproofing done" is already billed on INV-2083-0119');
    expect(calls.find((c) => c.method === 'POST').body).toEqual({ paymentStageId: 'st2' });
    // The stage list is read again, so it shows the bill someone else raised.
    await waitFor(() => expect(calls.filter((c) => c.path === '/admin/jobs/j9/progress').length).toBeGreaterThan(progressReads));
    expect(screen.queryByText('Invoice page')).not.toBeInTheDocument();
  });

  it('a dispatcher is told a bill is due but raises nothing', async () => {
    renderJob('DISPATCHER', { tab: '?tab=progress' });
    const prompt = await screen.findByTestId('next-bill');
    expect(within(prompt).queryByRole('button', { name: /Raise running bill/ })).not.toBeInTheDocument();
    expect(prompt).toHaveTextContent('Tell accounts.');
    const stages = screen.getByRole('region', { name: 'Payment stages' });
    expect(within(stages).queryByRole('button', { name: /^Actions for/ })).not.toBeInTheDocument();
    expect(screen.queryByTestId('final-bill-card')).not.toBeInTheDocument();
  });
});

describe('the final measurement in the office (Phase L8.2)', () => {
  it('shows the server’s measured quantity; Measure… sends the rows as numbers and toasts the server’s quantity', async () => {
    const user = userEvent.setup();
    const { calls, store } = renderJob('DISPATCHER', {
      tab: '?tab=progress',
      handler: ({ method, path, body }) => (method === 'PUT' && path === '/admin/jobs/j9/lines/l2/measure'
        ? json({ data: { ...LINES[1], rate: undefined, measurements: body.measurements, measuredQty: 3 } })
        : undefined),
    });
    await screen.findByTestId('job-progress');
    expect(screen.getByTestId('line-measured-l1')).toHaveTextContent('252 sq.ft');
    const drain = screen.getByRole('row', { name: /A\.2 Drain chamber/ });
    expect(within(drain).getByText('To measure')).toBeInTheDocument();
    const card = screen.getByTestId('final-measurement');
    expect(card).toHaveAttribute('data-state', 'open');
    expect(within(card).getByText('Item rate (measured)')).toBeInTheDocument();
    expect(screen.getByTestId('measurement-count')).toHaveTextContent('1 of 2 lines measured.');

    // An omission keeps its quoted quantity: its Measure… is off.
    await user.click(screen.getByRole('button', { name: 'Actions for B.1 Exterior weather coat (omitted)' }));
    expect(await screen.findByRole('menuitem', { name: 'Measure…' })).toHaveAttribute('aria-disabled', 'true');
    await user.keyboard('{Escape}');

    await user.click(screen.getByRole('button', { name: 'Actions for A.2 Drain chamber' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Measure…' }));
    const sheet = await screen.findByRole('dialog', { name: 'Measure A.2 · Drain chamber' });
    expect(sheet).toHaveTextContent('Quoted 2 nos; not measured yet.');
    await user.click(within(sheet).getByRole('button', { name: 'Add measurement' }));
    await user.keyboard('आँगन{Tab}Chamber{Tab}3{Tab}');
    expect(within(sheet).getByTestId('measurement-total')).toHaveTextContent('3');
    await user.click(within(sheet).getByRole('button', { name: 'Save measurements' }));

    await waitFor(() => expect(calls.find((c) => c.method === 'PUT')).toBeTruthy());
    const put = calls.find((c) => c.method === 'PUT');
    expect(put.body).toEqual({ measurements: [{ area: 'आँगन', description: 'Chamber', nos: 3 }] });
    expect(keysOf(put.body).filter((k) => MONEY_KEYS.test(k))).toEqual([]);
    await waitFor(() => expect(toastTitles(store)).toContain('A.2 measured'));
    expect(toasts(store).find((t) => t.title === 'A.2 measured').description).toBe('3 nos — the server’s quantity.');
  });

  it('Close measurement lists the lines the server says are missing, each opening its sheet', async () => {
    const user = userEvent.setup();
    const { calls } = renderJob('DISPATCHER', {
      tab: '?tab=progress',
      handler: ({ method, path }) => (method === 'POST' && path === '/admin/jobs/j9/measurement/close'
        ? json({ error: { code: 'MEASUREMENT_INCOMPLETE', message: '1 line(s) are not measured yet', details: [{ lineId: 'l2', number: 'A.2', description: 'Drain chamber' }] } }, 422)
        : undefined),
    });
    const card = await screen.findByTestId('final-measurement');
    await user.click(within(card).getByRole('button', { name: 'Close measurement' }));
    const ask = await screen.findByRole('alertdialog', { name: 'Close the final measurement?' });
    await user.click(within(ask).getByRole('button', { name: 'Close measurement' }));
    const refusal = await within(card).findByTestId('measurement-refusal');
    expect(refusal).toHaveTextContent('1 line(s) are not measured yet');
    expect(refusal).toHaveTextContent('A.2 · Drain chamber');
    expect(calls.find((c) => c.method === 'POST').path).toBe('/admin/jobs/j9/measurement/close');
    await user.click(within(refusal).getByRole('button', { name: 'Measure…' }));
    expect(await screen.findByRole('dialog', { name: 'Measure A.2 · Drain chamber' })).toBeInTheDocument();
  });

  it('a closed measurement says who closed it, measures nothing, and reopening is refused once the final bill is raised', async () => {
    const user = userEvent.setup();
    const closed = {
      ...JOB, measurementClosedAt: '2026-09-27T09:00:00.000Z', measurementClosedBy: { id: 'u3', name: 'Dispatch Desk' },
      lines: LINES.map((l) => (l.id === 'l2' ? { ...l, measurements: [{ nos: 2 }], measuredQty: 2 } : l)),
    };
    renderJob('DISPATCHER', {
      tab: '?tab=progress',
      job: closed,
      handler: ({ method, path }) => (method === 'POST' && path === '/admin/jobs/j9/measurement/reopen'
        ? json({ error: { code: 'FINAL_ALREADY_BILLED', message: 'The final bill INV-2083-0130 was raised from this measurement; void it first' } }, 422)
        : undefined),
    });
    const card = await screen.findByTestId('final-measurement');
    expect(card).toHaveAttribute('data-state', 'closed');
    expect(screen.getByTestId('measurement-closed-by')).toHaveTextContent('by Dispatch Desk');
    expect(screen.getByTestId('measurement-count')).toHaveTextContent('2 of 2 lines measured.');
    await user.click(screen.getByRole('button', { name: 'Actions for A.1 Crystalline slurry, two coats' }));
    expect(await screen.findByRole('menuitem', { name: 'Measure…' })).toHaveAttribute('aria-disabled', 'true');
    await user.keyboard('{Escape}');

    await user.click(within(card).getByRole('button', { name: 'Reopen measurement' }));
    await user.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Reopen measurement' }));
    expect(await within(card).findByTestId('measurement-refusal')).toHaveTextContent('The final bill INV-2083-0130 was raised from this measurement; void it first');
  });

  it('without jobs:write the measurement is read only', async () => {
    renderJob('SALES', { tab: '?tab=progress' });
    const card = await screen.findByTestId('final-measurement');
    expect(within(card).queryByRole('button', { name: /measurement/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Actions for A\./ })).not.toBeInTheDocument();
  });
});

describe('quoted vs actual cost (Phase L8.3)', () => {
  const COSTING = {
    jobId: 'j9',
    cost: { materials: 2_400_000, labour: 1_150_000, expenses: 90_000, total: 3_640_000 },
    labourMinutes: 2_880,
    billable: { materials: 0, invoiced: 6_090_000 },
    quoted: { materials: 2_250_000, labour: 1_200_050, other: null, total: 3_450_050, complete: false },
    margin: 2_450_000,
    marginPct: 40.2,
    breakdown: { materials: [], labour: [], expenses: [], invoices: [] },
  };

  it('puts the recipes’ quoted cost beside the actual, as the server sends them, and says when the quote is incomplete', async () => {
    renderJob('MANAGER', {
      tab: '?tab=costing',
      handler: ({ path }) => (path === '/admin/jobs/j9/costing' ? json({ data: COSTING }) : undefined),
    });
    const table = await screen.findByTestId('quoted-vs-actual');
    expect(within(table).getByTestId('quoted-materials')).toHaveTextContent('Rs. 22,500.00');
    expect(within(table).getByTestId('actual-materials')).toHaveTextContent('Rs. 24,000.00');
    expect(within(table).getByTestId('quoted-labour')).toHaveTextContent('Rs. 12,000.50');
    expect(within(table).getByTestId('quoted-other')).toHaveTextContent('—');
    expect(within(table).getByTestId('quoted-total')).toHaveTextContent('Rs. 34,500.50');
    expect(within(table).getByTestId('actual-total')).toHaveTextContent('Rs. 36,400.00');
    expect(within(screen.getByRole('row', { name: /^Materials/ })).getByText('Over the quote')).toBeInTheDocument();
    expect(within(screen.getByRole('row', { name: /^Labour/ })).getByText('Within the quote')).toBeInTheDocument();
    expect(screen.getByTestId('quoted-incomplete')).toBeInTheDocument();
    // Invoiced is the taxable amount billed — the contract's value on a fully billed BOQ job.
    expect(screen.getByText('Invoiced').parentElement).toHaveTextContent('Rs. 60,900.00');
    expect(screen.getByText('Invoiced').parentElement).toHaveTextContent('Before VAT, net of discount');
  });

  it('a job without a quotation has no quoted cost', async () => {
    renderJob('MANAGER', {
      tab: '?tab=costing',
      job: { ...JOB, quotation: null, lines: [] },
      handler: ({ path }) => (path === '/admin/jobs/j9/costing' ? json({ data: { ...COSTING, quoted: null } }) : undefined),
    });
    expect(await screen.findByText('Total cost')).toBeInTheDocument();
    expect(screen.queryByTestId('quoted-vs-actual')).not.toBeInTheDocument();
  });
});

describe('the handover dialog (Phase L8.4)', () => {
  const WARRANTY = {
    id: 'w1', jobId: 'j9', scope: 'Workmanship warranty for Terrace waterproofing', startsAt: '2026-09-28T06:00:00.000Z',
    endsAt: '2027-09-28T06:00:00.000Z', status: 'ACTIVE', publicToken: 'wty-tok-9',
  };

  it('snags become checklist items — and the job is not completed', async () => {
    const user = userEvent.setup();
    const { calls, store } = renderJob('DISPATCHER', {
      handler: ({ method, path, body }) => (method === 'POST' && path === '/admin/jobs/j9/tasks'
        ? json({ data: { id: `tk-${body.title.length}`, title: body.title, isDone: false, isSkipped: false } }, 201)
        : undefined),
    });
    await user.click(await screen.findByRole('button', { name: 'Complete…' }));
    const dialog = await screen.findByRole('dialog', { name: 'Hand over JOB-2083-0090' });
    expect(dialog).toHaveTextContent('Every checklist item must be done or skipped first.');
    expect(within(dialog).getByText(/An open item blocks completion/)).toBeInTheDocument();
    expect(within(dialog).getByLabelText('What was done')).toBeInTheDocument();

    await user.click(within(dialog).getByRole('button', { name: 'Add a snag' }));
    await user.type(within(dialog).getByRole('textbox', { name: /Snags — anything still to put right 1/ }), 'Touch up the paint by the door');
    await user.click(within(dialog).getByRole('button', { name: 'Add a snag' }));
    await user.type(within(dialog).getByRole('textbox', { name: /Snags — anything still to put right 2/ }), 'बाथरूमको टाइल मिलाउने');
    // With snags the job is not being completed: the sign-off is out of sight.
    await waitFor(() => expect(within(dialog).queryByLabelText('What was done')).not.toBeInTheDocument());
    await user.click(within(dialog).getByRole('button', { name: 'Add 2 snags to the checklist' }));

    await waitFor(() => expect(calls.filter((c) => c.method === 'POST' && c.path === '/admin/jobs/j9/tasks')).toHaveLength(2));
    expect(calls.filter((c) => c.path === '/admin/jobs/j9/tasks').map((c) => c.body.title)).toEqual(['Touch up the paint by the door', 'बाथरूमको टाइल मिलाउने']);
    expect(calls.some((c) => c.path === '/admin/jobs/j9/complete')).toBe(false);
    await waitFor(() => expect(toastTitles(store)).toContain('2 snags added to JOB-2083-0090’s checklist'));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('completes, then shows the warranty’s certificate link and offers AMC — a new lead for sales', async () => {
    const user = userEvent.setup();
    let done = false;
    const { calls, store } = renderJob('DISPATCHER', {
      handler: ({ method, path }) => {
        if (method === 'POST' && path === '/admin/jobs/j9/complete') {
          done = true;
          return json({ data: { ...JOB, status: 'COMPLETED' } });
        }
        if (method === 'GET' && path === '/admin/jobs/j9' && done) return json({ data: { ...JOB, status: 'COMPLETED', warranty: WARRANTY } });
        if (method === 'POST' && path === '/admin/jobs/j9/offer-amc') {
          return json({ data: { id: 'lead9', name: CUSTOMER.name, phone: CUSTOMER.phone, source: 'amc_offer', status: 'NEW', assignedTo: { id: 'u2', name: 'Sita Sales' } } }, 201);
        }
        return undefined;
      },
    });
    await user.click(await screen.findByRole('button', { name: 'Complete…' }));
    const dialog = await screen.findByRole('dialog', { name: 'Hand over JOB-2083-0090' });
    await user.type(within(dialog).getByLabelText('What was done'), 'छत वाटरप्रुफिङ सकियो');
    await user.click(within(dialog).getByRole('button', { name: 'Complete and hand over' }));

    const handed = await screen.findByRole('dialog', { name: 'JOB-2083-0090 is handed over' });
    const complete = calls.find((c) => c.path === '/admin/jobs/j9/complete');
    expect(complete.body).toEqual({ note: 'छत वाटरप्रुफिङ सकियो' });
    expect(await within(handed).findByTestId('warranty-link')).toHaveTextContent('/warranty/wty-tok-9');
    expect(within(handed).getByRole('link', { name: /Open the certificate/ })).toHaveAttribute('href', expect.stringContaining('/warranty/wty-tok-9'));
    expect(within(handed).getByText('Workmanship warranty for Terrace waterproofing')).toBeInTheDocument();

    await user.click(within(handed).getByRole('button', { name: 'Offer AMC' }));
    const offered = await within(handed).findByTestId('amc-offered');
    expect(offered).toHaveTextContent('A lead is with sales to offer the maintenance contract — Sita Sales.');
    expect(within(offered).getByRole('link', { name: 'Open the lead' })).toHaveAttribute('href', '/admin/leads/lead9');
    expect(calls.find((c) => c.path === '/admin/jobs/j9/offer-amc').method).toBe('POST');
    expect(toastTitles(store)).toContain('AMC offer sent to sales');
    await user.click(within(handed).getByRole('button', { name: 'Done' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('Offer AMC on a finished job’s Overview: an offer already open is said so, not made twice', async () => {
    const user = userEvent.setup();
    const { store } = renderJob('DISPATCHER', {
      job: { ...JOB, status: 'COMPLETED', warranty: WARRANTY },
      handler: ({ method, path }) => (method === 'POST' && path === '/admin/jobs/j9/offer-amc'
        ? json({ data: { id: 'lead7', name: CUSTOMER.name, phone: CUSTOMER.phone, source: 'amc_offer', status: 'CONTACTED', assignedTo: null } }, 200)
        : undefined),
    });
    await user.click(await screen.findByRole('button', { name: 'Offer AMC' }));
    expect(await screen.findByTestId('amc-offered')).toHaveTextContent('This customer already has an open AMC offer with sales.');
    expect(toastTitles(store)).toContain('An AMC offer is already open');
  });
});

describe('the final bill’s preview (Phase L8.3)', () => {
  /** The server's preview — one figure doctored (A.1 is not 252 × 220) to prove the sheet shows what it is sent. */
  const PREVIEW = {
    boq: true, contractType: 'ITEM_RATE', measurementRequired: true, measurementClosed: true,
    lines: [
      { lineId: 'l1', number: 'A.1', source: 'QUOTATION', description: 'A.1 Crystalline slurry, two coats', unit: 'sq.ft', qty: 252, rate: 22_000, amount: 5_544_001 },
      { lineId: 'l2', number: 'A.2', source: 'QUOTATION', description: 'A.2 Drain chamber', unit: 'nos', qty: 3, rate: 405_000, amount: 1_215_000 },
      { lineId: 'l3', number: 'B.1', source: 'VARIATION', description: 'B.1 Exterior weather coat (omitted)', unit: 'sq.ft', qty: -100, rate: 3_350, amount: -335_000 },
    ],
    deductions: [
      { invoiceId: 'inv-adv', number: 'INV-2083-0077', kind: 'ADVANCE', description: 'Less: advance INV-2083-0077', taxable: 3_045_000, vat: 395_850, total: 3_440_850 },
      { invoiceId: 'inv-r', number: 'INV-2083-0120', kind: 'RUNNING', description: 'Less: running bill INV-2083-0120', taxable: 609_000, vat: 79_170, total: 688_170 },
    ],
    totals: {
      contract: { subtotal: 6_424_001, discount: 64_240, taxable: 6_359_761, vatAmount: 826_769, total: 7_186_530 },
      billed: { taxable: 3_654_000, vat: 475_020, total: 4_129_020 },
      due: { taxable: 2_705_761, vat: 351_749, total: 3_057_510 },
    },
    blocking: [],
  };
  const FINISHED = { ...JOB, status: 'COMPLETED', warranty: null };

  it('opens from the job, shows the server’s lines, deductions and totals, and creates it sending only the due date', async () => {
    const user = userEvent.setup();
    const { calls, store } = renderJob('ACCOUNTANT', {
      tab: '?tab=progress',
      job: FINISHED,
      handler: ({ method, path }) => {
        if (path === '/admin/jobs/j9/final-bill') return json({ data: PREVIEW });
        if (method === 'POST' && path === '/admin/invoices/from-job/j9') return json({ data: { id: 'inv-f', number: 'INV-2083-0130', kind: 'FINAL', status: 'DRAFT' } }, 201);
        return undefined;
      },
    });
    const card = await screen.findByTestId('final-bill-card');
    await user.click(within(card).getByRole('button', { name: 'Raise final bill…' }));
    const sheet = await screen.findByRole('dialog', { name: 'Final bill for JOB-2083-0090' });
    const preview = await within(sheet).findByTestId('final-bill-preview');
    expect(within(preview).getByText('Item rate (measured)')).toBeInTheDocument();
    expect(within(preview).getByText('Measurement closed')).toBeInTheDocument();
    const a1 = within(preview).getByRole('row', { name: /A\.1 Crystalline slurry/ });
    expect(a1).toHaveTextContent('252 sq.ft');
    expect(a1).toHaveTextContent('Rs. 55,440.01'); // the server's amount, as sent
    const omission = within(preview).getByRole('row', { name: /B\.1 Exterior weather coat/ });
    expect(within(omission).getByText('− Rs. 3,350.00')).toBeInTheDocument();
    const deductions = within(preview).getByTestId('final-bill-deductions');
    expect(within(deductions).getByRole('row', { name: /INV-2083-0077/ })).toHaveTextContent('Rs. 34,408.50');
    expect(within(deductions).getByRole('row', { name: /INV-2083-0120/ })).toHaveTextContent('Running bill');
    const totals = within(preview).getByTestId('final-bill-totals');
    expect(within(totals).getByRole('row', { name: /^Discount/ })).toHaveTextContent('− Rs. 642.40');
    expect(within(totals).getByTestId('final-due-taxable')).toHaveTextContent('Rs. 27,057.61');
    expect(within(totals).getByTestId('final-due-vat')).toHaveTextContent('Rs. 3,517.49');
    expect(within(totals).getByTestId('final-due-total')).toHaveTextContent('Rs. 30,575.10');
    expect(within(totals).getByRole('row', { name: /^Total/ })).toHaveTextContent('Rs. 41,290.20');
    expect(preview).not.toHaveTextContent(/Rs\. -/);
    expect(within(sheet).queryByRole('alert')).not.toBeInTheDocument();

    await user.click(within(sheet).getByRole('button', { name: 'Create final bill (draft)' }));
    expect(await screen.findByText('Invoice page')).toBeInTheDocument();
    const post = calls.find((c) => c.method === 'POST' && c.path === '/admin/invoices/from-job/j9');
    expect(Object.keys(post.body ?? {}).filter((k) => k !== 'dueDate')).toEqual([]);
    expect(toastTitles(store)).toContain('Final bill INV-2083-0130 drafted');
  });

  it('says what stops it — the unmeasured lines, a final below what was billed — and cannot be created', async () => {
    const user = userEvent.setup();
    const blocked = {
      ...PREVIEW,
      measurementClosed: false,
      blocking: [
        {
          code: 'MEASUREMENT_INCOMPLETE',
          message: 'An item-rate job bills what was measured: measure every line and close the measurement first.',
          details: [{ lineId: 'l2', number: 'A.2', description: 'Drain chamber' }],
        },
        { code: 'FINAL_BELOW_BILLED', message: 'The stage bills already exceed the final contract; a credit note is needed (not yet supported).' },
      ],
    };
    const { calls } = renderJob('ACCOUNTANT', {
      tab: '?tab=progress',
      job: FINISHED,
      handler: ({ path }) => (path === '/admin/jobs/j9/final-bill' ? json({ data: blocked }) : undefined),
    });
    await user.click(await screen.findByRole('button', { name: 'Raise final bill…' }));
    const sheet = await screen.findByRole('dialog', { name: 'Final bill for JOB-2083-0090' });
    const why = await within(sheet).findByTestId('final-bill-blocking');
    expect(within(sheet).getByText('Measurement open')).toBeInTheDocument();
    expect(why).toHaveTextContent('measure every line and close the measurement first');
    expect(why).toHaveTextContent('A.2 · Drain chamber');
    expect(why).toHaveTextContent('a credit note is needed');
    expect(within(why).getByRole('link', { name: /BOQ & progress tab/ })).toHaveAttribute('href', '/admin/jobs/j9?tab=progress');
    expect(within(sheet).getByRole('button', { name: 'Create final bill (draft)' })).toBeDisabled();
    expect(calls.some((c) => c.path === '/admin/invoices/from-job/j9')).toBe(false);
  });

  it('is not offered before the job is complete', async () => {
    renderJob('ACCOUNTANT', { tab: '?tab=progress' });
    const card = await screen.findByTestId('final-bill-card');
    expect(within(card).getByRole('button', { name: 'Raise final bill…' })).toBeDisabled();
    expect(card).toHaveTextContent('Complete the job first — the final bill follows the handover.');
  });

  it('a job without BOQ lines ({ boq: false }) bills as Phase I says', async () => {
    const user = userEvent.setup();
    const calls = mockApi(({ method, path }) => {
      if (method === 'GET' && path === '/admin/invoices') return json({ data: [], meta: { page: 1, limit: 20, total: 0, pages: 1, counts: {} } });
      if (method === 'GET' && path === '/admin/jobs') {
        return json({
          data: [{ id: 'j1', number: 'JOB-2083-0011', title: 'Gutter and parapet', status: 'COMPLETED', customer: CUSTOMER, quotation: { id: 'q1', number: 'QT-2083-0007', total: 8_393_640, status: 'CONVERTED' } }],
          meta: { page: 1, limit: 10, total: 1, pages: 1 },
        });
      }
      if (path === '/admin/jobs/j1/final-bill') return json({ data: { boq: false } });
      if (method === 'POST' && path === '/admin/invoices/from-job/j1') return json({ data: { id: 'inv9', number: 'INV-2083-0050' } }, 201);
      return undefined;
    });
    renderWithProviders(<InvoicesPage />, {
      path: '/admin/invoices', preloadedState: signedInAs('ACCOUNTANT'),
      routes: [{ path: '/admin/invoices/:id', element: <p>Invoice page</p> }],
    });
    await user.click(await screen.findByRole('button', { name: 'Create from job' }));
    await user.click(await screen.findByText('Gutter and parapet'));
    await waitFor(() => expect(calls.some((c) => c.path === '/admin/jobs/j1/final-bill')).toBe(true));
    expect(screen.queryByTestId('final-bill-preview')).not.toBeInTheDocument();
    await user.click(await screen.findByRole('button', { name: 'Create draft invoice' }));
    expect(await screen.findByText('Invoice page')).toBeInTheDocument();
  });
});

describe('a final bill’s deductions in the invoice documents (Phase L8.3)', () => {
  /** The server's FINAL invoice: the billed lines, then two DEDUCTION lines (negative) — advance + running = contract. */
  const FINAL = {
    id: 'inv-f', number: 'INV-2083-0130', status: 'SENT', kind: 'FINAL', jobId: 'j9', job: { id: 'j9', number: 'JOB-2083-0090' },
    paymentStage: null, customer: CUSTOMER, issuedAt: '2026-10-20T04:00:00.000Z', dueDate: '2026-11-03T18:15:00.000Z',
    subtotal: 2_436_000, discount: 0, vatApplied: true, vatRate: 13, vatAmount: 316_680, total: 2_752_680, paidAmount: 0, balance: 2_752_680,
    items: [
      { id: 'f1', kind: 'ITEM', description: 'A.1 Crystalline slurry, two coats', unit: 'sq.ft', qty: 240, rate: 22_000, amount: 5_280_000, jobId: 'j9' },
      { id: 'f2', kind: 'ITEM', description: 'A.2 Drain chamber', unit: 'nos', qty: 2, rate: 405_000, amount: 810_000, jobId: 'j9' },
      { id: 'f3', kind: 'DEDUCTION', description: 'Less: advance INV-2083-0077', unit: 'lump', qty: 1, rate: -3_045_000, amount: -3_045_000, jobId: 'j9' },
      { id: 'f4', kind: 'DEDUCTION', description: 'Less: running bill INV-2083-0120', unit: 'lump', qty: 1, rate: -609_000, amount: -609_000, jobId: 'j9' },
    ],
    payments: [], jobs: [], quotation: { id: 'q9', number: 'QT-2083-0031' },
    publicToken: 'fin-tok', publicUrl: 'http://localhost:5400/invoice/fin-tok', note: null, terms: null, voidReason: null,
  };

  const expectDeductionBlock = (doc) => {
    const block = within(doc).getByTestId('invoice-deductions');
    expect(within(block).getByRole('heading', { name: 'Deducted — billed before' })).toBeInTheDocument();
    const advance = within(block).getByRole('row', { name: /Advance INV-2083-0077/ });
    expect(within(advance).getAllByText('− Rs. 30,450.00')).toHaveLength(1);
    expect(within(block).getByRole('row', { name: /Running bill INV-2083-0120/ })).toHaveTextContent('− Rs. 6,090.00');
    // One sign each: no "Less:" in the block (the heading says it), never "Rs. -", never a double minus.
    expect(block).not.toHaveTextContent(/Less:/);
    expect(doc).not.toHaveTextContent(/Rs\. -|−\s*−|-\s*Rs\./);
    // The deductions are not rows among the work.
    const work = within(doc).getAllByRole('row').filter((r) => r.getAttribute('data-row-type') === 'ITEM');
    expect(work).toHaveLength(2);
  };

  it('the office’s invoice page lists them in a block of their own, one sign each', async () => {
    mockApi(({ path }) => (path === '/admin/invoices/inv-f' ? json({ data: FINAL }) : undefined));
    renderWithProviders(<InvoiceDetailPage />, { path: '/admin/invoices/:id', initialPath: '/admin/invoices/inv-f', preloadedState: signedInAs('ACCOUNTANT') });
    const doc = await screen.findByTestId('invoice-document');
    expectDeductionBlock(doc);
    expect(within(doc).getByText('Total').parentElement).toHaveTextContent('Rs. 27,526.80');
  });

  it('the customer’s page reads the same', async () => {
    const { job: _j, jobs: _js, ...pub } = FINAL;
    mockApi(({ path }) => (path === '/public/invoices/fin-tok' ? json({ data: pub }) : undefined));
    renderWithProviders(<InvoicePublicPage />, { path: '/invoice/:token', initialPath: '/invoice/fin-tok' });
    expectDeductionBlock(await screen.findByTestId('invoice-document'));
  });

  it('a final bill’s locked draft shows them the same way', async () => {
    mockApi(({ path }) => (path === '/admin/invoices/inv-f' ? json({ data: { ...FINAL, status: 'DRAFT' } }) : undefined));
    renderWithProviders(<InvoiceDetailPage />, { path: '/admin/invoices/:id', initialPath: '/admin/invoices/inv-f', preloadedState: signedInAs('ACCOUNTANT') });
    const fixed = await screen.findByTestId('locked-lines');
    expectDeductionBlock(fixed);
  });
});
