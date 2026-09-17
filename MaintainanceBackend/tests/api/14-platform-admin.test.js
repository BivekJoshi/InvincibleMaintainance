import { describe, it, expect, beforeAll } from 'vitest';
import {
  anon, as, withToken, expectStatus, prisma, USERS, PASSWORD, uid, phone, createAssignedJob, createCustomer,
} from './helpers.js';

/** Phase G: record history everywhere, users and sessions, login activity, templates and delivery logs. */

let admin;
let sales;
let editor;
let dispatcher;
let accountant;
let adminId;

const rid = () => `g-${uid()}`;
const eventsFor = (requestId) => prisma.auditLog.findMany({ where: { requestId, event: { not: null } } });

/**
 * A throwaway account made through the API, so lockout and session tests never touch a seeded one.
 * An EDITOR by default: an active SALES account would join every lead-assignee list the other files read.
 */
async function throwaway(extra = {}) {
  const email = `${uid('g')}@example.com`;
  const user = expectStatus(await admin.post('/admin/users').send({
    name: 'Phase G User', email, password: PASSWORD, role: 'EDITOR', ...extra,
  }), 201).data;
  return { ...user, email };
}

async function login(email, password = PASSWORD) {
  return anon().post('/auth/login').send({ email, password });
}

const cookieOf = (res) => res.headers['set-cookie'].find((c) => c.startsWith('refresh_token=')).split(';')[0];

beforeAll(async () => {
  [admin, sales, editor, dispatcher, accountant] = await Promise.all([
    as('ADMIN'), as('SALES'), as('EDITOR'), as('DISPATCHER'), as('ACCOUNTANT'),
  ]);
  adminId = (await prisma.user.findUnique({ where: { email: USERS.ADMIN } })).id;
});

// ── G1 · record history everywhere

describe('generic record history', () => {
  it('a CMS resource: its rows and events, for cms:read only', async () => {
    const faq = expectStatus(await editor.post('/admin/faqs').send({ question: `History ${uid()}?`, answer: 'Yes, it has one.' }), 201).data;
    expectStatus(await editor.put(`/admin/faqs/${faq.id}`).send({ answer: 'कहिलेकाहीँ, हो।' }), 200);
    expectStatus(await editor.delete(`/admin/faqs/${faq.id}`), 204);

    const body = expectStatus(await editor.get(`/admin/faqs/${faq.id}/history?limit=50`), 200);
    expect(body.data.map((r) => r.event ?? `${r.model}.${r.action}`)).toEqual(expect.arrayContaining(['Faq.create', 'Faq.update', 'cms.deleted']));
    expect(body.data.every((r) => r.recordId === faq.id)).toBe(true);
    expect(body.data.find((r) => r.action === 'update' && r.after?.answer).after.answer).toBe('कहिलेकाहीँ, हो।');
    expect(body.data[0]).not.toHaveProperty('ip');
    expect(body.meta).toMatchObject({ page: 1, total: body.data.length });

    expectStatus(await sales.get(`/admin/faqs/${faq.id}/history`), 403);
    expectStatus(await editor.get('/admin/faqs/no-such-faq/history'), 404);
  });

  it('a service: an editor reads it, sales (services:read) does not', async () => {
    const service = await prisma.service.findFirst({ where: { deletedAt: null } });
    expectStatus(await editor.get(`/admin/services/${service.id}/history`), 200);
    expectStatus(await sales.get(`/admin/services/${service.id}/history`), 403);
  });

  it('a project includes its gallery rows', async () => {
    const project = await prisma.project.findFirst({ where: { deletedAt: null } });
    const media = await prisma.media.findFirst({ where: { deletedAt: null } });
    expectStatus(await editor.post(`/admin/projects/${project.id}/images`).send({ mediaId: media.id }), 201);
    const rows = expectStatus(await editor.get(`/admin/projects/${project.id}/history?limit=100`), 200).data;
    expect(rows.some((r) => r.model === 'ProjectImage')).toBe(true);
  });

  it('a job: jobs:history (dispatcher), not sales who only reads jobs', async () => {
    const { job, technicianId } = await createAssignedJob();
    expectStatus(await dispatcher.post(`/admin/jobs/${job.id}/assign`).send({ technicianIds: [technicianId] }), 200);
    expectStatus(await dispatcher.patch(`/admin/jobs/${job.id}/status`).send({ status: 'IN_PROGRESS' }), 200);
    const rows = expectStatus(await dispatcher.get(`/admin/jobs/${job.id}/history?limit=100`), 200).data;
    expect(rows.map((r) => r.event)).toEqual(expect.arrayContaining(['job.created', 'job.status_changed']));
    expect(rows.some((r) => r.model === 'JobAssignment')).toBe(true);
    expectStatus(await sales.get(`/admin/jobs/${job.id}/history`), 403);
    expectStatus(await accountant.get(`/admin/jobs/${job.id}/history`), 403);
  });

  it('an invoice includes its payments, for invoices:history (accountant)', async () => {
    const customer = await createCustomer(sales);
    const invoice = expectStatus(await accountant.post('/admin/invoices').send({
      customerId: customer.id, items: [{ description: 'History fee', unit: 'lump', qty: 1, rate: 1000 }],
    }), 201).data;
    expectStatus(await accountant.post(`/admin/invoices/${invoice.id}/send`), 200);
    const payment = expectStatus(await accountant.post(`/admin/invoices/${invoice.id}/payments`).send({ amount: 500, method: 'CASH' }), 201).data;
    expectStatus(await accountant.post(`/admin/invoices/${invoice.id}/payments/${payment.id}/void`).send({ reason: 'Entered twice' }), 200);

    const rows = expectStatus(await accountant.get(`/admin/invoices/${invoice.id}/history?limit=100`), 200).data;
    expect(rows.map((r) => r.event)).toEqual(expect.arrayContaining(['invoice.created', 'payment.recorded', 'payment.voided']));
    expectStatus(await dispatcher.get(`/admin/invoices/${invoice.id}/history`), 403);
    expectStatus(await sales.get(`/admin/invoices/${invoice.id}/history`), 403);
  });

  it('the rate card: quotations:history, not the accountant who only reads rates', async () => {
    const item = await prisma.rateCardItem.findFirst({ where: { deletedAt: null } });
    expectStatus(await sales.get(`/admin/rate-card/${item.id}/history`), 200);
    expectStatus(await accountant.get(`/admin/rate-card/${item.id}/history`), 403);
  });
});

