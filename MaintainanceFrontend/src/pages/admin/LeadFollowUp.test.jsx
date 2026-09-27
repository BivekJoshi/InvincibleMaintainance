import { afterEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import LeadsPage from '@/pages/admin/LeadsPage';
import LeadDetailPage from '@/pages/admin/LeadDetailPage';
import LostReportPage from '@/pages/admin/LostReportPage';
import { ActivityComposer } from '@/components/leads/ActivityComposer';
import { NextActionCard } from '@/components/leads/NextActionCard';
import { LostReasonDialog } from '@/components/leads/LostReasonDialog';
import { renderWithProviders, signedInAs } from '@/test/renderWithProviders';
import { json, mockApi, page } from '@/test/mockApi';

afterEach(() => vi.unstubAllGlobals());

const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const iso = (offsetMs) => new Date(Date.now() + offsetMs).toISOString();
const toastTitles = (store) => store.getState().ui.toasts.map((t) => t.title);
const leadRequests = (calls) => calls.filter((c) => c.method === 'GET' && c.path === '/admin/leads');

const LEAD = {
  id: 'l1', name: 'सीता राई', phone: '9808338255', email: 'sita@example.com', status: 'NEW', priority: 'NORMAL',
  source: 'web_form', preferredLocale: 'ne', createdAt: iso(-3 * HOUR), customerId: null, customer: null,
  address: 'Jhamsikhel, Lalitpur', sla: { state: 'ok', dueAt: iso(-HOUR) },
  nextActionAt: null, nextActionType: null, nextActionNote: null, stageEnteredAt: iso(-3 * HOUR), contactAttempts: 0,
  lostCategory: null, lostAtStage: null, qualification: null,
};

describe('NextActionCard', () => {
  it('sets an overdue action apart and says "Overdue" in words; Done clears it', async () => {
    const user = userEvent.setup();
    const calls = mockApi(({ method }) => (method === 'PATCH' ? json({ data: { ...LEAD, nextActionAt: null } }) : undefined));
    const lead = {
      ...LEAD, status: 'CONTACTED', nextActionAt: iso(-2 * HOUR - 5 * 60_000), nextActionType: 'CALL',
      nextActionNote: 'Ask for the owner', contactAttempts: 2, stageEnteredAt: iso(-4 * DAY - HOUR),
    };
    const { store } = renderWithProviders(<NextActionCard lead={lead} canWrite />, { preloadedState: signedInAs('SALES') });

    const card = screen.getByRole('region', { name: /Next action/ });
    expect(within(card).getByText('Overdue')).toBeInTheDocument();
    expect(within(card).getByText(/2 h late/)).toBeInTheDocument();
    expect(within(card).getByText('Call')).toBeInTheDocument();
    expect(within(card).getByText('Ask for the owner')).toBeInTheDocument();
    expect(within(card).getByText('2 contact attempts')).toBeInTheDocument();
    expect(within(card).getByText('4d in stage')).toBeInTheDocument();

    await user.click(within(card).getByRole('button', { name: 'Done' }));
    await waitFor(() => expect(calls.find((c) => c.method === 'PATCH')).toMatchObject({
      path: '/admin/leads/l1/next-action', body: { at: null },
    }));
    await waitFor(() => expect(toastTitles(store)).toContain('Next action done'));
  });

  it('a later action is not overdue', () => {
    mockApi(() => undefined);
    const lead = { ...LEAD, status: 'CONTACTED', nextActionAt: iso(2 * DAY), nextActionType: 'FOLLOW_UP' };
    renderWithProviders(<NextActionCard lead={lead} canWrite />, { preloadedState: signedInAs('SALES') });
    const card = screen.getByRole('region', { name: /Next action/ });
    expect(within(card).queryByText('Overdue')).not.toBeInTheDocument();
    expect(within(card).getByText('Follow up')).toBeInTheDocument();
    expect(within(card).getByRole('button', { name: /Reschedule/ })).toBeInTheDocument();
  });

  it('an open lead with nothing next asks for one, and will not save without a time', async () => {
    const user = userEvent.setup();
    const calls = mockApi(() => undefined);
    renderWithProviders(<NextActionCard lead={{ ...LEAD, status: 'CONTACTED' }} canWrite />, { preloadedState: signedInAs('SALES') });

    expect(screen.getByText(/Nothing is next/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Set next action/ }));
    const dialog = await screen.findByRole('dialog', { name: /Next action for सीता राई/ });
    await user.click(within(dialog).getByRole('button', { name: 'Set next action' }));
    expect(await within(dialog).findByText('Say when')).toBeInTheDocument();
    expect(calls.some((c) => c.method === 'PATCH')).toBe(false);
  });

  it('shows nothing for a won or lost lead, and no buttons without leads:write', () => {
    mockApi(() => undefined);
    const { container } = renderWithProviders(
      <NextActionCard lead={{ ...LEAD, status: 'WON', nextActionAt: iso(-HOUR), nextActionType: 'CALL' }} canWrite />,
      { preloadedState: signedInAs('SALES') },
    );
    expect(container).toBeEmptyDOMElement();
  });
});

