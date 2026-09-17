import { afterEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router-dom';
import JobsPage from '@/pages/admin/JobsPage';
import JobDetailPage from '@/pages/admin/JobDetailPage/JobDetailPage';
import DispatchBoardPage from '@/pages/admin/DispatchBoardPage/DispatchBoardPage';
import StockPage from '@/pages/admin/StockPage';
import ResourceListPage from '@/pages/admin/ResourceListPage';
import ResourceEditPage from '@/pages/admin/ResourceEditPage';
import { renderWithProviders, signedInAs } from '@/test/renderWithProviders';
import { json, mockApi, page } from '@/test/mockApi';
import { ktmDay } from '@/helpers/dispatchBoard';

afterEach(() => vi.unstubAllGlobals());

const toastTitles = (store) => store.getState().ui.toasts.map((t) => t.title);
const today = ktmDay();
/** An instant on a Kathmandu day at a Kathmandu time. */
const at = (day, hhmm) => new Date(`${day}T${hhmm}:00+05:45`).toISOString();

const HARI = { id: 't-hari', employeeCode: 'T-001', skills: ['waterproofing'], serviceAreas: ['ललितपुर'], dailyCapacity: 2, isAvailable: true, rating: 4.5, ratingCount: 2, loadThisWeek: 3, user: { id: 'u-hari', name: 'Hari KC', phone: '9808338255', role: 'TECHNICIAN', isActive: true, email: 'hari@gharjatan.com.np' } };
const CUSTOMER = { id: 'c1', name: 'सीता राई', phone: '9841234567', email: 'sita@example.com', preferredLocale: 'ne' };

const JOB = {
  id: 'j1', number: 'JOB-2083-0042', title: 'Terrace waterproofing', type: 'REPAIR', status: 'IN_PROGRESS', priority: 'HIGH',
  isBillable: true, invoicedAt: null, createdAt: '2026-09-15T04:00:00.000Z',
  scheduledStart: at(today, '10:00'), scheduledEnd: at(today, '12:00'), actualStart: at(today, '10:05'), actualEnd: null,
  customer: CUSTOMER,
  site: { id: 's1', label: 'Home', address: 'झम्सिखेल', area: 'Lalitpur', lat: 27.68, lng: 85.31, accessNotes: 'Gate code 4' },
  quotation: { id: 'q1', number: 'QT-2083-0007', total: 4520000, status: 'CONVERTED' },
  lead: null, survey: null, project: null, parentJob: null, childJobs: [], createdBy: { id: 'u1', name: 'Asha' }, warranty: null,
  assignments: [{ id: 'a1', technicianId: 't-hari', isLead: true, technician: { ...HARI } }],
  tasks: [
    { id: 'k1', title: 'Photograph before', isDone: true, isSkipped: false, doneAt: at(today, '10:10') },
    { id: 'k2', title: 'Apply membrane', isDone: false, isSkipped: false, note: 'दुई कोट' },
  ],
  photos: [{ id: 'p1', mediaId: 'm1', kind: 'BEFORE', caption: 'Crack', createdAt: at(today, '10:10') }],
  materials: [{ id: 'jm1', qty: 22, rate: 2001, isBillable: true, createdAt: at(today, '10:20'), material: { id: 'mat1', code: 'WP-CRYST', name: 'Crystalline slurry', unit: 'kg' } }],
  timeLogs: [{ id: 'tl1', startedAt: at(today, '10:05'), endedAt: at(today, '11:00'), minutes: 55, note: null, technician: { user: { id: 'u-hari', name: 'Hari KC' } } }],
  events: [
    { id: 'e2', from: 'EN_ROUTE', to: 'IN_PROGRESS', note: 'Started', lat: 27.6801, lng: 85.3102, createdAt: at(today, '10:05'), actor: { id: 'u-hari', name: 'Hari KC' } },
    { id: 'e1', from: null, to: 'DRAFT', note: 'Job created', lat: null, lng: null, createdAt: '2026-09-15T04:00:00.000Z', actor: null },
  ],
};

const COSTING = {
  jobId: 'j1', number: JOB.number,
  cost: { materials: 27170, labour: 30555, expenses: 0, total: 57725 },
  labourMinutes: 55,
  billable: { materials: 44022, invoiced: 0 },
  margin: -57725, marginPct: null,
  breakdown: {
    materials: [{ name: 'Crystalline slurry', code: 'WP-CRYST', unit: 'kg', qty: 22, rate: 2001, amount: 44022, cost: 27170, isBillable: true }],
    labour: [{ technician: 'Hari KC', startedAt: at(today, '10:05'), minutes: 55, cost: 30555 }],
    expenses: [], invoices: [],
  },
};

describe('JobsPage', () => {
  it('lists jobs with Nepali names and applies the presets to the query', async () => {
    const user = userEvent.setup();
    const draft = { ...JOB, id: 'j2', number: 'JOB-2083-0043', status: 'DRAFT', scheduledStart: null, scheduledEnd: null, assignments: [] };
    const calls = mockApi(({ path }) => (path === '/admin/jobs' ? page([JOB, draft]) : undefined));
    const { router } = renderWithProviders(<JobsPage />, { path: '/admin/jobs', preloadedState: signedInAs('DISPATCHER') });

    expect(await screen.findByText('JOB-2083-0042')).toBeInTheDocument();
    expect(screen.getAllByText('सीता राई')).toHaveLength(2);
    expect(screen.getAllByRole('link', { name: '9841234567' })[0]).toHaveAttribute('href', 'tel:9841234567');
    expect(screen.getByText('In progress')).toBeInTheDocument();
    expect(screen.getByText('Not scheduled')).toBeInTheDocument();
    expect(screen.getByText('No date yet')).toBeInTheDocument();
    expect(screen.getByText('Nobody yet')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /New job/ })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Today' }));
    await waitFor(() => expect(calls.at(-1).query).toMatchObject({ from: today, to: today }));
    expect(screen.getByRole('button', { name: 'Today' })).toHaveAttribute('aria-pressed', 'true');

    await user.click(screen.getByRole('button', { name: 'Not invoiced' }));
    await waitFor(() => expect(calls.at(-1).query).toMatchObject({ invoiced: 'false' }));
    expect(calls.at(-1).query.from).toBeUndefined();
    expect(router.state.location.search).toContain('invoiced=false');
  });

  it('is read-only for SALES', async () => {
    mockApi(({ path }) => (path === '/admin/jobs' ? page([JOB]) : undefined));
    renderWithProviders(<JobsPage />, { path: '/admin/jobs', preloadedState: signedInAs('SALES') });
    await screen.findByText('JOB-2083-0042');
    expect(screen.queryByRole('button', { name: /New job/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Board/ })).not.toBeInTheDocument();
  });
});