// ── G2 · users

describe('users', () => {
  it('creating without a password emails a set-password link; admins never see one', async () => {
    const email = `${uid('invite')}@example.com`;
    const requestId = rid();
    const res = await admin.post('/admin/users').set('X-Request-Id', requestId).send({ name: 'Invited User', email, role: 'EDITOR' });
    const user = expectStatus(res, 201).data;
    expect(JSON.stringify(res.body)).not.toMatch(/token|password/i);
    expect(user.invited).toBe(true);
    expect(await prisma.passwordReset.count({ where: { userId: user.id } })).toBe(1);
    const log = await prisma.messageLog.findFirst({ where: { toAddress: email }, orderBy: { createdAt: 'desc' } });
    expect(log.templateKey).toBe('account_invite');
    expect(log.body).not.toMatch(/token=[A-Za-z0-9_-]{10,}/);
    expect((await eventsFor(requestId)).map((e) => e.event)).toEqual(expect.arrayContaining(['user.created', 'auth.password_reset_requested']));
    // The account has no usable password until the link is used.
    expect((await login(email, 'Password123')).status).toBe(401);
  });

  it('PUT refuses a password: admins send a reset link instead', async () => {
    const user = await throwaway();
    const res = expectStatus(await admin.put(`/admin/users/${user.id}`).send({ password: 'Another123' }), 400);
    expect(res.error.details.map((d) => d.path)).toContain('password');
  });

  it('a TECHNICIAN or SURVEYOR gets a technician profile, and a role change to one creates it', async () => {
    const tech = await throwaway({ role: 'TECHNICIAN', phone: phone() });
    expect(tech.technician).toMatchObject({ id: expect.any(String) });
    expect(await prisma.technician.count({ where: { userId: tech.id, deletedAt: null } })).toBe(1);

    const other = await throwaway();
    expect(other.technician).toBeNull();
    const moved = expectStatus(await admin.put(`/admin/users/${other.id}`).send({ role: 'SURVEYOR' }), 200).data;
    expect(moved.technician).toMatchObject({ id: expect.any(String) });
    // Moving back and forth keeps one profile.
    expectStatus(await admin.put(`/admin/users/${other.id}`).send({ role: 'EDITOR' }), 200);
    expectStatus(await admin.put(`/admin/users/${other.id}`).send({ role: 'TECHNICIAN' }), 200);
    expect(await prisma.technician.count({ where: { userId: other.id } })).toBe(1);
  });

  it('the list carries last login, the lock and the technician link', async () => {
    const user = await throwaway();
    await prisma.user.update({ where: { id: user.id }, data: { lockedUntil: new Date(Date.now() + 600_000), failedLogins: 5 } });
    const rows = expectStatus(await admin.get(`/admin/users?q=${encodeURIComponent(user.email)}`), 200).data;
    expect(rows[0]).toMatchObject({ id: user.id, lockedUntil: expect.any(String), isLocked: true, technicianId: null });
    expect(rows[0]).not.toHaveProperty('passwordHash');
    expectStatus(await admin.get('/admin/users?role=EDITOR&isActive=true'), 200);
    expectStatus(await admin.get('/admin/users?role=ROBOT'), 400);
  });

  it('an admin cannot disable, delete or revoke themselves out', async () => {
    expectStatus(await admin.patch(`/admin/users/${adminId}/toggle`), 400);
    expectStatus(await admin.put(`/admin/users/${adminId}`).send({ isActive: false }), 400);
    expectStatus(await admin.put(`/admin/users/${adminId}`).send({ role: 'SALES' }), 400);
    expectStatus(await admin.delete(`/admin/users/${adminId}`), 400);
  });

  it('send-password-reset emails the normal link and never returns a token', async () => {
    const user = await throwaway();
    const requestId = rid();
    const res = await admin.post(`/admin/users/${user.id}/send-password-reset`).set('X-Request-Id', requestId);
    const body = expectStatus(res, 200);
    expect(body.data).toEqual({ sent: true, email: user.email });
    expect(JSON.stringify(body)).not.toMatch(/token/i);
    const [event] = (await eventsFor(requestId)).filter((e) => e.event === 'auth.password_reset_requested');
    expect(event).toMatchObject({ recordId: user.id, actorId: adminId, changes: { by: 'admin' } });

    // The message log keeps the delivery, not the link.
    const log = await prisma.messageLog.findFirst({ where: { toAddress: user.email, templateKey: 'password_reset' }, orderBy: { createdAt: 'desc' } });
    expect(log.body).toContain('[redacted]');
    const listed = expectStatus(await admin.get(`/admin/message-logs?templateKey=password_reset&limit=5`), 200).data;
    expect(JSON.stringify(listed)).not.toMatch(/token=[A-Za-z0-9_-]{10,}/);

    // A disabled account gets nothing.
    expectStatus(await admin.patch(`/admin/users/${user.id}/toggle`), 200);
    expectStatus(await admin.post(`/admin/users/${user.id}/send-password-reset`), 422);
  });

  it('unlock clears the lock and the failure count', async () => {
    const user = await throwaway();
    for (let i = 0; i < 5; i += 1) await login(user.email, `Wrong-${i}-pass`);
    expect((await login(user.email)).status).toBe(403);

    const requestId = rid();
    const res = expectStatus(await admin.post(`/admin/users/${user.id}/unlock`).set('X-Request-Id', requestId), 200);
    expect(res.data).toMatchObject({ id: user.id, isLocked: false, lockedUntil: null });
    const row = await prisma.user.findUnique({ where: { id: user.id } });
    expect(row).toMatchObject({ failedLogins: 0, lockedUntil: null });
    const [event] = await eventsFor(requestId);
    expect(event).toMatchObject({ event: 'auth.unlocked', recordId: user.id, actorId: adminId });
    expect(event.before).toMatchObject({ failedLogins: 5 });
    expectStatus(await login(user.email), 200);
  });

  it('sessions: listed without their token, and revoking them all ends the refresh', async () => {
    const user = await throwaway();
    const first = await login(user.email);
    const second = await login(user.email);
    expectStatus(first, 200);

    const sessions = expectStatus(await admin.get(`/admin/users/${user.id}/sessions`), 200).data;
    expect(sessions).toHaveLength(2);
    expect(Object.keys(sessions[0]).sort()).toEqual(['createdAt', 'expiresAt', 'id', 'ip', 'userAgent']);
    expect(sessions[0]).toMatchObject({ id: expect.any(String), createdAt: expect.any(String), ip: expect.any(String) });

    const requestId = rid();
    const revoked = expectStatus(await admin.delete(`/admin/users/${user.id}/sessions`).set('X-Request-Id', requestId), 200);
    expect(revoked.data).toEqual({ revoked: 2 });
    const [event] = await eventsFor(requestId);
    expect(event).toMatchObject({ event: 'auth.sessions_revoked', recordId: user.id, changes: { count: 2 } });

    for (const res of [first, second]) {
      expectStatus(await anon().post('/auth/refresh').set('Cookie', cookieOf(res)), 401);
    }
    expect(expectStatus(await admin.get(`/admin/users/${user.id}/sessions`), 200).data).toHaveLength(0);
  });

  it('disabling a user also ends their sessions', async () => {
    const user = await throwaway();
    const session = await login(user.email);
    expectStatus(await admin.patch(`/admin/users/${user.id}/toggle`), 200);
    const res = await anon().post('/auth/refresh').set('Cookie', cookieOf(session));
    expect([401, 403]).toContain(res.status);
    expect(await prisma.refreshToken.count({ where: { userId: user.id, revokedAt: null } })).toBe(0);
    expectStatus(await withToken(session.body.data.accessToken).get('/auth/me'), 403);
  });

  it('every user action is ADMIN only', async () => {
    const user = await throwaway();
    for (const [method, path] of [
      ['post', `/admin/users/${user.id}/send-password-reset`], ['post', `/admin/users/${user.id}/unlock`],
      ['get', `/admin/users/${user.id}/sessions`], ['delete', `/admin/users/${user.id}/sessions`],
      ['get', '/admin/login-activity'], ['get', '/admin/login-activity/summary'],
    ]) {
      expectStatus(await sales[method](path), 403);
    }
    expectStatus(await admin.post('/admin/users/no-such-user/unlock'), 404);
  });
});

