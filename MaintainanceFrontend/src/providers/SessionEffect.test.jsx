import { StrictMode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import { Provider } from 'react-redux';
import { makeStore } from '@/test/renderWithProviders';
import { json, mockApi } from '@/test/mockApi';

afterEach(() => vi.unstubAllGlobals());

describe('SessionEffect', () => {
  it('restores the session with one refresh even when StrictMode runs the effect twice', async () => {
    vi.resetModules(); // a fresh module is a fresh page load
    const { SessionEffect } = await import('@/providers/SessionEffect');
    let refreshes = 0;
    const calls = mockApi(({ path }) => {
      if (path !== '/auth/refresh') return undefined;
      refreshes += 1;
      // The token rotates: a second request with the same cookie is refused.
      return refreshes === 1
        ? json({ data: { user: { id: 'u1', role: 'EDITOR' }, accessToken: 'fresh' } })
        : json({ error: { code: 'UNAUTHORIZED', message: 'Session expired' } }, 401);
    });
    // fetch is called with (url, init) here, not a Request.
    const fetchMock = globalThis.fetch;
    vi.stubGlobal('fetch', vi.fn((url, init) => fetchMock({ url, method: init?.method ?? 'GET', body: init?.body })));

    const store = makeStore({ auth: { user: null, accessToken: null, status: 'idle' } });
    render(<StrictMode><Provider store={store}><SessionEffect /></Provider></StrictMode>);

    await waitFor(() => expect(store.getState().auth.status).toBe('authenticated'));
    await new Promise((r) => { setTimeout(r, 20); });
    expect(store.getState().auth).toMatchObject({ status: 'authenticated', accessToken: 'fresh' });
    expect(calls.filter((c) => c.path === '/auth/refresh')).toHaveLength(1);
  });
});
