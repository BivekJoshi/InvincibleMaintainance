import { afterEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router-dom';
import WarrantiesPage from '@/pages/admin/WarrantiesPage';
import WarrantyDetailPage from '@/pages/admin/WarrantyDetailPage';
import WarrantyClaimsPage from '@/pages/admin/WarrantyClaimsPage';
import AmcContractsPage from '@/pages/admin/AmcContractsPage';
import AmcContractDetailPage from '@/pages/admin/AmcContractDetailPage';
import ServiceRemindersPage from '@/pages/admin/ServiceRemindersPage';
import CustomerDetailPage from '@/pages/admin/CustomerDetailPage/CustomerDetailPage';
import { AmcContractSheet } from '@/components/aftercare/AmcContractSheet';
import { renderWithProviders, signedInAs } from '@/test/renderWithProviders';
import { json, mockApi, page } from '@/test/mockApi';

afterEach(() => vi.unstubAllGlobals());

/** An instant on a Kathmandu day at a Kathmandu time. */
const at = (day, hhmm = '00:00') => new Date(`${day}T${hhmm}:00+05:45`).toISOString();
const toastTitles = (store) => store.getState().ui.toasts.map((t) => t.title);
const soonAfter = (days) => new Date(Date.now() + days * 86_400_000).toISOString();

const CUSTOMER = { id: 'c1', name: 'सीता राई', phone: '9841234567', email: 'sita@example.com' };
const JOB = { id: 'j1', number: 'JOB-2083-0042', title: 'Terrace waterproofing', type: 'REPAIR', actualEnd: at('2026-09-01', '15:00') };
/** A claim row's job carries `service` — its lead's service, else its quotation's lead's — or null. */
const WARRANTY_REF = { id: 'w1', status: 'CLAIMED', endsAt: soonAfter(12), publicToken: 'tok-w1', job: { ...JOB, service: null }, customer: CUSTOMER };

const OPEN = {
  id: 'cl1', description: 'छतबाट फेरि पानी चुहियो — the terrace leaks again after the rain.', status: 'open',
  rejectReason: null, createdAt: at('2026-09-27', '09:30'), resolvedAt: null, resolvedJob: null, warranty: WARRANTY_REF,
};
const FREE_JOB = { id: 'j9', number: 'JOB-2083-0050', status: 'DRAFT' };
const ACCEPTED = {
  ...OPEN, id: 'cl2', description: 'Bathroom tiles came loose.', status: 'accepted', resolvedJob: { id: 'j8', number: 'JOB-2083-0049', status: 'ASSIGNED' },
  warranty: { ...WARRANTY_REF, id: 'w2', job: { ...JOB, id: 'j2', number: 'JOB-2083-0031' } },
};
const REJECTED = {
  ...OPEN, id: 'cl3', description: 'Paint faded on the gate.', status: 'rejected', rejectReason: 'Not our work',
  warranty: { ...WARRANTY_REF, id: 'w3', job: { ...JOB, id: 'j3', number: 'JOB-2083-0012' } },
};
const RATES = {
  totalWarranties: 40, totalClaims: 2, claimRate: 5,
  byType: [{ type: 'REPAIR', warranties: 20, claims: 2, claimRate: 10 }],
  byService: [
    { service: 'Waterproofing', warranties: 8, claims: 1, claimRate: 12.5 },
    { service: 'Other', warranties: 32, claims: 1, claimRate: 3.1 },
  ],
};

/** Two audit rows for a record: the newest a named event (or, without one, the record added), then a plain update. */
const HISTORY = (model, recordId, event, after) => [
  {
    id: `${recordId}-h2`, event, action: event ? 'update' : 'create', model, recordId, actorType: 'user',
    actor: { id: 'u-d', name: 'Dipak Dispatch', role: 'DISPATCHER' }, before: event ? { status: 'ACTIVE' } : null,
    after: event ? { status: 'VOID' } : after, changes: null, createdAt: at('2026-09-27', '11:00'),
  },
  {
    id: `${recordId}-h1`, event: null, action: 'update', model, recordId, actorType: 'user',
    actor: { id: 'u-d', name: 'Dipak Dispatch', role: 'DISPATCHER' }, before: {}, after, changes: null, createdAt: at('2026-09-20', '10:00'),
  },
];

const renderAt = (element, pattern, path, role) => renderWithProviders(
  <Routes>
    {[].concat(pattern).map((p) => <Route key={p} path={p} element={element} />)}
    <Route path="/admin/jobs/:id" element={<p>Job page</p>} />
    <Route path="/admin/amc-contracts/:id" element={element} />
  </Routes>,
  { path: '*', initialPath: path, preloadedState: signedInAs(role) },
);
const renderClaims = (path, role) => renderAt(<WarrantyClaimsPage />, ['/admin/warranty-claims', '/admin/warranty-claims/:id'], path, role);

describe('the claims queue (I7)', () => {
  it('lists open claims first (the API’s order), filters by tab, and lets a reader open one without deciding', async () => {
    const user = userEvent.setup();
    const calls = mockApi(({ path }) => {
      if (path === '/admin/warranty-claims') return page([OPEN, ACCEPTED, REJECTED]);
      if (path === '/admin/warranty-claims/cl1') return json({ data: OPEN });
      return undefined;
    });
    renderClaims('/admin/warranty-claims', 'SALES');

    expect(await screen.findByText(OPEN.description)).toBeInTheDocument();
    const rows = screen.getAllByRole('row').map((r) => r.textContent);
    const index = (text) => rows.findIndex((t) => t.includes(text));
    expect(index(OPEN.description)).toBeLessThan(index(ACCEPTED.description));
    expect(index(ACCEPTED.description)).toBeLessThan(index(REJECTED.description));
    expect(calls.find((c) => c.path === '/admin/warranty-claims').query.status).toBeUndefined();
    // An accepted claim links its free job; a rejected one shows why.
    expect(screen.getByRole('link', { name: 'JOB-2083-0049' })).toHaveAttribute('href', '/admin/jobs/j8');
    expect(screen.getByText('Not our work')).toBeInTheDocument();

    await user.click(screen.getByRole('tab', { name: 'Open' }));
    await waitFor(() => expect(calls.filter((c) => c.path === '/admin/warranty-claims').at(-1).query).toMatchObject({ status: 'open' }));

    await user.click(screen.getByText(OPEN.description));
    const sheet = await screen.findByRole('dialog', { name: 'Claim on JOB-2083-0042' });
    expect(within(sheet).getByText(OPEN.description)).toBeInTheDocument();
    expect(within(sheet).queryByRole('button', { name: /Accept/ })).not.toBeInTheDocument();
    expect(within(sheet).getByText('Dispatch decides claims; you can read them.')).toBeInTheDocument();
    // SALES holds no reports:ops, so the rate is not even asked for.
    expect(calls.some((c) => c.path === '/admin/reports/warranty-claims')).toBe(false);
  });

  it('accepts an open claim: the free job is created, linked, and waits unassigned in the dispatch queue', async () => {
    const user = userEvent.setup();
    let claim = OPEN;
    const calls = mockApi(({ method, path }) => {
      if (path === '/admin/warranty-claims') return page([claim]);
      if (path === '/admin/warranty-claims/cl1' && method === 'PATCH') {
        claim = { ...OPEN, status: 'accepted', resolvedJob: FREE_JOB };
        return json({ data: claim });
      }
      if (path === '/admin/warranty-claims/cl1') return json({ data: claim });
      if (path === '/admin/reports/warranty-claims') return json({ data: RATES });
      return undefined;
    });
    const { store } = renderClaims('/admin/warranty-claims/cl1', 'DISPATCHER');

    const sheet = await screen.findByRole('dialog', { name: 'Claim on JOB-2083-0042' });
    // The claim rate for the job's work — its type, since the claim's job has no service (null) — beside the overall one.
    const rate = await within(sheet).findByRole('region', { name: 'Claim rate' });
    expect(rate).toHaveTextContent('10% for Repair — 2 claims on 20 warranties');
    expect(rate).toHaveTextContent('All warranted work: 5% (2 of 40)');
    expect(calls.find((c) => c.path === '/admin/reports/warranty-claims').query).toHaveProperty('from');

    const decide = within(sheet).getByRole('group', { name: 'Decide' });
    expect(within(decide).getAllByRole('button').map((b) => b.textContent.trim())).toEqual(['Accept', 'Reject', 'Resolve']);
    await user.click(within(sheet).getByRole('button', { name: 'Accept — create the free job' }));

    await waitFor(() => expect(calls.find((c) => c.method === 'PATCH')?.body).toEqual({ status: 'accepted' }));
    const open = await within(sheet).findByRole('link', { name: /Open JOB-2083-0050/ });
    expect(open).toHaveAttribute('href', '/admin/jobs/j9');
    expect(within(sheet).getByText(/it waits in the dispatch queue/)).toBeInTheDocument();
    expect(within(sheet).getByRole('link', { name: /Dispatch board/ })).toHaveAttribute('href', '/admin/dispatch');
    expect(toastTitles(store)).toContain('Free job JOB-2083-0050 created');
    // Accepted, it can still be resolved — nothing else.
    expect(within(within(sheet).getByRole('group', { name: 'Decide' })).getAllByRole('button').map((b) => b.textContent.trim())).toEqual(['Resolve']);
  });

  it('shows the claim rate for the job’s service when the claim names one (byService, not the type)', async () => {
    const withService = { ...OPEN, warranty: { ...WARRANTY_REF, job: { ...WARRANTY_REF.job, service: 'Waterproofing' } } };
    mockApi(({ path }) => {
      if (path === '/admin/warranty-claims') return page([withService]);
      if (path === '/admin/warranty-claims/cl1') return json({ data: withService });
      if (path === '/admin/reports/warranty-claims') return json({ data: RATES });
      return undefined;
    });
    renderClaims('/admin/warranty-claims/cl1', 'DISPATCHER');

    const sheet = await screen.findByRole('dialog', { name: 'Claim on JOB-2083-0042' });
    const rate = await within(sheet).findByRole('region', { name: 'Claim rate' });
    expect(rate).toHaveTextContent('12.5% for Waterproofing — 1 claim on 8 warranties');
    expect(rate).not.toHaveTextContent('Repair');
    expect(rate).toHaveTextContent('All warranted work: 5% (2 of 40)');
  });

  it('will not reject without a reason, and sends the reason as written', async () => {
    const user = userEvent.setup();
    const calls = mockApi(({ method, path, body }) => {
      if (path === '/admin/warranty-claims') return page([OPEN]);
      if (path === '/admin/warranty-claims/cl1' && method === 'PATCH') return json({ data: { ...OPEN, ...body } });
      if (path === '/admin/warranty-claims/cl1') return json({ data: OPEN });
      if (path === '/admin/reports/warranty-claims') return json({ data: RATES });
      return undefined;
    });
    renderClaims('/admin/warranty-claims/cl1', 'DISPATCHER');

    const sheet = await screen.findByRole('dialog', { name: 'Claim on JOB-2083-0042' });
    await user.click(within(sheet).getByRole('button', { name: 'Reject' }));
    await user.click(within(sheet).getByRole('button', { name: 'Reject claim' }));
    expect(await within(sheet).findByText('Say why — the customer is sent this reason')).toBeInTheDocument();
    expect(calls.some((c) => c.method === 'PATCH')).toBe(false);

    await user.type(within(sheet).getByLabelText(/Why is it rejected/), 'हाम्रो कामको भाग होइन');
    await user.click(within(sheet).getByRole('button', { name: 'Reject claim' }));
    await waitFor(() => expect(calls.find((c) => c.method === 'PATCH')?.body).toEqual({ status: 'rejected', rejectReason: 'हाम्रो कामको भाग होइन' }));
  });

  it('resolves an accepted claim once the rework is done — the only decision left', async () => {
    const user = userEvent.setup();
    let claim = { ...OPEN, status: 'accepted', resolvedJob: { ...FREE_JOB, status: 'COMPLETED' } };
    const calls = mockApi(({ method, path }) => {
      if (path === '/admin/warranty-claims') return page([claim]);
      if (path === '/admin/warranty-claims/cl1' && method === 'PATCH') {
        claim = { ...claim, status: 'resolved', resolvedAt: at('2026-09-28', '11:00') };
        return json({ data: claim });
      }
      if (path === '/admin/warranty-claims/cl1') return json({ data: claim });
      if (path === '/admin/reports/warranty-claims') return json({ data: RATES });
      return undefined;
    });
    const { store } = renderClaims('/admin/warranty-claims/cl1', 'DISPATCHER');

    const sheet = await screen.findByRole('dialog', { name: 'Claim on JOB-2083-0042' });
    expect(within(sheet).getByRole('link', { name: /Open JOB-2083-0050/ })).toHaveAttribute('href', '/admin/jobs/j9');
    expect(within(within(sheet).getByRole('group', { name: 'Decide' })).getAllByRole('button').map((b) => b.textContent.trim())).toEqual(['Resolve']);
    expect(within(sheet).getByText(/The rework is done/)).toBeInTheDocument();
    await user.click(within(sheet).getByRole('button', { name: 'Mark resolved' }));
    await waitFor(() => expect(calls.find((c) => c.method === 'PATCH')?.body).toEqual({ status: 'resolved' }));
    expect(await within(sheet).findByText(/Resolved 28 Sept 2026/)).toBeInTheDocument();
    expect(within(sheet).queryByRole('group', { name: 'Decide' })).not.toBeInTheDocument();
    expect(toastTitles(store)).toContain('Claim resolved');
  });

  it('says so when someone else decided first (422 CLAIM_DECIDED) and shows the claim as it now stands', async () => {
    const user = userEvent.setup();
    let claim = OPEN;
    mockApi(({ method, path }) => {
      if (path === '/admin/warranty-claims') return page([claim]);
      if (path === '/admin/warranty-claims/cl1' && method === 'PATCH') {
        claim = { ...OPEN, status: 'accepted', resolvedJob: FREE_JOB };
        return json({ error: { code: 'CLAIM_DECIDED', message: 'This claim is already accepted.' } }, 422);
      }
      if (path === '/admin/warranty-claims/cl1') return json({ data: claim });
      if (path === '/admin/reports/warranty-claims') return json({ error: { code: 'FORBIDDEN', message: 'No' } }, 403);
      return undefined;
    });
    const { store } = renderClaims('/admin/warranty-claims/cl1', 'DISPATCHER');

    const sheet = await screen.findByRole('dialog', { name: 'Claim on JOB-2083-0042' });
    await user.click(within(sheet).getByRole('button', { name: 'Accept — create the free job' }));
    const alert = await within(sheet).findByRole('alert');
    expect(alert).toHaveTextContent('This claim is already accepted. Someone else decided it first');
    expect(toastTitles(store)).toContain('Already decided');
    // The refetched claim: its job, and only Resolve left.
    expect(await within(sheet).findByRole('link', { name: /Open JOB-2083-0050/ })).toHaveAttribute('href', '/admin/jobs/j9');
    expect(within(sheet).queryByRole('button', { name: 'Accept' })).not.toBeInTheDocument();
    expect(within(sheet).getByRole('button', { name: 'Resolve' })).toBeInTheDocument();
    // A refused report is no panel, not an error.
    expect(within(sheet).queryByRole('region', { name: 'Claim rate' })).not.toBeInTheDocument();
  });
});

const WARRANTY = {
  id: 'w1', status: 'ACTIVE', scope: 'छत वाटरप्रुफिङको कामको वारेन्टी', startsAt: at('2026-09-01', '15:00'), endsAt: soonAfter(12),
  voidReason: null, publicToken: 'tok-w1', publicUrl: 'https://gharjatan.com.np/warranty/tok-w1',
  job: JOB, customer: CUSTOMER,
  claims: [{ ...ACCEPTED, id: 'cl2', resolvedJob: { id: 'j8', number: 'JOB-2083-0049', status: 'COMPLETED' } }],
};

describe('warranties (I6)', () => {
  it('lists warranties with an "expiring soon" preset', async () => {
    const user = userEvent.setup();
    const calls = mockApi(({ path }) => (path === '/admin/warranties' ? page([WARRANTY]) : undefined));
    renderAt(<WarrantiesPage />, '/admin/warranties', '/admin/warranties', 'SALES');

    expect(await screen.findByText('Terrace waterproofing')).toBeInTheDocument();
    expect(screen.getByText('12 days left')).toBeInTheDocument();
    expect(screen.getByText('1 claim')).toBeInTheDocument();
    await user.click(screen.getByRole('tab', { name: 'Expiring soon' }));
    await waitFor(() => expect(calls.at(-1).query).toMatchObject({ expiringDays: '30', sort: 'endsAt' }));
    expect(screen.getByRole('combobox', { name: 'Ending within' })).toHaveTextContent('Ending within 30 days');
    await user.click(screen.getByRole('tab', { name: 'Void' }));
    await waitFor(() => expect(calls.at(-1).query).toMatchObject({ status: 'VOID' }));
    expect(calls.at(-1).query.expiringDays).toBeUndefined();
  });

  it('shows the certificate link and the claims, and voids only with a reason', async () => {
    const user = userEvent.setup();
    let warranty = WARRANTY;
    const calls = mockApi(({ method, path, body }) => {
      if (path === '/admin/warranties/w1/void') {
        warranty = { ...WARRANTY, status: 'VOID', voidReason: body.reason };
        return json({ data: warranty });
      }
      if (path === '/admin/warranties/w1') return json({ data: warranty });
      return method === 'GET' ? undefined : undefined;
    });
    const { store } = renderAt(<WarrantyDetailPage />, '/admin/warranties/:id', '/admin/warranties/w1', 'DISPATCHER');

    expect(await screen.findByTestId('certificate-link')).toHaveTextContent('https://gharjatan.com.np/warranty/tok-w1');
    expect(screen.getByRole('link', { name: /Open certificate/ })).toHaveAttribute('href', 'https://gharjatan.com.np/warranty/tok-w1');
    expect(screen.getByText('छत वाटरप्रुफिङको कामको वारेन्टी')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'JOB-2083-0049' })).toHaveAttribute('href', '/admin/jobs/j8');
    expect(screen.getByRole('link', { name: /JOB-2083-0042/ })).toHaveAttribute('href', '/admin/jobs/j1');
    expect(screen.getByRole('link', { name: 'Decide…' })).toHaveAttribute('href', '/admin/warranty-claims/cl2');

    await user.click(screen.getByRole('button', { name: /Void…/ }));
    const dialog = await screen.findByRole('dialog', { name: 'Void the warranty for JOB-2083-0042?' });
    await user.click(within(dialog).getByRole('button', { name: 'Void warranty' }));
    expect(await within(dialog).findByText('Say why, in a few words')).toBeInTheDocument();
    expect(calls.some((c) => c.method === 'POST')).toBe(false);

    await user.type(within(dialog).getByLabelText(/Why is it void/), 'ग्राहकले अरूबाट काम गराए');
    await user.click(within(dialog).getByRole('button', { name: 'Void warranty' }));
    await waitFor(() => expect(calls.find((c) => c.method === 'POST')).toMatchObject({
      path: '/admin/warranties/w1/void', body: { reason: 'ग्राहकले अरूबाट काम गराए' },
    }));
    expect(await screen.findByTestId('void-reason')).toHaveTextContent('Void: ग्राहकले अरूबाट काम गराए');
    expect(screen.queryByRole('button', { name: /Void…/ })).not.toBeInTheDocument();
    expect(toastTitles(store)).toContain('Warranty voided');
  });

  it('has a History tab — the warranty’s audit trail, loaded only when opened, its tab in the URL', async () => {
    const user = userEvent.setup();
    const calls = mockApi(({ path }) => {
      if (path === '/admin/warranties/w1/history') {
        return json({ data: HISTORY('Warranty', 'w1', 'warranty.voided', { scope: 'छत' }), meta: { page: 1, limit: 20, total: 2, pages: 1 } });
      }
      if (path === '/admin/warranties/w1') return json({ data: WARRANTY });
      return undefined;
    });
    const { router } = renderAt(<WarrantyDetailPage />, '/admin/warranties/:id', '/admin/warranties/w1', 'SALES');

    await screen.findByTestId('certificate-link');
    expect(screen.getAllByRole('tab').map((t) => t.textContent)).toEqual(['Details', 'History']);
    expect(calls.some((c) => c.path.endsWith('/history'))).toBe(false);

    await user.click(screen.getByRole('tab', { name: 'History' }));
    const list = await screen.findByRole('list', { name: 'History' });
    expect(within(list).getByText('Warranty voided')).toBeInTheDocument();
    expect(within(list).getByText('Warranty changed')).toBeInTheDocument();
    expect(router.state.location.search).toBe('?tab=history');
    expect(screen.queryByTestId('certificate-link')).not.toBeInTheDocument();
  });

  it('is read-only for SALES', async () => {
    mockApi(({ path }) => (path === '/admin/warranties/w1' ? json({ data: WARRANTY }) : undefined));
    renderAt(<WarrantyDetailPage />, '/admin/warranties/:id', '/admin/warranties/w1', 'SALES');
    await screen.findByTestId('certificate-link');
    expect(screen.queryByRole('button', { name: /Void/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Edit/ })).not.toBeInTheDocument();
  });
});

