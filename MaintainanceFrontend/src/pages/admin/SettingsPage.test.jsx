import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import SettingsPage from '@/pages/admin/SettingsPage';
import { renderWithProviders, signedInAs } from '@/test/renderWithProviders';
import { json, mockApi } from '@/test/mockApi';

const SETTINGS = {
  contact: [
    { key: 'contact.companyName', group: 'contact', label: 'Company name', type: 'string', value: 'Ghar Jatan' },
    { key: 'contact.phonePrimary', group: 'contact', label: 'Primary phone', type: 'string', value: '01-5407720' },
  ],
  booking: [
    { key: 'booking.closedWeekdays', group: 'booking', label: 'Closed weekdays', type: 'json', value: [6] },
    { key: 'booking.maxDaysAhead', group: 'booking', label: 'Book up to this many days ahead', type: 'number', value: 30 },
  ],
  branding: [
    { key: 'branding.tagline', group: 'branding', label: 'Tagline', type: 'string', value: 'Certified engineers.' },
  ],
};

let calls;
beforeEach(() => {
  calls = mockApi(({ method, path, body }) => {
    if (path === '/admin/settings' && method === 'PATCH') return json({ data: body.values });
    if (path === '/admin/settings') return json({ data: SETTINGS });
    return undefined;
  });
});
afterEach(() => vi.unstubAllGlobals());

const toastTitles = (store) => store.getState().ui.toasts.map((t) => t.title);
const patches = () => calls.filter((c) => c.method === 'PATCH').map((c) => c.body);
const renderAs = (role) => renderWithProviders(<SettingsPage />, { path: '/admin/platform/settings', preloadedState: signedInAs(role) });

describe('SettingsPage', () => {
  it('shows one section at a time and saves every section ADMIN changed', async () => {
    const user = userEvent.setup();
    const { store } = renderAs('ADMIN');

    const contact = await screen.findByRole('region', { name: 'Contact details' });
    const nav = screen.getByRole('navigation', { name: 'Settings sections' });
    expect(within(nav).getAllByRole('button').map((b) => b.textContent)).toEqual(['Contact details', 'Brand and home page', 'Online booking']);
    expect(screen.queryByRole('region', { name: 'Online booking' })).not.toBeInTheDocument();

    const phone = within(contact).getByLabelText(/Primary phone/);
    expect(phone).toHaveValue('01-5407720');
    await user.clear(phone);
    await user.type(phone, '+977 980 8338255');
    expect(within(nav).getByRole('button', { name: /Contact details/ })).toHaveTextContent('1 unsaved');
    expect(screen.getByText('1 unsaved change')).toBeInTheDocument();

    await user.click(within(nav).getByRole('button', { name: 'Online booking' }));
    const booking = screen.getByRole('region', { name: 'Online booking' });
    expect(within(booking).getByRole('checkbox', { name: 'Saturday' })).toBeChecked();
    await user.click(within(booking).getByRole('checkbox', { name: 'Sunday' }));

    await user.click(within(nav).getByRole('button', { name: 'Brand and home page' }));
    const tagline = screen.getByLabelText('Tagline');
    await user.clear(tagline);
    await user.type(tagline, 'प्रमाणित इन्जिनियर, पारदर्शी मूल्य');

    await user.click(screen.getByRole('button', { name: 'Save settings' }));
    await waitFor(() => expect(patches()).toHaveLength(1));
    expect(patches()[0]).toEqual({
      values: {
        'contact.phonePrimary': '9808338255',
        'booking.closedWeekdays': [0, 6],
        'branding.tagline': 'प्रमाणित इन्जिनियर, पारदर्शी मूल्य',
      },
    });
    await waitFor(() => expect(toastTitles(store)).toContain('Settings saved'));
  });

  it('refuses a phone number that is not Nepali, opens its section and sends nothing', async () => {
    const user = userEvent.setup();
    renderAs('ADMIN');
    const phone = await screen.findByLabelText(/Primary phone/);
    await user.clear(phone);
    await user.type(phone, '12345');
    await user.click(screen.getByRole('button', { name: 'Online booking' }));
    await user.click(screen.getByRole('button', { name: 'Save settings' }));
    expect(await screen.findByRole('region', { name: 'Contact details' })).toBeVisible();
    expect(screen.getByRole('button', { name: /Contact details/ })).toHaveTextContent('needs fixing');
    expect(await screen.findByText(/Enter a valid Nepali number/)).toBeInTheDocument();
    expect(phone).toHaveAttribute('aria-invalid', 'true');
    expect(patches()).toHaveLength(0);
  });

  it('discards unsaved changes', async () => {
    const user = userEvent.setup();
    renderAs('ADMIN');
    const name = await screen.findByLabelText(/Company name/);
    await user.type(name, ' Pvt Ltd');
    await user.click(screen.getByRole('button', { name: 'Discard' }));
    expect(await screen.findByLabelText(/Company name/)).toHaveValue('Ghar Jatan');
    expect(screen.getByText('All changes saved')).toBeInTheDocument();
  });

  it('finds a setting in another section', async () => {
    const user = userEvent.setup();
    renderAs('ADMIN');
    await screen.findByRole('region', { name: 'Contact details' });
    await user.type(screen.getByLabelText('Find a setting'), 'days ahead');
    await user.click(screen.getByRole('button', { name: /Book up to this many days ahead/ }));
    expect(screen.getByRole('region', { name: 'Online booking' })).toBeVisible();
  });

  it('saves nothing when nothing changed', async () => {
    const user = userEvent.setup();
    const { store } = renderAs('ADMIN');
    await user.click(await screen.findByRole('button', { name: 'Save settings' }));
    await waitFor(() => expect(toastTitles(store)).toContain('Nothing to save'));
    expect(patches()).toHaveLength(0);
  });

  it('is read-only for EDITOR, who holds settings:read only', async () => {
    renderAs('EDITOR');
    expect(await screen.findByLabelText(/Primary phone/)).toBeDisabled();
    expect(screen.getByText(/Only an administrator can change settings/)).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: 'Saturday', hidden: true })).toBeDisabled();
    expect(screen.queryByRole('button', { name: 'Save settings' })).not.toBeInTheDocument();
  });
});
