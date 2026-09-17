import { afterEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import QuotationsPage from '@/pages/admin/QuotationsPage';
import QuotationBuilderPage from '@/pages/admin/QuotationBuilderPage/QuotationBuilderPage';
import { renderWithProviders, signedInAs } from '@/test/renderWithProviders';
import { json, mockApi, page } from '@/test/mockApi';

afterEach(() => vi.unstubAllGlobals());

const toastTitles = (store) => store.getState().ui.toasts.map((t) => t.title);

const QUOTATION = {
  id: 'q1', number: 'QT-2083-0042', version: 1, status: 'DRAFT', total: 226000, subtotal: 200000, discount: 0,
  vatApplied: true, vatRate: 13, vatAmount: 26000, validUntil: '2026-10-01T18:14:00.000Z', terms: 'Half in advance.',
  internalNote: null, createdById: 'someone', makerChecker: true, autoApproved: false,
  customer: { id: 'c1', name: 'सीता गुरुङ', phone: '9841500005', email: null },
  site: { id: 's1', address: 'Budhanilkantha' }, lead: { id: 'l1', status: 'QUOTED' },
  createdBy: { id: 'someone', name: 'Rajesh Sales' },
  items: [{ id: 'i1', description: 'Crack filling', unit: 'rft', qty: 20, rate: 10000, amount: 200000, rateCardItemId: null }],
  versions: [{ id: 'q1', number: 'QT-2083-0042', version: 1, status: 'DRAFT' }],
  messages: [], survey: null, createdAt: '2026-09-16T04:00:00.000Z',
};

const builder = (quotation, role, handler = () => undefined) => {
  const calls = mockApi((call) => {
    if (call.method === 'GET' && call.path === `/admin/quotations/${quotation.id}`) return json({ data: quotation });
    if (call.path === '/admin/rate-card') return page([]);
    return handler(call);
  });
  const rendered = renderWithProviders(<QuotationBuilderPage />, {
    path: '/admin/quotations/:id', initialPath: `/admin/quotations/${quotation.id}`, preloadedState: signedInAs(role),
    routes: [{ path: '/admin/quotations/:other', element: <p>Other version</p> }],
  });
  return { calls, ...rendered };
};

describe('QuotationsPage', () => {
  it('opens an approver on Needs approval with its count, and switches stage in the URL', async () => {
    const user = userEvent.setup();
    const calls = mockApi(({ path, query }) => {
      if (path !== '/admin/quotations') return undefined;
      if (query.limit === '1') return json({ data: [], meta: { page: 1, limit: 1, total: query.stage === 'approval' ? 3 : 2 } });
      return page([{ ...QUOTATION, status: 'PENDING_APPROVAL' }]);
    });
    const { router } = renderWithProviders(<QuotationsPage />, { path: '/admin/quotations', preloadedState: signedInAs('MANAGER') });

    expect(await screen.findByText('QT-2083-0042')).toBeInTheDocument();
    const lists = () => calls.filter((c) => c.path === '/admin/quotations' && c.query.limit !== '1');
    expect(lists()[0].query).toMatchObject({ stage: 'approval', limit: '20' });
    expect(await within(screen.getByRole('tab', { name: /Needs approval/ })).findByText('3')).toBeInTheDocument();
    expect(within(screen.getByRole('tab', { name: /asked for changes/ })).getByText('2')).toBeInTheDocument();

    await user.click(screen.getByRole('tab', { name: 'Ready to send' }));
    await waitFor(() => expect(lists().at(-1).query).toMatchObject({ stage: 'ready' }));
    expect(router.state.location.search).toContain('stage=ready');
  });

  it('shows sales every queue, the approval one without its count, and opens on All', async () => {
    const calls = mockApi(({ path, query }) => {
      if (path !== '/admin/quotations') return undefined;
      return query.limit === '1' ? json({ data: [], meta: { total: 4 } }) : page([QUOTATION]);
    });
    renderWithProviders(<QuotationsPage />, { path: '/admin/quotations', preloadedState: signedInAs('SALES') });
    await screen.findByText('QT-2083-0042');
    expect(calls.find((c) => c.path === '/admin/quotations' && c.query.limit === '20').query.stage).toBe('all');
    expect(screen.getByRole('tab', { name: 'Needs approval' })).toBeInTheDocument();
    expect(calls.some((c) => c.query.stage === 'approval' && c.query.limit === '1')).toBe(false);
  });

  it('offers a row the actions its state allows and runs Submit', async () => {
    const user = userEvent.setup();
    const calls = mockApi(({ method, path }) => {
      if (method === 'POST' && path === '/admin/quotations/q1/submit') return json({ data: { ...QUOTATION, status: 'PENDING_APPROVAL' } });
      if (path === '/admin/quotations') return page([QUOTATION]);
      return undefined;
    });
    const { store } = renderWithProviders(<QuotationsPage />, { path: '/admin/quotations', preloadedState: signedInAs('SALES') });
    await screen.findByText('QT-2083-0042');
    await user.click(screen.getByRole('button', { name: /Actions for QT-2083-0042/ }));
    expect(screen.queryByRole('menuitem', { name: 'Approve' })).not.toBeInTheDocument();
    await user.click(await screen.findByRole('menuitem', { name: 'Submit for approval' }));
    await waitFor(() => expect(calls.some((c) => c.method === 'POST' && c.path === '/admin/quotations/q1/submit')).toBe(true));
    await waitFor(() => expect(toastTitles(store)).toContain('QT-2083-0042 submitted'));
  });
});

describe('QuotationBuilderPage', () => {
  it('edits a draft in rupees, saves it, and holds Submit while there are unsaved edits', async () => {
    const user = userEvent.setup();
    const { calls, store } = builder(QUOTATION, 'SALES', ({ method, path, body }) => {
      if (method === 'PUT' && path === '/admin/quotations/q1') return json({ data: { ...QUOTATION, items: body.items } });
      if (method === 'POST' && path === '/admin/quotations/q1/submit') return json({ data: { ...QUOTATION, status: 'PENDING_APPROVAL' } });
      return undefined;
    });
    const rate = await screen.findByRole('textbox', { name: 'Rate for line 1' });
    expect(rate).toHaveValue('100');
    expect(screen.getByTestId('quotation-total')).toHaveTextContent('2,260');

    await user.clear(rate);
    await user.type(rate, '1,250.50');
    expect(screen.getByRole('button', { name: 'Submit for approval' })).toBeDisabled();

    await user.click(screen.getByRole('button', { name: 'Save draft' }));
    await waitFor(() => expect(calls.find((c) => c.method === 'PUT')?.body.items).toEqual([
      { rateCardItemId: null, description: 'Crack filling', unit: 'rft', qty: 20, rate: 1250.5, sortOrder: 0 },
    ]));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Submit for approval' })).toBeEnabled());
    await user.click(screen.getByRole('button', { name: 'Submit for approval' }));
    await waitFor(() => expect(toastTitles(store)).toContain('QT-2083-0042 submitted'));
  });

  it('refuses a line with no description', async () => {
    const user = userEvent.setup();
    const { calls } = builder(QUOTATION, 'SALES');
    const description = await screen.findByRole('textbox', { name: 'Description for line 1' });
    await user.clear(description);
    await user.type(screen.getByRole('textbox', { name: 'Rate for line 1' }), '5');
    await user.click(screen.getByRole('button', { name: 'Save draft' }));
    expect(await screen.findByText('Describe the work')).toBeInTheDocument();
    expect(calls.some((c) => c.method === 'PUT')).toBe(false);
  });

  it('is read-only while waiting, and a manager approves with a remark', async () => {
    const user = userEvent.setup();
    const waiting = { ...QUOTATION, status: 'PENDING_APPROVAL' };
    const { calls } = builder(waiting, 'MANAGER', ({ method, path }) => (
      method === 'POST' && path === '/admin/quotations/q1/approve' ? json({ data: { ...waiting, status: 'OFFICE_APPROVED' } }) : undefined
    ));
    expect(await screen.findByText('Waiting for your approval.')).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Rate for line 1' })).toBeDisabled();
    expect(screen.queryByRole('button', { name: 'Save draft' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Submit for approval' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Approve' }));
    const dialog = await screen.findByRole('dialog', { name: 'Approve this quotation' });
    await user.type(within(dialog).getByRole('textbox', { name: /Remark/ }), 'Rates checked');
    await user.click(within(dialog).getByRole('button', { name: 'Approve' }));
    await waitFor(() => expect(calls.find((c) => c.path === '/admin/quotations/q1/approve')?.body).toEqual({ note: 'Rates checked' }));
  });

  it('send back needs a note', async () => {
    const user = userEvent.setup();
    const { calls } = builder({ ...QUOTATION, status: 'PENDING_APPROVAL' }, 'ADMIN');
    await user.click(await screen.findByRole('button', { name: 'Send back' }));
    const dialog = await screen.findByRole('dialog', { name: 'Send back to the draft' });
    await user.click(within(dialog).getByRole('button', { name: 'Send back' }));
    expect(await within(dialog).findByText('Say what needs to change')).toBeInTheDocument();
    expect(calls.some((c) => c.path.endsWith('/send-back'))).toBe(false);
  });

  it('will not let the author approve their own quotation, and says why', async () => {
    builder({ ...QUOTATION, status: 'PENDING_APPROVAL', createdById: 'user-test' }, 'MANAGER');
    expect(await screen.findByText('You prepared this quotation')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Approve' })).toBeDisabled();
    expect(screen.getByText('Waiting for a manager to approve it.')).toBeInTheDocument();
  });

  it('shows the customer’s Nepali change request and offers Revise, which opens the new version', async () => {
    const user = userEvent.setup();
    const asked = {
      ...QUOTATION, status: 'CHANGES_REQUESTED', decisionNote: 'कृपया बार्दलीको भित्ता पनि थप्नुहोस्।',
      decidedAt: '2026-09-16T05:00:00.000Z', publicToken: 'tok-1',
      messages: [{ id: 'm1', channel: 'sms', templateKey: 'quotation_sent', toAddress: '9841500005', status: 'sent', createdAt: '2026-09-15T05:00:00.000Z' }],
    };
    const { calls, router } = builder(asked, 'SALES', ({ method, path }) => (
      method === 'POST' && path === '/admin/quotations/q1/revise' ? json({ data: { ...QUOTATION, id: 'q2', version: 2 } }) : undefined
    ));
    expect(await screen.findByTestId('customer-message')).toHaveTextContent('बार्दलीको भित्ता');
    expect(screen.getByTestId('public-link')).toHaveTextContent('/quotation/tok-1');
    expect(screen.getByText(/The quotation link · SMS/)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Revise' }));
    await user.click(await screen.findByRole('button', { name: 'Create revision' }));
    await waitFor(() => expect(calls.some((c) => c.path === '/admin/quotations/q1/revise')).toBe(true));
    await waitFor(() => expect(router.state.location.pathname).toBe('/admin/quotations/q2'));
  });

  it('shows what a revision answers, an auto-approval, and switches versions', async () => {
    const user = userEvent.setup();
    const v2 = {
      ...QUOTATION, id: 'q2', version: 2, status: 'OFFICE_APPROVED', autoApproved: true,
      approvalNote: 'Below the auto-approval limit of NPR 5,000.00',
      requestedChanges: 'Smaller area please', parent: { id: 'q1', number: 'QT-2083-0041' },
      versions: [
        { id: 'q1', number: 'QT-2083-0041', version: 1, status: 'SUPERSEDED' },
        { id: 'q2', number: 'QT-2083-0042', version: 2, status: 'OFFICE_APPROVED' },
      ],
    };
    const { router } = builder(v2, 'SALES');
    expect(await screen.findByTestId('requested-changes')).toHaveTextContent('Smaller area please');
    expect(screen.getByText('Approved automatically')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Send to customer' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Pull back' })).toBeEnabled();

    await user.click(screen.getByRole('combobox', { name: 'Version' }));
    await user.click(await screen.findByRole('option', { name: /v1 · QT-2083-0041 · Replaced/ }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/admin/quotations/q1'));
  });

  it('gives an accountant the figures only: no actions, no History tab', async () => {
    builder({ ...QUOTATION, status: 'SENT' }, 'ACCOUNTANT');
    expect(await screen.findByText('You can read this quotation but not change it.')).toBeInTheDocument();
    expect(screen.queryByTestId('quotation-actions')).not.toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: 'History' })).not.toBeInTheDocument();
  });

  it('offers convert-to-job on a legacy accepted quotation to dispatch only', async () => {
    builder({ ...QUOTATION, status: 'APPROVED' }, 'DISPATCHER');
    expect(await screen.findByRole('button', { name: 'Convert to job' })).toBeInTheDocument();
  });
});
