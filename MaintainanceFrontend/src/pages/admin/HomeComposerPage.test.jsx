import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import HomeComposerPage from '@/pages/admin/HomeComposerPage';
import { renderWithProviders, signedInAs } from '@/test/renderWithProviders';
import { toSectionItems } from '@/config/admin/homeSections';

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

const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

const SECTIONS = [
  { key: 'hero', sortOrder: 0, isVisible: true, settings: null },
  { key: 'services', sortOrder: 1, isVisible: true, settings: { limit: 6 } },
  { key: 'offers', sortOrder: 2, isVisible: true, settings: null },
  { key: 'process', sortOrder: 3, isVisible: false, settings: null },
];

let puts;

beforeEach(() => {
  puts = [];
  vi.stubGlobal('Request', TestRequest);
  vi.stubGlobal('fetch', vi.fn(async (request) => {
    const { pathname } = new URL(request.url, 'http://localhost');
    const path = pathname.replace(/^\/api\/v1/, '');
    if (path === '/admin/home-sections' && request.method === 'PUT') {
      const { items } = JSON.parse(request.body);
      puts.push(items);
      return json({ data: items });
    }
    if (path === '/admin/home-sections') return json({ data: SECTIONS });
    // The site renders hero and services; offers is visible but has nothing to show.
    if (path === '/public/home') return json({ data: { sections: [{ key: 'hero', data: [{ id: 's1' }] }, { key: 'services', data: [{ id: 'v1' }] }], settings: {} } });
    return json({ data: {} });
  }));
});

afterEach(() => vi.unstubAllGlobals());

const rowOf = (label) => screen.getAllByRole('listitem').find((li) => within(li).queryByText(label, { selector: 'p, p *' }));

describe('HomeComposerPage', () => {
  it('reorders with the keyboard-free buttons, hides a section, and saves every section in the new order', async () => {
    const user = userEvent.setup();
    renderWithProviders(<HomeComposerPage />, { path: '/admin/content/home', preloadedState: signedInAs('EDITOR') });

    expect(await screen.findByText('How it works')).toBeInTheDocument();
    expect(within(rowOf('Offers')).getByText('No content — not shown')).toBeInTheDocument();
    expect(within(rowOf('How it works')).getByText('Hidden')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save home page' })).toBeDisabled();

    await user.click(screen.getByRole('button', { name: 'Move How it works up' }));
    await user.click(screen.getByRole('button', { name: 'Move How it works up' }));
    await user.click(screen.getByRole('switch', { name: 'Show How it works on the home page' }));
    await user.click(screen.getByRole('switch', { name: 'Show Offers on the home page' }));
    expect(screen.getByText('Unsaved changes')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Save home page' }));
    await waitFor(() => expect(puts).toHaveLength(1));
    expect(puts[0]).toEqual([
      { key: 'hero', sortOrder: 0, isVisible: true },
      { key: 'process', sortOrder: 1, isVisible: true },
      { key: 'services', sortOrder: 2, isVisible: true, settings: { limit: 6 } },
      { key: 'offers', sortOrder: 3, isVisible: false },
    ]);
  });

  it('refuses to save a limit the API would refuse, and clears a limit to the default', async () => {
    const user = userEvent.setup();
    renderWithProviders(<HomeComposerPage />, { path: '/admin/content/home', preloadedState: signedInAs('EDITOR') });
    const limit = await screen.findByLabelText('Show up to');

    await user.clear(limit);
    await user.type(limit, '0');
    expect(screen.getByText('Popular services: show between 1 and 50 items.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save home page' })).toBeDisabled();

    await user.clear(limit);
    await user.click(screen.getByRole('button', { name: 'Save home page' }));
    await waitFor(() => expect(puts).toHaveLength(1));
    expect(puts[0].find((s) => s.key === 'services')).toEqual({ key: 'services', sortOrder: 1, isVisible: true });
  });

  it('is read-only for a role without cms:write', async () => {
    renderWithProviders(<HomeComposerPage />, { path: '/admin/content/home', preloadedState: signedInAs('SALES') });
    expect(await screen.findByText('How it works')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Move How it works up' })).toBeDisabled();
    expect(screen.queryByRole('button', { name: 'Save home page' })).not.toBeInTheDocument();
  });
});

describe('toSectionItems', () => {
  it('numbers sections in list order and drops empty settings', () => {
    expect(toSectionItems([
      { key: 'b', isVisible: 1, settings: {} },
      { key: 'a', isVisible: false, settings: { limit: 3 } },
    ])).toEqual([
      { key: 'b', sortOrder: 0, isVisible: true },
      { key: 'a', sortOrder: 1, isVisible: false, settings: { limit: 3 } },
    ]);
  });
});