/** The API's schedule rule (warranty.service#amcSchedule), for the mocked preview. */
function schedule({ startDate, endDate, visitsPerYear }) {
  const span = Math.max(1, Math.round((Date.parse(endDate) - Date.parse(startDate)) / 86_400_000));
  const total = Math.max(1, Math.round((visitsPerYear * span) / 365));
  const interval = Math.floor(span / total);
  return {
    totalVisits: total,
    intervalDays: interval,
    visits: Array.from({ length: total }, (_, i) => ({ dueDate: new Date(Date.parse(startDate) + interval * (i + 1) * 86_400_000).toISOString() })),
  };
}

const CONTRACT = {
  id: 'a1', number: 'AMC-2083-0001', customerId: 'c1', siteId: 's1', customer: CUSTOMER, site: { id: 's1', label: 'Home', address: 'झम्सिखेल' },
  planName: 'Annual Home Care — Standard', coveredServices: ['Waterproofing', 'plumbing'],
  startDate: at('2026-01-01'), endDate: at('2026-12-31'), visitsPerYear: 4, amount: 2_400_050, billingCycle: 'quarterly',
  status: 'active', notes: null,
  visits: [
    { id: 'v1', dueDate: at('2026-04-01'), status: 'completed', note: null, job: { id: 'j60', number: 'JOB-2083-0060', status: 'VERIFIED', scheduledStart: at('2026-04-01', '10:00') } },
    { id: 'v2', dueDate: at('2026-07-01'), status: 'scheduled', note: null, job: { id: 'j61', number: 'JOB-2083-0061', status: 'SCHEDULED', scheduledStart: at('2026-07-01', '10:00') } },
    { id: 'v3', dueDate: at('2026-09-30'), status: 'pending', note: null, job: null },
  ],
};

