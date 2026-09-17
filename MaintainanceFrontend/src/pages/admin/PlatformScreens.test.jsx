import { afterEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router-dom';
import AuditLogPage from '@/pages/admin/AuditLogPage';
import UsersPage from '@/pages/admin/UsersPage';
import RolesPage from '@/pages/admin/RolesPage';
import LoginActivityPage from '@/pages/admin/LoginActivityPage';
import MessageLogsPage from '@/pages/admin/MessageLogsPage';
import MessageTemplatesPage from '@/pages/admin/MessageTemplatesPage';
import MessageTemplateEditPage from '@/pages/admin/MessageTemplateEditPage/MessageTemplateEditPage';
import ResetPasswordPage from '@/pages/public/ResetPasswordPage/ResetPasswordPage';
import { renderWithProviders, signedInAs } from '@/test/renderWithProviders';
import { json, mockApi, page } from '@/test/mockApi';

afterEach(() => vi.unstubAllGlobals());

const toasts = (store) => store.getState().ui.toasts.map((t) => [t.title, t.description]);
const asAdmin = { ...signedInAs('ADMIN'), auth: { ...signedInAs('ADMIN').auth, user: { id: 'me', name: 'Asha Admin', role: 'ADMIN' } } };

// ── audit log

const APPROVAL = {
  id: 'a1', event: 'quotation.customer_approved', action: 'customer_approved', model: 'Quotation', recordId: 'q1',
  actorId: null, actorType: 'public', actor: null, requestId: 'req-approve-123', ip: '10.0.0.9',
  userAgent: 'Mozilla/5.0 (Android)', before: { status: 'SENT' }, after: { status: 'APPROVED', note: 'ठीक छ' },
  changes: { jobId: 'j1' }, createdAt: '2026-09-17T04:00:00.000Z',
};
const ROW_WRITE = {
  ...APPROVAL, id: 'a2', event: null, action: 'update', actorType: 'user', actor: { id: 'u1', name: 'Sita Sales', role: 'SALES' },
  requestId: 'req-note-456', ip: '10.0.0.7', userAgent: 'Chrome',
  model: 'LeadNote', recordId: 'n1', before: { body: 'old', meta: { a: 1 } }, after: { leadId: 'l9', body: 'new', meta: { a: 1, b: 2 } }, changes: null,
};

describe('AuditLogPage', () => {
  it('lists steps, expands one into its diff, and jumps to everything from its request', async () => {
    const user = userEvent.setup();
    const calls = mockApi(({ path }) => {
      if (path === '/admin/audit-logs') return page([APPROVAL, ROW_WRITE]);
      if (path === '/admin/audit-logs/models') return json({ data: ['Lead', 'LeadNote', 'Quotation'] });
      return undefined;
    });
    const { router } = renderWithProviders(<AuditLogPage />, { path: '/admin/platform/audit', preloadedState: asAdmin });

    expect(await screen.findByText('Customer approved the quotation')).toBeInTheDocument();
    expect(screen.getByText('Customer or website')).toBeInTheDocument();
    expect(screen.getByText('Sita Sales · Sales')).toBeInTheDocument();
    // The note's row links to its lead.
    expect(screen.getByRole('link', { name: /LeadNote/ })).toHaveAttribute('href', '/admin/leads/l9');
    expect(calls.find((c) => c.path === '/admin/audit-logs').query).toMatchObject({ limit: '50', sort: '-createdAt' });

    await user.click(screen.getByRole('button', { name: /Show details of Note changed/ }));
    const diffRow = (name) => screen.getByText((_, el) => el?.tagName === 'TH' && el.textContent === name).closest('tr');
    expect(diffRow('body — Changed')).toHaveAttribute('data-kind', 'changed');
    expect(diffRow('meta.b — Added')).toHaveAttribute('data-kind', 'added');
    expect(diffRow('leadId — Added')).toHaveTextContent('l9');
    expect(screen.queryByText((_, el) => el?.tagName === 'TH' && el.textContent.startsWith('meta.a'))).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Show details of Customer approved/ }));
    expect(screen.getByText('10.0.0.9')).toBeInTheDocument();
    expect(screen.getByText('Mozilla/5.0 (Android)')).toBeInTheDocument();
    expect(screen.getByText('ठीक छ')).toBeInTheDocument();
    expect(screen.getByText('jobId')).toBeInTheDocument();
    await user.click(screen.getAllByRole('button', { name: 'Show everything from this request' })[0]);

    await waitFor(() => expect(calls.filter((c) => c.path === '/admin/audit-logs').at(-1).query)
      .toMatchObject({ requestId: 'req-approve-123', sort: 'createdAt' }));
    expect(router.state.location.search).toContain('requestId=req-approve-123');
    expect(screen.getByRole('button', { name: /One request/ })).toBeInTheDocument();
  });

  it('filters by a whole group of events', async () => {
    const user = userEvent.setup();
    const calls = mockApi(({ path }) => {
      if (path === '/admin/audit-logs') return page([]);
      if (path === '/admin/audit-logs/models') return json({ data: [] });
      return undefined;
    });
    renderWithProviders(<AuditLogPage />, { path: '/admin/platform/audit', preloadedState: asAdmin });
    await screen.findByText('Nothing matches');
    await user.click(screen.getByRole('combobox', { name: 'Event' }));
    const listbox = await screen.findByRole('listbox');
    expect(within(listbox).getByText('Quotations')).toBeInTheDocument();
    await user.click(within(listbox).getByRole('option', { name: 'Every sign-in event' }));
    await waitFor(() => expect(calls.filter((c) => c.path === '/admin/audit-logs').at(-1).query).toMatchObject({ event: 'auth.*' }));
  });
});

