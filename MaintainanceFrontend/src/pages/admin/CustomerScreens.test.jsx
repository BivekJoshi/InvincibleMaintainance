import { afterEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router-dom';
import CustomersPage from '@/pages/admin/CustomersPage';
import CustomerDetailPage from '@/pages/admin/CustomerDetailPage/CustomerDetailPage';
import { renderWithProviders, signedInAs } from '@/test/renderWithProviders';
import { json, mockApi, page } from '@/test/mockApi';

afterEach(() => vi.unstubAllGlobals());

const CUSTOMER = {
  id: 'c1', type: 'company', name: 'Himal Traders', phone: '01-5407720', altPhone: null, email: 'accounts@himal.np',
  panVatNo: '609876543', notes: null, tags: ['vip'], preferredLocale: 'ne',
  sites: [{ id: 's1', label: 'Office', address: 'Durbar Marg', isPrimary: true, lat: null, lng: null }],
  _count: { leads: 2, quotations: 1, jobs: 3, invoices: 1 },
};
const ROW = { ...CUSTOMER, siteCount: 1, openJobs: 2, balanceDue: 1250050 };

function api() {
  return mockApi(({ method, path, body }) => {
    if (path === '/admin/customers') {
      if (method === 'POST') return json({ data: { ...body, id: 'c2' } }, 201);
      return page([ROW]);
    }
    if (path === '/admin/customers/c1' && method === 'PUT') return json({ data: { ...CUSTOMER, ...body } });
    if (path === '/admin/customers/c1') return json({ data: CUSTOMER });
    if (path === '/admin/customers/c1/sites' && method === 'POST') return json({ data: { ...body, id: 's2' } }, 201);
    if (path === '/admin/customers/c1/sites') return json({ data: CUSTOMER.sites });
    if (path === '/admin/quotations') return page([{ id: 'q1', number: 'QT-2083-0001', status: 'SENT', total: 282557, createdAt: '2026-09-01T00:00:00Z' }]);
    return undefined;
  });
}

const renderDetail = (role, tab = '') => renderWithProviders(
  <Routes><Route path="/admin/customers/:id" element={<CustomerDetailPage />} /></Routes>,
  { path: '*', initialPath: `/admin/customers/c1${tab ? `?tab=${tab}` : ''}`, preloadedState: signedInAs(role) },
);

const tabNames = () => screen.getAllByRole('tab').map((t) => t.textContent.replace(/\s*\(\d+\)$/, ''));

describe('customers list', () => {
  it('shows the balance to accounts, not to sales', async () => {
    api();
    const { unmount } = renderWithProviders(<CustomersPage />, { path: '/admin/customers', preloadedState: signedInAs('ACCOUNTANT') });
    expect(await screen.findByText('Himal Traders')).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Balance due' })).toBeInTheDocument();
    expect(screen.getByText('Rs. 12,500.50')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /New customer/ })).not.toBeInTheDocument();
    unmount();

    renderWithProviders(<CustomersPage />, { path: '/admin/customers', preloadedState: signedInAs('SALES') });
    expect(await screen.findByText('Himal Traders')).toBeInTheDocument();
    expect(screen.queryByRole('columnheader', { name: 'Balance due' })).not.toBeInTheDocument();
    expect(screen.getByText('नेपाली')).toHaveAttribute('lang', 'ne');
  });

  it('filters by a tag from the row', async () => {
    const user = userEvent.setup();
    const calls = api();
    const { router } = renderWithProviders(<CustomersPage />, { path: '/admin/customers', preloadedState: signedInAs('SALES') });
    await user.click(await screen.findByRole('button', { name: 'Show customers tagged vip' }));
    await waitFor(() => expect(calls.filter((c) => c.path === '/admin/customers').at(-1).query).toMatchObject({ tag: 'vip' }));
    expect(router.state.location.search).toContain('tag=vip');
    await user.click(screen.getByRole('button', { name: 'Remove the tag filter vip' }));
    // Back to the first list, which is served from the cache.
    await waitFor(() => expect(router.state.location.search).not.toContain('tag='));
    expect(screen.queryByRole('button', { name: 'Remove the tag filter vip' })).not.toBeInTheDocument();
  });

  it('creates a customer, refusing a bad phone first', async () => {
    const user = userEvent.setup();
    const calls = api();
    renderWithProviders(<CustomersPage />, { path: '/admin/customers', preloadedState: signedInAs('SALES') });
    await user.click(await screen.findByRole('button', { name: /New customer/ }));
    const sheet = await screen.findByRole('dialog', { name: 'New customer' });
    await user.type(within(sheet).getByLabelText(/^Name/), 'रमेश श्रेष्ठ');
    await user.type(within(sheet).getByLabelText(/^Phone/), '5407720');
    await user.type(within(sheet).getByLabelText(/^Email/), ' Ramesh@Example.COM ');
    await user.click(within(sheet).getByRole('button', { name: 'Create customer' }));
    expect(await within(sheet).findByText(/9808338255 or 01-5407720/)).toBeInTheDocument();
    expect(calls.some((c) => c.method === 'POST')).toBe(false);

    await user.clear(within(sheet).getByLabelText(/^Phone/));
    await user.type(within(sheet).getByLabelText(/^Phone/), '+977 9808338255');
    await user.click(within(sheet).getByRole('button', { name: 'Create customer' }));
    await waitFor(() => expect(calls.find((c) => c.method === 'POST')?.body).toMatchObject({
      name: 'रमेश श्रेष्ठ', phone: '9808338255', email: 'ramesh@example.com', type: 'individual', preferredLocale: 'en',
    }));
  });
});