// ── G3 · login activity

describe('login activity', () => {
  let user;

  beforeAll(async () => {
    user = await throwaway();
    await login(user.email, 'Wrong-once-pass');
    await login(user.email);
  });

  it('lists auth events with the user, filtered by user, event and date', async () => {
    const body = expectStatus(await admin.get(`/admin/login-activity?userId=${user.id}&limit=50`), 200);
    const events = body.data.map((r) => r.event);
    expect(events).toEqual(expect.arrayContaining(['auth.login', 'auth.login_failed']));
    expect(body.data.every((r) => r.event.startsWith('auth.'))).toBe(true);
    const failed = body.data.find((r) => r.event === 'auth.login_failed');
    expect(failed).toMatchObject({ user: { id: user.id, name: 'Phase G User', email: user.email, role: 'EDITOR' }, reason: 'wrong_password' });
    expect(failed).toHaveProperty('ip');

    const onlyFailed = expectStatus(await admin.get(`/admin/login-activity?userId=${user.id}&event=auth.login_failed`), 200).data;
    expect(onlyFailed.every((r) => r.event === 'auth.login_failed')).toBe(true);
    expectStatus(await admin.get(`/admin/login-activity?userId=${user.id}&from=2020-01-01&to=2020-01-02`), 200);
    expectStatus(await admin.get('/admin/login-activity?event=quotation.sent'), 400);
  });

  it('an unknown email shows the address that was typed', async () => {
    const email = `${uid('nobody')}@example.com`;
    await login(email, 'Whatever123');
    const rows = expectStatus(await admin.get(`/admin/login-activity?q=${encodeURIComponent(email)}`), 200).data;
    expect(rows[0]).toMatchObject({ event: 'auth.login_failed', user: null, email, reason: 'unknown_email' });
  });

  it('filters by ip', async () => {
    const row = await prisma.auditLog.findFirst({ where: { event: 'auth.login', recordId: user.id } });
    const rows = expectStatus(await admin.get(`/admin/login-activity?ip=${row.ip}`), 200).data;
    expect(rows.map((r) => r.id)).toContain(row.id);
  });

  it('summary: last login, failures in 24 hours, locked until', async () => {
    const locked = await throwaway();
    for (let i = 0; i < 5; i += 1) await login(locked.email, `Wrong-${i}-pass`);
    const rows = expectStatus(await admin.get('/admin/login-activity/summary?attention=true&limit=100'), 200).data;
    const mine = rows.find((r) => r.user.id === locked.id);
    expect(mine).toMatchObject({ failures24h: 5, lockedUntil: expect.any(String), isLocked: true, lastLoginAt: null });
    expect(rows.find((r) => r.user.id === user.id)).toMatchObject({ failures24h: 1, isLocked: false, lastLoginAt: expect.any(String) });
    const all = expectStatus(await admin.get('/admin/login-activity/summary'), 200);
    expect(all.meta.total).toBeGreaterThanOrEqual(Object.keys(USERS).length);
  });
});

