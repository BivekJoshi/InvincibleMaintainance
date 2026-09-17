import { afterEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import LeadsPage from '@/pages/admin/LeadsPage';
import LeadBoardPage from '@/pages/admin/LeadBoardPage/LeadBoardPage';
import { ScheduleVisitDialog } from '@/components/leads/ScheduleVisitDialog';
import { ConvertLeadSheet } from '@/components/leads/ConvertLeadSheet';
import { RecordHistory } from '@/components/common/RecordHistory';
import { renderWithProviders, signedInAs } from '@/test/renderWithProviders';
import { json, mockApi, page } from '@/test/mockApi';

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

  it('asks why before losing a lead', async () => {
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
    await user.type(within(dialog).getByLabelText(/Why was it lost/), 'Went with another company');
    await user.click(within(dialog).getByRole('button', { name: 'Mark as lost' }));
    await waitFor(() => expect(calls.find((c) => c.method === 'PATCH')?.body)
      .toEqual({ status: 'LOST', lostReason: 'Went with another company' }));
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
