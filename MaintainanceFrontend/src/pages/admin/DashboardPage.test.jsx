import { afterEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import DashboardPage from '@/pages/admin/DashboardPage';
import { renderWithProviders, signedInAs } from '@/test/renderWithProviders';
import { json, mockApi } from '@/test/mockApi';
import { dayParts, lastDays, shiftDay } from '@/helpers/dashboard';
import { ktmDay } from '@/helpers/dispatchBoard';

afterEach(() => vi.unstubAllGlobals());

const as = (role, name = 'Asha Admin') => ({ auth: { ...signedInAs(role).auth, user: { id: 'me', name, role } } });
const NOTE = { id: 'n1', title: 'New booking — Sita', body: 'Tile work', link: '/leads/l1', readAt: null, createdAt: new Date().toISOString() };
const serve = (data, notes = [NOTE]) => mockApi(({ path }) => {
  if (path === '/admin/dashboard') return json({ data });
  if (path === '/admin/notifications') return json({ data: notes, meta: { unread: notes.filter((n) => !n.readAt).length } });
  return undefined;
});

const today = ktmDay();
const leadTrend = lastDays(14, today).map((day, i) => ({ day, leads: i < 7 ? 1 : 2, won: i === 13 ? 1 : 0 }));
const jobsWeek = Array.from({ length: 7 }, (_, i) => ({ day: shiftDay(today, i), jobs: i === 2 ? 5 : 1 }));

const ADMIN = {
  leadHeatmap: {
    bands: ['Before 8', '8–10', '10–12', '12–2', '2–4', '4–6', 'After 6'].map((label, i) => ({ key: `b${i}`, label })),
    cells: Array.from({ length: 7 }, (_, d) => Array.from({ length: 7 }, (_, b) => (d === 5 && b === 2 ? 4 : d === 1 ? 1 : 0))),
    total: 11,
  },
  slaQueue: {
    total: 3,
    items: [{ id: 'l1', name: 'Sita Sharma', area: 'Baneshwor', priority: 'URGENT', source: 'whatsapp', slaDueAt: new Date(Date.now() - 600_000).toISOString(), createdAt: new Date().toISOString(), service: 'Waterproofing', assignedTo: null }],
  },
  quotationPipeline: {
    stages: [
      { status: 'DRAFT', count: 1, value: 1_000_000 },
      { status: 'PENDING_APPROVAL', count: 2, value: 12_345_678 },
      { status: 'OFFICE_APPROVED', count: 0, value: 0 },
      { status: 'SENT', count: 1, value: 500_050 },
      { status: 'CHANGES_REQUESTED', count: 0, value: 0 },
    ],
    openCount: 4, openValue: 13_845_728, won: 3, lost: 1, wonValue: 9_000_000, winRate: 75,
  },
  todaysJobs: {
    total: 9,
    items: [{
      id: 'j1', number: 'JOB-1', title: 'Fix leaking tap', status: 'ASSIGNED', priority: 'HIGH',
      scheduledStart: '2026-09-17T03:15:00Z', scheduledEnd: '2026-09-17T05:15:00Z', customer: 'Ram Karki', area: 'Sanepa', technicians: ['Hari Tech'],
    }],
  },
  technicianLoad: [
    { id: 't1', name: 'Hari Tech', isAvailable: true, capacity: 2, jobs: 2 },
    { id: 't2', name: 'Suresh Tech', isAvailable: false, capacity: 4, jobs: 0 },
  ],
  role: 'ADMIN',
  cards: { leadsToday: 2, slaBreached: 3, stockLow: 1, jobsUnassigned: 0, outstandingAmount: 12_345_600 },
  funnel: {
    total: 10, lost: 2,
    stages: [
      { key: 'NEW', label: 'Enquiries', count: 10, pct: 100 },
      { key: 'CONTACTED', label: 'Contacted', count: 8, pct: 80 },
      { key: 'QUOTED', label: 'Quoted', count: 4, pct: 40 },
      { key: 'WON', label: 'Won', count: 2, pct: 20 },
    ],
  },
  sla: {
    total: 10, responded: 9, neverResponded: 1, onTime: 8, complianceRate: 80, medianResponseMinutes: 95,
    byStaff: [{ staff: 'Sita Sales', total: 6, responded: 6, onTime: 5, complianceRate: 83.3 }],
  },
  leadTrend,
  sources: [{ source: 'whatsapp', total: 6, won: 2, lost: 1, open: 3, estimatedValue: 0, conversionRate: 33.3 }],
  jobsWeek,
  jobStatus: { DRAFT: 2, IN_PROGRESS: 1, ON_HOLD: 1 },
  revenue: {
    groupBy: 'day',
    rows: [{ key: today, invoiced: 5_000_000, collected: 2_500_000, outstanding: 2_500_000, count: 2 }],
    totals: { invoiced: 5_000_000, collected: 2_500_000, outstanding: 2_500_000, count: 2 },
  },
};

describe('DashboardPage', () => {
  it('greets by first name and lists what needs someone, worst first, as links', async () => {
    serve(ADMIN);
    renderWithProviders(<DashboardPage />, { path: '/admin', preloadedState: as('ADMIN') });

    expect(await screen.findByRole('heading', { level: 1, name: /, Asha$/ })).toBeInTheDocument();
    const hero = screen.getByRole('region', { name: 'Today' });
    const chips = within(await within(hero).findByRole('list', { name: 'Needs attention' })).getAllByRole('link');
    expect(chips.map((c) => c.getAttribute('href'))).toEqual(['/admin/sla', '/admin/stock?lowOnly=true']);
    expect(chips[0]).toHaveTextContent('3past the 2-hour promise');
    expect(hero).toHaveTextContent('4 items waiting on the team');
  });

  it('draws every chart an admin is sent, each with a table twin', async () => {
    const user = userEvent.setup();
    serve(ADMIN);
    renderWithProviders(<DashboardPage />, { path: '/admin', preloadedState: as('ADMIN') });

    for (const title of [
      'Enquiries', 'The 2-hour promise', 'The week ahead', 'Open jobs by stage', 'Invoiced and collected', 'From enquiry to job',
      'Where enquiries come from', 'Call these next', 'Quotation pipeline', 'When enquiries arrive', 'Today’s run sheet', 'Crew today',
      'Latest for you',
    ]) {
      expect(await screen.findByRole('region', { name: title })).toBeInTheDocument();
    }

    // This week (2 × 7) against last (1 × 7).
    expect(screen.getByRole('link', { name: 'Leads today: 2' })).toHaveTextContent('+100%this week vs last');
    // An outstanding balance is a dimmed, unlinked tile until invoices exist.
    expect(screen.queryByRole('link', { name: /^Outstanding/ })).not.toBeInTheDocument();

    const week = screen.getByRole('region', { name: 'The week ahead' });
    const busiest = dayParts(jobsWeek[2].day);
    expect(within(week).getByText(`11 jobs booked · busiest ${busiest.weekday}`)).toBeInTheDocument();
    await user.click(within(week).getByRole('button', { name: 'Show as table' }));
    const rows = within(week).getAllByRole('rowheader').map((r) => r.textContent);
    expect(rows).toHaveLength(7);
    expect(rows[2]).toBe(`${busiest.weekday} ${busiest.date}`);

    const sla = screen.getByRole('region', { name: 'The 2-hour promise' });
    expect(within(sla).getByRole('meter')).toHaveAttribute('aria-valuenow', '80');
    expect(within(sla).getByText('Slipping')).toBeInTheDocument();
    expect(within(sla).getByText('1 h 35 min')).toBeInTheDocument();

    // The numbers sit in named groups; the lead group carries the weekly trend.
    expect(within(screen.getByRole('region', { name: 'Leads' })).getByRole('link', { name: 'SLA breached: 3' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Jobs and stock' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Operations' })).toBeInTheDocument();

    const queue = screen.getByRole('region', { name: 'Call these next' });
    expect(within(queue).getByRole('link', { name: /Sita Sharma/ })).toHaveAttribute('href', '/admin/leads/l1');
    expect(within(queue).getByText(/overdue/)).toBeInTheDocument();
    expect(within(queue).getByText('unassigned')).toBeInTheDocument();

    const pipeline = screen.getByRole('region', { name: 'Quotation pipeline' });
    // The open value glides up to its figure, then settles on exact paisa-derived rupees.
    await waitFor(() => expect(pipeline).toHaveTextContent('Open valueRs. 1,38,457'), { timeout: 3000 });
    expect(pipeline).toHaveTextContent('75%');
    expect(within(pipeline).getByRole('link', { name: /Needs approval/ })).toHaveAttribute('href', '/admin/quotations?stage=approval');

    const heat = screen.getByRole('region', { name: 'When enquiries arrive' });
    expect(within(heat).getByRole('cell', { name: 'Fri 10–12: 4 enquiries' })).toBeInTheDocument();
    expect(heat).toHaveTextContent('4 on Fri, 10–12 — the busiest slot');

    const sheet = screen.getByRole('region', { name: 'Today’s run sheet' });
    expect(within(sheet).getByRole('link', { name: /Fix leaking tap/ })).toHaveAttribute('href', '/admin/jobs/j1');
    expect(sheet).toHaveTextContent('09:00–11:00');
    expect(within(sheet).getByRole('link', { name: 'See all 9 jobs today' })).toBeInTheDocument();

    const crew = screen.getByRole('region', { name: 'Crew today' });
    expect(crew).toHaveTextContent('2 of 2 slots booked · 0 free');
    expect(crew).toHaveTextContent('2/2 · full');
    expect(crew).toHaveTextContent('Off today');

    const latest = screen.getByRole('region', { name: 'Latest for you' });
    expect(await within(latest).findByRole('button', { name: /New booking — Sita/ })).toHaveTextContent('(unread)');

    const status = screen.getByRole('region', { name: 'Open jobs by stage' });
    expect(within(status).getByRole('link', { name: /On hold\s*1/ })).toHaveAttribute('href', '/admin/jobs?status=ON_HOLD');
  });

  it('opens a day of the week ahead from its column', async () => {
    const user = userEvent.setup();
    serve(ADMIN);
    const { router } = renderWithProviders(<DashboardPage />, {
      path: '/admin', preloadedState: as('ADMIN'), routes: [{ path: '/admin/jobs', element: <p>Jobs list</p> }],
    });
    const week = await screen.findByRole('region', { name: 'The week ahead' });
    const items = within(week).getAllByRole('listitem');
    await user.click(items[2]);
    expect(router.state.location.search).toBe(`?from=${jobsWeek[2].day}&to=${jobsWeek[2].day}`);
  });

  it('shows a technician just their tile and an all-clear', async () => {
    serve({ role: 'TECHNICIAN', cards: { jobsToday: 0 } }, []);
    renderWithProviders(<DashboardPage />, { path: '/admin', preloadedState: as('TECHNICIAN', 'Ram Tech') });

    expect(await screen.findByRole('img', { name: 'All clear' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Jobs today: 0' })).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Enquiries' })).not.toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Jobs and stock' })).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Operations' })).not.toBeInTheDocument();
    expect(await screen.findByText('Nothing new.')).toBeInTheDocument();
  });
});