describe('JobDetailPage', () => {
  const renderJob = (role, handler = () => undefined, tab = '') => {
    const calls = mockApi(async (call) => {
      const custom = await handler(call);
      if (custom) return custom;
      if (call.path === '/admin/jobs/j1') return json({ data: JOB });
      if (call.path === '/admin/jobs/j1/costing') return json({ data: COSTING });
      if (call.path === '/admin/materials') return page([{ id: 'mat1', code: 'WP-CRYST', name: 'Crystalline slurry', unit: 'kg' }]);
      if (call.path.startsWith('/admin/media/')) return json({ data: { id: 'm1', alt: 'Crack', mime: 'image/webp' } });
      return undefined;
    });
    const view = renderWithProviders(
      <Routes><Route path="/admin/jobs/:id" element={<JobDetailPage />} /></Routes>,
      { path: '*', initialPath: `/admin/jobs/j1${tab}`, preloadedState: signedInAs(role) },
    );
    return { calls, ...view };
  };

  it('offers what the state allows, and says why Complete is not open yet', async () => {
    renderJob('DISPATCHER');
    expect(await screen.findByRole('heading', { name: 'JOB-2083-0042 · Terrace waterproofing' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Complete…' })).toBeDisabled();
    expect(screen.getByText('Complete: 1 checklist item is still open.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Put on hold…' })).toBeEnabled();
    expect(screen.queryByRole('button', { name: /Schedule/ })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: /On the board/ })).toHaveAttribute('href', `/admin/dispatch?date=${today}`);

    // Overview: tap to call, the map, the quotation it came from.
    expect(screen.getByRole('link', { name: /9841234567/ })).toHaveAttribute('href', 'tel:9841234567');
    expect(screen.getByRole('link', { name: /Open in Maps/ })).toHaveAttribute('href', 'https://www.google.com/maps/search/?api=1&query=27.68,85.31');
    expect(screen.getByText('Messages in Nepali')).toBeInTheDocument();
    expect(screen.getByText('QT-2083-0007')).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /History/ })).toBeInTheDocument();
  });

  it('asks why before a hold and sends the note', async () => {
    const user = userEvent.setup();
    const { calls, store } = renderJob('DISPATCHER');
    await user.click(await screen.findByRole('button', { name: 'Put on hold…' }));
    const dialog = await screen.findByRole('dialog', { name: 'Put on hold JOB-2083-0042' });
    await user.click(within(dialog).getByRole('button', { name: 'Put on hold' }));
    expect(await within(dialog).findByText('Say why, in a few words')).toBeInTheDocument();
    await user.type(within(dialog).getByLabelText(/Why is it on hold/), 'ग्राहक बाहिर गएका');
    await user.click(within(dialog).getByRole('button', { name: 'Put on hold' }));
    await waitFor(() => expect(calls.find((c) => c.method === 'PATCH' && c.path === '/admin/jobs/j1/status')?.body)
      .toEqual({ status: 'ON_HOLD', note: 'ग्राहक बाहिर गएका' }));
    await waitFor(() => expect(toastTitles(store)).toContain('JOB-2083-0042: on hold'));
  });

  it('ticks the checklist', async () => {
    const user = userEvent.setup();
    const { calls } = renderJob('DISPATCHER', () => undefined, '?tab=checklist');
    expect(await screen.findByText('1 of 2 still open — the job cannot be completed until each is done or skipped.')).toBeInTheDocument();
    expect(screen.getByText('दुई कोट')).toBeInTheDocument();
    await user.click(screen.getByRole('checkbox', { name: 'Done: Apply membrane' }));
    await waitFor(() => expect(calls.find((c) => c.method === 'PATCH' && c.path === '/admin/jobs/j1/tasks/k2')?.body).toEqual({ isDone: true }));
  });

  it('issues material from stock with a billed rate in rupees', async () => {
    const user = userEvent.setup();
    const { calls, store } = renderJob('DISPATCHER', ({ method, path }) => (method === 'POST' && path === '/admin/jobs/j1/materials'
      ? json({ data: { id: 'jm2', qty: 22, rate: 123450, material: { id: 'mat1', code: 'WP-CRYST', name: 'Crystalline slurry', unit: 'kg' } } }, 201)
      : undefined), '?tab=materials');
    expect(await screen.findByText('22 kg')).toBeInTheDocument();
    expect(screen.getByText('Rs. 440.22')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Issue from stock/ }));
    const dialog = await screen.findByRole('dialog', { name: 'Issue material to JOB-2083-0042' });
    await user.click(within(dialog).getByRole('combobox', { name: /Material/ }));
    await user.click(await screen.findByRole('option', { name: 'WP-CRYST · Crystalline slurry (kg)' }));
    await user.type(within(dialog).getByLabelText(/Quantity/), '22');
    await user.type(within(dialog).getByLabelText(/Bill at/), '1,234.50');
    await user.click(within(dialog).getByRole('button', { name: 'Issue' }));

    await waitFor(() => expect(calls.find((c) => c.method === 'POST' && c.path === '/admin/jobs/j1/materials')?.body)
      .toEqual({ materialId: 'mat1', qty: 22, rate: 1234.5, isBillable: true }));
    await waitFor(() => expect(toastTitles(store)).toContain('22 kg of Crystalline slurry issued'));
  });

  it('shows costing to the paisa and the events with where they happened', async () => {
    const user = userEvent.setup();
    renderJob('DISPATCHER', () => undefined, '?tab=costing');
    expect(await screen.findByText('Rs. 577.25')).toBeInTheDocument();
    expect(screen.getAllByText('Rs. 305.55').length).toBeGreaterThanOrEqual(2);
    expect(screen.getAllByText('Rs. 271.70').length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText('Billable Rs. 440.22')).toBeInTheDocument();
    expect(screen.getByText('Rs. -577.25')).toHaveClass('text-destructive');
    expect(screen.getAllByText('55 min').length).toBeGreaterThanOrEqual(1);

    await user.click(screen.getByRole('tab', { name: 'Events' }));
    expect(await screen.findByRole('link', { name: /27\.6801, 85\.3102/ })).toHaveAttribute('href', 'https://www.google.com/maps/search/?api=1&query=27.6801,85.3102');
    expect(screen.getByText('System', { exact: false })).toBeInTheDocument();
  });

  it('records time for a technician on the job', async () => {
    const user = userEvent.setup();
    const { calls } = renderJob('DISPATCHER', ({ method, path }) => (method === 'POST' && path === '/admin/jobs/j1/time-logs'
      ? json({ data: { id: 'tl2', minutes: 90, technician: { user: { name: 'Hari KC' } } } }, 201)
      : undefined), '?tab=time');
    expect(await screen.findByText('Total recorded:')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Add time/ }));
    const dialog = await screen.findByRole('dialog', { name: 'Record time on JOB-2083-0042' });
    await user.type(within(dialog).getByLabelText(/Minutes worked/), '90');
    await user.click(within(dialog).getByRole('button', { name: 'Record time' }));
    await waitFor(() => expect(calls.find((c) => c.method === 'POST' && c.path === '/admin/jobs/j1/time-logs')?.body)
      .toMatchObject({ technicianId: 't-hari', startedAt: JOB.actualStart, minutes: 90 }));
  });

  it('gives SALES no actions and no History', async () => {
    renderJob('SALES');
    await screen.findByRole('heading', { name: /JOB-2083-0042/ });
    expect(screen.queryByRole('button', { name: /Complete|Put on hold|Schedule/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: /History/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Edit details/ })).not.toBeInTheDocument();
  });
});