describe('customer page', () => {
  it('gives each role the tabs its capabilities allow', async () => {
    api();
    const { unmount } = renderDetail('SALES');
    expect(await screen.findByRole('heading', { name: 'Himal Traders' })).toBeInTheDocument();
    expect(tabNames()).toEqual(['Profile', 'Sites', 'Timeline', 'Quotations', 'Jobs', 'Warranties', 'AMC', 'History']);
    unmount();

    const accounts = renderDetail('ACCOUNTANT');
    await screen.findByRole('heading', { name: 'Himal Traders' });
    expect(tabNames()).toEqual(['Profile', 'Sites', 'Timeline', 'Quotations', 'Jobs', 'Invoices', 'Statement']);
    // Accounts may read a customer, not change one.
    expect(screen.getByLabelText(/^Name/)).toBeDisabled();
    expect(screen.queryByRole('button', { name: 'Save customer' })).not.toBeInTheDocument();
    accounts.unmount();

    renderDetail('DISPATCHER');
    await screen.findByRole('heading', { name: 'Himal Traders' });
    expect(tabNames()).toEqual(['Profile', 'Sites', 'Timeline', 'Jobs', 'Warranties', 'AMC']);
  });

  it('lists the customer\'s quotations with links', async () => {
    const calls = api();
    renderDetail('SALES', 'quotations');
    expect(await screen.findByRole('link', { name: 'QT-2083-0001' })).toHaveAttribute('href', '/admin/quotations/q1');
    expect(calls.find((c) => c.path === '/admin/quotations').query).toMatchObject({ customerId: 'c1' });
  });

  it('adds a site from a pasted map pin', async () => {
    const user = userEvent.setup();
    const calls = api();
    renderDetail('SALES', 'sites');
    await user.click(await screen.findByRole('button', { name: /Add site/ }));
    const sheet = await screen.findByRole('dialog', { name: 'Add site' });
    await user.type(within(sheet).getByLabelText(/^Name/), 'Warehouse');
    await user.type(within(sheet).getByLabelText(/^Address/), 'Balaju Industrial Area');
    await user.type(within(sheet).getByLabelText('Use map pin'), '27.7349, 85.3035');
    await user.click(within(sheet).getByRole('button', { name: /Use$/ }));
    expect(within(sheet).getByLabelText(/^Latitude/)).toHaveValue(27.7349);
    await user.click(within(sheet).getByRole('button', { name: 'Add site' }));
    await waitFor(() => expect(calls.find((c) => c.method === 'POST' && c.path === '/admin/customers/c1/sites')?.body)
      .toMatchObject({ label: 'Warehouse', address: 'Balaju Industrial Area', lat: 27.7349, lng: 85.3035, isPrimary: false }));
  });
});
