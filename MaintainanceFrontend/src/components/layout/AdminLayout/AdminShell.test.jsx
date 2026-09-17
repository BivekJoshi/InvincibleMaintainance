import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TooltipProvider } from '@/components/ui/tooltip';
import { ThemeProvider } from '@/providers/ThemeProvider';
import { usePaletteHotkey } from '@/hooks/usePaletteHotkey';
import { renderWithProviders, signedInAs } from '@/test/renderWithProviders';
import { json, mockApi } from '@/test/mockApi';
import { AdminSidebar } from './AdminSidebar';
import { CommandPalette } from './CommandPalette';
import { NotesSheet } from './NotesSheet';
import { ShortcutBar } from './ShortcutBar';

afterEach(() => vi.unstubAllGlobals());

const SHORTCUTS = [
  { id: 's1', label: 'Leads', to: '/admin/leads', icon: 'Users', sortOrder: 0 },
  { id: 's2', label: 'Dispatch', to: '/admin/dispatch', icon: 'CalendarDays', sortOrder: 1 },
];
const NOTES = [
  { id: 'n1', body: 'Call Ram back about the leak', color: 'yellow', isPinned: true, createdAt: '2026-09-17T04:00:00.000Z', updatedAt: '2026-09-17T04:00:00.000Z' },
];

/** The API for the shell: shortcuts and notes, with whatever was posted appended. */
function shellApi(extra) {
  const shortcuts = [...SHORTCUTS];
  const notes = [...NOTES];
  return mockApi(async (call) => {
    const handled = await extra?.(call);
    if (handled) return handled;
    if (call.path === '/admin/me/shortcuts' && call.method === 'GET') return json({ data: shortcuts, meta: { total: shortcuts.length, max: 12 } });
    if (call.path === '/admin/me/shortcuts' && call.method === 'POST') {
      const row = { id: `s${shortcuts.length + 1}`, sortOrder: shortcuts.length, ...call.body };
      shortcuts.push(row);
      return json({ data: row }, 201);
    }
    if (call.path === '/admin/me/notes' && call.method === 'GET') return json({ data: notes, meta: { total: notes.length, max: 100 } });
    if (call.path === '/admin/me/notes' && call.method === 'POST') {
      const row = { id: `n${notes.length + 1}`, isPinned: false, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), ...call.body };
      notes.push(row);
      return json({ data: row }, 201);
    }
    if (call.path === '/admin/leads') return json({ data: [], meta: { total: 3 } });
    return undefined;
  });
}

const shell = (ui) => <ThemeProvider><TooltipProvider>{ui}</TooltipProvider></ThemeProvider>;

