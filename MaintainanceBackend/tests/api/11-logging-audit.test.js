import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app.js';
import { createLogger } from '../../src/lib/logger.js';
import { runJob } from '../../src/queues/index.js';
import '../../src/queues/handlers.js';
import { AUDIT_EVENTS } from '../../src/shared/enums.js';
import {
  anon, as, withToken, expectStatus, prisma, USERS, PASSWORD, uid, phone, nextIp,
  createCustomer, technicianIdFor,
} from './helpers.js';

// ── helpers

/** A request id the app accepts, unique per call, so a test can find exactly its own rows. */
const rid = () => `t-${uid()}`;

const rowsFor = (requestId) => prisma.auditLog.findMany({ where: { requestId }, orderBy: { createdAt: 'asc' } });

/** Asserts that `requestId` wrote each event, and returns the event rows by name. */
async function expectEvents(requestId, ...events) {
  const rows = await rowsFor(requestId);
  const byEvent = Object.fromEntries(rows.filter((r) => r.event).map((r) => [r.event, r]));
  for (const event of events) {
    if (!byEvent[event]) {
      throw new Error(`expected ${event} for request ${requestId}; got ${JSON.stringify(rows.map((r) => r.event ?? `${r.action} ${r.model}`))}`);
    }
  }
  return byEvent;
}

/** An app whose logger writes JSON lines into an array. */
function capturedApp() {
  const lines = [];
  const logger = createLogger({ level: 'debug', destination: { write: (chunk) => lines.push(String(chunk)) } });
  const app = createApp({ logger });
  const parsed = () => lines.join('').split('\n').filter(Boolean).map((l) => JSON.parse(l));
  return { app, lines, parsed, text: () => lines.join('') };
}

const api = (app) => (method, path) => request(app)[method](`/api/v1${path}`).set('X-Forwarded-For', nextIp());

/** A throwaway account, so lockout and password tests never touch a seeded one. */
async function throwawayUser(role = 'SALES') {
  const admin = await as('ADMIN');
  const email = `${uid('audit')}@example.com`;
  const user = expectStatus(await admin.post('/admin/users').send({ name: 'Audit Throwaway', email, password: PASSWORD, role }), 201).data;
  return { ...user, email };
}

let admin;
let sales;
let dispatcher;
let accountant;

beforeAll(async () => {
  [admin, sales, dispatcher, accountant] = await Promise.all([as('ADMIN'), as('SALES'), as('DISPATCHER'), as('ACCOUNTANT')]);
});

// ── application logs