// ── users

const ME = {
  id: 'me', name: 'Asha Admin', email: 'admin@gharjatan.com.np', role: 'ADMIN', isActive: true, isLocked: false,
  lockedUntil: null, lastLoginAt: '2026-09-17T03:00:00.000Z', phone: null, technicianId: null,
};
const LOCKED = {
  ...ME, id: 'u2', name: 'Sita Sales', email: 'sales@gharjatan.com.np', role: 'SALES', isLocked: true,
  lockedUntil: '2026-09-17T05:00:00.000Z', phone: '9808338255',
};

function usersApi(extra = () => undefined) {
  return mockApi((call) => {
    const answer = extra(call);
    if (answer) return answer;
    if (call.path === '/admin/users') return page([ME, LOCKED]);
    return undefined;
  });
}

const openMenu = async (user, name) => user.click(await screen.findByRole('button', { name: `Actions for ${name}` }));

describe('UsersPage', () => {
  it('shows role, status and lock; an admin cannot switch themselves off', async () => {
    const user = userEvent.setup();
    usersApi();
    renderWithProviders(<UsersPage />, { path: '/admin/platform/users', preloadedState: asAdmin });
    expect(await screen.findByText('Sita Sales')).toBeInTheDocument();
    expect(screen.getByText('Locked')).toBeInTheDocument();

    await openMenu(user, 'Asha Admin');
    expect(screen.getByRole('menuitem', { name: 'Switch off (not your own)' })).toHaveAttribute('aria-disabled', 'true');
    expect(screen.getByRole('menuitem', { name: 'Remove (not your own)' })).toHaveAttribute('aria-disabled', 'true');
    expect(screen.queryByRole('menuitem', { name: 'Unlock' })).not.toBeInTheDocument();
  });

  it('sends a reset link after confirming, and the toast names the address only', async () => {
    const user = userEvent.setup();
    const calls = usersApi(({ method, path }) => (method === 'POST' && path === '/admin/users/u2/send-password-reset'
      ? json({ data: { sent: true, email: 'sales@gharjatan.com.np' } }) : undefined));
    const { store } = renderWithProviders(<UsersPage />, { path: '/admin/platform/users', preloadedState: asAdmin });
    await openMenu(user, 'Sita Sales');
    await user.click(screen.getByRole('menuitem', { name: 'Send reset link' }));
    await user.click(await screen.findByRole('button', { name: 'Send link' }));
    await waitFor(() => expect(toasts(store)).toContainEqual(['Reset link sent', 'Sent to sales@gharjatan.com.np.']));
    expect(calls.filter((c) => c.path.endsWith('/send-password-reset'))).toHaveLength(1);
  });

  it('unlocks a locked account', async () => {
    const user = userEvent.setup();
    const calls = usersApi(({ method, path }) => (method === 'POST' && path === '/admin/users/u2/unlock'
      ? json({ data: { ...LOCKED, isLocked: false, lockedUntil: null } }) : undefined));
    const { store } = renderWithProviders(<UsersPage />, { path: '/admin/platform/users', preloadedState: asAdmin });
    await openMenu(user, 'Sita Sales');
    await user.click(screen.getByRole('menuitem', { name: 'Unlock' }));
    await waitFor(() => expect(toasts(store).map((t) => t[0])).toContain('Sita Sales can try again now'));
    expect(calls.some((c) => c.method === 'POST' && c.path === '/admin/users/u2/unlock')).toBe(true);
  });

  it('lists sessions and signs someone out everywhere', async () => {
    const user = userEvent.setup();
    const calls = usersApi(({ method, path }) => {
      if (method === 'GET' && path === '/admin/users/u2/sessions') {
        return json({ data: [{ id: 's1', createdAt: '2026-09-17T02:00:00.000Z', expiresAt: '2026-10-17T02:00:00.000Z', ip: '10.1.1.1', userAgent: 'Firefox' }] });
      }
      if (method === 'DELETE' && path === '/admin/users/u2/sessions') return json({ data: { revoked: 1 } });
      return undefined;
    });
    const { store } = renderWithProviders(<UsersPage />, { path: '/admin/platform/users', preloadedState: asAdmin });
    await openMenu(user, 'Sita Sales');
    await user.click(screen.getByRole('menuitem', { name: 'Sessions' }));
    const dialog = await screen.findByRole('dialog', { name: 'Sita Sales’s sessions' });
    expect(await within(dialog).findByText(/10\.1\.1\.1/)).toBeInTheDocument();
    expect(within(dialog).getByText('Firefox')).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: 'Sign out everywhere' }));
    const confirmBox = await screen.findByRole('alertdialog', { name: 'Sign Sita Sales out everywhere?' });
    await user.click(within(confirmBox).getByRole('button', { name: 'Sign out everywhere' }));
    await waitFor(() => expect(toasts(store).map((t) => t[0])).toContain('1 session ended'));
    expect(calls.some((c) => c.method === 'DELETE' && c.path === '/admin/users/u2/sessions')).toBe(true);
  });

  it('creates a user without a password, with a Nepali number', async () => {
    const user = userEvent.setup();
    const calls = usersApi(({ method, path, body }) => (method === 'POST' && path === '/admin/users'
      ? json({ data: { ...ME, id: 'u3', ...body, invited: true } }, 201) : undefined));
    const { store } = renderWithProviders(<UsersPage />, { path: '/admin/platform/users', preloadedState: asAdmin });
    await user.click(await screen.findByRole('button', { name: /New user/ }));
    const sheet = await screen.findByRole('dialog', { name: 'New user' });
    expect(within(sheet).queryByLabelText(/password/i)).not.toBeInTheDocument();
    await user.type(within(sheet).getByLabelText(/Name/), 'राम थापा');
    await user.type(within(sheet).getByLabelText(/Email/), 'Ram@Example.com');
    await user.type(within(sheet).getByLabelText(/Phone/), '+977 9808338255');
    await user.click(within(sheet).getByRole('button', { name: 'Create and send invite' }));
    await waitFor(() => expect(calls.find((c) => c.method === 'POST' && c.path === '/admin/users')?.body).toEqual({
      name: 'राम थापा', email: 'ram@example.com', phone: '9808338255', role: 'SALES', isActive: true,
    }));
    await waitFor(() => expect(toasts(store)[0][0]).toBe('राम थापा added'));
  });
});