describe('ShortcutBar', () => {
  it('lists your shortcuts and pins the page you are on', async () => {
    const user = userEvent.setup();
    const calls = shellApi();
    renderWithProviders(shell(<ShortcutBar />), { path: '/admin/quotations', preloadedState: signedInAs('ADMIN') });

    const bar = await screen.findByRole('navigation', { name: 'Your shortcuts' });
    expect(await within(bar).findByRole('link', { name: 'Leads' })).toHaveAttribute('href', '/admin/leads');
    expect(within(bar).getByRole('link', { name: 'Dispatch' })).toHaveAttribute('href', '/admin/dispatch');
    expect(screen.getByRole('button', { name: 'Notes, 1' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Pin this page to your shortcuts' }));
    const name = screen.getByLabelText('Name');
    expect(name).toHaveValue('Quotations');
    await user.clear(name);
    await user.type(name, 'कोटेशन');
    await user.click(screen.getByRole('button', { name: /^Pin$/ }));

    await waitFor(() => expect(calls.find((c) => c.method === 'POST')?.body).toEqual({ label: 'कोटेशन', to: '/admin/quotations', icon: 'FileText' }));
    expect(await within(bar).findByRole('link', { name: 'कोटेशन' })).toBeInTheDocument();
    // Now pinned, the star offers to unpin instead.
    expect(await screen.findByRole('button', { name: 'Unpin कोटेशन' })).toBeInTheDocument();
  });

  it('shows the API refusal in the pin form', async () => {
    const user = userEvent.setup();
    shellApi(({ method, path }) => (method === 'POST' && path === '/admin/me/shortcuts'
      ? json({ error: { code: 'LIMIT_REACHED', message: 'You can pin at most 12 shortcuts' } }, 409)
      : undefined));
    renderWithProviders(shell(<ShortcutBar />), { path: '/admin/jobs', preloadedState: signedInAs('ADMIN') });

    await user.click(await screen.findByRole('button', { name: 'Pin this page to your shortcuts' }));
    await user.click(screen.getByRole('button', { name: /^Pin$/ }));
    expect(await screen.findByText('You can pin at most 12 shortcuts')).toBeInTheDocument();
  });
});

describe('NotesSheet', () => {
  it('adds a note in Nepali with the colour you picked', async () => {
    const user = userEvent.setup();
    const calls = shellApi();
    renderWithProviders(shell(<NotesSheet />), {
      path: '/admin',
      preloadedState: { ...signedInAs('ADMIN'), ui: { theme: 'light', locale: 'en', sidebarOpen: true, mobileNavOpen: false, commandOpen: false, notesOpen: true, toasts: [] } },
    });

    expect(await screen.findByText('Call Ram back about the leak')).toBeInTheDocument();
    await user.type(screen.getByLabelText('New note'), 'भोलि साइट भ्रमण');
    await user.click(within(screen.getByRole('radiogroup', { name: 'Note colour' })).getByRole('radio', { name: 'Green' }));
    await user.click(screen.getByRole('button', { name: 'Add note' }));

    await waitFor(() => expect(calls.find((c) => c.method === 'POST')?.body).toEqual({ body: 'भोलि साइट भ्रमण', color: 'green' }));
    expect(await screen.findByText('भोलि साइट भ्रमण')).toBeInTheDocument();
    expect(screen.getByLabelText('New note')).toHaveValue('');
  });

  it('will not add an empty note', async () => {
    const user = userEvent.setup();
    const calls = shellApi();
    renderWithProviders(shell(<NotesSheet />), {
      path: '/admin',
      preloadedState: { ...signedInAs('ADMIN'), ui: { theme: 'light', locale: 'en', sidebarOpen: true, mobileNavOpen: false, commandOpen: false, notesOpen: true, toasts: [] } },
    });
    await user.click(await screen.findByRole('button', { name: 'Add note' }));
    expect(screen.getByText('Write something first')).toBeInTheDocument();
    expect(calls.some((c) => c.method === 'POST')).toBe(false);
  });
});

function Palette() {
  usePaletteHotkey();
  return <CommandPalette role="SALES" />;
}

describe('CommandPalette', () => {
  it('opens on Ctrl+K and jumps to a screen the role can open', async () => {
    const user = userEvent.setup();
    shellApi();
    const { router } = renderWithProviders(shell(<Palette />), {
      path: '/admin', preloadedState: signedInAs('SALES'), routes: [{ path: '/admin/quotations', element: <p>Quotations screen</p> }],
    });

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    fireEvent.keyDown(window, { key: 'k', ctrlKey: true });
    const dialog = await screen.findByRole('dialog', { name: 'Search the back office' });
    // SALES never sees the platform screens.
    expect(within(dialog).queryByText('Users')).not.toBeInTheDocument();
    expect(await within(dialog).findByText('Your shortcuts')).toBeInTheDocument();

    await user.type(within(dialog).getByRole('combobox'), 'quotat');
    await user.keyboard('{Enter}');
    await waitFor(() => expect(router.state.location.pathname).toBe('/admin/quotations'));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});

describe('AdminSidebar', () => {
  it('finds a screen across every section', async () => {
    const user = userEvent.setup();
    shellApi();
    renderWithProviders(shell(<AdminSidebar role="ADMIN" user={{ name: 'Asha Admin' }} />), { path: '/admin/leads', preloadedState: signedInAs('ADMIN') });

    const nav = screen.getByRole('navigation', { name: 'Back office' });
    expect(screen.getByRole('tab', { name: 'Home' })).toHaveAttribute('aria-selected', 'true');
    expect(within(nav).getByRole('link', { name: 'Leads' })).toHaveAttribute('aria-current', 'page');
    expect(within(nav).queryByRole('link', { name: 'Audit log' })).not.toBeInTheDocument();

    await user.type(screen.getByRole('searchbox', { name: 'Find a screen' }), 'audit');
    expect(within(nav).getByRole('link', { name: /Audit log/ })).toHaveAttribute('href', '/admin/platform/audit');
    expect(screen.queryByRole('tab')).not.toBeInTheDocument();

    await user.clear(screen.getByRole('searchbox', { name: 'Find a screen' }));
    await user.click(screen.getByRole('tab', { name: 'Settings' }));
    expect(await within(nav).findByRole('link', { name: 'Audit log' })).toBeInTheDocument();
  });

  it('folds to an icon rail that still names every link', () => {
    shellApi();
    renderWithProviders(shell(<AdminSidebar role="SALES" user={{ name: 'Sita' }} rail onToggleRail={() => {}} />), { path: '/admin', preloadedState: signedInAs('SALES') });
    expect(screen.getByRole('link', { name: 'Leads' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Expand sidebar' })).toBeInTheDocument();
    expect(screen.queryByRole('searchbox')).not.toBeInTheDocument();
  });
});