describe('application logs', () => {
  it('a request carrying Authorization, a cookie and a password logs none of them', async () => {
    const { app, text } = capturedApp();
    const res = await api(app)('post', '/auth/login')
      .set('Authorization', 'Bearer never-log-this-access-token')
      .set('Cookie', 'refresh_token=never-log-this-cookie')
      .send({ email: USERS.ADMIN, password: PASSWORD });
    expectStatus(res, 200);
    const issuedCookie = res.headers['set-cookie'].find((c) => c.startsWith('refresh_token=')).split(';')[0].split('=')[1];

    const out = text();
    expect(out).toContain('[redacted]');
    for (const secret of ['never-log-this-access-token', 'never-log-this-cookie', PASSWORD, issuedCookie, res.body.data.accessToken]) {
      expect(out).not.toContain(secret);
    }
    expect(out).not.toMatch(/Bearer/);
  });

  it('echoes a valid X-Request-Id and replaces an invalid one', async () => {
    const good = 'client-supplied.id_0001';
    expect((await anon().get('/public/faqs').set('X-Request-Id', good)).headers['x-request-id']).toBe(good);

    for (const bad of ['short', 'has spaces in it', 'x'.repeat(65), 'semi;colon-injection']) {
      const echoed = (await anon().get('/public/faqs').set('X-Request-Id', bad)).headers['x-request-id'];
      expect(echoed).not.toBe(bad);
      expect(echoed).toMatch(/^[0-9a-f-]{36}$/);
    }
    // Without one, a UUID is generated.
    expect((await anon().get('/public/faqs')).headers['x-request-id']).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('exposes X-Request-Id to the browser through CORS', async () => {
    const res = await anon().get('/public/faqs').set('Origin', 'http://localhost:5400');
    expect(res.headers['access-control-expose-headers']).toMatch(/X-Request-Id/i);
  });

  it('a CORS rejection answers 403 FORBIDDEN_ORIGIN, not 500', async () => {
    const body = expectStatus(await anon().get('/public/faqs').set('Origin', 'https://evil.example.com'), 403);
    expect(body.error.code).toBe('FORBIDDEN_ORIGIN');
  });

  it('the request log line and its audit rows share one requestId', async () => {
    const { app, parsed } = capturedApp();
    const token = await (await as('ADMIN')).token;
    const requestId = rid();
    expectStatus(await api(app)('patch', '/admin/settings')
      .set('Authorization', `Bearer ${token}`)
      .set('X-Request-Id', requestId)
      .send({ values: { 'branding.tagline': `Correlated ${uid()}` } }), 200);

    const line = parsed().find((l) => l.req?.id === requestId && l.res);
    expect(line).toBeTruthy();
    expect(line.requestId).toBe(requestId);
    expect(line.userId).toBeTruthy();

    const rows = await rowsFor(requestId);
    expect(rows.length).toBeGreaterThanOrEqual(2); // the Setting upsert and settings.changed
    expect(rows.every((r) => r.requestId === requestId && r.actorId === line.userId)).toBe(true);
  });

  it('a 4xx logs at info with its code and no stack; a phone in a logged object is masked', async () => {
    const { app, parsed } = capturedApp();
    const requestId = rid();
    await api(app)('post', '/auth/login').set('X-Request-Id', requestId).send({ email: 'not-an-email' });
    const rejected = parsed().find((l) => l.requestId === requestId && l.code === 'BAD_REQUEST');
    expect(rejected.level).toBe(30);
    expect(rejected.stack).toBeUndefined();
    expect(rejected.err).toBeUndefined();

    const lines = [];
    const logger = createLogger({ level: 'info', destination: { write: (c) => lines.push(String(c)) } });
    logger.info({ to: '9841234567', lead: { phone: '+977-9812345678', name: 'Sita' } }, 'sms');
    const out = lines.join('');
    expect(out).not.toContain('9841234567');
    expect(out).not.toContain('9812345678');
    expect(out).toContain('******4567');
    expect(out).toContain('Sita');
  });
});

// ── the audit extension

describe('audit extension', () => {
  it('an update rolled back inside prisma.$transaction leaves no audit row', async () => {
    const customer = await prisma.customer.findFirst({ where: { deletedAt: null } });
    const since = new Date();

    await expect(prisma.$transaction(async (tx) => {
      await tx.customer.update({ where: { id: customer.id }, data: { name: `${customer.name} (rolled back)` } });
      throw new Error('boom');
    })).rejects.toThrow('boom');

    const rows = await prisma.auditLog.findMany({
      where: { model: 'Customer', recordId: customer.id, createdAt: { gte: since } },
    });
    expect(rows).toHaveLength(0);
    expect((await prisma.customer.findUnique({ where: { id: customer.id } })).name).toBe(customer.name);
  });

  it('a committed transaction writes the row with a before/after diff of the changed fields only', async () => {
    const customer = await createCustomer(sales);
    const since = new Date();
    await prisma.$transaction(async (tx) => {
      await tx.customer.update({ where: { id: customer.id }, data: { name: 'राम बहादुर श्रेष्ठ', phone: customer.phone } });
    });
    const [row] = await prisma.auditLog.findMany({ where: { model: 'Customer', recordId: customer.id, createdAt: { gte: since } } });
    expect(row.action).toBe('update');
    expect(row.before).toEqual({ name: customer.name });
    expect(row.after).toEqual({ name: 'राम बहादुर श्रेष्ठ' });
    expect(row.actorType).toBe('system'); // no request context: a script or a test
  });

  it('PATCH /admin/settings audits the upsert and settings.changed with before and after', async () => {
    const requestId = rid();
    const before = (await prisma.setting.findUnique({ where: { key: 'branding.tagline' } }))?.value ?? null;
    const next = `Tagline ${uid()}`;
    expectStatus(await admin.patch('/admin/settings').set('X-Request-Id', requestId).send({ values: { 'branding.tagline': next } }), 200);

    const { 'settings.changed': event } = await expectEvents(requestId, 'settings.changed');
    expect(event.before).toEqual({ 'branding.tagline': before });
    expect(event.after).toEqual({ 'branding.tagline': next });

    const upsert = (await rowsFor(requestId)).find((r) => r.model === 'Setting' && r.action === 'upsert');
    expect(upsert.after.value).toBe(next);
    expect(upsert.before.value).toEqual(before);
  });

  it('secrets never reach before/after', async () => {
    const user = await throwawayUser();
    const requestId = rid();
    expectStatus(await admin.put(`/admin/users/${user.id}`).set('X-Request-Id', requestId).send({ password: 'Another123' }), 200);
    const row = (await rowsFor(requestId)).find((r) => r.model === 'User' && r.action === 'update');
    expect(row.before.passwordHash).toBe('[redacted]');
    expect(row.after.passwordHash).toBe('[redacted]');
    expect(JSON.stringify(row)).not.toMatch(/argon2/);
  });

  it('translations and home sections are audited', async () => {
    const service = await prisma.service.findFirst({ where: { deletedAt: null } });
    const t = rid();
    expectStatus(await (await as('EDITOR')).put('/admin/translations').set('X-Request-Id', t).send({
      model: 'Service', recordId: service.id, values: { name: { ne: `सेवा ${uid()}` } },
    }), 200);
    expect((await rowsFor(t)).some((r) => r.model === 'Translation')).toBe(true);

    const h = rid();
    const offers = await prisma.homeSection.findUnique({ where: { key: 'offers' } });
    expectStatus(await (await as('EDITOR')).put('/admin/home-sections').set('X-Request-Id', h).send({
      items: [{ key: 'offers', sortOrder: offers.sortOrder, isVisible: offers.isVisible }],
    }), 200);
    expect((await rowsFor(h)).some((r) => r.model === 'HomeSection' && r.action === 'upsert')).toBe(true);
  });

  it('a multipart upload keeps the request context through the body parser', async () => {
    const requestId = rid();
    const { pngBuffer } = await import('./helpers.js');
    expectStatus(await admin.post('/admin/media').set('X-Request-Id', requestId).attach('files', await pngBuffer('#010203'), 'ctx.png'), 201);
    const row = (await rowsFor(requestId)).find((r) => r.model === 'Media' && r.action === 'create');
    expect(row.actorId).toBeTruthy();
    expect(row.actorType).toBe('user');
  });

  it('merging two duplicates writes one row per merged id and logs no warning', async () => {
    const { app, parsed } = capturedApp();
    const [primary, b, c] = await Promise.all([1, 2, 3].map(async () =>
      expectStatus(await sales.post('/admin/leads').send({ name: 'Merge Audit', phone: phone() }), 201).data));
    const requestId = rid();
    expectStatus(await api(app)('post', '/admin/leads/merge')
      .set('Authorization', `Bearer ${sales.token}`)
      .set('X-Request-Id', requestId)
      .send({ primaryId: primary.id, duplicateIds: [b.id, c.id] }), 200);

    const rows = await rowsFor(requestId);
    const softDeletes = rows.filter((r) => r.model === 'Lead' && r.after?.deletedAt);
    expect(softDeletes.map((r) => r.recordId).sort()).toEqual([b.id, c.id].sort());
    expect(rows.filter((r) => r.model === 'Lead' && !r.event && r.recordId === null)).toHaveLength(0);

    const { 'lead.merged': merged } = await expectEvents(requestId, 'lead.merged');
    expect(merged.recordId).toBe(primary.id);
    expect(merged.changes.duplicateIds.sort()).toEqual([b.id, c.id].sort());

    expect(parsed().filter((l) => l.level >= 40)).toEqual([]);
  });
});

// ── public and system actors

describe('who did it', () => {
  let customer;
  const sendQuotation = async () => {
    const q = expectStatus(await sales.post('/admin/quotations').send({
      customerId: customer.id, items: [{ description: 'Audit line', qty: 1, rate: 1000 }],
    }), 201).data;
    expectStatus(await sales.post(`/admin/quotations/${q.id}/send`), 200);
    return prisma.quotation.findUnique({ where: { id: q.id } });
  };

  beforeAll(async () => { customer = await createCustomer(sales); });

  it('a public quotation approval is audited as public with ip and user agent', async () => {
    const q = await sendQuotation();
    const requestId = rid();
    const ip = nextIp();
    expectStatus(await anon(ip).post(`/public/quotations/${q.publicToken}/decide`)
      .set('X-Request-Id', requestId).set('User-Agent', 'AuditTest/1.0 (Android)')
      .send({ decision: 'approve' }), 200);

    const { 'quotation.customer_approved': event } = await expectEvents(requestId, 'quotation.customer_approved');
    expect(event).toMatchObject({ actorType: 'public', actorId: null, ip, userAgent: 'AuditTest/1.0 (Android)', recordId: q.id });
    expect(event.before).toEqual({ status: 'SENT' });
    expect(event.after).toEqual({ status: 'APPROVED' });
    // The model rows of the same request carry the same attribution.
    const update = (await rowsFor(requestId)).find((r) => r.model === 'Quotation' && !r.event);
    expect(update).toMatchObject({ actorType: 'public', ip });
    expect(update.after.publicToken).toBeUndefined();
  });

  it('a public rejection is quotation.customer_rejected', async () => {
    const q = await sendQuotation();
    const requestId = rid();
    expectStatus(await anon().post(`/public/quotations/${q.publicToken}/decide`).set('X-Request-Id', requestId).send({ decision: 'reject', note: 'Too dear' }), 200);
    await expectEvents(requestId, 'quotation.customer_rejected');
  });

  it('the quotation:expire task runs as system and records quotation.expired', async () => {
    const q = await sendQuotation();
    await prisma.quotation.update({ where: { id: q.id }, data: { validUntil: new Date(Date.now() - 86_400_000) } });
    await runJob('quotation:expire', {}, 'audit-test');
    const [event] = await prisma.auditLog.findMany({ where: { event: 'quotation.expired', recordId: q.id } });
    expect(event).toMatchObject({ actorType: 'system', actorId: null, requestId: 'quotation:expire:audit-test' });
  });

  it('a public lead is lead.created by the public', async () => {
    const requestId = rid();
    const body = expectStatus(await anon().post('/public/leads').set('X-Request-Id', requestId)
      .send({ name: 'Public Audit', phone: phone(), message: 'Seepage in the kitchen', elapsedMs: 9000 }), 201);
    const { 'lead.created': event } = await expectEvents(requestId, 'lead.created');
    expect(event).toMatchObject({ actorType: 'public', recordId: body.data.id });
  });
});

// ── domain events, one business moment at a time

describe('domain events: accounts', () => {
  it('login, logout, password change and reset request', async () => {
    const user = await throwawayUser();
    const login = rid();
    const res = await anon().post('/auth/login').set('X-Request-Id', login).send({ email: user.email, password: PASSWORD });
    expectStatus(res, 200);
    const { 'auth.login': event } = await expectEvents(login, 'auth.login');
    expect(event).toMatchObject({ actorId: user.id, recordId: user.id, actorType: 'user' });

    const cookie = res.headers['set-cookie'].find((c) => c.startsWith('refresh_token=')).split(';')[0];
    const logout = rid();
    expectStatus(await anon().post('/auth/logout').set('Cookie', cookie).set('X-Request-Id', logout), 200);
    expect((await expectEvents(logout, 'auth.logout'))['auth.logout'].recordId).toBe(user.id);

    const change = rid();
    expectStatus(await withToken(res.body.data.accessToken).post('/auth/change-password').set('X-Request-Id', change)
      .send({ currentPassword: PASSWORD, password: 'Changed123' }), 200);
    await expectEvents(change, 'auth.password_changed');

    const forgot = rid();
    expectStatus(await anon().post('/auth/forgot-password').set('X-Request-Id', forgot).send({ email: user.email }), 200);
    await expectEvents(forgot, 'auth.password_reset_requested');
    // An unknown address leaves nothing that would confirm it exists either way.
    const ghost = rid();
    expectStatus(await anon().post('/auth/forgot-password').set('X-Request-Id', ghost).send({ email: `${uid('ghost')}@example.com` }), 200);
    expect(await rowsFor(ghost)).toHaveLength(0);
  });

  it('five failed logins are auth.login_failed ×5 and auth.locked', async () => {
    const user = await throwawayUser();
    for (let i = 0; i < 5; i += 1) {
      await anon().post('/auth/login').send({ email: user.email, password: `wrong-${i}-Pass` });
    }
    const failed = await prisma.auditLog.findMany({ where: { event: 'auth.login_failed', recordId: user.id } });
    expect(failed).toHaveLength(5);
    expect(failed.every((r) => r.actorType === 'public' && r.actorId === null)).toBe(true);
    expect(JSON.stringify(failed)).not.toContain('wrong-');
    expect(await prisma.auditLog.count({ where: { event: 'auth.locked', recordId: user.id } })).toBe(1);
  });

  it('users: created, role changed, disabled', async () => {
    const created = rid();
    const email = `${uid('evt')}@example.com`;
    const user = expectStatus(await admin.post('/admin/users').set('X-Request-Id', created)
      .send({ name: 'Event User', email, password: PASSWORD, role: 'SALES' }), 201).data;
    expect((await expectEvents(created, 'user.created'))['user.created'].after).toMatchObject({ role: 'SALES' });

    const role = rid();
    expectStatus(await admin.put(`/admin/users/${user.id}`).set('X-Request-Id', role).send({ role: 'DISPATCHER' }), 200);
    const { 'user.role_changed': changed } = await expectEvents(role, 'user.role_changed');
    expect(changed.before).toEqual({ role: 'SALES' });
    expect(changed.after).toEqual({ role: 'DISPATCHER' });

    const disabled = rid();
    expectStatus(await admin.patch(`/admin/users/${user.id}/toggle`).set('X-Request-Id', disabled), 200);
    await expectEvents(disabled, 'user.disabled');
  });
});

describe('domain events: leads', () => {
  let salesUserId;
  beforeAll(async () => { salesUserId = expectStatus(await sales.get('/auth/me'), 200).data.id; });

  it('created, status_changed, assigned, converted, export', async () => {
    const created = rid();
    const lead = expectStatus(await sales.post('/admin/leads').set('X-Request-Id', created).send({ name: 'Event Lead', phone: phone() }), 201).data;
    expect((await expectEvents(created, 'lead.created'))['lead.created'].actorType).toBe('user');

    const status = rid();
    expectStatus(await sales.patch(`/admin/leads/${lead.id}/status`).set('X-Request-Id', status).send({ status: 'CONTACTED' }), 200);
    const { 'lead.status_changed': moved } = await expectEvents(status, 'lead.status_changed');
    expect(moved.before).toEqual({ status: 'NEW' });
    expect(moved.after).toEqual({ status: 'CONTACTED' });

    const assigned = rid();
    expectStatus(await sales.patch(`/admin/leads/${lead.id}/assign`).set('X-Request-Id', assigned).send({ assignedToId: salesUserId }), 200);
    expect((await expectEvents(assigned, 'lead.assigned'))['lead.assigned'].after).toEqual({ assignedToId: salesUserId });

    const converted = rid();
    expectStatus(await sales.post(`/admin/leads/${lead.id}/convert`).set('X-Request-Id', converted).send({ createQuotation: true }), 201);
    const events = await expectEvents(converted, 'lead.converted', 'quotation.created', 'lead.status_changed');
    expect(events['lead.converted'].recordId).toBe(lead.id);

    const exported = rid();
    expectStatus(await sales.get('/admin/leads/export.csv?status=NEW').set('X-Request-Id', exported), 200);
    expect((await expectEvents(exported, 'export.csv'))['export.csv'].changes).toMatchObject({ status: 'NEW' });
  });
});

describe('domain events: quotations', () => {
  it('created, sent, revised', async () => {
    const customer = await createCustomer(sales);
    const created = rid();
    const q = expectStatus(await sales.post('/admin/quotations').set('X-Request-Id', created).send({
      customerId: customer.id, items: [{ description: 'Event line', qty: 2, rate: 500 }],
    }), 201).data;
    await expectEvents(created, 'quotation.created');

    const sent = rid();
    expectStatus(await sales.post(`/admin/quotations/${q.id}/send`).set('X-Request-Id', sent), 200);
    expect((await expectEvents(sent, 'quotation.sent'))['quotation.sent'].after).toEqual({ status: 'SENT' });

    const revised = rid();
    const copy = expectStatus(await sales.post(`/admin/quotations/${q.id}/revise`).set('X-Request-Id', revised), 201).data;
    const { 'quotation.revised': event } = await expectEvents(revised, 'quotation.revised');
    expect(event.recordId).toBe(copy.id);
    expect(event.changes).toMatchObject({ parentId: q.id, version: 2 });
  });
});

describe('domain events: jobs', () => {
  it('created, status_changed, assigned, completed, verified', async () => {
    const customer = await createCustomer(sales);
    const [tech1, tech2] = await Promise.all([technicianIdFor('TECHNICIAN'), technicianIdFor('TECHNICIAN2')]);

    const created = rid();
    const job = expectStatus(await dispatcher.post('/admin/jobs').set('X-Request-Id', created).send({
      type: 'REPAIR', customerId: customer.id, title: `Event job ${uid()}`, technicianIds: [tech1], isBillable: true,
    }), 201).data;
    await expectEvents(created, 'job.created');

    const started = rid();
    expectStatus(await dispatcher.patch(`/admin/jobs/${job.id}/status`).set('X-Request-Id', started).send({ status: 'IN_PROGRESS' }), 200);
    const { 'job.status_changed': moved } = await expectEvents(started, 'job.status_changed');
    expect(moved.before).toEqual({ status: 'ASSIGNED' });
    expect(moved.after).toEqual({ status: 'IN_PROGRESS' });

    const assigned = rid();
    expectStatus(await dispatcher.post(`/admin/jobs/${job.id}/assign`).set('X-Request-Id', assigned).send({ technicianIds: [tech2] }), 200);
    expect((await expectEvents(assigned, 'job.assigned'))['job.assigned'].after).toMatchObject({ technicianIds: [tech2] });

    const completed = rid();
    expectStatus(await dispatcher.post(`/admin/jobs/${job.id}/complete`).set('X-Request-Id', completed).send({ note: 'Done' }), 200);
    await expectEvents(completed, 'job.completed');

    const verified = rid();
    expectStatus(await dispatcher.post(`/admin/jobs/${job.id}/verify`).set('X-Request-Id', verified), 200);
    await expectEvents(verified, 'job.verified');
  });
});

describe('domain events: money', () => {
  it('invoice created, sent, payment recorded and voided, invoice voided', async () => {
    const customer = await createCustomer(sales);
    const created = rid();
    const invoice = expectStatus(await accountant.post('/admin/invoices').set('X-Request-Id', created).send({
      customerId: customer.id, items: [{ description: 'Event labour', unit: 'hour', qty: 2, rate: 500 }],
    }), 201).data;
    await expectEvents(created, 'invoice.created');

    const sent = rid();
    expectStatus(await accountant.post(`/admin/invoices/${invoice.id}/send`).set('X-Request-Id', sent), 200);
    await expectEvents(sent, 'invoice.sent');

    const paid = rid();
    const payment = expectStatus(await accountant.post(`/admin/invoices/${invoice.id}/payments`).set('X-Request-Id', paid)
      .send({ amount: 300, method: 'CASH' }), 201).data;
    const { 'payment.recorded': recorded } = await expectEvents(paid, 'payment.recorded');
    expect(recorded).toMatchObject({ recordId: payment.id });
    expect(recorded.after).toMatchObject({ amount: 30000, method: 'CASH' });

    const voidedPayment = rid();
    expectStatus(await accountant.post(`/admin/invoices/${invoice.id}/payments/${payment.id}/void`).set('X-Request-Id', voidedPayment)
      .send({ reason: 'Entered twice' }), 200);
    await expectEvents(voidedPayment, 'payment.voided');

    const voided = rid();
    expectStatus(await accountant.post(`/admin/invoices/${invoice.id}/void`).set('X-Request-Id', voided).send({ reason: 'Raised in error' }), 200);
    expect((await expectEvents(voided, 'invoice.voided'))['invoice.voided'].after).toMatchObject({ status: 'VOID' });
  });
});

describe('domain events: surveys', () => {
  async function surveyForSubmit() {
    const surveyor = await as('SURVEYOR');
    const customer = await createCustomer(sales);
    const job = expectStatus(await dispatcher.post('/admin/jobs').send({
      type: 'INSPECTION', customerId: customer.id, title: `Event survey ${uid()}`,
      technicianIds: [await technicianIdFor('SURVEYOR')], isBillable: false,
    }), 201).data;
    const survey = expectStatus(await surveyor.post(`/tech/jobs/${job.id}/survey`).send({}), 201).data;
    const treatment = await prisma.rateCardItem.findUnique({ where: { code: 'SEEP-CHEM' } });
    const submit = (requestId) => surveyor.post(`/tech/surveys/${survey.id}/submit`).set('X-Request-Id', requestId).send({
      diagnosis: 'Rising damp',
      items: [{ kind: 'SERVICE', rateCardItemId: treatment.id, description: 'Crystalline treatment', unit: 'sq.ft', qty: 50 }],
    });
    return { survey, submit };
  }

  it('submitted, returned, quoted', async () => {
    const first = await surveyForSubmit();
    const submitted = rid();
    expectStatus(await first.submit(submitted), 200);
    await expectEvents(submitted, 'survey.submitted', 'job.completed');

    const returned = rid();
    expectStatus(await sales.patch(`/admin/surveys/${first.survey.id}/review`).set('X-Request-Id', returned)
      .send({ status: 'RETURNED', note: 'Measure the east wall too' }), 200);
    await expectEvents(returned, 'survey.returned');

    const second = await surveyForSubmit();
    expectStatus(await second.submit(rid()), 200);
    const quoted = rid();
    const body = expectStatus(await sales.post(`/admin/surveys/${second.survey.id}/quotation`).set('X-Request-Id', quoted).send({}), 201).data;
    const { 'survey.quoted': event } = await expectEvents(quoted, 'survey.quoted', 'quotation.created');
    expect(event.changes).toMatchObject({ quotationId: body.quotation.id });
  });
});

describe('domain events: CMS', () => {
  it('deleted, restored, purged', async () => {
    const editor = await as('EDITOR');
    const faq = expectStatus(await editor.post('/admin/faqs').send({ question: `Audit ${uid()}?`, answer: 'An audited answer.' }), 201).data;

    const deleted = rid();
    expectStatus(await editor.delete(`/admin/faqs/${faq.id}`).set('X-Request-Id', deleted), 204);
    expect((await expectEvents(deleted, 'cms.deleted'))['cms.deleted']).toMatchObject({ model: 'Faq', recordId: faq.id });

    const restored = rid();
    expectStatus(await editor.patch(`/admin/faqs/${faq.id}/restore`).set('X-Request-Id', restored), 200);
    await expectEvents(restored, 'cms.restored');

    const purged = rid();
    expectStatus(await admin.delete(`/admin/faqs/${faq.id}?hard=true`).set('X-Request-Id', purged), 204);
    const { 'cms.purged': event } = await expectEvents(purged, 'cms.purged');
    expect(event.before).toMatchObject({ question: faq.question });
  });
});

describe('AUDIT_EVENTS', () => {
  it('lists every implemented event and reserves the Phase F names', () => {
    const names = Object.values(AUDIT_EVENTS);
    expect(new Set(names).size).toBe(names.length);
    expect(names).toEqual(expect.arrayContaining(['lead.created', 'settings.changed', 'auth.locked', 'quotation.superseded', 'quotation.auto_approved']));
  });
});

// ── the read API

describe('GET /admin/audit-logs', () => {
  let requestId;

  beforeAll(async () => {
    requestId = rid();
    expectStatus(await admin.patch('/admin/settings').set('X-Request-Id', requestId).send({ values: { 'branding.tagline': `Filter ${uid()}` } }), 200);
  });

  it('filters by event, requestId, model and actorType, with the actor', async () => {
    const byEvent = expectStatus(await admin.get(`/admin/audit-logs?event=settings.changed&requestId=${requestId}`), 200);
    expect(byEvent.data).toHaveLength(1);
    expect(byEvent.data[0].actor).toEqual({ id: expect.any(String), name: expect.any(String), role: 'ADMIN' });
    expect(byEvent.meta).toMatchObject({ page: 1, total: 1 });

    const byModel = expectStatus(await admin.get(`/admin/audit-logs?model=Setting&requestId=${requestId}`), 200);
    expect(byModel.data.every((r) => r.model === 'Setting')).toBe(true);

    const system = expectStatus(await admin.get('/admin/audit-logs?actorType=system&limit=5'), 200);
    expect(system.data.every((r) => r.actorType === 'system')).toBe(true);

    const actorId = byEvent.data[0].actor.id;
    const mine = expectStatus(await admin.get(`/admin/audit-logs?actorId=${actorId}&from=2020-01-01&limit=3`), 200);
    expect(mine.data.every((r) => r.actorId === actorId)).toBe(true);

    const searched = expectStatus(await admin.get('/admin/audit-logs?q=settings.changed&limit=3'), 200);
    expect(searched.data.length).toBeGreaterThan(0);
  });

  it('rejects an unknown actorType or sort field, and stays ADMIN only', async () => {
    expectStatus(await admin.get('/admin/audit-logs?actorType=robot'), 400);
    expectStatus(await admin.get('/admin/audit-logs?sort=passwordHash'), 400);
    expectStatus(await sales.get('/admin/audit-logs'), 403);
  });
});