describe('RolesPage', () => {
  it('draws the matrix from the permission map', () => {
    renderWithProviders(<RolesPage />, { path: '/admin/platform/roles', preloadedState: asAdmin });
    const row = (capability) => screen.getByText(capability).closest('tr');
    expect(within(row('quotations:approve')).getByLabelText('Manager: yes')).toBeInTheDocument();
    expect(within(row('quotations:approve')).getByLabelText('Sales: no')).toBeInTheDocument();
    expect(within(row('quotations:read')).getByLabelText('Surveyor: no')).toBeInTheDocument();
    expect(within(row('users:admin')).getAllByLabelText(/: yes$/)).toHaveLength(1);
  });
});

// ── login activity

describe('LoginActivityPage', () => {
  it('lists sign-in events, and unlocks an account that needs attention', async () => {
    const user = userEvent.setup();
    const calls = mockApi(({ method, path }) => {
      if (path === '/admin/login-activity') {
        return page([
          { id: 'e1', event: 'auth.login_failed', createdAt: '2026-09-17T04:00:00.000Z', user: null, email: 'ghost@example.com', reason: 'unknown_email', attempt: null, ip: '10.9.9.9', userAgent: 'curl/8', requestId: 'r1', actorType: 'public' },
          { id: 'e2', event: 'auth.locked', createdAt: '2026-09-17T04:01:00.000Z', user: { id: 'u2', name: 'Sita Sales', email: 'sales@gharjatan.com.np', role: 'SALES' }, email: 'sales@gharjatan.com.np', reason: null, attempt: null, ip: '10.9.9.8', userAgent: null, requestId: 'r2', actorType: 'public' },
        ]);
      }
      if (path === '/admin/login-activity/summary') {
        return page([{ user: { id: 'u2', name: 'Sita Sales', email: 'sales@gharjatan.com.np', role: 'SALES' }, lastLoginAt: null, failures24h: 5, lockedUntil: '2026-09-17T04:16:00.000Z', isLocked: true }]);
      }
      if (method === 'POST' && path === '/admin/users/u2/unlock') return json({ data: {} });
      return undefined;
    });
    const { store } = renderWithProviders(<LoginActivityPage />, { path: '/admin/platform/login-activity', preloadedState: asAdmin });
    expect(await screen.findByText('ghost@example.com')).toBeInTheDocument();
    expect(screen.getByText('No account with this email')).toBeInTheDocument();
    expect(screen.getByText('Account locked')).toBeInTheDocument();
    expect(calls.find((c) => c.path === '/admin/login-activity/summary').query).toMatchObject({ attention: 'true' });

    const attention = await screen.findByRole('list', { name: 'Accounts that need attention' });
    expect(within(attention).getByText(/5 failed in 24 h/)).toBeInTheDocument();
    await user.click(within(attention).getByRole('button', { name: 'Unlock Sita Sales' }));
    await waitFor(() => expect(toasts(store).map((t) => t[0])).toContain('Sita Sales can try again now'));
  });
});