// ── G4 · message templates and logs

describe('message templates', () => {
  let template;

  beforeAll(async () => {
    template = expectStatus(await admin.post('/admin/message-templates').send({
      key: uid('tpl_g'), channel: 'sms', locale: 'ne', body: 'नमस्ते {{name}}, तपाईंको {{ quotation.number }} तयार छ। {{link}}',
    }), 201).data;
  });

  it('preview renders, lists the placeholders and the missing vars', async () => {
    const body = expectStatus(await admin.post(`/admin/message-templates/${template.id}/preview`).send({
      vars: { name: 'राम', quotation: { number: 'QT-1' } },
    }), 200).data;
    expect(body.body).toBe('नमस्ते राम, तपाईंको QT-1 तयार छ। ');
    expect(body.placeholders).toEqual(['name', 'quotation.number', 'link']);
    expect(body.missing).toEqual(['link']);
    expect(body.subject).toBeNull();
  });

  it('preview takes unsaved text, and works without a saved template', async () => {
    const draft = expectStatus(await admin.post(`/admin/message-templates/${template.id}/preview`).send({
      body: 'Hi {{name}}', vars: {},
    }), 200).data;
    expect(draft).toMatchObject({ body: 'Hi ', missing: ['name'] });

    const fresh = expectStatus(await admin.post('/admin/message-templates/preview').send({
      subject: 'About {{ job }}', body: 'Job {{job}} done', vars: { job: 'JOB-7' },
    }), 200).data;
    expect(fresh).toMatchObject({ subject: 'About JOB-7', body: 'Job JOB-7 done', placeholders: ['job'], missing: [] });
    expectStatus(await admin.post('/admin/message-templates/preview').send({ vars: {} }), 400);
    expectStatus(await admin.post('/admin/message-templates/no-such/preview').send({ vars: {} }), 404);
    expectStatus(await sales.post('/admin/message-templates/preview').send({ body: 'x {{y}}' }), 403);
  });

  it('groups: one row per key with its variants', async () => {
    const res = expectStatus(await admin.get(`/admin/message-templates/groups?q=${template.key}`), 200);
    expect(res.data).toEqual([{ key: template.key, variants: [expect.objectContaining({ id: template.id, channel: 'sms', locale: 'ne', isActive: true })] }]);
    const all = expectStatus(await admin.get('/admin/message-templates/groups?limit=100'), 200);
    expect(all.data.some((g) => g.key === 'quotation_sent')).toBe(true);
    expect(all.meta.total).toBe(new Set((await prisma.messageTemplate.findMany({ select: { key: true } })).map((t) => t.key)).size);
  });

  it('the list filters by key, channel and locale', async () => {
    const rows = expectStatus(await admin.get(`/admin/message-templates?key=${template.key}&channel=sms&locale=ne`), 200).data;
    expect(rows.map((r) => r.id)).toEqual([template.id]);
    expectStatus(await admin.get('/admin/message-templates?channel=fax'), 400);
  });
});

