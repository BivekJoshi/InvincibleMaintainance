import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router-dom';
import ResourceListPage from '@/pages/admin/ResourceListPage';
import ResourceEditPage from '@/pages/admin/ResourceEditPage';
import { renderWithProviders, signedInAs } from '@/test/renderWithProviders';

class TestRequest {
  constructor(url, init = {}) {
    this.url = String(url);
    this.method = (init.method ?? 'GET').toUpperCase();
    this.headers = new Headers(init.headers);
    this.body = init.body;
  }

  clone() {
    return this;
  }
}

const json = (body) => new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } });
const RATE = { id: 'r1', code: 'WP-TERRACE', name: 'Terrace membrane waterproofing', category: 'Waterproofing', unit: 'sq.ft', rate: 27550, isActive: true, sortOrder: 0 };

beforeEach(() => {
  vi.stubGlobal('Request', TestRequest);
  vi.stubGlobal('fetch', vi.fn(async (request) => {
    const path = new URL(request.url, 'http://localhost').pathname.replace(/^\/api\/v1/, '');
    if (path === '/admin/rate-card') return json({ data: [RATE], meta: { page: 1, limit: 20, total: 1, pages: 1 } });
    if (path === '/admin/rate-card/r1') return json({ data: RATE });
    if (path === '/admin/rate-card/r1/history') {
      return json({
        data: [{ id: 'h1', event: null, action: 'update', model: 'RateCardItem', recordId: 'r1', actorType: 'user', actor: { id: 'u1', name: 'Meena Manager', role: 'MANAGER' }, requestId: 'q1', before: { rate: 25000 }, after: { rate: 27550 }, changes: null, createdAt: '2026-09-17T04:00:00.000Z' }],
        meta: { page: 1, limit: 20, total: 1, pages: 1 },
      });
    }
    return json({ data: {} });
  }));
});

afterEach(() => vi.unstubAllGlobals());

/** The app's rate card routes and the generic content route, as AppRoutes mounts them. */
function Screens() {
  return (
    <Routes>
      <Route path="/admin/rate-card" element={<ResourceListPage resource="rate-card" />} />
      <Route path="/admin/rate-card/new" element={<ResourceEditPage resource="rate-card" />} />
      <Route path="/admin/rate-card/:id" element={<ResourceEditPage resource="rate-card" />} />
      <Route path="/admin/content/:resource" element={<ResourceListPage />} />
      <Route path="*" element={<p>Somewhere else</p>} />
    </Routes>
  );
}

const renderAt = (path, role) => renderWithProviders(<Screens />, { path: '*', preloadedState: signedInAs(role), initialPath: path });

describe('rate card screens', () => {
  it('lists rates with their rate in rupees and the “In use” switch, and lets SALES add one', async () => {
    renderAt('/admin/rate-card', 'SALES');
    expect(await screen.findByText('Terrace membrane waterproofing')).toBeInTheDocument();
    expect(screen.getByText(/275\.50/)).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: /In use/ })).toBeInTheDocument();
    expect(screen.getByRole('switch', { name: 'Offer this rate: “WP-TERRACE · Terrace membrane waterproofing”' })).toBeEnabled();
    expect(screen.getByRole('link', { name: /New Rate/ })).toHaveAttribute('href', '/admin/rate-card/new');
    expect(screen.getByText(/The estimator uses each service’s own price range/)).toBeInTheDocument();
  });

  it('is read-only for ACCOUNTANT: no New, a disabled switch, a form without Save, and /new goes back to the list', async () => {
    const { router } = renderAt('/admin/rate-card', 'ACCOUNTANT');
    expect(await screen.findByText('Terrace membrane waterproofing')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /New Rate/ })).not.toBeInTheDocument();
    expect(screen.getByRole('switch')).toBeDisabled();

    await router.navigate('/admin/rate-card/r1');
    expect(await screen.findByDisplayValue('WP-TERRACE')).toBeDisabled();
    expect(screen.queryByRole('button', { name: 'Save changes' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Back' })).toBeInTheDocument();

    await router.navigate('/admin/rate-card/new');
    expect(await screen.findByText('Terrace membrane waterproofing')).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/admin/rate-card');
  });

  it('is not a content screen', async () => {
    renderAt('/admin/content/rate-card', 'ADMIN');
    expect(await screen.findByRole('heading', { name: 'We could not find that page' })).toBeInTheDocument();
  });
});

describe('the History tab on a registry edit page', () => {
  it('shows a record’s trail to a role with the entry’s history capability', async () => {
    const user = userEvent.setup();
    renderAt('/admin/rate-card/r1', 'SALES');
    await user.click(await screen.findByRole('tab', { name: 'History' }));
    expect(await screen.findByText('Rate changed')).toBeInTheDocument();
    expect(screen.getByText('Meena Manager · Manager')).toBeInTheDocument();
    const calls = fetch.mock.calls.map(([req]) => new URL(req.url, 'http://localhost').pathname);
    expect(calls).toContain('/api/v1/admin/rate-card/r1/history');
  });

  it('has no History tab for a role that reads the record but not its trail', async () => {
    renderAt('/admin/rate-card/r1', 'ACCOUNTANT');
    expect(await screen.findByDisplayValue('Terrace membrane waterproofing')).toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: 'History' })).not.toBeInTheDocument();
  });
});