describe('DispatchBoardPage', () => {
  const booked = {
    id: 'jA', number: 'JOB-2083-0050', title: 'Seepage', type: 'REPAIR', status: 'ASSIGNED', priority: 'NORMAL',
    scheduledStart: at(today, '10:00'), scheduledEnd: at(today, '12:00'),
    customer: { id: 'c2', name: 'Ram Thapa' }, site: { area: 'Baneshwor' }, assignments: [{ technicianId: 't-hari', isLead: true }],
  };
  const waiting = {
    id: 'jB', number: 'JOB-2083-0051', title: 'Terrace', type: 'REPAIR', status: 'DRAFT', priority: 'URGENT',
    scheduledStart: null, scheduledEnd: null, customer: CUSTOMER, site: null, assignments: [],
  };
  const board = (view = 'day') => ({
    view, days: [today], hours: { start: 8, end: 18 }, unassignedCount: 1, unscheduledAssigned: [],
    lanes: [{
      technician: { id: 't-hari', name: 'Hari KC', role: 'TECHNICIAN', employeeCode: 'T-001', skills: ['waterproofing'], serviceAreas: ['ललितपुर'], dailyCapacity: 2, isAvailable: true },
      jobs: [booked], loadByDay: { [today]: 1 }, overCapacityDays: [], conflicts: [],
    }],
  });

  const renderBoard = (handler = () => undefined) => {
    const calls = mockApi(async (call) => {
      const custom = await handler(call);
      if (custom) return custom;
      if (call.path === '/admin/dispatch/board') return json({ data: board(call.query.view) });
      if (call.path === '/admin/dispatch/unassigned') return page([waiting]);
      if (call.path === '/admin/technicians') return page([HARI]);
      return undefined;
    });
    return { calls, ...renderWithProviders(<DispatchBoardPage />, { path: '/admin/dispatch', preloadedState: signedInAs('DISPATCHER') }) };
  };

  it('draws the technicians, their load and the unassigned queue', async () => {
    const user = userEvent.setup();
    const { calls } = renderBoard();
    expect(await screen.findByRole('rowheader', { name: /Hari KC/ })).toHaveTextContent('1 / 2 today');
    expect(screen.getByRole('gridcell', { name: /Hari KC, .*10:00/ })).toHaveTextContent('JOB-2083-0050');
    expect(await screen.findByText('1 waiting')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Drag JOB-2083-0051' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Schedule JOB-2083-0051' })).toBeInTheDocument();

    await user.click(screen.getByRole('radio', { name: 'Week' }));
    await waitFor(() => expect(calls.filter((c) => c.path === '/admin/dispatch/board').at(-1).query).toMatchObject({ view: 'week', date: today }));
  });

  it('schedules from the dialog, warns about the clash first, and sends only when told to', async () => {
    const user = userEvent.setup();
    const { calls, store } = renderBoard(({ method, path }) => (method === 'POST' && path === '/admin/jobs/jB/schedule'
      ? json({ data: { ...waiting, status: 'ASSIGNED' }, meta: { warnings: [] } })
      : undefined));
    await user.click(await screen.findByRole('button', { name: 'Schedule JOB-2083-0051' }));
    const dialog = await screen.findByRole('dialog', { name: 'Schedule JOB-2083-0051' });
    await user.click(await within(dialog).findByRole('checkbox', { name: /Hari KC/ }));
    await user.click(within(dialog).getByRole('button', { name: 'Schedule' }));

    const warning = await screen.findByRole('alertdialog', { name: 'Schedule JOB-2083-0051 anyway?' });
    expect(within(warning).getByText(/Hari KC already has JOB-2083-0050 10:00–12:00/)).toBeInTheDocument();
    await user.click(within(warning).getByRole('button', { name: 'Go back' }));
    expect(await within(dialog).findByText(/Not scheduled yet/)).toBeInTheDocument();
    expect(calls.some((c) => c.path === '/admin/jobs/jB/schedule')).toBe(false);

    await user.click(within(dialog).getByRole('button', { name: 'Schedule' }));
    await user.click(await screen.findByRole('button', { name: 'Schedule anyway' }));
    await waitFor(() => expect(calls.find((c) => c.path === '/admin/jobs/jB/schedule')?.body).toEqual({
      scheduledStart: at(today, '10:00'), scheduledEnd: at(today, '12:00'), technicianIds: ['t-hari'], notifyCustomer: true,
    }));
    await waitFor(() => expect(toastTitles(store)).toContain('JOB-2083-0051 scheduled'));
  });

  it('filters the lanes by skill and area', async () => {
    const user = userEvent.setup();
    const { router } = renderBoard();
    await screen.findByRole('rowheader', { name: /Hari KC/ });
    await user.click(screen.getByRole('combobox', { name: 'Area' }));
    await user.click(await screen.findByRole('option', { name: 'ललितपुर' }));
    expect(router.state.location.search).toContain(encodeURIComponent('ललितपुर'));
    expect(screen.getByRole('rowheader', { name: /Hari KC/ })).toBeInTheDocument();
  });
});

