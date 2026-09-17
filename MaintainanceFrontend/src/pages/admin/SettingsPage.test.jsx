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
  it('shows one card per group and saves only what ADMIN changed', async () => {
    const user = userEvent.setup();
    const { store } = renderAs('ADMIN');

    const contact = await screen.findByRole('region', { name: 'Contact details' });
    expect(screen.getByRole('region', { name: 'Online booking' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Brand and home page' })).toBeInTheDocument();

    const phone = within(contact).getByLabelText(/Primary phone/);
    expect(phone).toHaveValue('01-5407720');
    await user.clear(phone);
    await user.type(phone, '+977 980 8338255');

    const booking = screen.getByRole('region', { name: 'Online booking' });
    expect(within(booking).getByRole('checkbox', { name: 'Saturday' })).toBeChecked();
    await user.click(within(booking).getByRole('checkbox', { name: 'Sunday' }));

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

  it('refuses a phone number that is not Nepali, and sends nothing', async () => {
    const user = userEvent.setup();
    renderAs('ADMIN');
    const phone = await screen.findByLabelText(/Primary phone/);
    await user.clear(phone);
    await user.type(phone, '12345');
    await user.click(screen.getByRole('button', { name: 'Save settings' }));
    expect(await screen.findByText(/Enter a valid Nepali number/)).toBeInTheDocument();
    expect(phone).toHaveAttribute('aria-invalid', 'true');
    expect(patches()).toHaveLength(0);
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
    expect(screen.getByRole('checkbox', { name: 'Saturday' })).toBeDisabled();
    expect(screen.queryByRole('button', { name: 'Save settings' })).not.toBeInTheDocument();
  });
});