// ── messages

describe('MessageLogsPage', () => {
  it('shows delivery states with the masked address, and sends a failed one again', async () => {
    const user = userEvent.setup();
    const failed = { id: 'm1', channel: 'sms', templateKey: 'quotation_sent', toAddress: '******4567', subject: null, body: 'तपाईंको कोटेसन तयार छ', provider: 'sparrow', providerId: null, status: 'failed', error: 'Sparrow SMS failed with 500', relatedModel: 'Quotation', relatedId: 'q1', createdAt: '2026-09-17T04:00:00.000Z' };
    const reset = { ...failed, id: 'm2', channel: 'email', templateKey: 'password_reset', toAddress: 'ra***@example.com', body: 'Reset: https://x/reset-password?token=[redacted]', relatedModel: 'User', relatedId: 'u2' };
    const calls = mockApi(({ method, path }) => {
      if (path === '/admin/message-logs') return page([failed, reset]);
      if (method === 'POST' && path === '/admin/message-logs/m1/retry') return json({ data: { ...failed, status: 'sent', error: null } });
      return undefined;
    });
    const { store } = renderWithProviders(<MessageLogsPage />, { path: '/admin/platform/messages', preloadedState: asAdmin });
    expect(await screen.findByText('******4567')).toBeInTheDocument();
    expect(screen.getAllByText('Sparrow SMS failed with 500', { selector: 'p' })).toHaveLength(2);
    expect(screen.getByRole('link', { name: 'Quotation' })).toHaveAttribute('href', '/admin/quotations/q1');

    await user.click(screen.getByRole('button', { name: /Actions for Email to ra\*\*\*@example.com/ }));
    expect(screen.getByRole('menuitem', { name: /one-time link/ })).toHaveAttribute('aria-disabled', 'true');
    await user.keyboard('{Escape}');

    await user.click(screen.getByRole('button', { name: /Actions for SMS to \*\*\*\*\*\*4567/ }));
    await user.click(screen.getByRole('menuitem', { name: 'Send again' }));
    await waitFor(() => expect(toasts(store)).toContainEqual(['Sent', 'Delivered to ******4567 this time.']));
    expect(calls.some((c) => c.method === 'POST' && c.path === '/admin/message-logs/m1/retry')).toBe(true);
  });
});

