import { afterEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router-dom';
import { DndContext } from '@dnd-kit/core';
import JobDetailPage from '@/pages/admin/JobDetailPage/JobDetailPage';
import JobsPage from '@/pages/admin/JobsPage';
import InvoiceDetailPage from '@/pages/admin/InvoiceDetailPage/InvoiceDetailPage';
import InvoicesPage from '@/pages/admin/InvoicesPage';
import InvoicePublicPage from '@/pages/public/InvoicePublicPage/InvoicePublicPage';
import ResourceEditPage from '@/pages/admin/ResourceEditPage';
import { INVOICE_LINES_LOCKED_MESSAGE } from '@/pages/admin/InvoiceDetailPage/sections/InvoiceEditForm';
import { UnassignedQueue } from '@/pages/admin/DispatchBoardPage/UnassignedQueue';
import { ScheduleJobDialog } from '@/components/jobs/ScheduleJobDialog';
import { services } from '@/config/admin/resources/services';
import { serviceSchema } from '@/form/schemas/cms.schema';
import { JOB_TYPES, JOB_TYPE_LABELS } from '@/config/constants';
import { renderWithProviders, signedInAs } from '@/test/renderWithProviders';
import { json, mockApi, page } from '@/test/mockApi';

afterEach(() => vi.unstubAllGlobals());

/**
 * Phase L6 — won → hand-off, in the office: the advance and its gate on the job page, the board and the lists, the
 * override, the Plan tab of a BOQ job, the invoice's kind, and the services' job type. The mocked server answers in
 * the contract's shapes; every amount is its paisa.
 */

const toastTitles = (store) => store.getState().ui.toasts.map((t) => t.title);

const HARI = {
  id: 't-hari', employeeCode: 'TECH-001', skills: ['waterproofing'], serviceAreas: ['Lalitpur'], dailyCapacity: 4, isAvailable: true,
  user: { id: 'u-hari', name: 'Hari KC', phone: '9808338255', role: 'TECHNICIAN', isActive: true },
};
const CUSTOMER = { id: 'c1', name: 'राबिन महर्जन', phone: '9841234567', email: null, preferredLocale: 'ne' };

/** The advance a 50 · 40 · 10 quotation of Rs. 82,377.00 raised on Accept: stage 1, Rs. 41,188.50. */
const ADVANCE = {
  required: true, gateOn: true, paid: false, overridden: false, override: null, awaitingAdvance: true,
  invoice: {
    id: 'inv-adv', number: 'INV-2083-0077', status: 'SENT', total: 4_118_850, paidAmount: 0, balance: 4_118_850,
    dueDate: '2026-10-04T18:15:00.000Z', publicUrl: 'http://localhost:5400/invoice/adv-tok',
  },
};

const LINES = [
  { id: 'l1', source: 'QUOTATION', quotationItemId: 'qi1', number: 'A.1', section: 'Waterproofing', kind: 'ITEM', description: 'Crystalline slurry, two coats', unit: 'sq.ft', quotedQty: 240, rate: 22_000, measurements: null, measuredQty: null, progressPct: 0, isProvisional: false, sortOrder: 0 },
  { id: 'l2', source: 'QUOTATION', quotationItemId: 'qi2', number: 'A.2', section: 'Waterproofing', kind: 'ITEM', description: 'Drain chamber', unit: 'nos', quotedQty: 2, rate: 405_000, measurements: null, measuredQty: null, progressPct: 0, isProvisional: true, sortOrder: 1 },
  { id: 'l3', source: 'QUOTATION', quotationItemId: 'qi3', number: 'B.1', section: 'Painting', kind: 'ITEM', description: 'Exterior weather coat', unit: 'sq.ft', quotedQty: 600, rate: 3_350, measurements: null, measuredQty: null, progressPct: 0, isProvisional: false, sortOrder: 2 },
];

const BOQ_JOB = {
  id: 'j9', number: 'JOB-2083-0090', title: 'Terrace waterproofing — QT-2083-0031', type: 'RENOVATION', status: 'DRAFT', priority: 'NORMAL',
  isBillable: true, invoicedAt: null, createdAt: '2026-09-27T04:00:00.000Z', plannedDays: 8,
  scheduledStart: null, scheduledEnd: null, actualStart: null, actualEnd: null,
  customer: CUSTOMER,
  site: { id: 's1', label: 'Home', address: 'Jhamsikhel', area: 'Lalitpur', lat: null, lng: null },
  quotation: { id: 'q9', number: 'QT-2083-0031', total: 8_237_700, status: 'CONVERTED' },
  lead: null, survey: null, project: null, parentJob: null, childJobs: [], createdBy: null, warranty: null,
  assignments: [], tasks: [], photos: [], materials: [], timeLogs: [], events: [],
  lines: LINES,
  requirements: [
    { id: 'r1', kind: 'MATERIAL', materialId: 'mat1', tradeId: null, description: 'Crystalline slurry', unit: 'kg', qty: 120, packs: 5, source: 'TAKEOFF' },
    { id: 'r3', kind: 'LABOUR', materialId: null, tradeId: 'tr1', description: 'Mason', unit: 'day', qty: 7.5, packs: null, source: 'TAKEOFF' },
  ],
  advance: ADVANCE,
};

/** An ordinary repair: no lines, no advance. */
const PLAIN_JOB = { ...BOQ_JOB, id: 'j1', number: 'JOB-2083-0042', type: 'REPAIR', title: 'Leaking tap', lines: [], requirements: [], advance: { required: false, gateOn: true, invoice: null, paid: false, overridden: false, override: null, awaitingAdvance: false }, plannedDays: null, quotation: null };

const PLAN = {
  job: { id: 'j9', number: 'JOB-2083-0090', plannedDays: 8, scheduledStart: null, scheduledEnd: null },
  advance: ADVANCE,
  sections: [
    { title: 'Waterproofing', lines: LINES.slice(0, 2).map(({ id, number, description, unit, quotedQty, isProvisional }) => ({ id, number, description, unit, quotedQty, isProvisional })) },
    { title: 'Painting', lines: [{ id: 'l3', number: 'B.1', description: 'Exterior weather coat', unit: 'sq.ft', quotedQty: 600, isProvisional: false }] },
  ],
  lineCount: 3,
  materials: [
    { id: 'r1', materialId: 'mat1', code: 'WP-CRYST', name: 'Crystalline slurry', unit: 'kg', qty: 120, packs: 5, packSize: 25, packLabel: 'bag', onHand: 50, shortfall: 70 },
    { id: 'r2', materialId: 'mat2', code: 'PT-EXT', name: 'Exterior emulsion', unit: 'litre', qty: 40, packs: 2, packSize: 20, packLabel: 'tin', onHand: 60, shortfall: 0 },
  ],
  labour: [
    { id: 'r3', tradeId: 'tr1', code: 'MASON', name: 'Mason', days: 7.5 },
    { id: 'r4', tradeId: 'tr2', code: 'HELPER', name: 'Helper', days: 5 },
  ],
  labourDays: 12.5,
  crew: { size: 0, lead: null, technicians: [] },
  readiness: [
    { key: 'advance', label: 'Advance paid', done: false, detail: 'Waiting — invoice INV-2083-0077' },
    { key: 'boq', label: 'BOQ imported', done: true, detail: '3 line(s) in 2 section(s)' },
    { key: 'materials', label: 'Materials in stock', done: false, detail: '1 material(s) short' },
    { key: 'crew', label: 'Crew and foreman', done: false, detail: 'Nobody assigned' },
    { key: 'schedule', label: 'Dates set', done: false, detail: 'Not scheduled' },
    { key: 'site', label: 'Site details', done: true, detail: 'Jhamsikhel' },
  ],
};

const renderJob = (role, { job = BOQ_JOB, tab = '', handler = () => undefined } = {}) => {
  const calls = mockApi(async (call) => {
    const custom = await handler(call);
    if (custom) return custom;
    if (call.path === `/admin/jobs/${job.id}`) return json({ data: job });
    if (call.path === `/admin/jobs/${job.id}/plan`) return json({ data: PLAN });
    return undefined;
  });
  const view = renderWithProviders(
    <Routes><Route path="/admin/jobs/:id" element={<JobDetailPage />} /></Routes>,
    { path: '*', initialPath: `/admin/jobs/${job.id}${tab}`, preloadedState: signedInAs(role) },
  );
  return { calls, ...view };
};

describe('the job page while the advance is unpaid (Phase L6.3)', () => {
  it('shows the chip and the advance card, and holds Schedule and Assign with the reason — the dispatcher cannot override', async () => {
    renderJob('DISPATCHER');
    await screen.findByRole('heading', { name: /JOB-2083-0090/ });
    expect(screen.getByTestId('awaiting-advance')).toHaveTextContent('Awaiting advance');
    expect(screen.getByTestId('awaiting-advance').closest('[title]')).toHaveAttribute('title', expect.stringContaining('INV-2083-0077'));

    const card = screen.getByTestId('advance-card');
    expect(card).toHaveAttribute('data-state', 'awaiting');
    expect(within(card).getByTestId('advance-title')).toHaveTextContent('Waiting for the advance — scheduling is locked');
    expect(within(card).getByTestId('advance-total')).toHaveTextContent('Rs. 41,188.50');
    expect(within(card).getByTestId('advance-balance')).toHaveTextContent('Rs. 41,188.50');
    expect(within(card).getByText('05 Oct 2026')).toBeInTheDocument();
    expect(within(card).getByRole('link', { name: /customer’s payment page/ })).toHaveAttribute('href', 'http://localhost:5400/invoice/adv-tok');
    // The dispatcher cannot open invoices, so the number is not a link to a page that would refuse them.
    expect(within(card).queryByRole('link', { name: 'INV-2083-0077' })).not.toBeInTheDocument();
    expect(within(card).getByText('INV-2083-0077')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Override/ })).not.toBeInTheDocument();

    // Still offered, but held — and the bar says why, once for both.
    expect(screen.getByRole('button', { name: 'Schedule…' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Assign technicians…' })).toBeDisabled();
    expect(screen.getByText('Schedule, Assign technicians: the advance is not paid yet.')).toBeInTheDocument();
    expect(screen.getByText(/Waiting for the customer’s advance/)).toBeInTheDocument();
  });

  it('a manager overrides with a reason — required — and the override is sent', async () => {
    const user = userEvent.setup();
    const overridden = {
      ...BOQ_JOB,
      advance: { ...ADVANCE, overridden: true, awaitingAdvance: false, override: { by: { id: 'u-m', name: 'Maya Manager' }, reason: 'ग्राहकले नगद तिर्नुभयो', at: '2026-09-28T05:00:00.000Z' } },
    };
    let done = false;
    const { calls, store } = renderJob('MANAGER', {
      handler: ({ method, path }) => {
        if (method === 'POST' && path === '/admin/jobs/j9/advance-override') {
          done = true;
          return json({ data: overridden });
        }
        if (path === '/admin/jobs/j9' && done) return json({ data: overridden });
        return undefined;
      },
    });
    await user.click(await screen.findByRole('button', { name: /Override/ }));
    const dialog = await screen.findByRole('dialog', { name: 'Override the advance on JOB-2083-0090' });
    expect(within(dialog).getByText(/before INV-2083-0077 is paid/)).toBeInTheDocument();

    // No reason, no request.
    await user.click(within(dialog).getByRole('button', { name: 'Override the advance' }));
    expect(await within(dialog).findByText('Say why, in at least 5 characters')).toBeInTheDocument();
    expect(calls.some((c) => c.method === 'POST')).toBe(false);

    await user.type(within(dialog).getByLabelText(/Why may it go ahead unpaid/), 'ग्राहकले नगद तिर्नुभयो');
    await user.click(within(dialog).getByRole('button', { name: 'Override the advance' }));
    await waitFor(() => expect(calls.find((c) => c.method === 'POST')?.body).toEqual({ reason: 'ग्राहकले नगद तिर्नुभयो' }));
    await waitFor(() => expect(toastTitles(store)).toContain('JOB-2083-0090 may go ahead'));

    // The card follows the server: overridden, by whom and why; the chip is gone.
    expect(await screen.findByTestId('advance-override')).toHaveTextContent('Overridden by Maya Manager');
    expect(screen.getByTestId('advance-override')).toHaveTextContent('“ग्राहकले नगद तिर्नुभयो”');
    expect(screen.queryByTestId('awaiting-advance')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Override/ })).not.toBeInTheDocument();
  });

  it('an admin sees the invoice as a link, and the override too', async () => {
    renderJob('ADMIN');
    const card = await screen.findByTestId('advance-card');
    expect(within(card).getByRole('link', { name: 'INV-2083-0077' })).toHaveAttribute('href', '/admin/invoices/inv-adv');
    expect(within(card).getByRole('button', { name: /Override/ })).toBeInTheDocument();
  });

  it('a paid advance frees the job: no chip, the card says so, Schedule is open', async () => {
    const paid = { ...BOQ_JOB, advance: { ...ADVANCE, paid: true, awaitingAdvance: false, invoice: { ...ADVANCE.invoice, status: 'PAID', paidAmount: 4_118_850, balance: 0 } } };
    renderJob('DISPATCHER', { job: paid });
    const card = await screen.findByTestId('advance-card');
    expect(card).toHaveAttribute('data-state', 'paid');
    expect(within(card).getByTestId('advance-balance')).toHaveTextContent('Rs. 0.00');
    expect(screen.queryByTestId('awaiting-advance')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Schedule…' })).toBeEnabled();
  });

  it('a job with no advance has no card and no chip', async () => {
    renderJob('DISPATCHER', { job: PLAIN_JOB });
    await screen.findByRole('heading', { name: /JOB-2083-0042/ });
    expect(screen.queryByTestId('advance-card')).not.toBeInTheDocument();
    expect(screen.queryByTestId('awaiting-advance')).not.toBeInTheDocument();
  });
});

describe('the Plan tab (Phase L6.4)', () => {
  it('is there on a BOQ job only', async () => {
    const first = renderJob('SALES', { job: PLAIN_JOB });
    await screen.findByRole('heading', { name: /JOB-2083-0042/ });
    expect(screen.queryByRole('tab', { name: /Plan/ })).not.toBeInTheDocument();
    // Asked for by address, a job without lines falls back to the Overview.
    first.unmount();
    renderJob('SALES', { job: PLAIN_JOB, tab: '?tab=plan' });
    await screen.findByRole('heading', { name: /JOB-2083-0042/ });
    expect(screen.getByRole('tab', { name: 'Overview' })).toHaveAttribute('aria-selected', 'true');
  });

  it('lays out the hand-off: readiness, the advance, the BOQ by section, materials with the shortfall highlighted', async () => {
    const user = userEvent.setup();
    const { calls } = renderJob('SALES', { tab: '?tab=plan' });
    expect(screen.queryByRole('tab', { name: /Costing/ })).not.toBeInTheDocument();
    const plan = await screen.findByTestId('job-plan');
    expect(screen.getByRole('tab', { name: /Plan/ })).toHaveTextContent('(3)');
    expect(calls.some((c) => c.path === '/admin/jobs/j9/plan')).toBe(true);

    // The checklist, from the server's readiness.
    expect(within(plan).getByText('2 of 6 ready')).toBeInTheDocument();
    expect(within(plan).getByTestId('ready-advance')).toHaveAttribute('data-done', 'false');
    expect(within(plan).getByTestId('ready-advance')).toHaveTextContent('Waiting — invoice INV-2083-0077');
    expect(within(plan).getByTestId('ready-boq')).toHaveAttribute('data-done', 'true');

    // The BOQ, grouped by section; a section opens to its lines.
    expect(within(plan).getByText('3 lines from the accepted quotation, in 2 sections. Open a section for its lines.')).toBeInTheDocument();
    expect(within(plan).queryByText('Drain chamber')).not.toBeInTheDocument();
    await user.click(within(plan).getByRole('button', { name: 'Show details of Waterproofing' }));
    expect(within(plan).getByText('Drain chamber').closest('tr')).toHaveTextContent('Provisional');
    expect(within(plan).getByText('240 sq.ft')).toBeInTheDocument();

    // Materials against stock: the short one is flagged with how much, the other is in stock. No rates anywhere.
    const materials = within(plan).getByRole('region', { name: /Materials needed vs stock/ });
    expect(within(materials).getByText('1 short')).toBeInTheDocument();
    const slurry = within(materials).getByRole('row', { name: /Crystalline slurry/ });
    expect(slurry).toHaveTextContent('120 kg');
    expect(slurry).toHaveTextContent('5 bag');
    expect(slurry).toHaveTextContent('50 kg');
    expect(within(slurry).getByTestId('shortfall-mat1')).toHaveTextContent('Short 70 kg');
    expect(within(slurry).getByTestId('shortfall-mat1').closest('.surface-warning')).not.toBeNull();
    expect(within(materials).getByRole('row', { name: /Exterior emulsion/ })).toHaveTextContent('In stock');
    // Quantities only (L-D4): no line's rate, no material's price — the one amount is the advance still owed.
    expect(materials).not.toHaveTextContent('Rs.');
    expect(within(plan).getByRole('region', { name: /Bill of quantities imported/ })).not.toHaveTextContent('Rs.');
    expect(within(plan).getByRole('region', { name: /Crew plan/ })).not.toHaveTextContent('Rs.');
    expect(within(plan).getByRole('region', { name: 'Advance' })).toHaveTextContent('Rs. 41,188.50');
  });

  it('the crew calculator divides the labour days by the crew and rounds up, against the planned days; the foreman is the lead', async () => {
    const user = userEvent.setup();
    renderJob('DISPATCHER', { tab: '?tab=plan' });
    await screen.findByTestId('job-plan');
    // Nobody assigned yet: a crew of two. 12.5 days ÷ 2 = 6.25 → 7 days.
    const size = screen.getByLabelText('Crew size');
    expect(size).toHaveValue(2);
    expect(screen.getByTestId('crew-duration')).toHaveTextContent('7 days');
    expect(screen.getByTestId('crew-verdict')).toHaveTextContent('Fits the plan — 7 of 8 planned days.');
    expect(screen.getByTestId('crew-foreman')).toHaveTextContent('No foreman yet');

    await user.clear(size);
    await user.type(size, '3');
    expect(screen.getByTestId('crew-duration')).toHaveTextContent('5 days'); // 4.17 → 5

    await user.clear(size);
    await user.type(size, '1');
    expect(screen.getByTestId('crew-duration')).toHaveTextContent('13 days'); // 12.5 → 13
    expect(screen.getByTestId('crew-verdict')).toHaveTextContent('5 days over the 8 planned days');
  });

  it('starts the crew at the people assigned, and names the lead as foreman', async () => {
    const crewed = {
      ...PLAN,
      crew: { size: 3, lead: { technicianId: 't-hari', name: 'Hari KC' }, technicians: [{ technicianId: 't-hari', name: 'Hari KC', isLead: true }, { technicianId: 't2', name: 'सुरेश', isLead: false }, { technicianId: 't3', name: 'Ram', isLead: false }] },
    };
    renderJob('DISPATCHER', { tab: '?tab=plan', handler: ({ path }) => (path === '/admin/jobs/j9/plan' ? json({ data: crewed }) : undefined) });
    await screen.findByTestId('job-plan');
    expect(screen.getByLabelText('Crew size')).toHaveValue(3);
    expect(screen.getByTestId('crew-duration')).toHaveTextContent('5 days');
    expect(screen.getByTestId('crew-foreman')).toHaveTextContent('Foreman: Hari KC');
    expect(screen.getByText(/On the job: Hari KC \(lead\), सुरेश, Ram/)).toBeInTheDocument();
  });
});

describe('the Schedule dialog and the gate (Phase L6.3)', () => {
  /** A queue row the board fetched before the advance was raised — it does not know the job is held. */
  const ROW = {
    id: 'j9', number: 'JOB-2083-0090', title: 'Terrace waterproofing', type: 'RENOVATION', status: 'DRAFT', priority: 'NORMAL',
    scheduledStart: null, scheduledEnd: null, plannedDays: 8, customer: CUSTOMER, site: null, assignments: [],
    awaitingAdvance: false, advanceInvoice: null,
  };
  const refusal = () => json({
    error: {
      code: 'ADVANCE_UNPAID',
      message: 'Job JOB-2083-0090 waits for its advance: invoice INV-2083-0077, Rs. 41,188.50 still to pay. Record the payment on the invoice, or a manager can override.',
      details: { invoiceId: 'inv-adv', invoiceNumber: 'INV-2083-0077', balance: 4_118_850 },
    },
  }, 422);

  const openDialog = (role, job = ROW) => {
    const calls = mockApi(({ method, path }) => {
      if (path === '/admin/technicians') return page([HARI]);
      if (method === 'POST' && path === '/admin/jobs/j9/schedule') return refusal();
      return undefined;
    });
    const onOpenChange = vi.fn();
    const view = renderWithProviders(<ScheduleJobDialog job={job} onOpenChange={onOpenChange} />, { preloadedState: signedInAs(role) });
    return { calls, onOpenChange, ...view };
  };

  it('prefills the end from the job’s planned days, and says so', async () => {
    openDialog('ADMIN');
    const dialog = await screen.findByRole('dialog', { name: 'Schedule JOB-2083-0090' });
    expect(within(dialog).getByText('From the plan: 8 days after the start. Clear it and the end is worked out from the start the same way.')).toBeInTheDocument();
    expect(within(dialog).getByLabelText('Starts — time')).toHaveValue('10:00');
    expect(within(dialog).getByLabelText('Ends — time')).toHaveValue('10:00');
  });

  it('maps a 422 ADVANCE_UNPAID in place: the server’s words, the invoice, what is owed — and the override for an admin', async () => {
    const user = userEvent.setup();
    const { calls, onOpenChange } = openDialog('ADMIN');
    const dialog = await screen.findByRole('dialog', { name: 'Schedule JOB-2083-0090' });
    expect(within(dialog).queryByTestId('advance-notice')).not.toBeInTheDocument();
    await user.click(await within(dialog).findByRole('checkbox', { name: /Hari KC/ }));
    await user.click(within(dialog).getByRole('button', { name: 'Schedule' }));

    const notice = await within(dialog).findByTestId('advance-notice');
    expect(notice).toHaveTextContent('Waiting for the advance — scheduling is locked');
    expect(notice).toHaveTextContent('Record the payment on the invoice, or a manager can override.');
    expect(notice).toHaveTextContent('Rs. 41,188.50 to pay');
    expect(within(notice).getByRole('link', { name: 'INV-2083-0077' })).toHaveAttribute('href', '/admin/invoices/inv-adv');
    expect(within(notice).getByRole('button', { name: /Override/ })).toBeInTheDocument();
    // It stayed open, and the request carried the planned end.
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
    const sent = calls.find((c) => c.method === 'POST').body;
    expect(new Date(sent.scheduledEnd) - new Date(sent.scheduledStart)).toBe(8 * 86_400_000);
  });

  it('tells a dispatcher the same, with the invoice’s number and no override', async () => {
    const user = userEvent.setup();
    openDialog('DISPATCHER');
    const dialog = await screen.findByRole('dialog', { name: 'Schedule JOB-2083-0090' });
    await user.click(await within(dialog).findByRole('checkbox', { name: /Hari KC/ }));
    await user.click(within(dialog).getByRole('button', { name: 'Schedule' }));
    const notice = await within(dialog).findByTestId('advance-notice');
    expect(within(notice).getByText('INV-2083-0077')).toBeInTheDocument();
    expect(within(notice).queryByRole('link')).not.toBeInTheDocument();
    expect(within(notice).queryByRole('button', { name: /Override/ })).not.toBeInTheDocument();
  });

  it('says so up front when the row already knows the job is held', async () => {
    openDialog('DISPATCHER', { ...ROW, awaitingAdvance: true, advanceInvoice: { id: 'inv-adv', number: 'INV-2083-0077', status: 'SENT' } });
    const notice = await screen.findByTestId('advance-notice');
    expect(notice).toHaveTextContent('can be scheduled once the customer pays the advance');
    expect(notice).toHaveTextContent('INV-2083-0077');
  });
});

describe('"Awaiting advance" on the lists (Phase L6.3)', () => {
  const held = {
    id: 'j9', number: 'JOB-2083-0090', title: 'Terrace waterproofing', type: 'RENOVATION', status: 'DRAFT', priority: 'NORMAL',
    scheduledStart: null, scheduledEnd: null, customer: CUSTOMER, site: { area: 'Lalitpur' }, assignments: [],
    awaitingAdvance: true, advanceInvoice: { id: 'inv-adv', number: 'INV-2083-0077', status: 'SENT' },
  };
  const free = { ...held, id: 'j8', number: 'JOB-2083-0089', awaitingAdvance: false, advanceInvoice: { id: 'inv-8', number: 'INV-2083-0070', status: 'PAID' } };

  it('the unassigned queue: the held job wears the chip and cannot be dragged, but still has Schedule…', async () => {
    mockApi(({ path }) => (path === '/admin/dispatch/unassigned' ? page([held, free]) : undefined));
    renderWithProviders(
      <DndContext><UnassignedQueue unscheduledAssigned={[]} onSchedule={() => {}} pending={{}} /></DndContext>,
      { preloadedState: signedInAs('DISPATCHER') },
    );
    const chip = await screen.findByTestId('awaiting-advance');
    expect(chip.closest('article')).toHaveTextContent('JOB-2083-0090');
    expect(chip.closest('[title]')).toHaveAttribute('title', 'Scheduling is locked until the advance (INV-2083-0077) is paid');
    expect(screen.getAllByTestId('awaiting-advance')).toHaveLength(1);
    expect(screen.queryByRole('button', { name: 'Drag JOB-2083-0090' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Schedule JOB-2083-0090' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Drag JOB-2083-0089' })).toBeInTheDocument();
  });

  it('the jobs list: the chip sits in the status column', async () => {
    mockApi(({ path }) => (path === '/admin/jobs' ? page([{ ...held, tasks: [] }, { ...free, tasks: [] }]) : undefined));
    renderWithProviders(<JobsPage />, { path: '/admin/jobs', preloadedState: signedInAs('DISPATCHER') });
    const chip = await screen.findByTestId('awaiting-advance');
    expect(chip.closest('tr')).toHaveTextContent('JOB-2083-0090');
    expect(chip.closest('td')).toHaveTextContent('Not scheduled');
    expect(screen.getAllByTestId('awaiting-advance')).toHaveLength(1);
  });
});

describe('invoices know their kind (Phase L6)', () => {
  const ADVANCE_INVOICE = {
    id: 'inv-adv', number: 'INV-2083-0077', status: 'SENT', kind: 'ADVANCE', jobId: 'j9',
    job: { id: 'j9', number: 'JOB-2083-0090' },
    paymentStage: { id: 'st1', label: 'Advance', basisPoints: 5000, trigger: 'ON_ACCEPT' },
    customer: CUSTOMER, issuedAt: '2026-09-27T04:00:00.000Z', dueDate: '2026-10-04T18:15:00.000Z',
    subtotal: 3_645_000, discount: 0, vatApplied: true, vatRate: 13, vatAmount: 473_850, total: 4_118_850, paidAmount: 0, balance: 4_118_850,
    items: [{ id: 'it1', description: 'Advance — 50% of quotation QT-2083-0031', unit: null, qty: 1, rate: 3_645_000, amount: 3_645_000, jobId: 'j9' }],
    payments: [], jobs: [], quotation: { id: 'q9', number: 'QT-2083-0031' },
    publicToken: 'adv-tok', publicUrl: 'http://localhost:5400/invoice/adv-tok', note: null, terms: null, voidReason: null,
  };

  it('the detail wears "Advance", links its job and names the stage', async () => {
    mockApi(({ path }) => (path === '/admin/invoices/inv-adv' ? json({ data: ADVANCE_INVOICE }) : undefined));
    renderWithProviders(<InvoiceDetailPage />, {
      path: '/admin/invoices/:id', initialPath: '/admin/invoices/inv-adv', preloadedState: signedInAs('ACCOUNTANT'),
    });
    expect(await screen.findByTestId('invoice-kind')).toHaveTextContent('Advance');
    expect(screen.getByRole('link', { name: 'JOB-2083-0090' })).toHaveAttribute('href', '/admin/jobs/j9');
    expect(screen.getByTestId('invoice-stage')).toHaveTextContent('Advance — on acceptance (50%)');
    expect(within(screen.getByTestId('invoice-document')).getByTestId('invoice-stage-line')).toHaveTextContent('Advance — on acceptance (50%)');
  });

  it('the list filters by kind and badges an advance', async () => {
    const user = userEvent.setup();
    const standard = { ...ADVANCE_INVOICE, id: 'inv-1', number: 'INV-2083-0042', kind: 'STANDARD', paymentStage: null, job: null };
    const calls = mockApi(({ path }) => (path === '/admin/invoices' ? json({ data: [ADVANCE_INVOICE, standard], meta: { page: 1, limit: 20, total: 2, pages: 1, counts: {} } }) : undefined));
    const { router } = renderWithProviders(<InvoicesPage />, { path: '/admin/invoices', preloadedState: signedInAs('ACCOUNTANT') });
    const badge = await screen.findByTestId('invoice-kind');
    expect(badge.closest('tr')).toHaveTextContent('INV-2083-0077');
    expect(screen.getAllByTestId('invoice-kind')).toHaveLength(1);

    await user.click(screen.getByRole('combobox', { name: /Kind/ }));
    await user.click(await screen.findByRole('option', { name: 'Advance' }));
    await waitFor(() => expect(calls.filter((c) => c.path === '/admin/invoices').at(-1).query).toMatchObject({ kind: 'ADVANCE' }));
    expect(router.state.location.search).toContain('kind=ADVANCE');
  });

  it('the customer’s page says which stage it is, from the public answer’s paymentStage', async () => {
    mockApi(({ path }) => (path === '/public/invoices/adv-tok' ? json({ data: ADVANCE_INVOICE }) : undefined));
    renderWithProviders(<InvoicePublicPage />, { path: '/invoice/:token', initialPath: '/invoice/adv-tok' });
    // The default schedule's stage is called "Advance": not repeated, the trigger says when instead.
    expect(await screen.findByTestId('invoice-stage-line')).toHaveTextContent('Advance — on acceptance (50%)');
  });

  it('the customer’s page names a stage by its own label and share', async () => {
    // What GET /public/invoices/:token answers: the invoice's scalars and its paymentStage — no job, no office fields.
    const pub = {
      number: 'INV-2083-0078', status: 'SENT', kind: 'ADVANCE', paymentStageId: 'st2',
      paymentStage: { label: 'Mobilisation', basisPoints: 4000, trigger: 'ON_ACCEPT' },
      customer: { name: CUSTOMER.name, phone: CUSTOMER.phone, panVatNo: null },
      issuedAt: '2026-09-27T04:00:00.000Z', dueDate: '2026-10-04T18:15:00.000Z',
      subtotal: 2_916_000, discount: 0, vatApplied: true, vatRate: 13, vatAmount: 379_080, total: 3_295_080, paidAmount: 0, balance: 3_295_080,
      items: [{ id: 'it1', description: 'Mobilisation — 40% of quotation QT-2083-0032', unit: null, qty: 1, rate: 2_916_000, amount: 2_916_000 }],
      payments: [], terms: null, voidReason: null,
    };
    mockApi(({ path }) => (path === '/public/invoices/mob-tok' ? json({ data: pub }) : undefined));
    renderWithProviders(<InvoicePublicPage />, { path: '/invoice/:token', initialPath: '/invoice/mob-tok' });
    expect(await screen.findByTestId('invoice-stage-line')).toHaveTextContent('Advance — Mobilisation (40%)');
    expect(screen.getByTestId('invoice-document')).toHaveTextContent('Rs. 32,950.80');
  });

  it('a final bill’s "Less: advance" line reads as a deduction, never "Rs. -"', async () => {
    const final = {
      ...ADVANCE_INVOICE, id: 'inv-f', number: 'INV-2083-0101', kind: 'FINAL', paymentStage: null, status: 'SENT',
      items: [
        { id: 'f1', description: 'Crystalline slurry, two coats', unit: 'sq.ft', qty: 240, rate: 22_000, amount: 5_280_000, jobId: 'j9' },
        { id: 'f2', description: 'Less: advance INV-2083-0077', unit: null, qty: 1, rate: -3_645_000, amount: -3_645_000, jobId: 'j9' },
      ],
    };
    mockApi(({ path }) => (path === '/admin/invoices/inv-f' ? json({ data: final }) : undefined));
    renderWithProviders(<InvoiceDetailPage />, { path: '/admin/invoices/:id', initialPath: '/admin/invoices/inv-f', preloadedState: signedInAs('ACCOUNTANT') });
    const doc = await screen.findByTestId('invoice-document');
    const row = within(doc).getByRole('row', { name: /Less: advance INV-2083-0077/ });
    expect(within(row).getAllByText('− Rs. 36,450.00')).toHaveLength(2);
    expect(doc).not.toHaveTextContent(/Rs\. -|-Rs\.|−\s*Rs\. -/);
    expect(screen.getByTestId('invoice-kind')).toHaveTextContent('Final bill');
  });
});

describe('a stage or closing bill’s draft has locked lines (Phase L6)', () => {
  /** The server's FINAL draft: the quotation's line, less the advance already billed — a negative line. */
  const FINAL_DRAFT = {
    id: 'inv-f', number: 'INV-2083-0101', status: 'DRAFT', kind: 'FINAL', jobId: 'j9', job: { id: 'j9', number: 'JOB-2083-0090' },
    paymentStage: null, customer: CUSTOMER, issuedAt: '2026-10-20T04:00:00.000Z', dueDate: '2026-11-03T18:15:00.000Z',
    subtotal: 1_635_000, discount: 0, vatApplied: true, vatRate: 13, vatAmount: 212_550, total: 1_847_550, paidAmount: 0, balance: 1_847_550,
    items: [
      { id: 'f1', description: 'Crystalline slurry, two coats', unit: 'sq.ft', qty: 240, rate: 22_000, amount: 5_280_000, jobId: 'j9' },
      { id: 'f2', description: 'Less: advance INV-2083-0077', unit: null, qty: 1, rate: -3_645_000, amount: -3_645_000, jobId: 'j9' },
    ],
    payments: [], jobs: [], quotation: { id: 'q9', number: 'QT-2083-0031' },
    publicToken: null, publicUrl: null, note: null, terms: 'Payable within 15 days.', voidReason: null,
  };

  const openDraft = (record, put) => {
    const calls = mockApi(({ method, path }) => {
      if (method === 'PUT' && path === `/admin/invoices/${record.id}`) return put();
      if (path === `/admin/invoices/${record.id}`) return json({ data: record });
      return undefined;
    });
    const view = renderWithProviders(<InvoiceDetailPage />, {
      path: '/admin/invoices/:id', initialPath: `/admin/invoices/${record.id}`, preloadedState: signedInAs('ACCOUNTANT'),
    });
    return { calls, ...view };
  };

  it('shows the lines, discount and VAT read-only — the deduction as "− Rs." — and saves only the due date, note and terms', async () => {
    const user = userEvent.setup();
    const { calls, store } = openDraft(FINAL_DRAFT, () => json({ data: { ...FINAL_DRAFT, note: 'दाबी पछि पठाउने' } }));
    expect(await screen.findByRole('tab', { name: 'Edit', selected: true })).toBeInTheDocument();
    const fixed = screen.getByTestId('locked-lines');
    expect(fixed).toHaveTextContent('A final bill is the quotation less the advance and running bills already billed.');
    const deduction = within(fixed).getByRole('row', { name: /Less: advance INV-2083-0077/ });
    expect(within(deduction).getAllByText('− Rs. 36,450.00')).toHaveLength(2);
    expect(fixed).not.toHaveTextContent(/Rs\. -/);
    expect(within(fixed).getByText('VAT (13%)').parentElement).toHaveTextContent('Rs. 2,125.50');
    expect(within(fixed).getByText('Total').parentElement).toHaveTextContent('Rs. 18,475.50');
    // No lines grid, no discount, no VAT switch: only the header is a form.
    expect(screen.queryByRole('grid', { name: 'Invoice lines' })).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/^Discount/)).not.toBeInTheDocument();
    expect(screen.queryByRole('switch', { name: /Charge VAT/ })).not.toBeInTheDocument();

    await user.type(screen.getByLabelText(/Note \(office only\)/), 'दाबी पछि पठाउने');
    await user.click(screen.getByRole('button', { name: 'Save draft' }));
    await waitFor(() => expect(calls.find((c) => c.method === 'PUT')).toBeTruthy());
    const { body } = calls.find((c) => c.method === 'PUT');
    expect(body).toEqual({ dueDate: FINAL_DRAFT.dueDate, note: 'दाबी पछि पठाउने', terms: 'Payable within 15 days.' });
    await waitFor(() => expect(toastTitles(store)).toContain('INV-2083-0101 saved'));
  });

  it('tells a 422 INVOICE_LINES_LOCKED in plain words', async () => {
    const user = userEvent.setup();
    openDraft({ ...FINAL_DRAFT, kind: 'ADVANCE', paymentStage: { id: 'st1', label: 'Advance', basisPoints: 5000, trigger: 'ON_ACCEPT' } }, () => json({
      error: { code: 'INVOICE_LINES_LOCKED', message: 'The lines of advance invoice INV-2083-0101 come from the quotation and its stage bills.' },
    }, 422));
    expect(await screen.findByTestId('locked-lines')).toHaveTextContent('An advance invoice bills the “on acceptance” stage');
    await user.click(screen.getByRole('button', { name: 'Save draft' }));
    expect(await screen.findByText(INVOICE_LINES_LOCKED_MESSAGE)).toBeInTheDocument();
  });

  it('a STANDARD draft is edited as before — its lines grid, discount and VAT', async () => {
    openDraft({ ...FINAL_DRAFT, kind: 'STANDARD', job: null, items: FINAL_DRAFT.items.slice(0, 1) }, () => json({ data: FINAL_DRAFT }));
    expect(await screen.findByRole('grid', { name: 'Invoice lines' })).toBeInTheDocument();
    expect(screen.getByRole('switch', { name: /Charge VAT/ })).toBeInTheDocument();
    expect(screen.queryByTestId('locked-lines')).not.toBeInTheDocument();
  });
});