describe('StockPage', () => {
  const ROW = {
    id: 'mat1', code: 'WP-CRYST', name: 'Crystalline slurry', unit: 'kg', balance: 6, reorderLevel: 10, isLow: true,
    stockValue: 7410, purchaseRate: 1235, category: { id: 'cat1', name: 'जलरोधक' },
  };

  it('shows the balance, the low flag and a material’s movements', async () => {
    const user = userEvent.setup();
    mockApi(({ path }) => {
      if (path === '/admin/stock') return json({ data: [ROW], meta: { page: 1, limit: 20, total: 1, pages: 1, lowCount: 1 } });
      if (path === '/admin/stock/movements') {
        return page([{ id: 'sm1', type: 'ISSUE_TO_JOB', qty: -22, rate: 2001, jobId: 'j1', job: { id: 'j1', number: 'JOB-2083-0042' }, actor: { name: 'Dipak' }, createdAt: at(today, '10:20'), material: { code: 'WP-CRYST', name: 'Crystalline slurry', unit: 'kg' } }]);
      }
      return undefined;
    });
    renderWithProviders(<StockPage />, { path: '/admin/stock', preloadedState: signedInAs('DISPATCHER') });
    expect(await screen.findByText('6 kg')).toBeInTheDocument();
    expect(screen.getByText('Low — reorder')).toBeInTheDocument();
    expect(screen.getByText('जलरोधक')).toBeInTheDocument();
    expect(screen.getByText('Rs. 74.10')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /1 material is at or below/ })).toBeInTheDocument();

    await user.click(screen.getByText('Crystalline slurry'));
    const sheet = await screen.findByRole('dialog', { name: 'WP-CRYST · Crystalline slurry' });
    expect(await within(sheet).findByText('−22 kg')).toBeInTheDocument();
    expect(within(sheet).getByRole('link', { name: 'JOB-2083-0042' })).toHaveAttribute('href', '/admin/jobs/j1');
    expect(within(sheet).getByText('6 kg in stock now.')).toBeInTheDocument();
  });

  it('records a purchase with the rate in rupees', async () => {
    const user = userEvent.setup();
    const calls = mockApi(({ method, path }) => {
      if (path === '/admin/stock') return json({ data: [ROW], meta: { page: 1, limit: 20, total: 1, pages: 1, lowCount: 1 } });
      if (path === '/admin/materials') return page([{ id: 'mat1', code: 'WP-CRYST', name: 'Crystalline slurry', unit: 'kg' }]);
      if (method === 'POST' && path === '/admin/stock/movements') return json({ data: { id: 'sm2', type: 'PURCHASE', qty: 50 } }, 201);
      return undefined;
    });
    const { store } = renderWithProviders(<StockPage />, { path: '/admin/stock', preloadedState: signedInAs('DISPATCHER') });
    await screen.findByText('6 kg');
    await user.click(screen.getByRole('button', { name: /Record movement/ }));
    const sheet = await screen.findByRole('dialog', { name: 'Record a stock movement' });
    await user.click(within(sheet).getByRole('combobox', { name: /Material/ }));
    await user.click(await screen.findByRole('option', { name: 'WP-CRYST · Crystalline slurry (kg)' }));
    await user.type(within(sheet).getByLabelText(/^Quantity/), '50');
    await user.type(within(sheet).getByLabelText(/Rate per unit/), '18.50');
    await user.type(within(sheet).getByLabelText(/Bill number/), 'Bill 2083-114');
    await user.click(within(sheet).getByRole('button', { name: 'Record' }));
    await waitFor(() => expect(calls.find((c) => c.method === 'POST')?.body).toEqual({
      materialId: 'mat1', type: 'PURCHASE', qty: 50, rate: 18.5, reference: 'Bill 2083-114', note: undefined,
    }));
    await waitFor(() => expect(toastTitles(store)).toContain('Purchase recorded'));
  });
});