describe('message templates', () => {
  it('lists each message once with its versions', async () => {
    mockApi(({ path }) => (path === '/admin/message-templates/groups'
      ? page([{ key: 'lead_ack', variants: [{ id: 't1', channel: 'sms', locale: 'en', isActive: true }, { id: 't2', channel: 'sms', locale: 'ne', isActive: false }] }])
      : undefined));
    renderWithProviders(<MessageTemplatesPage />, { path: '/admin/platform/message-templates', preloadedState: asAdmin });
    expect(await screen.findByText('lead_ack')).toBeInTheDocument();
    expect(screen.getByText('Customer')).toBeInTheDocument();
    expect(screen.getByTitle('SMS · English: in use')).toBeInTheDocument();
    expect(screen.getByTitle('SMS · नेपाली: switched off')).toBeInTheDocument();
    expect(screen.getByTitle('Email · English: not written')).toBeInTheDocument();
  });

  it('edits the Nepali SMS beside a live preview with its segment count', async () => {
    const user = userEvent.setup();
    const EN = { id: 't1', key: 'lead_ack', channel: 'sms', locale: 'en', subject: null, body: 'Thank you {{leadName}} - {{appName}}', isActive: true };
    const NE = { id: 't2', key: 'lead_ack', channel: 'sms', locale: 'ne', subject: null, body: 'धन्यवाद {{leadName}}', isActive: true };
    const calls = mockApi(({ method, path, body }) => {
      if (path === '/admin/message-templates' && method === 'GET') return json({ data: [EN, NE] });
      if (method === 'POST' && path === '/admin/message-templates/t2/preview') {
        const rendered = body.body.replace(/\{\{\s*leadName\s*\}\}/g, body.vars.leadName ?? '');
        return json({ data: { subject: null, body: rendered, placeholders: ['leadName'], missing: body.vars.leadName ? [] : ['leadName'] } });
      }
      if (method === 'PUT' && path === '/admin/message-templates/t2') return json({ data: { ...NE, ...body } });
      return undefined;
    });
    const { store } = renderWithProviders(
      <Routes><Route path="/admin/platform/message-templates/:key" element={<MessageTemplateEditPage />} /></Routes>,
      { path: '*', initialPath: '/admin/platform/message-templates/lead_ack', preloadedState: asAdmin },
    );
    await user.click(await screen.findByRole('tab', { name: 'SMS · नेपाली' }));
    const message = await screen.findByLabelText(/Message/);
    expect(message).toHaveValue('धन्यवाद {{leadName}}');

    await user.clear(message);
    await user.type(message, 'धन्यवाद {{{{leadName}}, हाम्रो इन्जिनियरले फोन गर्नुहुनेछ।');
    await waitFor(() => expect(calls.filter((c) => c.path === '/admin/message-templates/t2/preview').at(-1)?.body)
      .toMatchObject({ body: 'धन्यवाद {{leadName}}, हाम्रो इन्जिनियरले फोन गर्नुहुनेछ।', vars: { leadName: 'Sita Rai' } }));
    expect(await screen.findByText('धन्यवाद Sita Rai, हाम्रो इन्जिनियरले फोन गर्नुहुनेछ।')).toBeInTheDocument();
    expect(screen.getByText(/Unicode/)).toBeInTheDocument();
    expect(screen.getByText(/70 characters a part/)).toBeInTheDocument();
    // The English version's other placeholder is offered to the translator.
    expect(screen.getByRole('button', { name: 'Copy the placeholder appName' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(calls.find((c) => c.method === 'PUT')?.body).toMatchObject({
      body: 'धन्यवाद {{leadName}}, हाम्रो इन्जिनियरले फोन गर्नुहुनेछ।', isActive: true,
    }));
    await waitFor(() => expect(toasts(store).map((t) => t[0])).toContain('Template saved'));
  });
});

// ── the reset link

describe('ResetPasswordPage', () => {
  const at = (search) => renderWithProviders(
    <Routes><Route path="/reset-password" element={<ResetPasswordPage />} /></Routes>,
    { path: '*', initialPath: `/reset-password${search}` },
  );

  it('asks for the email link when there is no token', () => {
    mockApi(() => undefined);
    at('');
    expect(screen.getByRole('heading', { name: 'Open the link from your email' })).toBeInTheDocument();
  });

  it('checks the two passwords, sets it, and says what a spent link means', async () => {
    const user = userEvent.setup();
    const token = 'x'.repeat(43);
    let attempts = 0;
    const calls = mockApi(({ path }) => {
      if (path !== '/auth/reset-password') return undefined;
      attempts += 1;
      return attempts === 1
        ? json({ error: { code: 'BAD_REQUEST', message: 'This reset link is invalid or has expired' } }, 400)
        : json({ data: { ok: true } });
    });
    at(`?token=${token}`);
    await user.type(screen.getByLabelText('New password'), 'short');
    await user.type(screen.getByLabelText('Type it again'), 'different1');
    await user.click(screen.getByRole('button', { name: 'Set password' }));
    expect(await screen.findByText('Use at least 8 characters')).toBeInTheDocument();
    expect(screen.getByText('The two passwords are different')).toBeInTheDocument();
    expect(calls.filter((c) => c.path === '/auth/reset-password')).toHaveLength(0);

    await user.clear(screen.getByLabelText('New password'));
    await user.type(screen.getByLabelText('New password'), 'नयाँPassword1');
    await user.clear(screen.getByLabelText('Type it again'));
    await user.type(screen.getByLabelText('Type it again'), 'नयाँPassword1');
    await user.click(screen.getByRole('button', { name: 'Set password' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('invalid or has expired Ask an administrator');

    await user.click(screen.getByRole('button', { name: 'Set password' }));
    expect(await screen.findByRole('heading', { name: 'Password set' })).toBeInTheDocument();
    expect(calls.filter((c) => c.path === '/auth/reset-password').at(-1).body).toEqual({ token, password: 'नयाँPassword1' });
  });
});