describe('services carry their job type (Phase L6)', () => {
  it('the registry entry has a jobType select with every type in words, REPAIR by default', () => {
    const field = services.fields.find((f) => f.name === 'jobType');
    expect(field).toMatchObject({ type: 'select', required: true });
    expect(field.options).toEqual(JOB_TYPES.map((t) => ({ value: t, label: JOB_TYPE_LABELS[t] })));
    expect(services.defaultValues.jobType).toBe('REPAIR');
    const base = { name: 'Seepage treatment', slug: 'seepage-treatment', excerpt: 'Damp walls treated at the source with crystalline slurry and a new plinth DPC.' };
    expect(serviceSchema.parse(base).jobType).toBe('REPAIR');
    expect(serviceSchema.parse({ ...base, jobType: 'RENOVATION' }).jobType).toBe('RENOVATION');
    expect(serviceSchema.safeParse({ ...base, jobType: 'BUILD' }).success).toBe(false);
  });

  it('the service form sends the chosen job type', async () => {
    const user = userEvent.setup();
    const saved = {
      id: 'sv1', name: 'Seepage treatment', slug: 'seepage-treatment', type: 'standard', jobType: 'REPAIR', isActive: true, isFeatured: false,
      excerpt: 'Damp walls treated at the source with crystalline slurry and a new plinth DPC.', sortOrder: 0,
    };
    const calls = mockApi(({ method, path }) => {
      if (path === '/admin/services/sv1' && method === 'GET') return json({ data: saved });
      if (path === '/admin/services/sv1' && method === 'PUT') return json({ data: { ...saved, jobType: 'RENOVATION' } });
      return undefined;
    });
    renderWithProviders(
      <Routes><Route path="/admin/content/:resource/:id" element={<ResourceEditPage />} /></Routes>,
      { path: '*', initialPath: '/admin/content/services/sv1', preloadedState: signedInAs('EDITOR') },
    );
    const select = await screen.findByRole('combobox', { name: /Job type when won/ });
    expect(select).toHaveTextContent('Repair');
    await user.click(select);
    await user.click(await screen.findByRole('option', { name: 'Renovation' }));
    await user.click(screen.getByRole('button', { name: 'Save changes' }));
    await waitFor(() => expect(calls.find((c) => c.method === 'PUT')?.body).toMatchObject({ jobType: 'RENOVATION' }));
  });
});