function amcApi(extra = () => undefined) {
  return mockApi(async (call) => {
    const custom = await extra(call);
    if (custom) return custom;
    const { method, path, body } = call;
    if (path === '/admin/amc-contracts/preview') return json({ data: schedule(body) });
    if (path === '/admin/amc-contracts' && method === 'POST') return json({ data: { ...body, id: 'a2', number: 'AMC-2083-0002', visits: schedule(body).visits } }, 201);
    if (path === '/admin/amc-contracts') return page([CONTRACT]);
    if (path === '/admin/amc-contracts/a1') return json({ data: CONTRACT });
    if (path === '/admin/customers/c1/sites') return json({ data: [{ id: 's1', label: 'Home', address: 'झम्सिखेल', isPrimary: true }] });
    if (path === '/admin/customers/c1') return json({ data: CUSTOMER });
    if (path === '/admin/services') return page([{ id: 'sv1', name: 'Waterproofing' }, { id: 'sv2', name: 'Plumbing' }]);
    return undefined;
  });
}

describe('AMC contracts (I8)', () => {
  it('opens on the renewals preset from the notification’s ?renewals=true', async () => {
    const calls = amcApi();
    renderAt(<AmcContractsPage />, '/admin/amc-contracts', '/admin/amc-contracts?renewals=true', 'SALES');
    expect(await screen.findByText('Annual Home Care — Standard')).toBeInTheDocument();
    expect(calls.find((c) => c.path === '/admin/amc-contracts').query).toMatchObject({ renewalsDays: '60' });
    expect(calls.find((c) => c.path === '/admin/amc-contracts').query.status).toBeUndefined();
    expect(screen.getByRole('tab', { name: 'Renewals due (60 days)' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByText('Rs. 24,000.50')).toBeInTheDocument();
    // SALES reads contracts; only dispatch makes them.
    expect(screen.queryByRole('button', { name: /New contract/ })).not.toBeInTheDocument();
  });

  it('shows the visit schedule from /preview before saving, follows the visits a year, and sends rupees', async () => {
    const user = userEvent.setup();
    const calls = amcApi();
    const onCreated = vi.fn();
    renderWithProviders(
      <AmcContractSheet open onOpenChange={() => {}} onCreated={onCreated} defaults={{ customerId: 'c1', startDate: at('2026-10-01'), endDate: at('2027-09-30') }} />,
      { path: '/', preloadedState: signedInAs('DISPATCHER') },
    );
    const sheet = await screen.findByRole('dialog', { name: 'New AMC contract' });
    // Four visits a year over a year: the server's dates, listed before anything is saved.
    expect(await within(sheet).findByTestId('schedule-summary')).toHaveTextContent('4 visits, one about every 91 days.');
    const visits = within(within(sheet).getByRole('list', { name: 'Visits' })).getAllByRole('listitem');
    expect(visits.map((v) => v.textContent)).toEqual(schedule({ startDate: at('2026-10-01'), endDate: at('2027-09-30'), visitsPerYear: 4 }).visits
      .map((v, i) => `Visit ${i + 1}${new Date(v.dueDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'Asia/Kathmandu' })}`));
    expect(calls.find((c) => c.path === '/admin/amc-contracts/preview').body).toEqual({ startDate: at('2026-10-01'), endDate: at('2027-09-30'), visitsPerYear: 4 });

    const perYear = within(sheet).getByLabelText(/Visits a year/);
    await user.clear(perYear);
    await user.type(perYear, '6');
    await waitFor(() => expect(within(sheet).getByTestId('schedule-summary')).toHaveTextContent('6 visits, one about every 60 days.'));
    expect(calls.filter((c) => c.path === '/admin/amc-contracts/preview').at(-1).body.visitsPerYear).toBe(6);

    await user.type(within(sheet).getByLabelText(/^Plan/), 'वार्षिक घर हेरचाह');
    await user.click(await within(sheet).findByRole('checkbox', { name: 'Waterproofing' }));
    await user.type(within(sheet).getByLabelText(/^Amount/), '1,24,000.50');
    await user.click(within(sheet).getByRole('button', { name: 'Create contract' }));

    await waitFor(() => expect(calls.find((c) => c.path === '/admin/amc-contracts' && c.method === 'POST')?.body).toEqual({
      customerId: 'c1', siteId: null, planName: 'वार्षिक घर हेरचाह', coveredServices: ['Waterproofing'],
      startDate: at('2026-10-01'), endDate: at('2027-09-30'), visitsPerYear: 6, amount: 124000.5, billingCycle: 'annual',
    }));
    expect(onCreated).toHaveBeenCalledWith(expect.objectContaining({ id: 'a2' }));
  });

  it('shows the visits with their jobs, and Renew prefills a contract starting the day after this one ends', async () => {
    const user = userEvent.setup();
    const calls = amcApi();
    const { router } = renderAt(<AmcContractDetailPage />, '/admin/amc-contracts/:id', '/admin/amc-contracts/a1', 'DISPATCHER');

    expect(await screen.findByTestId('amc-amount')).toHaveTextContent('Rs. 24,000.50');
    const visits = screen.getByRole('region', { name: 'Visits' });
    expect(within(visits).getByRole('link', { name: 'JOB-2083-0060' })).toHaveAttribute('href', '/admin/jobs/j60');
    expect(within(visits).getByText('Done')).toBeInTheDocument();
    expect(within(visits).getByText('Job made')).toBeInTheDocument();
    expect(within(visits).getByText('Not booked yet')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Renew…/ }));
    const sheet = await screen.findByRole('dialog', { name: 'Renew AMC-2083-0001' });
    expect(within(sheet).getByLabelText(/^Plan/)).toHaveValue('Annual Home Care — Standard');
    expect(within(sheet).getByLabelText(/^Amount/)).toHaveValue('24,000.50');
    expect(within(sheet).getByRole('checkbox', { name: 'Waterproofing' })).toBeChecked();
    // The seed's lower-case tag is the catalogue's service, ticked once — not a second "Plumbing".
    expect(within(sheet).getAllByRole('checkbox', { name: /Plumbing/ })).toHaveLength(1);
    expect(within(sheet).getByRole('checkbox', { name: 'Plumbing' })).toBeChecked();
    expect(within(sheet).getByLabelText(/Notes/)).toHaveValue('Renewal of AMC-2083-0001');
    await within(sheet).findByTestId('schedule-summary');
    expect(calls.filter((c) => c.path === '/admin/amc-contracts/preview').at(-1).body).toEqual({
      startDate: at('2027-01-01'), endDate: at('2027-12-31'), visitsPerYear: 4,
    });

    await user.click(within(sheet).getByRole('button', { name: 'Create contract' }));
    await waitFor(() => expect(calls.find((c) => c.path === '/admin/amc-contracts' && c.method === 'POST')?.body).toEqual({
      customerId: 'c1', siteId: 's1', planName: 'Annual Home Care — Standard', coveredServices: ['Waterproofing', 'Plumbing'],
      startDate: at('2027-01-01'), endDate: at('2027-12-31'), visitsPerYear: 4, amount: 24000.5, billingCycle: 'quarterly',
      notes: 'Renewal of AMC-2083-0001',
    }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/admin/amc-contracts/a2'));
  });

  it('opens its History tab from the URL — the contract’s audit trail', async () => {
    const calls = amcApi(({ path }) => (path === '/admin/amc-contracts/a1/history'
      ? json({ data: HISTORY('AmcContract', 'a1', null, { amount: 2_400_050 }), meta: { page: 1, limit: 20, total: 2, pages: 1 } })
      : undefined));
    renderAt(<AmcContractDetailPage />, '/admin/amc-contracts/:id', '/admin/amc-contracts/a1?tab=history', 'SALES');

    const list = await screen.findByRole('list', { name: 'History' });
    expect(within(list).getByText('AMC contract added')).toBeInTheDocument();
    expect(within(list).getByText('AMC contract changed')).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'History' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.queryByRole('region', { name: 'Visits' })).not.toBeInTheDocument();
    expect(calls.find((c) => c.path === '/admin/amc-contracts/a1/history').query).toMatchObject({ page: '1', limit: '20' });
  });

  it('offers SALES no Renew, Edit or Cancel', async () => {
    amcApi();
    renderAt(<AmcContractDetailPage />, '/admin/amc-contracts/:id', '/admin/amc-contracts/a1', 'SALES');
    await screen.findByTestId('amc-amount');
    expect(screen.queryByRole('button', { name: /Renew/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Edit/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Cancel/ })).not.toBeInTheDocument();
  });
});

const PENDING = {
  id: 'r1', customer: CUSTOMER, jobId: 'j1', serviceId: null, dueAt: at('2026-10-15', '10:00'), channel: 'sms',
  message: 'नमस्ते सीता जी, मनसुन अघि छतको जाँच गराउनुहोस्।', status: 'pending', sentAt: null, createdAt: at('2026-09-01'),
};
const SENT = { ...PENDING, id: 'r2', customer: { ...CUSTOMER, name: 'Ram Karki' }, message: 'Time for your annual check-up.', status: 'sent', sentAt: at('2026-09-20', '10:01') };

describe('service reminders (I9)', () => {
  const remindersApi = () => mockApi(({ method, path, body }) => {
    if (path === '/admin/service-reminders') return page([PENDING, SENT]);
    if (path === '/admin/service-reminders/r1' && method === 'PUT') return json({ data: { ...PENDING, ...body } });
    if (path === '/admin/service-reminders/r1' && method === 'DELETE') return new Response(null, { status: 204 });
    if (path === '/admin/customers/c1') return json({ data: CUSTOMER });
    if (path === '/admin/jobs/j1') return json({ data: JOB });
    if (path === '/admin/jobs' || path === '/admin/services') return page([]);
    return undefined;
  });

  it('opens on pending, and keeps edit and delete for a pending reminder only', async () => {
    const user = userEvent.setup();
    const calls = remindersApi();
    renderAt(<ServiceRemindersPage />, '/admin/service-reminders', '/admin/service-reminders', 'DISPATCHER');

    expect(await screen.findByText(PENDING.message)).toHaveAttribute('lang', 'ne');
    expect(calls.find((c) => c.path === '/admin/service-reminders').query).toMatchObject({ status: 'pending', sort: 'dueAt' });

    await user.click(screen.getByRole('button', { name: /Actions for Reminder to Ram Karki/ }));
    expect(await screen.findByRole('menuitem', { name: 'Edit' })).toHaveAttribute('aria-disabled', 'true');
    expect(screen.getByRole('menuitem', { name: 'Delete' })).toHaveAttribute('aria-disabled', 'true');
    await user.keyboard('{Escape}');

    await user.click(screen.getByRole('button', { name: /Actions for Reminder to सीता राई/ }));
    await user.click(await screen.findByRole('menuitem', { name: 'Delete' }));
    await user.click(await screen.findByRole('button', { name: 'Delete reminder' }));
    await waitFor(() => expect(calls.some((c) => c.method === 'DELETE' && c.path === '/admin/service-reminders/r1')).toBe(true));
  });

  it('counts SMS parts as the message is typed — Nepali makes the parts shorter', async () => {
    const user = userEvent.setup();
    const calls = remindersApi();
    renderAt(<ServiceRemindersPage />, '/admin/service-reminders', '/admin/service-reminders', 'DISPATCHER');

    await user.click(await screen.findByRole('button', { name: /Actions for Reminder to सीता राई/ }));
    await user.click(await screen.findByRole('menuitem', { name: 'Edit' }));
    const sheet = await screen.findByRole('dialog', { name: 'Edit reminder' });
    expect(within(sheet).getByText(/Unicode \(because of Devanagari\): 70 characters a part/)).toBeInTheDocument();

    const message = within(sheet).getByLabelText(/^Message/);
    await user.clear(message);
    await user.type(message, 'Your check-up is due.');
    expect(within(sheet).getByText(/Plain text: 160 characters a part/)).toBeInTheDocument();
    expect(within(sheet).getByText('1 part')).toBeInTheDocument();

    // 71 Devanagari letters: one over a Unicode SMS, so two parts of 67.
    await user.clear(message);
    await user.click(message);
    await user.paste('क'.repeat(71));
    expect(within(sheet).getByText('2 parts')).toBeInTheDocument();
    expect(within(sheet).getByText(/71 characters/)).toBeInTheDocument();

    await user.click(within(sheet).getByRole('button', { name: 'Save reminder' }));
    await waitFor(() => expect(calls.find((c) => c.method === 'PUT')?.body).toMatchObject({
      customerId: 'c1', channel: 'sms', message: 'क'.repeat(71), dueAt: PENDING.dueAt, jobId: 'j1',
    }));
  });

  it('is read-only for SALES', async () => {
    remindersApi();
    renderAt(<ServiceRemindersPage />, '/admin/service-reminders', '/admin/service-reminders', 'SALES');
    await screen.findByText(PENDING.message);
    expect(screen.queryByRole('button', { name: /New reminder/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Actions for/ })).not.toBeInTheDocument();
  });
});

describe('the customer page’s aftercare tabs', () => {
  it('lists the customer’s warranties and contracts, each linked to its page', async () => {
    const user = userEvent.setup();
    const calls = mockApi(({ path }) => {
      if (path === '/admin/customers/c1') return json({ data: { ...CUSTOMER, type: 'individual', preferredLocale: 'ne', tags: [], sites: [], _count: {} } });
      if (path === '/admin/warranties') return page([WARRANTY]);
      if (path === '/admin/amc-contracts') return page([CONTRACT]);
      return undefined;
    });
    renderAt(<CustomerDetailPage />, '/admin/customers/:id', '/admin/customers/c1?tab=warranties', 'SALES');

    expect(await screen.findByRole('link', { name: 'JOB-2083-0042' })).toHaveAttribute('href', '/admin/warranties/w1');
    expect(calls.find((c) => c.path === '/admin/warranties').query).toMatchObject({ customerId: 'c1' });
    expect(screen.queryByText('Soon')).not.toBeInTheDocument();

    await user.click(screen.getByRole('tab', { name: 'AMC' }));
    expect(await screen.findByRole('link', { name: 'AMC-2083-0001' })).toHaveAttribute('href', '/admin/amc-contracts/a1');
    expect(screen.getByText('Rs. 24,000.50')).toBeInTheDocument();
  });
});