describe('the outcome composer', () => {
  const ANSWER = {
    id: 'a1', type: 'call', summary: 'Interested — book a visit', outcome: 'book_visit', firstResponse: true,
    sla: { state: 'met', dueAt: iso(-HOUR), respondedAt: iso(0) },
    lead: { id: 'l1', status: 'CONTACTED', nextActionAt: iso(0), nextActionType: 'BOOK_VISIT', contactAttempts: 1 },
    dialog: 'visit',
  };

  function composerApi(answer = ANSWER) {
    return mockApi(({ method, path }) => {
      if (method === 'POST' && path === '/admin/leads/l1/activities') return json({ data: answer }, 201);
      if (path === '/admin/leads/l1/customer-matches') return json({ data: [] });
      if (path === '/public/bootstrap') {
        return json({ data: { booking: { slots: [{ key: 'morning', label: 'Morning', window: '8:00 – 12:00', startHour: 8 }] } } });
      }
      if (path === '/public/availability') return json({ data: { days: [] } });
      if (path === '/admin/technicians') return json({ data: [] });
      return undefined;
    });
  }

  const pickOutcome = async (user, name) => {
    await user.click(screen.getByRole('combobox', { name: /What came of it/ }));
    await user.click(await screen.findByRole('option', { name }));
  };
  const activityPosts = (calls) => calls.filter((c) => c.method === 'POST' && c.path === '/admin/leads/l1/activities');

  it('"Call back at…" needs a time before it saves', async () => {
    const user = userEvent.setup();
    const calls = composerApi();
    renderWithProviders(<ActivityComposer lead={LEAD} />, { preloadedState: signedInAs('SALES') });

    await pickOutcome(user, 'Call back at…');
    expect(screen.getByRole('button', { name: 'When' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Log it' }));
    expect(await screen.findByText('When should we call back?')).toBeInTheDocument();
    expect(activityPosts(calls)).toHaveLength(0);
  });

  it('"Interested — book a visit" saves with the outcome as the summary, then opens the visit booking', async () => {
    const user = userEvent.setup();
    const calls = composerApi();
    const onLogged = vi.fn();
    const { store } = renderWithProviders(<ActivityComposer lead={LEAD} onLogged={onLogged} />, { preloadedState: signedInAs('SALES') });

    await pickOutcome(user, 'Interested — book a visit');
    expect(screen.getByRole('switch', { name: /Set a different next action/ })).not.toBeChecked();
    await user.click(screen.getByRole('button', { name: 'Log it' }));

    await waitFor(() => expect(activityPosts(calls)[0]?.body).toEqual({
      type: 'call', outcome: 'book_visit', summary: 'Interested — book a visit',
    }));
    const dialog = await screen.findByRole('dialog', { name: 'Book the site visit' });
    expect(toastTitles(store)).toContain('Call logged — Interested — book a visit');
    // The caller hears once the booking is done or dropped.
    expect(onLogged).not.toHaveBeenCalled();
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(onLogged).toHaveBeenCalledWith(expect.objectContaining({ dialog: 'visit' }), null));
  });

  it('"Not interested" closes the lead, so it needs the lost category', async () => {
    const user = userEvent.setup();
    const calls = composerApi({ ...ANSWER, outcome: 'not_interested', dialog: null, lead: { id: 'l1', status: 'LOST' } });
    renderWithProviders(<ActivityComposer lead={{ ...LEAD, status: 'CONTACTED' }} />, { preloadedState: signedInAs('SALES') });

    await pickOutcome(user, 'Not interested');
    await user.click(screen.getByRole('button', { name: 'Log it' }));
    expect(await screen.findByText(/pick why it was lost/)).toBeInTheDocument();
    expect(activityPosts(calls)).toHaveLength(0);

    await user.click(screen.getByRole('combobox', { name: /Why was it lost/ }));
    await user.click(await screen.findByRole('option', { name: 'Using own mistri / thekedar' }));
    await user.type(screen.getByLabelText(/^Summary/), 'उनीहरूले आफ्नै मिस्त्री ल्याउने');
    await user.click(screen.getByRole('button', { name: 'Log it' }));
    await waitFor(() => expect(activityPosts(calls)[0]?.body).toEqual({
      type: 'call', outcome: 'not_interested', summary: 'उनीहरूले आफ्नै मिस्त्री ल्याउने', close: { lostCategory: 'OWN_LABOUR' },
    }));
  });

  it('"Wrong number" asks for a next action or the lead closed', async () => {
    const user = userEvent.setup();
    const calls = composerApi();
    renderWithProviders(<ActivityComposer lead={LEAD} />, { preloadedState: signedInAs('SALES') });

    await pickOutcome(user, 'Wrong number');
    await user.click(screen.getByRole('button', { name: 'Log it' }));
    expect(await screen.findByText('Set a next action or close the lead')).toBeInTheDocument();
    expect(activityPosts(calls)).toHaveLength(0);
  });

  it('a note has no outcome, and neither does a closed lead', async () => {
    const user = userEvent.setup();
    composerApi();
    const { unmount } = renderWithProviders(<ActivityComposer lead={LEAD} defaultType="note" />, { preloadedState: signedInAs('SALES') });
    expect(screen.queryByRole('combobox', { name: /What came of it/ })).not.toBeInTheDocument();
    await user.click(screen.getByRole('combobox', { name: /What happened/ }));
    await user.click(await screen.findByRole('option', { name: 'WhatsApp' }));
    expect(screen.getByRole('combobox', { name: /What came of it/ })).toBeInTheDocument();
    unmount();

    renderWithProviders(<ActivityComposer lead={{ ...LEAD, status: 'LOST' }} />, { preloadedState: signedInAs('SALES') });
    expect(screen.queryByRole('combobox', { name: /What came of it/ })).not.toBeInTheDocument();
  });
});

describe('the lost dialog', () => {
  it('requires a category, and words for "Other"', async () => {
    const user = userEvent.setup();
    mockApi(() => undefined);
    const onSubmit = vi.fn(async () => {});
    renderWithProviders(<LostReasonDialog open leadName="Sita Rai" onOpenChange={() => {}} onSubmit={onSubmit} />);

    const dialog = await screen.findByRole('dialog', { name: 'Mark Sita Rai as lost' });
    await user.click(within(dialog).getByRole('button', { name: 'Mark as lost' }));
    expect(await within(dialog).findByText('Pick why the lead was lost')).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();

    await user.click(within(dialog).getByRole('combobox', { name: /Why was it lost/ }));
    await user.click(await screen.findByRole('option', { name: 'Other' }));
    await user.click(within(dialog).getByRole('button', { name: 'Mark as lost' }));
    expect(await within(dialog).findByText(/“Other” needs a reason/)).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();

    await user.type(within(dialog).getByLabelText(/In their words/), 'Moved abroad');
    await user.click(within(dialog).getByRole('button', { name: 'Mark as lost' }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith({ lostCategory: 'OTHER', lostReason: 'Moved abroad' }));
  });

  it('sends no reason when none is typed', async () => {
    const user = userEvent.setup();
    mockApi(() => undefined);
    const onSubmit = vi.fn(async () => {});
    renderWithProviders(<LostReasonDialog open leadName="Sita Rai" onOpenChange={() => {}} onSubmit={onSubmit} />);
    const dialog = await screen.findByRole('dialog', { name: 'Mark Sita Rai as lost' });
    await user.click(within(dialog).getByRole('combobox', { name: /Why was it lost/ }));
    await user.click(await screen.findByRole('option', { name: 'Price too high' }));
    await user.click(within(dialog).getByRole('button', { name: 'Mark as lost' }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith({ lostCategory: 'PRICE' }));
  });
});

describe('the leads list — follow-up views', () => {
  const ROWS = [
    { ...LEAD, id: 'o1', name: 'Overdue Lead', status: 'CONTACTED', nextActionAt: iso(-3 * HOUR), nextActionType: 'CALL', stageEnteredAt: iso(-5 * DAY) },
    { ...LEAD, id: 'n1', name: 'Nothing Next', status: 'CONTACTED', stageEnteredAt: iso(-HOUR) },
  ];

  it('Due today, Overdue and No next action ask the API for `nextAction`, on My leads or All leads', async () => {
    const user = userEvent.setup();
    const calls = mockApi(({ path }) => (path === '/admin/leads' ? page(ROWS) : undefined));
    const { router } = renderWithProviders(<LeadsPage />, { path: '/admin/leads', preloadedState: signedInAs('SALES') });
    await screen.findByText('Overdue Lead');

    await user.click(screen.getByRole('button', { name: 'Due today' }));
    await waitFor(() => expect(leadRequests(calls).at(-1).query).toMatchObject({ nextAction: 'due_today', assignedToId: 'me' }));
    expect(router.state.location.search).toContain('nextAction=due_today');
    expect(screen.getByRole('button', { name: 'Due today' })).toHaveAttribute('aria-pressed', 'true');

    // The view narrows whichever list is showing: All leads keeps "Due today" on.
    await user.click(screen.getByRole('radio', { name: 'All leads' }));
    await waitFor(() => expect(leadRequests(calls).at(-1).query).not.toHaveProperty('assignedToId'));
    expect(leadRequests(calls).at(-1).query).toMatchObject({ nextAction: 'due_today' });
    expect(screen.getByRole('button', { name: 'Due today' })).toHaveAttribute('aria-pressed', 'true');

    await user.click(screen.getByRole('button', { name: 'Overdue' }));
    await waitFor(() => expect(leadRequests(calls).at(-1).query).toMatchObject({ nextAction: 'overdue' }));

    await user.click(screen.getByRole('button', { name: 'No next action' }));
    await waitFor(() => expect(leadRequests(calls).at(-1).query).toMatchObject({ nextAction: 'none' }));

    // Another preset clears it.
    await user.click(screen.getByRole('button', { name: 'Breached' }));
    await waitFor(() => expect(leadRequests(calls).at(-1).query).toMatchObject({ slaRisk: 'breached' }));
    expect(leadRequests(calls).at(-1).query).not.toHaveProperty('nextAction');
  });

  it('shows each row’s next action and its days in stage', async () => {
    mockApi(({ path }) => (path === '/admin/leads' ? page(ROWS) : undefined));
    renderWithProviders(<LeadsPage />, { path: '/admin/leads', preloadedState: signedInAs('SALES') });
    const overdue = (await screen.findByText('Overdue Lead')).closest('tr');
    expect(within(overdue).getByText(/Overdue · 3 h/)).toBeInTheDocument();
    expect(within(overdue).getByText('5d in stage')).toBeInTheDocument();
    const none = screen.getByText('Nothing Next').closest('tr');
    expect(within(none).getByText('None set')).toBeInTheDocument();
    expect(within(none).getByText('In stage today')).toBeInTheDocument();
  });
});

describe('the lead page', () => {
  const DETAIL = {
    ...LEAD, status: 'CONTACTED', firstResponseAt: iso(-2 * HOUR), sla: { state: 'met', respondedAt: iso(-2 * HOUR) },
    nextActionAt: iso(-30 * 60_000), nextActionType: 'CALL', contactAttempts: 1,
    qualification: { propertyType: 'house', floors: 3 },
    activities: [{ id: 'a1', type: 'call', outcome: 'no_answer', summary: 'No answer / switched off', createdAt: iso(-2 * HOUR), user: { name: 'Hari KC' } }],
    quotations: [], jobs: [],
  };

  function detailApi(detail = DETAIL) {
    return mockApi(({ method, path }) => {
      if (method === 'GET' && path === '/admin/leads/l1') return json({ data: detail });
      if (path === '/admin/leads/l1/duplicates') return json({ data: [] });
      if (method === 'PUT' && path === '/admin/leads/l1') return json({ data: detail });
      if (method === 'PATCH') return json({ data: { ...detail, status: 'LOST' } });
      return undefined;
    });
  }

  it('?markLost=1 opens the Mark lost dialog once, and leaves the address', async () => {
    const user = userEvent.setup();
    const calls = detailApi();
    const { router } = renderWithProviders(<LeadDetailPage />, {
      path: '/admin/leads/:id', initialPath: '/admin/leads/l1?markLost=1', preloadedState: signedInAs('SALES'),
    });

    const dialog = await screen.findByRole('dialog', { name: 'Mark सीता राई as lost' });
    await waitFor(() => expect(router.state.location.search).not.toContain('markLost'));
    await user.click(within(dialog).getByRole('combobox', { name: /Why was it lost/ }));
    await user.click(await screen.findByRole('option', { name: 'Postponed indefinitely' }));
    await user.click(within(dialog).getByRole('button', { name: 'Mark as lost' }));
    await waitFor(() => expect(calls.find((c) => c.method === 'PATCH')).toMatchObject({
      path: '/admin/leads/l1/status', body: { status: 'LOST', lostCategory: 'POSTPONED' },
    }));
  });

  it('?markLost=1&category=PRICE starts the dialog on the customer’s decline reason (Phase L4)', async () => {
    const user = userEvent.setup();
    const calls = detailApi();
    const { router } = renderWithProviders(<LeadDetailPage />, {
      path: '/admin/leads/:id', initialPath: '/admin/leads/l1?markLost=1&category=PRICE', preloadedState: signedInAs('SALES'),
    });
    const dialog = await screen.findByRole('dialog', { name: 'Mark सीता राई as lost' });
    await waitFor(() => expect(router.state.location.search).toBe(''));
    expect(within(dialog).getByRole('combobox', { name: /Why was it lost/ })).toHaveTextContent('Price too high');
    // A person still decides: nothing is sent until they confirm.
    expect(calls.some((c) => c.method === 'PATCH')).toBe(false);
    await user.click(within(dialog).getByRole('button', { name: 'Mark as lost' }));
    await waitFor(() => expect(calls.find((c) => c.method === 'PATCH')).toMatchObject({
      path: '/admin/leads/l1/status', body: { status: 'LOST', lostCategory: 'PRICE' },
    }));
  });

  it('ignores a category it does not know', async () => {
    detailApi();
    renderWithProviders(<LeadDetailPage />, {
      path: '/admin/leads/:id', initialPath: '/admin/leads/l1?markLost=1&category=NOT_A_REASON', preloadedState: signedInAs('SALES'),
    });
    const dialog = await screen.findByRole('dialog', { name: 'Mark सीता राई as lost' });
    expect(within(dialog).getByRole('combobox', { name: /Why was it lost/ })).not.toHaveTextContent('Price too high');
  });

  it('shows the next action, the outcome in the timeline, and what qualification is missing', async () => {
    const user = userEvent.setup();
    const calls = detailApi();
    renderWithProviders(<LeadDetailPage />, { path: '/admin/leads/:id', initialPath: '/admin/leads/l1', preloadedState: signedInAs('SALES') });

    const card = await screen.findByRole('region', { name: /Next action/ });
    expect(within(card).getByText('Overdue')).toBeInTheDocument();
    expect(screen.getByText('No answer / switched off', { selector: 'p.text-xs' })).toBeInTheDocument();
    expect(screen.getByText('House')).toBeInTheDocument();
    expect(screen.getByText(/building age, budget, decision maker/)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Edit qualification' }));
    const dialog = await screen.findByRole('dialog', { name: 'Qualify सीता राई' });
    await user.click(within(dialog).getByRole('combobox', { name: /Who decides/ }));
    await user.click(await screen.findByRole('option', { name: 'Owner abroad (decides remotely)' }));
    await user.click(within(dialog).getByRole('combobox', { name: /Budget/ }));
    await user.click(await screen.findByRole('option', { name: 'Rs 1 – 5 lakh' }));
    await user.click(within(dialog).getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(calls.find((c) => c.method === 'PUT')?.body).toEqual({
      qualification: { propertyType: 'house', floors: 3, decisionMaker: 'owner_abroad', budgetBand: '1l_5l' },
    }));
  });
});

describe('the lead page — Change status runs the board’s rules', () => {
  it('Quoted without a quotation opens the new-quotation sheet instead of moving the lead', async () => {
    const user = userEvent.setup();
    const calls = mockApi(({ method, path }) => {
      if (method === 'GET' && path === '/admin/leads/l1') {
        return json({ data: { ...LEAD, status: 'CONTACTED', activities: [], quotations: [], jobs: [] } });
      }
      if (path === '/admin/leads/l1/duplicates') return json({ data: [] });
      if (path === '/admin/leads/l1/customer-matches') return json({ data: [] });
      return undefined;
    });
    renderWithProviders(<LeadDetailPage />, { path: '/admin/leads/:id', initialPath: '/admin/leads/l1', preloadedState: signedInAs('SALES') });

    await user.click(await screen.findByRole('button', { name: /Change status/ }));
    await user.click(await screen.findByRole('menuitem', { name: 'Quoted' }));
    expect(await screen.findByRole('dialog', { name: 'New quotation' })).toBeInTheDocument();
    expect(calls.some((c) => c.method === 'PATCH')).toBe(false);
  });
});

describe('the lost-lead report', () => {
  const REPORT = {
    total: 4,
    byCategory: [{ category: 'COMPETITOR', count: 3 }, { category: 'OWN_LABOUR', count: 1 }],
    rows: [
      { category: 'COMPETITOR', stage: 'QUOTED', serviceId: 's1', serviceName: 'Waterproofing', count: 2 },
      { category: 'COMPETITOR', stage: 'INSPECTION_SCHEDULED', serviceId: 's1', serviceName: 'Waterproofing', count: 1 },
      { category: 'OWN_LABOUR', stage: 'CONTACTED', serviceId: null, serviceName: null, count: 1 },
    ],
  };

  it('asks for a date range and shows categories, then category × stage × service', async () => {
    const calls = mockApi(({ path }) => (path === '/admin/reports/lost' ? json({ data: REPORT }) : undefined));
    renderWithProviders(<LostReportPage />, { path: '/admin/reports/lost', preloadedState: signedInAs('SALES') });

    const summary = await screen.findByRole('list', { name: 'Lost leads by category' });
    expect(within(summary).getByText('Went with a competitor')).toBeInTheDocument();
    expect(within(summary).getByText('· 75%')).toBeInTheDocument();
    expect(screen.getByText('4 leads lost')).toBeInTheDocument();

    const query = calls.find((c) => c.path === '/admin/reports/lost').query;
    expect(query.from).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(query.to).toMatch(/^\d{4}-\d{2}-\d{2}$/);

    const rows = screen.getAllByRole('row').slice(1);
    expect(rows).toHaveLength(3);
    expect(within(rows[0]).getByText('Quoted')).toBeInTheDocument();
    expect(within(rows[0]).getByText('Waterproofing')).toBeInTheDocument();
    expect(within(rows[0]).getByText('50%')).toBeInTheDocument();
    expect(within(rows[2]).getByText('General enquiry')).toBeInTheDocument();
    expect(within(rows[2]).getByText('Using own mistri / thekedar')).toBeInTheDocument();
  });
});