describe('message logs', () => {
  let failed;
  let related;

  beforeAll(async () => {
    related = uid('rel');
    failed = await prisma.messageLog.create({
      data: {
        channel: 'sms', templateKey: 'quotation_sent', toAddress: '9841234567', body: 'Your quotation is ready',
        status: 'failed', error: 'Sparrow SMS failed with 500', relatedModel: 'Quotation', relatedId: related,
      },
    });
  });

  it('filters, and masks the address to its last four digits', async () => {
    const body = expectStatus(await admin.get(`/admin/message-logs?relatedModel=Quotation&relatedId=${related}`), 200);
    expect(body.data).toHaveLength(1);
    expect(body.data[0]).toMatchObject({ id: failed.id, toAddress: '******4567', status: 'failed', error: expect.any(String) });
    expect(JSON.stringify(body)).not.toContain('9841234567');

    const byPhone = expectStatus(await admin.get('/admin/message-logs?q=4567&status=failed&channel=sms'), 200).data;
    expect(byPhone.map((r) => r.id)).toContain(failed.id);
    expectStatus(await admin.get('/admin/message-logs?templateKey=quotation_sent&from=2020-01-01'), 200);
    expectStatus(await admin.get('/admin/message-logs?status=lost'), 400);
    expectStatus(await admin.get('/admin/message-logs?sort=body'), 400);
    expectStatus(await sales.get('/admin/message-logs'), 403);
  });

  it('an email address keeps its domain', async () => {
    const log = await prisma.messageLog.create({ data: { channel: 'email', toAddress: 'ramesh.shrestha@example.com', body: 'Hello', status: 'sent' } });
    const rows = expectStatus(await admin.get(`/admin/message-logs?q=ramesh.shrestha`), 200).data;
    expect(rows.find((r) => r.id === log.id).toAddress).toBe('ra***@example.com');
  });

  it('retry re-sends a failed message and is audited', async () => {
    const requestId = rid();
    const res = expectStatus(await admin.post(`/admin/message-logs/${failed.id}/retry`).set('X-Request-Id', requestId), 200).data;
    expect(res).toMatchObject({ id: failed.id, status: 'sent', error: null, toAddress: '******4567' });
    const [event] = await eventsFor(requestId);
    expect(event).toMatchObject({
      event: 'message.retried', model: 'MessageLog', recordId: failed.id, actorId: adminId,
      before: { status: 'failed', error: 'Sparrow SMS failed with 500' }, after: { status: 'sent' },
    });

    // Only a failed message can be retried.
    expectStatus(await admin.post(`/admin/message-logs/${failed.id}/retry`), 422);
    expectStatus(await admin.post('/admin/message-logs/no-such/retry'), 404);
    expectStatus(await sales.post(`/admin/message-logs/${failed.id}/retry`), 403);
  });

  it('a redacted message (a reset link) cannot be retried', async () => {
    const log = await prisma.messageLog.create({
      data: { channel: 'email', templateKey: 'password_reset', toAddress: 'x@example.com', body: 'link [redacted]', status: 'failed', error: 'SMTP down' },
    });
    const res = expectStatus(await admin.post(`/admin/message-logs/${log.id}/retry`), 422);
    expect(res.error.code).toBe('NOT_RETRYABLE');
  });
});

describe('platform routes', () => {
  it('SALES is refused users and the audit log', async () => {
    expectStatus(await sales.get('/admin/users'), 403);
    expectStatus(await sales.get('/admin/audit-logs'), 403);
    expectStatus(await sales.get('/admin/audit-logs/models'), 403);
  });

  it('GET /admin/audit-logs accepts an event prefix and lists the models', async () => {
    const rows = expectStatus(await admin.get('/admin/audit-logs?event=auth.*&limit=20'), 200).data;
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((r) => r.event.startsWith('auth.'))).toBe(true);
    const models = expectStatus(await admin.get('/admin/audit-logs/models'), 200).data;
    expect(models).toEqual(expect.arrayContaining(['User', 'Lead', 'Setting']));
    expect(new Set(models).size).toBe(models.length);
  });
});
