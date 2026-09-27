import { afterEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import QuotationsPage from '@/pages/admin/QuotationsPage';
import CustomerDetailPage from '@/pages/admin/CustomerDetailPage/CustomerDetailPage';
import { renderWithProviders, signedInAs } from '@/test/renderWithProviders';
import { json, mockApi, page } from '@/test/mockApi';

afterEach(() => vi.unstubAllGlobals());

const CUSTOMER = { id: 'c1', name: 'सीता गुरुङ', phone: '9841500005', type: 'INDIVIDUAL', preferredLocale: 'ne', tags: [], createdAt: '2026-01-01T00:00:00.000Z', _count: {}, sites: [{ id: 's1', label: 'Home', address: 'Budhanilkantha', isPrimary: true }] };
const SURVEY = { id: 'sv1', number: 'SV-2083-0004', status: 'SUBMITTED', customer: { name: 'सीता गुरुङ' }, service: { name: 'Seepage treatment' } };
const SOURCE = { id: 'q2', number: 'QT-2083-0002', version: 1, status: 'SENT', total: 5_650_000, customer: { name: 'Ram Thapa' } };

function api(handler = () => undefined) {
  return mockApi(async (call) => {
    const custom = await handler(call);
    if (custom) return custom;
    const { method, path } = call;
    if (method === 'GET' && path === '/admin/quotations') return page(call.query.limit === '1' ? [] : [SOURCE]);
    if (path === '/admin/customers') return page([CUSTOMER]);
    if (path === '/admin/customers/c1') return json({ data: CUSTOMER });
    if (path === '/admin/customers/c1/sites') return json({ data: CUSTOMER.sites });
    if (path === '/admin/surveys') return page([SURVEY]);
    if (method === 'POST' && path === '/admin/quotations') return json({ data: { id: 'q9', number: 'QT-2083-0009' } }, 201);
    if (method === 'POST' && path === '/admin/quotations/q2/copy') return json({ data: { id: 'q10', number: 'QT-2083-0010' } }, 201);
    return undefined;
  });
}

const openFromList = async (user) => {
  const rendered = renderWithProviders(<QuotationsPage />, {
    path: '/admin/quotations',
    preloadedState: signedInAs('SALES'),
    routes: [
      { path: '/admin/quotations/:id', element: <p>Builder</p> },
      { path: '/admin/surveys/:id', element: <p>Survey review</p> },
    ],
  });
  await user.click(await screen.findByRole('button', { name: 'New quotation' }));
  return { ...rendered, sheet: await screen.findByRole('dialog', { name: 'New quotation' }) };
};

const choose = async (user, sheet, label, option) => {
  await user.click(within(sheet).getByRole('combobox', { name: label }));
  await user.click(await screen.findByRole('option', { name: option }));
};

describe('the New quotation sheet', () => {
  it('blank: picks the customer and site and opens an empty draft in the builder', async () => {
    const user = userEvent.setup();
    const calls = api();
    const { sheet, router } = await openFromList(user);
    await user.click(within(sheet).getByRole('button', { name: 'Create draft quotation' }));
    expect(await within(sheet).findByText('Choose the customer')).toBeInTheDocument();

    await choose(user, sheet, /Customer/, 'सीता गुरुङ · 9841500005');
    await choose(user, sheet, /Site/, 'Home · Budhanilkantha (primary)');
    await user.click(within(sheet).getByRole('button', { name: 'Create draft quotation' }));
    await waitFor(() => expect(calls.find((c) => c.method === 'POST' && c.path === '/admin/quotations')?.body)
      .toEqual({ customerId: 'c1', siteId: 's1', items: [] }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/admin/quotations/q9'));
  });

  it('from a survey: lists submitted and in-review surveys and opens the one picked to build it', async () => {
    const user = userEvent.setup();
    const calls = api();
    const { sheet, router } = await openFromList(user);
    await choose(user, sheet, /Start from/, 'A submitted site survey');
    await choose(user, sheet, /Survey/, 'SV-2083-0004 · सीता गुरुङ · Seepage treatment');
    expect(calls.find((c) => c.path === '/admin/surveys').query).toMatchObject({ status: 'SUBMITTED,IN_REVIEW' });
    await user.click(within(sheet).getByRole('button', { name: 'Open the survey to build it' }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/admin/surveys/sv1'));
    expect(calls.some((c) => c.method === 'POST')).toBe(false);
  });

  it('copy: copies another quotation into a new draft and opens it', async () => {
    const user = userEvent.setup();
    const calls = api();
    const { sheet, router } = await openFromList(user);
    await choose(user, sheet, /Start from/, 'A copy of another quotation');
    await choose(user, sheet, /Quotation to copy/, /QT-2083-0002 · Ram Thapa · Rs. 56,500.00/);
    await user.click(within(sheet).getByRole('button', { name: 'Copy into a new draft' }));
    await waitFor(() => expect(calls.find((c) => c.method === 'POST' && c.path === '/admin/quotations/q2/copy')?.body).toEqual({}));
    await waitFor(() => expect(router.state.location.pathname).toBe('/admin/quotations/q10'));
  });

  it('opens from a customer with that customer and their primary site', async () => {
    const user = userEvent.setup();
    const calls = api();
    const { router } = renderWithProviders(<CustomerDetailPage />, {
      path: '/admin/customers/:id', initialPath: '/admin/customers/c1', preloadedState: signedInAs('SALES'),
      routes: [{ path: '/admin/quotations/:id', element: <p>Builder</p> }],
    });
    await user.click(await screen.findByRole('button', { name: 'New quotation' }));
    const sheet = await screen.findByRole('dialog', { name: 'New quotation' });
    expect(within(sheet).queryByRole('combobox', { name: /Customer/ })).not.toBeInTheDocument();
    await choose(user, sheet, /Start from/, 'A copy of another quotation');
    await choose(user, sheet, /Quotation to copy/, /QT-2083-0002/);
    await user.click(within(sheet).getByRole('button', { name: 'Copy into a new draft' }));
    await waitFor(() => expect(calls.find((c) => c.path === '/admin/quotations/q2/copy')?.body).toEqual({ customerId: 'c1', siteId: 's1' }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/admin/quotations/q10'));
  });
});