describe('technician registry screens', () => {
  const Screens = () => (
    <Routes>
      <Route path="/admin/technicians" element={<ResourceListPage resource="technicians" />} />
      <Route path="/admin/technicians/:id" element={<ResourceEditPage resource="technicians" />} />
    </Routes>
  );

  it('switches availability from the list', async () => {
    const user = userEvent.setup();
    const calls = mockApi(({ method, path }) => {
      if (path === '/admin/technicians') return page([HARI]);
      if (method === 'PATCH' && path === '/admin/technicians/t-hari/toggle') return json({ data: { ...HARI, isAvailable: false } });
      return undefined;
    });
    const { store } = renderWithProviders(<Screens />, { path: '*', initialPath: '/admin/technicians', preloadedState: signedInAs('DISPATCHER') });
    expect(await screen.findByText('3 jobs')).toBeInTheDocument();
    expect(screen.getByText('ललितपुर')).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: /Available/ })).toBeInTheDocument();
    const toggle = screen.getByRole('switch', { name: 'Available for dispatch: “Hari KC”' });
    expect(toggle).toBeChecked();
    await user.click(toggle);
    await waitFor(() => expect(calls.some((c) => c.method === 'PATCH' && c.path === '/admin/technicians/t-hari/toggle')).toBe(true));
    await waitFor(() => expect(toastTitles(store)).toContain('Technician is marked unavailable — the board warns before anyone books them'));
  });

  it('shows the labour rate to dispatch and hides it from sales', async () => {
    const profile = (rate) => ({ ...HARI, userId: 'u-hari', ...(rate ? { hourlyRate: 45000 } : {}) });
    mockApi(({ path }) => {
      if (path === '/admin/technicians/t-hari') return json({ data: profile(true) });
      if (path === '/admin/technicians/users/u-hari') return json({ data: { id: 'u-hari', label: 'Hari KC · Technician' } });
      return undefined;
    });
    const first = renderWithProviders(<Screens />, { path: '*', initialPath: '/admin/technicians/t-hari', preloadedState: signedInAs('DISPATCHER') });
    expect(await screen.findByLabelText(/Labour cost per hour/)).toHaveValue('450.00');
    expect(screen.getByRole('tab', { name: 'History' })).toBeInTheDocument();
    first.unmount();

    renderWithProviders(<Screens />, { path: '*', initialPath: '/admin/technicians/t-hari', preloadedState: signedInAs('SALES') });
    expect(await screen.findByLabelText(/Employee code/)).toBeDisabled();
    expect(screen.queryByLabelText(/Labour cost per hour/)).not.toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: 'History' })).not.toBeInTheDocument();
  });
});
