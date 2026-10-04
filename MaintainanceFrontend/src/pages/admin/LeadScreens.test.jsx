import { afterEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import LeadsPage from '@/pages/admin/LeadsPage';
import LeadBoardPage from '@/pages/admin/LeadBoardPage/LeadBoardPage';
import SlaBoardPage from '@/pages/admin/SlaBoardPage';
import { ScheduleVisitDialog } from '@/components/leads/ScheduleVisitDialog';
import { ConvertLeadSheet } from '@/components/leads/ConvertLeadSheet';
import { RecordHistory } from '@/components/common/RecordHistory';
import { renderWithProviders, signedInAs } from '@/test/renderWithProviders';
import { json, mockApi, page } from '@/test/mockApi';
import { ktmToday, otherPeriodLabel, periodLabel } from '@/helpers/calendarDays';
import { shiftAnchor, spanFor } from '@/helpers/agenda';
import { CalendarModeSwitch } from '@/components/common/CalendarModeSwitch';

afterEach(() => vi.unstubAllGlobals());

const toastTitles = (store) => store.getState().ui.toasts.map((t) => t.title);
const leadRequests = (calls) => calls.filter((c) => c.method === 'GET' && c.path === '/admin/leads');

const LEAD = {
  id: 'l1', name: 'Sita Rai', phone: '9808338255', email: 'sita@example.com', status: 'NEW', priority: 'NORMAL',
  source: 'web_form', preferredLocale: 'ne', createdAt: '2026-09-16T04:00:00.000Z', customerId: null,
  address: 'Jhamsikhel, Lalitpur', sla: { state: 'ok', dueAt: '2026-09-16T06:00:00.000Z' },
};

describe('LeadsPage', () => {
  it('opens on My leads, switches to All leads, and applies a saved view', async () => {
    const user = userEvent.setup();
    const calls = mockApi(({ path }) => (path === '/admin/leads' ? page([LEAD]) : undefined));
    const { router } = renderWithProviders(<LeadsPage />, { path: '/admin/leads', preloadedState: signedInAs('SALES') });

    expect(await screen.findByText('Sita Rai')).toBeInTheDocument();
    expect(leadRequests(calls)[0].query).toMatchObject({ assignedToId: 'me', limit: '20' });
    expect(leadRequests(calls)[0].query).not.toHaveProperty('view');
    expect(screen.getByRole('radio', { name: 'My leads' })).toHaveAttribute('aria-checked', 'true');

    await user.click(screen.getByRole('radio', { name: 'All leads' }));
    await waitFor(() => expect(leadRequests(calls).at(-1).query).not.toHaveProperty('assignedToId'));
    expect(router.state.location.search).toContain('view=all');

    await user.click(screen.getByRole('button', { name: 'Breached' }));
    await waitFor(() => expect(leadRequests(calls).at(-1).query).toMatchObject({ slaRisk: 'breached' }));
    expect(screen.getByRole('button', { name: 'Breached' })).toHaveAttribute('aria-pressed', 'true');

    await user.click(screen.getByRole('button', { name: 'Unassigned' }));
    await waitFor(() => expect(leadRequests(calls).at(-1).query).toMatchObject({ assignedToId: 'none' }));
    expect(leadRequests(calls).at(-1).query).not.toHaveProperty('slaRisk');
    // An owner picked by a view is neither "mine" nor "all".
    expect(screen.getByRole('radio', { name: 'My leads' })).toHaveAttribute('aria-checked', 'false');
    expect(screen.getByRole('radio', { name: 'All leads' })).toHaveAttribute('aria-checked', 'false');
  });

  it('filters from the panel and shows each applied filter as a removable chip', async () => {
    const user = userEvent.setup();
    const calls = mockApi(({ path }) => (path === '/admin/leads' ? page([LEAD]) : undefined));
    renderWithProviders(<LeadsPage />, { path: '/admin/leads', preloadedState: signedInAs('SALES') });
    await screen.findByText('Sita Rai');

    await user.click(screen.getByRole('button', { name: 'Filters' }));
    const panel = await screen.findByRole('dialog', { name: 'Filters' });
    await user.click(within(within(panel).getByRole('group', { name: 'Response' })).getByRole('button', { name: 'Deadline passed' }));
    await user.click(within(within(panel).getByRole('group', { name: 'Priority' })).getByRole('button', { name: 'Urgent' }));
    await waitFor(() => expect(leadRequests(calls).at(-1).query).toMatchObject({ slaRisk: 'breached', priority: 'URGENT', assignedToId: 'me' }));
    await user.click(within(panel).getByRole('button', { name: 'Show results' }));

    expect(screen.getByRole('button', { name: 'Filters, 2 applied' })).toBeInTheDocument();
    const applied = screen.getByRole('list', { name: 'Applied filters' });
    expect(within(applied).getByText('Deadline passed')).toBeInTheDocument();

    await user.click(within(applied).getByRole('button', { name: 'Remove Response filter' }));
    await waitFor(() => expect(leadRequests(calls).at(-1).query).not.toHaveProperty('slaRisk'));
    expect(leadRequests(calls).at(-1).query).toMatchObject({ priority: 'URGENT' });
  });

  it('assigns the selected leads in one request', async () => {
    const user = userEvent.setup();
    const other = { ...LEAD, id: 'l2', name: 'Ram Thapa' };
    const calls = mockApi(({ method, path }) => {
      if (path === '/admin/leads') return page([LEAD, other]);
      if (path === '/admin/leads/assignees') return json({ data: [{ id: 'u9', name: 'Hari KC', role: 'SALES' }] });
      if (method === 'POST' && path === '/admin/leads/bulk-assign') return json({ data: { assigned: 2, unchanged: 0 } });
      return undefined;
    });
    const { store } = renderWithProviders(<LeadsPage />, { path: '/admin/leads', preloadedState: signedInAs('SALES') });
    await screen.findByText('Ram Thapa');

    await user.click(screen.getByRole('checkbox', { name: 'Select Sita Rai' }));
    await user.click(screen.getByRole('checkbox', { name: 'Select Ram Thapa' }));
    await user.click(screen.getByRole('button', { name: 'Assign' }));
    const dialog = await screen.findByRole('dialog', { name: 'Assign 2 leads' });
    await user.click(within(dialog).getByRole('combobox', { name: /Owner/ }));
    await user.click(await screen.findByRole('option', { name: 'Hari KC · Sales' }));
    await user.click(within(dialog).getByRole('button', { name: 'Assign' }));

    await waitFor(() => expect(calls.find((c) => c.path === '/admin/leads/bulk-assign')?.body)
      .toEqual({ ids: ['l1', 'l2'], assignedToId: 'u9' }));
    await waitFor(() => expect(toastTitles(store)).toContain('2 leads assigned'));
  });

  it('is read-only for dispatch: no New lead, no Assign', async () => {
    mockApi(({ path }) => (path === '/admin/leads' ? page([LEAD]) : undefined));
    renderWithProviders(<LeadsPage />, { path: '/admin/leads', preloadedState: signedInAs('DISPATCHER') });
    await screen.findByText('Sita Rai');
    expect(screen.queryByRole('button', { name: /New lead/ })).not.toBeInTheDocument();
    await userEvent.setup().click(screen.getByRole('checkbox', { name: 'Select Sita Rai' }));
    expect(screen.queryByRole('button', { name: 'Assign' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Export selected' })).toBeInTheDocument();
  });
});

describe('the pipeline board', () => {
  const byStatus = {
    NEW: [LEAD],
    CONTACTED: [{ ...LEAD, id: 'l3', name: 'Gita Shah', status: 'CONTACTED' }],
  };

  it('offers only the allowed moves, and moves through the status endpoint', async () => {
    const user = userEvent.setup();
    const calls = mockApi(({ method, path, query }) => {
      if (method === 'PATCH') return json({ data: { ...LEAD, status: 'CONTACTED' } });
      if (path === '/admin/leads') return page(byStatus[query.status] ?? []);
      return undefined;
    });
    const { store } = renderWithProviders(<LeadBoardPage />, { path: '/admin/leads/board', preloadedState: signedInAs('SALES') });

    const newColumn = await screen.findByRole('region', { name: 'New' });
    expect(await within(newColumn).findByText('Sita Rai')).toBeInTheDocument();
    expect(leadRequests(calls).every((c) => c.query.assignedToId === 'me')).toBe(true);
    expect(leadRequests(calls).map((c) => c.query.status).sort())
      .toEqual(['CONTACTED', 'INSPECTION_SCHEDULED', 'LOST', 'NEW', 'QUOTED', 'WON']);

    await user.click(within(newColumn).getByRole('button', { name: 'Move Sita Rai' }));
    const items = (await screen.findAllByRole('menuitem')).map((i) => i.textContent);
    expect(items).toEqual(['Contacted', 'Lost']);
    await user.click(screen.getByRole('menuitem', { name: 'Contacted' }));

    await waitFor(() => expect(calls.find((c) => c.method === 'PATCH')).toMatchObject({
      path: '/admin/leads/l1/status', body: { status: 'CONTACTED' },
    }));
    await waitFor(() => expect(toastTitles(store)).toContain('Sita Rai → Contacted'));
  });

  it('puts a refused move back, with the reason', async () => {
    const user = userEvent.setup();
    mockApi(({ method, path, query }) => {
      if (method === 'PATCH') {
        return json({ error: { code: 'INVALID_TRANSITION', message: 'Cannot move lead from NEW to CONTACTED' } }, 422);
      }
      if (path === '/admin/leads') return page(byStatus[query.status] ?? []);
      return undefined;
    });
    const { store } = renderWithProviders(<LeadBoardPage />, { path: '/admin/leads/board', preloadedState: signedInAs('SALES') });
    const newColumn = await screen.findByRole('region', { name: 'New' });
    await within(newColumn).findByText('Sita Rai');

    await user.click(within(newColumn).getByRole('button', { name: 'Move Sita Rai' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Contacted' }));

    await waitFor(() => expect(store.getState().ui.toasts.at(-1)).toMatchObject({
      title: 'Could not move Sita Rai', description: 'Cannot move lead from NEW to CONTACTED',
    }));
    await waitFor(() => expect(within(newColumn).getByText('Sita Rai')).toBeInTheDocument());
    expect(within(screen.getByRole('region', { name: 'Contacted' })).queryByText('Sita Rai')).not.toBeInTheDocument();
  });

  it('asks why before losing a lead — a category, then the words', async () => {
    const user = userEvent.setup();
    const calls = mockApi(({ method, path, query }) => {
      if (method === 'PATCH') return json({ data: { ...LEAD, status: 'LOST' } });
      if (path === '/admin/leads') return page(byStatus[query.status] ?? []);
      return undefined;
    });
    renderWithProviders(<LeadBoardPage />, { path: '/admin/leads/board', preloadedState: signedInAs('SALES') });
    const newColumn = await screen.findByRole('region', { name: 'New' });
    await within(newColumn).findByText('Sita Rai');

    await user.click(within(newColumn).getByRole('button', { name: 'Move Sita Rai' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Lost' }));
    const dialog = await screen.findByRole('dialog', { name: 'Mark Sita Rai as lost' });
    expect(calls.some((c) => c.method === 'PATCH')).toBe(false);
    // The card waits in its column until the dialog is answered.
    expect(within(newColumn).getByText('Sita Rai')).toBeInTheDocument();

    await user.click(within(dialog).getByRole('combobox', { name: /Why was it lost/ }));
    await user.click(await screen.findByRole('option', { name: 'Went with a competitor' }));
    await user.type(within(dialog).getByLabelText(/In their words/), 'Went with another company');
    await user.click(within(dialog).getByRole('button', { name: 'Mark as lost' }));
    await waitFor(() => expect(calls.find((c) => c.method === 'PATCH')?.body)
      .toEqual({ status: 'LOST', lostCategory: 'COMPETITOR', lostReason: 'Went with another company' }));
  });
});

describe('the pipeline board — moves with work behind them (Phase L1)', () => {
  const CONTACTED = { ...LEAD, id: 'l3', name: 'Gita Shah', status: 'CONTACTED', stageEnteredAt: '2026-09-10T04:00:00.000Z', customerId: null };

  /** The board with one Contacted lead, whose own record carries `quotations`. */
  function boardApi(quotations = []) {
    return mockApi(({ method, path, query }) => {
      if (path === '/admin/leads') return page(query.status === 'CONTACTED' ? [CONTACTED] : []);
      if (method === 'GET' && path === '/admin/leads/l3') return json({ data: { ...CONTACTED, quotations, jobs: [] } });
      if (path === '/admin/leads/l3/customer-matches') return json({ data: [] });
      if (path === '/public/bootstrap') {
        return json({ data: { booking: { slots: [{ key: 'morning', label: 'Morning', window: '8:00 – 12:00', startHour: 8 }] } } });
      }
      if (path === '/public/availability') return json({ data: { days: [] } });
      if (path === '/admin/technicians') return json({ data: [] });
      if (method === 'POST' && path === '/admin/leads/l3/convert') {
        return json({
          data: {
            customer: { id: 'c9', name: 'Gita Shah', phone: '9808338255' }, customerCreated: true, site: null,
            quotation: { id: 'q1', number: 'QT-2026-0042', total: 1_500_000 },
          },
        }, 201);
      }
      if (method === 'PATCH') return json({ data: { ...CONTACTED, status: 'QUOTED' } });
      return undefined;
    });
  }

  async function moveGita(user, to) {
    const contacted = await screen.findByRole('region', { name: 'Contacted' });
    await within(contacted).findByText('Gita Shah');
    await user.click(within(contacted).getByRole('button', { name: 'Move Gita Shah' }));
    await user.click(await screen.findByRole('menuitem', { name: to }));
    return contacted;
  }

  it('shows how long each card has sat in its stage', async () => {
    boardApi();
    renderWithProviders(<LeadBoardPage />, { path: '/admin/leads/board', preloadedState: signedInAs('SALES') });
    const contacted = await screen.findByRole('region', { name: 'Contacted' });
    expect(await within(contacted).findByText(/\d+d in stage/)).toBeInTheDocument();
  });

  it('a drop on Quoted without a quotation opens the new-quotation sheet, and Cancel puts the card back', async () => {
    const user = userEvent.setup();
    const calls = boardApi([]);
    renderWithProviders(<LeadBoardPage />, { path: '/admin/leads/board', preloadedState: signedInAs('SALES') });

    const contacted = await moveGita(user, 'Quoted');
    const sheet = await screen.findByRole('dialog', { name: 'New quotation' });
    expect(calls.some((c) => c.method === 'GET' && c.path === '/admin/leads/l3')).toBe(true);
    // The card has not moved while the sheet is open.
    expect(within(contacted).getByText('Gita Shah')).toBeInTheDocument();
    // (The open sheet hides the board from the accessibility tree, hence `hidden`.)
    expect(within(screen.getByRole('region', { name: 'Quoted', hidden: true })).queryByText('Gita Shah')).not.toBeInTheDocument();

    await user.click(within(sheet).getByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'New quotation' })).not.toBeInTheDocument());
    expect(within(contacted).getByText('Gita Shah')).toBeInTheDocument();
    expect(calls.some((c) => c.method === 'PATCH' || c.method === 'POST')).toBe(false);
  });

  it('completing the sheet drafts the quotation and leaves the lead where the server says', async () => {
    const user = userEvent.setup();
    const calls = boardApi([]);
    const { store } = renderWithProviders(<LeadBoardPage />, { path: '/admin/leads/board', preloadedState: signedInAs('SALES') });

    const contacted = await moveGita(user, 'Quoted');
    const sheet = await screen.findByRole('dialog', { name: 'New quotation' });
    expect(within(sheet).queryByRole('switch', { name: /Start a draft quotation/ })).not.toBeInTheDocument();
    await user.click(within(sheet).getByRole('button', { name: 'Create draft quotation' }));

    await waitFor(() => expect(calls.find((c) => c.method === 'POST' && c.path === '/admin/leads/l3/convert')?.body)
      .toMatchObject({ createQuotation: true, site: { address: 'Jhamsikhel, Lalitpur' } }));
    await waitFor(() => expect(store.getState().ui.toasts.at(-1)).toMatchObject({
      title: 'Draft QT-2026-0042 created', description: 'The lead moves to Quoted when the quotation is sent.',
    }));
    // Drafting is not quoting: no status change was asked for, and the card is still Contacted.
    expect(calls.some((c) => c.method === 'PATCH')).toBe(false);
    expect(within(contacted).getByText('Gita Shah')).toBeInTheDocument();
  });

  it('with a quotation already there, Quoted is the plain status change', async () => {
    const user = userEvent.setup();
    const calls = boardApi([{ id: 'q1', number: 'QT-2026-0042', status: 'SENT', total: 1_500_000 }]);
    renderWithProviders(<LeadBoardPage />, { path: '/admin/leads/board', preloadedState: signedInAs('SALES') });

    await moveGita(user, 'Quoted');
    await waitFor(() => expect(calls.find((c) => c.method === 'PATCH')).toMatchObject({
      path: '/admin/leads/l3/status', body: { status: 'QUOTED' },
    }));
    expect(screen.queryByRole('dialog', { name: 'New quotation' })).not.toBeInTheDocument();
  });

  it('a drop on Visit booked opens the visit booking; Cancel changes nothing', async () => {
    const user = userEvent.setup();
    const calls = boardApi();
    renderWithProviders(<LeadBoardPage />, { path: '/admin/leads/board', preloadedState: signedInAs('SALES') });

    const contacted = await moveGita(user, 'Visit booked');
    const dialog = await screen.findByRole('dialog', { name: 'Book the site visit' });
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Book the site visit' })).not.toBeInTheDocument());
    expect(within(contacted).getByText('Gita Shah')).toBeInTheDocument();
    expect(calls.some((c) => c.method === 'PATCH' || c.method === 'POST')).toBe(false);
  });

  it('booking the visit from the drop converts with the inspection', async () => {
    const user = userEvent.setup();
    const calls = boardApi();
    renderWithProviders(<LeadBoardPage />, { path: '/admin/leads/board', preloadedState: signedInAs('SALES') });

    await moveGita(user, 'Visit booked');
    const dialog = await screen.findByRole('dialog', { name: 'Book the site visit' });
    const book = within(dialog).getByRole('button', { name: 'Book visit' });
    await waitFor(() => expect(book).toBeEnabled());
    await user.click(book);
    await waitFor(() => expect(calls.find((c) => c.method === 'POST' && c.path === '/admin/leads/l3/convert')?.body)
      .toMatchObject({ createInspectionJob: true }));
    expect(calls.some((c) => c.method === 'PATCH')).toBe(false);
  });
});

const HOUSEHOLD = {
  id: 'c1', name: 'Existing Household', phone: '9808338255', email: 'household@example.com', preferredLocale: 'en',
  jobCount: 2, lastVisitAt: '2026-08-01T04:15:00.000Z', primaryAddress: 'Jhamsikhel', type: 'individual',
};

function convertApi(matches) {
  return mockApi(({ method, path }) => {
    if (path === '/admin/leads/l1/customer-matches') return json({ data: matches });
    if (path === '/public/bootstrap') {
      return json({ data: { booking: { slots: [{ key: 'morning', label: 'Morning', window: '8:00 – 12:00', startHour: 8 }] } } });
    }
    if (path === '/public/availability') return json({ data: { days: [] } });
    if (path === '/admin/technicians') return json({ data: [] });
    if (method === 'POST' && path === '/admin/leads/l1/convert') {
      return json({ data: { customer: { id: 'c9', name: 'Sita Rai', phone: '9808338255' }, customerCreated: true, site: null, job: { number: 'JOB-1' } } }, 201);
    }
    return undefined;
  });
}

const convertBody = (calls) => calls.find((c) => c.method === 'POST' && c.path === '/admin/leads/l1/convert')?.body;

describe('the pipeline board — finding and folding', () => {
  it('searches every column, and folds won and lost until asked', async () => {
    const user = userEvent.setup();
    const calls = mockApi(({ path, query }) => {
      if (path !== '/admin/leads') return undefined;
      if (query.status === 'WON') return page([{ ...LEAD, id: 'w1', name: 'Won Customer', status: 'WON' }]);
      return page(query.status === 'NEW' ? [LEAD] : []);
    });
    const { router } = renderWithProviders(<LeadBoardPage />, { path: '/admin/leads/board', preloadedState: signedInAs('SALES') });

    const newColumn = await screen.findByRole('region', { name: 'New' });
    expect(await within(newColumn).findByRole('link', { name: 'Call Sita Rai' })).toHaveAttribute('href', 'tel:9808338255');
    // Folded, but loaded — its count shows and it still takes a drop.
    const won = screen.getByRole('region', { name: 'Won' });
    expect(within(won).queryByText('Won Customer')).not.toBeInTheDocument();
    await waitFor(() => expect(within(won).getByLabelText('1 leads')).toBeInTheDocument());

    await user.click(screen.getByRole('button', { name: 'Show the Won column' }));
    expect(await within(screen.getByRole('region', { name: 'Won' })).findByText('Won Customer')).toBeInTheDocument();
    expect(router.state.location.search).toContain('closed=show');

    await user.type(screen.getByRole('searchbox', { name: 'Search the pipeline' }), 'Sita{Enter}');
    await waitFor(() => expect(leadRequests(calls).filter((c) => c.query.q === 'Sita').map((c) => c.query.status).sort())
      .toEqual(['CONTACTED', 'INSPECTION_SCHEDULED', 'LOST', 'NEW', 'QUOTED', 'WON']));
    expect(leadRequests(calls).every((c) => !('closed' in c.query))).toBe(true);
  });
});

describe('the SLA board', () => {
  const breached = { ...LEAD, id: 'b1', name: 'Late Lead', message: 'Roof leaking into the bedroom', assignedToId: null, assignedTo: null, sla: { state: 'breached', dueAt: '2026-09-16T06:00:00.000Z' } };
  const mine = { ...LEAD, id: 'm1', name: 'My Lead', assignedToId: 'user-test', assignedTo: { id: 'user-test', name: 'Test User' }, sla: { state: 'at_risk', dueAt: '2099-01-01T00:00:00.000Z' } };
  const board = { breached: [breached], atRisk: [mine], newToday: 3, answeredToday: 4, metToday: 3 };

  it('shows the score, what the customer asked, and lets a salesperson take an unowned lead', async () => {
    const user = userEvent.setup();
    const calls = mockApi(({ method, path }) => {
      if (path === '/admin/leads/sla-board') return json({ data: board });
      if (method === 'PATCH' && path === '/admin/leads/b1/assign') return json({ data: { ...breached, assignedToId: 'user-test' } });
      return undefined;
    });
    const { store } = renderWithProviders(<SlaBoardPage />, { path: '/admin/sla', preloadedState: signedInAs('SALES') });

    const late = await screen.findByRole('region', { name: 'Deadline passed' });
    expect(within(late).getByText('Roof leaking into the bedroom')).toBeInTheDocument();
    expect(within(late).getByRole('link', { name: 'WhatsApp Late Lead' })).toHaveAttribute('href', 'https://wa.me/9779808338255');
    expect(screen.getByText('3 of 4')).toBeInTheDocument();
    // Only the unowned lead offers Take it.
    expect(screen.getAllByRole('button', { name: /Take it/ })).toHaveLength(1);

    await user.click(within(late).getByRole('button', { name: /Take it/ }));
    await waitFor(() => expect(calls.find((c) => c.method === 'PATCH')?.body).toEqual({ assignedToId: 'user-test' }));
    await waitFor(() => expect(toastTitles(store)).toContain('Late Lead is yours'));
  });

  it('narrows to mine or to the unowned', async () => {
    const user = userEvent.setup();
    mockApi(({ path }) => (path === '/admin/leads/sla-board' ? json({ data: board }) : undefined));
    const { router } = renderWithProviders(<SlaBoardPage />, { path: '/admin/sla', preloadedState: signedInAs('SALES') });
    await screen.findByText('Late Lead');

    await user.click(screen.getByRole('radio', { name: 'Mine' }));
    expect(screen.queryByText('Late Lead')).not.toBeInTheDocument();
    expect(screen.getByText('My Lead')).toBeInTheDocument();
    expect(router.state.location.search).toContain('who=mine');

    await user.click(screen.getByRole('radio', { name: 'Unassigned' }));
    expect(await screen.findByText('Late Lead')).toBeInTheDocument();
    expect(screen.queryByText('My Lead')).not.toBeInTheDocument();
  });

  it('is read-only for dispatch: no Take it, no Log response', async () => {
    mockApi(({ path }) => (path === '/admin/leads/sla-board' ? json({ data: board }) : undefined));
    renderWithProviders(<SlaBoardPage />, { path: '/admin/sla', preloadedState: signedInAs('DISPATCHER') });
    await screen.findByText('Late Lead');
    expect(screen.queryByRole('button', { name: /Take it/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Log response/ })).not.toBeInTheDocument();
  });

  it('the Calendar tab lays out what is late, what is today and what is coming, by kind', async () => {
    const user = userEvent.setup();
    const nowIso = new Date().toISOString();
    const base = { allDay: false, endAt: null, ownable: true, ownerId: null, ownerName: null };
    const agenda = {
      kinds: ['response', 'followUp', 'visit', 'job', 'quotation', 'amcVisit', 'renewal'],
      items: [
        // Long before any month on screen: only the side panel has it.
        { ...base, key: 'followUp:old', kind: 'followUp', id: 'old', at: '2020-01-10T05:00:00.000Z', state: 'overdue', title: 'Gita Shrestha', href: '/admin/leads/old', type: 'CALL', note: 'Call back about the roof' },
        { ...base, key: 'response:new', kind: 'response', id: 'new', at: nowIso, state: 'today', title: 'Ram Thapa', href: '/admin/leads/new', ownerId: 'user-test', ownerName: 'Test User' },
        { ...base, key: 'job:j1', kind: 'job', id: 'j1', at: nowIso, state: 'today', title: 'Hotel Annapurna', href: '/admin/jobs/j1', number: 'JOB-1', ownable: false, people: ['Hari'] },
      ],
      overdue: { total: 1, byKind: { followUp: 1 } },
      truncated: [],
    };
    const calls = mockApi(({ path }) => {
      if (path === '/admin/leads/sla-board') return json({ data: board });
      if (path === '/admin/agenda') return json({ data: agenda });
      return undefined;
    });
    const { router } = renderWithProviders(<SlaBoardPage />, { path: '/admin/sla', preloadedState: signedInAs('SALES') });

    await user.click(await screen.findByRole('tab', { name: /Calendar/ }));
    expect(router.state.location.search).toContain('tab=calendar');
    const late = await screen.findByRole('region', { name: 'Overdue' });
    expect(within(late).getByText('Gita Shrestha')).toBeInTheDocument();
    expect(within(late).getByText(/d late$/)).toBeInTheDocument();
    // The month's six weeks are what was asked for.
    const today = ktmToday();
    expect(calls.find((c) => c.path === '/admin/agenda').query).toEqual(spanFor('month', today));

    // Today is picked to begin with; the side panel has it in full.
    const day = screen.getByRole('region', { name: /^On / });
    expect(within(day).getByText('Ram Thapa')).toBeInTheDocument();
    expect(within(day).getByRole('link', { name: 'Hotel Annapurna' })).toHaveAttribute('href', '/admin/jobs/j1');

    // The legend is the filter.
    await user.click(screen.getByRole('button', { name: /^Follow-up/ }));
    expect(router.state.location.search).toContain('hide=followUp');
    expect(within(late).queryByText('Gita Shrestha')).not.toBeInTheDocument();

    // Mine: the caller's own; a job is nobody's lead.
    await user.click(screen.getByRole('radio', { name: 'Mine' }));
    expect(within(day).getByText('Ram Thapa')).toBeInTheDocument();
    expect(within(day).queryByText('Hotel Annapurna')).not.toBeInTheDocument();

    // The week asks for its seven days.
    await user.click(screen.getByRole('radio', { name: 'Week' }));
    await waitFor(() => expect(calls.filter((c) => c.path === '/admin/agenda').at(-1).query).toEqual(spanFor('week', today)));
    expect(router.state.location.search).toContain('cal=week');
  });

  it('reads in the Nepali calendar once the account menu says so', async () => {
    const user = userEvent.setup();
    const empty = { kinds: ['response', 'followUp'], items: [], overdue: { total: 0, byKind: {} }, truncated: [] };
    const calls = mockApi(({ path }) => {
      if (path === '/admin/leads/sla-board') return json({ data: board });
      if (path === '/admin/agenda') return json({ data: empty });
      return undefined;
    });
    // The switch is the account menu's; here beside the board, as one store holds both.
    renderWithProviders(<><CalendarModeSwitch /><SlaBoardPage /></>, {
      path: '/admin/sla', initialPath: '/admin/sla?tab=calendar', preloadedState: signedInAs('SALES'),
    });
    const today = ktmToday();
    const heading = await screen.findByRole('heading', { level: 2 });
    expect(heading).toHaveTextContent(periodLabel('month', today));

    await user.click(screen.getByRole('button', { name: 'Nepali' }));
    expect(screen.getByRole('button', { name: 'Nepali' })).toHaveAttribute('aria-pressed', 'true');
    expect(heading).toHaveTextContent(periodLabel('month', today, 'bs'));
    expect(screen.getByText(otherPeriodLabel('month', today, 'bs'))).toBeInTheDocument();
    // The grid is the BS month's six weeks, and the API is asked for them.
    await waitFor(() => expect(calls.filter((c) => c.path === '/admin/agenda').at(-1).query).toEqual(spanFor('month', today, 'bs')));
    expect(localStorage.getItem('calendar')).toBe('bs');

    // A step is a BS month.
    await user.click(screen.getByRole('button', { name: 'Next month' }));
    expect(heading).toHaveTextContent(periodLabel('month', shiftAnchor(today, 'month', 1, 'bs'), 'bs'));

    await user.click(screen.getByRole('button', { name: 'English' }));
    expect(localStorage.getItem('calendar')).toBe('ad');
    localStorage.removeItem('calendar');
  });
});

describe('convert — a matching phone needs a decision', () => {
  it('Book visit waits for "same person" or "different person"; different person asks for a new customer', async () => {
    const user = userEvent.setup();
    const calls = convertApi([HOUSEHOLD]);
    renderWithProviders(<ScheduleVisitDialog lead={LEAD} open onOpenChange={() => {}} />, { preloadedState: signedInAs('SALES') });

    expect(await screen.findByText('Existing customer with this phone. Is this the same person?')).toBeInTheDocument();
    expect(screen.getByText(/Existing Household · 2 jobs · last visit 01 Aug 2026/)).toBeInTheDocument();
    const book = screen.getByRole('button', { name: 'Book visit' });
    expect(book).toBeDisabled();

    await user.click(screen.getByRole('radio', { name: /Different person/ }));
    expect(book).toBeEnabled();
    await user.click(book);
    await waitFor(() => expect(convertBody(calls)).toMatchObject({ createNewCustomer: true, createInspectionJob: true }));
    expect(convertBody(calls)).not.toHaveProperty('customerId');
  });

  it('"same person" leaves the email alone unless the box is ticked, and can switch the language', async () => {
    const user = userEvent.setup();
    const calls = convertApi([HOUSEHOLD]);
    renderWithProviders(<ScheduleVisitDialog lead={LEAD} open onOpenChange={() => {}} />, { preloadedState: signedInAs('SALES') });

    await user.click(await screen.findByRole('radio', { name: /Same person/ }));
    const emailBox = screen.getByRole('checkbox', { name: /Also save sita@example.com on this customer/ });
    expect(emailBox).not.toBeChecked();
    expect(screen.getByText(/Replaces household@example.com/)).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: /Write to them in नेपाली from now on/ })).not.toBeChecked();

    await user.click(emailBox);
    await user.click(screen.getByRole('checkbox', { name: /Write to them in नेपाली/ }));
    await user.click(screen.getByRole('button', { name: 'Book visit' }));
    await waitFor(() => expect(convertBody(calls)).toMatchObject({ customerId: 'c1', confirmEmail: true, preferredLocale: 'ne' }));
  });

  it('with no match there is nothing to decide', async () => {
    const user = userEvent.setup();
    const calls = convertApi([]);
    renderWithProviders(<ScheduleVisitDialog lead={LEAD} open onOpenChange={() => {}} />, { preloadedState: signedInAs('SALES') });
    const book = screen.getByRole('button', { name: 'Book visit' });
    await waitFor(() => expect(book).toBeEnabled());
    expect(screen.queryByText(/Existing customer/)).not.toBeInTheDocument();
    await user.click(book);
    await waitFor(() => expect(convertBody(calls)).toBeTruthy());
    expect(convertBody(calls)).not.toHaveProperty('customerId');
    expect(convertBody(calls)).not.toHaveProperty('createNewCustomer');
  });

  it('"Convert without a visit" refuses to guess, then sends the site and the choice', async () => {
    const user = userEvent.setup();
    const calls = convertApi([HOUSEHOLD]);
    const onConverted = vi.fn();
    renderWithProviders(
      <ConvertLeadSheet lead={{ ...LEAD, serviceId: 's1' }} open onOpenChange={() => {}} onConverted={onConverted} />,
      { preloadedState: signedInAs('SALES') },
    );
    const sheet = await screen.findByRole('dialog', { name: 'Convert without a visit' });
    await within(sheet).findByText('Existing customer with this phone. Is this the same person?');
    expect(within(sheet).getByLabelText(/^Address/)).toHaveValue('Jhamsikhel, Lalitpur');
    expect(within(sheet).getByRole('switch', { name: /Start a draft quotation/ })).toBeChecked();

    await user.click(within(sheet).getByRole('button', { name: 'Convert' }));
    expect(await within(sheet).findByRole('alert')).toHaveTextContent('Say whether this is the same person');
    expect(convertBody(calls)).toBeUndefined();

    await user.click(within(sheet).getByRole('radio', { name: /Different person/ }));
    await user.click(within(sheet).getByRole('button', { name: 'Convert' }));
    await waitFor(() => expect(convertBody(calls)).toEqual({
      createNewCustomer: true,
      site: { label: 'Primary site', address: 'Jhamsikhel, Lalitpur' },
      createQuotation: true,
    }));
    await waitFor(() => expect(onConverted).toHaveBeenCalled());
  });
});

describe('RecordHistory', () => {
  const ENTRIES = [
    {
      id: 'h3', event: 'lead.status_changed', action: 'status_changed', model: 'Lead', recordId: 'l1', actorType: 'user',
      actor: { id: 'u1', name: 'Sita Sharma', role: 'SALES' }, before: { status: 'NEW' }, after: { status: 'CONTACTED' },
      changes: null, createdAt: '2026-09-16T05:30:00.000Z',
    },
    {
      id: 'h2', event: 'lead.activity_logged', action: 'activity_logged', model: 'Lead', recordId: 'l1', actorType: 'user',
      actor: { id: 'u1', name: 'Sita Sharma', role: 'SALES' }, before: { firstResponseAt: null },
      after: { firstResponseAt: '2026-09-16T04:34:00.000Z' }, changes: { type: 'call', summary: 'Called back' },
      createdAt: '2026-09-16T04:34:00.000Z',
    },
    {
      id: 'h1', event: null, action: 'create', model: 'Lead', recordId: 'l1', actorType: 'public', actor: null,
      before: null, after: { name: 'राम थापा', phone: '9808338255' }, changes: null, createdAt: '2026-09-16T04:00:00.000Z',
    },
  ];

  it('lists each step with who and when (Kathmandu time), and opens the before/after', async () => {
    const user = userEvent.setup();
    const calls = mockApi(({ path }) => (path === '/admin/leads/l1/history'
      ? json({ data: ENTRIES, meta: { page: 1, limit: 20, total: 3, pages: 1 } })
      : undefined));
    renderWithProviders(<RecordHistory endpoint="/admin/leads/l1/history" />, { preloadedState: signedInAs('SALES') });

    const list = await screen.findByRole('list', { name: 'History' });
    const items = within(list).getAllByRole('listitem');
    expect(items).toHaveLength(3);
    expect(within(items[0]).getByText('Status changed')).toBeInTheDocument();
    expect(within(items[0]).getByText('New → Contacted')).toBeInTheDocument();
    expect(within(items[0]).getByText('Sita Sharma · Sales')).toBeInTheDocument();
    // 05:30 UTC is 11:15 in Kathmandu.
    expect(within(items[0]).getByText(/16 Sept? 2026, 11:15/)).toBeInTheDocument();
    expect(within(items[1]).getByText('Call · Called back · stopped the response clock')).toBeInTheDocument();
    expect(within(items[2]).getByText('Lead added')).toBeInTheDocument();
    expect(within(items[2]).getByText('Customer (website or link)')).toBeInTheDocument();

    await user.click(within(items[2]).getByRole('button', { name: 'Show details' }));
    const diff = within(items[2]).getByRole('table');
    expect(within(diff).getByRole('rowheader', { name: 'Name' })).toBeInTheDocument();
    expect(within(diff).getByText('राम थापा')).toBeInTheDocument();
    expect(calls[0].query).toMatchObject({ page: '1', limit: '20' });
  });

  it('says so when there is nothing yet', async () => {
    mockApi(() => json({ data: [], meta: { page: 1, limit: 20, total: 0, pages: 1 } }));
    renderWithProviders(<RecordHistory endpoint="/admin/customers/c1/history" />, { preloadedState: signedInAs('SALES') });
    expect(await screen.findByText('No history yet')).toBeInTheDocument();
  });
});

describe('booking the visit — the window, the site contact and the SMS (Phase L5)', () => {
  const SURVEYOR = { id: 't1', employeeCode: 'SRV-01', user: { name: 'राम थापा', phone: '9851012345' } };
  const SLOTS = [
    { key: 'morning', label: 'Morning', window: '8:00 – 12:00', startHour: 8, endHour: 12 },
    { key: 'afternoon', label: 'Afternoon', window: '12:00 – 16:00', startHour: 12, endHour: 16 },
  ];

  /** The dialog's API: no matching customer, one surveyor, the company's name in the settings. */
  function visitApi({ slots = SLOTS, matches = [] } = {}) {
    return mockApi(({ method, path }) => {
      if (path === '/admin/leads/l1/customer-matches') return json({ data: matches });
      if (path === '/public/bootstrap') {
        return json({ data: { settings: { 'contact.companyName': 'Ghar Jatan' }, booking: { slots } } });
      }
      if (path === '/public/availability') return json({ data: { days: [] } });
      if (path === '/admin/technicians') return page([SURVEYOR]);
      if (method === 'POST' && path === '/admin/leads/l1/convert') {
        return json({ data: { customer: { id: 'c9', name: 'Sita Rai' }, customerCreated: true, job: { number: 'JOB-2083-0007' } } }, 201);
      }
      return undefined;
    });
  }

  const renderDialog = (lead = LEAD) => renderWithProviders(
    <ScheduleVisitDialog lead={lead} open onOpenChange={() => {}} />, { preloadedState: signedInAs('SALES') },
  );
  const replace = async (user, input, value) => {
    await user.clear(input);
    await user.type(input, value);
  };
  const smsText = () => screen.getByTestId('visit-sms').textContent;

  it('books a window with a caretaker and a landmark: +05:45 instants, the number normalised, Devanagari kept', async () => {
    const user = userEvent.setup();
    const calls = visitApi();
    renderDialog();
    const book = screen.getByRole('button', { name: 'Book visit' });
    await waitFor(() => expect(book).toBeEnabled());

    // The slot fills the window; both ends can be moved.
    expect(screen.getByLabelText('From')).toHaveValue('08:00');
    expect(screen.getByLabelText('Until')).toHaveValue('12:00');
    await replace(user, screen.getByLabelText('Date'), '2026-10-03');
    await replace(user, screen.getByLabelText('From'), '10:00');
    await replace(user, screen.getByLabelText('Until'), '12:00');

    await user.click(screen.getByRole('combobox', { name: 'Surveyor' }));
    await user.click(await screen.findByRole('option', { name: 'राम थापा · SRV-01' }));
    await user.type(screen.getByLabelText(/^Site contact \(optional\)/), 'हरि बहादुर');
    await user.type(screen.getByLabelText('Site contact phone'), '+977 9841234567');
    await user.type(screen.getByLabelText(/^Landmark/), 'Opposite the Bhatbhateni, blue gate');
    expect(screen.getByText('Also sent to हरि बहादुर (9841234567).')).toBeInTheDocument();

    await user.click(book);
    await waitFor(() => expect(convertBody(calls)).toEqual({
      createInspectionJob: true,
      // 10:00 and 12:00 in Kathmandu are 04:15 and 06:15 UTC.
      scheduledStart: '2026-10-03T04:15:00.000Z',
      scheduledEnd: '2026-10-03T06:15:00.000Z',
      surveyorId: 't1',
      site: { label: 'Primary site', address: 'Jhamsikhel, Lalitpur' },
      siteContactName: 'हरि बहादुर',
      siteContactPhone: '9841234567',
      landmark: 'Opposite the Bhatbhateni, blue gate',
    }));
  }, 15_000);

  it('a slot without an end hour gives a two-hour window, and picking another slot moves it', async () => {
    const user = userEvent.setup();
    visitApi({ slots: [{ key: 'morning', label: 'Morning', window: '8:00 – 12:00', startHour: 8 }, SLOTS[1]] });
    renderDialog({ ...LEAD, preferredSlot: 'morning' });
    // The slots arrive with the bootstrap, after the dialog has opened.
    await waitFor(() => expect(screen.getByLabelText('Until')).toHaveValue('10:00'), { timeout: 3000 });
    expect(screen.getByLabelText('From')).toHaveValue('08:00');

    await user.click(screen.getByRole('combobox', { name: 'Slot' }));
    await user.click(await screen.findByRole('option', { name: /Afternoon/ }));
    expect(screen.getByLabelText('From')).toHaveValue('12:00');
    expect(screen.getByLabelText('Until')).toHaveValue('16:00');
  });

  it('an end at or before the start disables Book and says why', async () => {
    const user = userEvent.setup();
    const calls = visitApi();
    renderDialog();
    const book = screen.getByRole('button', { name: 'Book visit' });
    await waitFor(() => expect(book).toBeEnabled());

    await replace(user, screen.getByLabelText('Until'), '07:30');
    expect(screen.getByText('The window must end after it starts')).toBeInTheDocument();
    expect(screen.getByLabelText('Until')).toHaveAttribute('aria-invalid', 'true');
    expect(book).toBeDisabled();

    await replace(user, screen.getByLabelText('From'), '06:00');
    expect(screen.queryByText('The window must end after it starts')).not.toBeInTheDocument();
    expect(book).toBeEnabled();
    expect(convertBody(calls)).toBeUndefined();
  });

  it('a wrong number — or a number with nobody’s name — blocks Book with a message', async () => {
    const user = userEvent.setup();
    const calls = visitApi();
    renderDialog();
    const book = screen.getByRole('button', { name: 'Book visit' });
    await waitFor(() => expect(book).toBeEnabled());

    await user.type(screen.getByLabelText('Site contact phone'), '5407720');
    await user.click(book);
    expect(await screen.findByText(/Enter a valid Nepali number/)).toBeInTheDocument();
    expect(screen.getByLabelText('Site contact phone')).toHaveFocus();
    expect(convertBody(calls)).toBeUndefined();

    // A landline with its area code is a Nepali number too — but whose?
    await replace(user, screen.getByLabelText('Site contact phone'), '01-5407720');
    await waitFor(() => expect(screen.queryByText(/Enter a valid Nepali number/)).not.toBeInTheDocument());
    await user.click(book);
    expect(await screen.findByText('Say whose number this is')).toBeInTheDocument();
    expect(convertBody(calls)).toBeUndefined();

    await user.type(screen.getByLabelText(/^Site contact \(optional\)/), 'Hari');
    await waitFor(() => expect(screen.queryByText('Say whose number this is')).not.toBeInTheDocument());
    await user.click(book);
    await waitFor(() => expect(convertBody(calls)).toMatchObject({ siteContactName: 'Hari', siteContactPhone: '01-5407720' }));
    expect(convertBody(calls)).not.toHaveProperty('landmark');
  }, 15_000);

  it('previews the SMS in the customer’s language (Nepali for this lead), with the surveyor and the window', async () => {
    const user = userEvent.setup();
    visitApi();
    renderDialog();
    await waitFor(() => expect(screen.getByRole('button', { name: 'Book visit' })).toBeEnabled());
    await replace(user, screen.getByLabelText('Date'), '2026-10-03');
    await replace(user, screen.getByLabelText('From'), '10:00');

    const preview = screen.getByRole('region', { name: 'SMS to the customer' });
    expect(within(preview).getByRole('radio', { name: 'नेपाली' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByTestId('visit-sms')).toHaveAttribute('lang', 'ne');
    expect(smsText()).toContain('नमस्ते Sita Rai');
    // A Nepali SMS dates the visit in Bikram Sambat, in Nepali words (Phase J1) — 3 Oct 2026 is 17 Ashwin 2083.
    expect(smsText()).toContain('17 असोज 2083, 10:00–12:00');
    // Nobody picked yet: "our surveyor", in Nepali.
    expect(smsText()).toContain('हाम्रो सर्वेक्षक आउनुहुनेछ');
    expect(smsText()).toMatch(/\/visit\/… - Ghar Jatan$/);

    await user.click(screen.getByRole('combobox', { name: 'Surveyor' }));
    await user.click(await screen.findByRole('option', { name: 'राम थापा · SRV-01' }));
    expect(smsText()).toContain('राम थापा (9851012345) आउनुहुनेछ');

    await user.click(within(preview).getByRole('radio', { name: 'English' }));
    expect(screen.getByTestId('visit-sms')).toHaveAttribute('lang', 'en');
    expect(smsText()).toBe(
      `Hi Sita Rai, your site visit JOB-… is booked for 3 Oct 2026, 10:00–12:00. राम थापा (9851012345) will come. Confirm or ask for another time: ${window.location.origin}/visit/… - Ghar Jatan`,
    );
  }, 15_000);

  it('an English customer reads English; the site contact is not written to twice on the customer’s own number', async () => {
    const user = userEvent.setup();
    visitApi();
    renderDialog({ ...LEAD, preferredLocale: 'en' });
    await waitFor(() => expect(screen.getByRole('button', { name: 'Book visit' })).toBeEnabled());
    expect(smsText()).toMatch(/^Hi Sita Rai, your site visit JOB-… is booked for .+, 08:00–12:00\. our surveyor will come\./);

    await user.type(screen.getByLabelText(/^Site contact \(optional\)/), 'Sita');
    await user.type(screen.getByLabelText('Site contact phone'), '+977 9808338255');
    expect(screen.queryByText(/Also sent to/)).not.toBeInTheDocument();
  });

  it('"same person" writes to the existing customer, in their language', async () => {
    const user = userEvent.setup();
    visitApi({ matches: [HOUSEHOLD] });
    renderDialog();
    await user.click(await screen.findByRole('radio', { name: /Same person/ }));
    expect(smsText()).toMatch(/^Hi Existing Household,/);
    await user.click(screen.getByRole('checkbox', { name: /Write to them in नेपाली/ }));
    expect(smsText()).toMatch(/^नमस्ते Existing Household,/);
  });
});

describe('convert without a visit — the site contact (Phase L5)', () => {
  it('sends the caretaker and the landmark as top-level fields, normalised, only when filled', async () => {
    const user = userEvent.setup();
    const calls = convertApi([]);
    renderWithProviders(
      <ConvertLeadSheet lead={LEAD} open onOpenChange={() => {}} onConverted={() => {}} />,
      { preloadedState: signedInAs('SALES') },
    );
    const sheet = await screen.findByRole('dialog', { name: 'Convert without a visit' });
    expect(within(sheet).getByText('The caretaker, when the owner is abroad')).toBeInTheDocument();

    await user.type(within(sheet).getByLabelText('Site contact phone'), '98083382');
    await user.click(within(sheet).getByRole('button', { name: 'Convert' }));
    expect(await within(sheet).findByText(/Enter a valid Nepali number/)).toBeInTheDocument();
    expect(convertBody(calls)).toBeUndefined();

    await user.clear(within(sheet).getByLabelText('Site contact phone'));
    await user.type(within(sheet).getByLabelText('Site contact phone'), '+977 9841234567');
    await user.type(within(sheet).getByLabelText(/^Site contact$/), 'हरि बहादुर');
    await user.type(within(sheet).getByLabelText(/^Landmark/), 'भाटभटेनी अगाडि, निलो गेट');
    await user.click(within(sheet).getByRole('button', { name: 'Convert' }));
    await waitFor(() => expect(convertBody(calls)).toEqual({
      site: { label: 'Primary site', address: 'Jhamsikhel, Lalitpur' },
      createQuotation: false,
      siteContactName: 'हरि बहादुर',
      siteContactPhone: '9841234567',
      landmark: 'भाटभटेनी अगाडि, निलो गेट',
    }));
  }, 15_000);
});
