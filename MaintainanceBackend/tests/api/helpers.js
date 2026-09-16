import request from 'supertest';
import sharp from 'sharp';
import { createApp } from '../../src/app.js';
import { prisma } from '../../src/lib/prisma.js';

export { prisma };

export const PASSWORD = 'Password123';

/** The seeded accounts, by the role each one exercises. */
export const USERS = {
  ADMIN: 'admin@gharjatan.com.np',
  EDITOR: 'editor@gharjatan.com.np',
  SALES: 'sales@gharjatan.com.np',
  MANAGER: 'manager@gharjatan.com.np',
  DISPATCHER: 'dispatch@gharjatan.com.np',
  ACCOUNTANT: 'accounts@gharjatan.com.np',
  TECHNICIAN: 'hari@gharjatan.com.np',
  TECHNICIAN2: 'suresh@gharjatan.com.np',
  SURVEYOR: 'survey@gharjatan.com.np',
};

let app;
export const getApp = () => (app ??= createApp());

let ipCounter = 0;
/**
 * A fresh client address per request. Every IP-keyed limiter (300/min global,
 * the lead limiter, the login limiter) would otherwise see one client making a
 * few hundred calls and start answering 429 halfway through the suite. The app
 * trusts one proxy hop, so X-Forwarded-For is what it keys on.
 */
export const nextIp = () => {
  ipCounter += 1;
  return `10.${(ipCounter >> 16) & 255}.${(ipCounter >> 8) & 255}.${ipCounter & 255}`;
};

function client(token, ip) {
  const agent = request(getApp());
  const wrap = (method) => (path) => {
    const req = agent[method](`/api/v1${path}`).set('X-Forwarded-For', ip ?? nextIp());
    return token ? req.set('Authorization', `Bearer ${token}`) : req;
  };
  return {
    get: wrap('get'), post: wrap('post'), put: wrap('put'), patch: wrap('patch'), delete: wrap('delete'), token,
  };
}

/** Anonymous client. Pass `ip` to pin the address, e.g. to test a rate limit. */
export const anon = (ip) => client(null, ip);

const tokens = new Map();

/** Logs a seeded role in once per process and caches the access token. */
export async function tokenFor(role) {
  if (tokens.has(role)) return tokens.get(role);
  const res = await anon().post('/auth/login').send({ email: USERS[role], password: PASSWORD });
  if (res.status !== 200) throw new Error(`login as ${role} failed: ${res.status} ${JSON.stringify(res.body)}`);
  tokens.set(role, res.body.data.accessToken);
  return res.body.data.accessToken;
}

/** Client authenticated as a seeded role. */
export async function as(role) {
  return client(await tokenFor(role));
}

/** Client for an arbitrary access token (a user a test created itself). */
export const withToken = (token) => client(token);

/**
 * Asserts a status and returns the body. On a mismatch it throws with the
 * method, path and response body — the first thing anyone triaging a red
 * test needs, and the one thing a bare `expect(status).toBe(200)` hides.
 */
export function expectStatus(res, status) {
  if (res.status !== status) {
    const where = `${res.req?.method ?? '?'} ${res.req?.path ?? '?'}`;
    const body = JSON.stringify(res.body, null, 2)?.slice(0, 2000) ?? res.text?.slice(0, 2000);
    throw new Error(`${where} → ${res.status}, expected ${status}\n${body}`);
  }
  return res.body;
}

/** A real PNG, so upload validation (which checks magic bytes) accepts it. */
export const pngBuffer = (background = '#4a90a4') =>
  sharp({ create: { width: 64, height: 48, channels: 3, background } }).png().toBuffer();

let seq = 0;
/** Short unique suffix for names, codes and slugs. */
export const uid = (prefix = 't') => `${prefix}${Date.now().toString(36)}${(seq++).toString(36)}`;

/** A valid, unique Nepali mobile: 98 + 8 digits. */
export const phone = () => {
  seq += 1;
  return `98${String((Date.now() + seq * 7919) % 100_000_000).padStart(8, '0')}`;
};

export const daysFromNow = (n) => new Date(Date.now() + n * 86_400_000);

/** YYYY-MM-DD of the first day, 2-9 days out, for which `test(weekday)` holds. */
export function dayMatching(test) {
  for (let n = 2; n <= 9; n += 1) {
    const d = daysFromNow(n);
    if (test(d.getUTCDay())) return d.toISOString().slice(0, 10);
  }
  throw new Error('no matching day');
}

// ── fixtures built through the API, so they exercise it on the way

export async function createCustomer(api) {
  const res = await api.post('/admin/customers').send({
    name: `Test Customer ${uid()}`, phone: phone(), email: `${uid('c')}@example.com`,
  });
  return expectStatus(res, 201).data;
}

export async function technicianIdFor(role) {
  const tech = await prisma.technician.findFirst({ where: { user: { email: USERS[role] }, deletedAt: null } });
  if (!tech) throw new Error(`no technician profile for ${role}`);
  return tech.id;
}

/** A job assigned to a field user, optionally from a template. */
export async function createAssignedJob({ assignee = 'TECHNICIAN', type = 'REPAIR', templateId, scheduledStart } = {}) {
  const dispatcher = await as('DISPATCHER');
  const sales = await as('SALES');
  const customer = await createCustomer(sales);
  const technicianId = await technicianIdFor(assignee);
  const res = await dispatcher.post('/admin/jobs').send({
    type,
    customerId: customer.id,
    title: `Test ${type.toLowerCase()} job ${uid()}`,
    technicianIds: [technicianId],
    ...(templateId ? { templateId } : {}),
    ...(scheduledStart ? { scheduledStart } : {}),
    isBillable: type !== 'INSPECTION',
  });
  return { job: expectStatus(res, 201).data, customer, technicianId };
}

/** A job taken all the way to COMPLETED, which is what creates its warranty. */
export async function createCompletedJob({ withMaterial = false } = {}) {
  const dispatcher = await as('DISPATCHER');
  const { job, customer } = await createAssignedJob();
  expectStatus(await dispatcher.patch(`/admin/jobs/${job.id}/status`).send({ status: 'IN_PROGRESS' }), 200);
  if (withMaterial) {
    const material = await prisma.material.findFirst({ where: { deletedAt: null, isActive: true } });
    expectStatus(await dispatcher.post(`/admin/jobs/${job.id}/materials`).send({ materialId: material.id, qty: 2 }), 201);
  }
  const done = await dispatcher.post(`/admin/jobs/${job.id}/complete`).send({ note: 'Done in test', customerRating: 5 });
  return { job: expectStatus(done, 200).data, customer };
}

/**
 * Takes a DRAFT quotation through internal approval and sends it: SALES submits, MANAGER
 * approves (unless it auto-approved), SALES sends. Submit needs a future validUntil, so a
 * missing or lapsed one is moved forward for the send and a lapsed one put back afterwards
 * — which is how a test gets a SENT quotation that has since expired.
 * @returns the sent quotation row, publicToken included
 */
export async function approveAndSend(id, { requestId } = {}) {
  const [sales, manager] = await Promise.all([as('SALES'), as('MANAGER')]);
  const q = await prisma.quotation.findUnique({ where: { id } });
  const lapsed = q.validUntil && q.validUntil < new Date() ? q.validUntil : null;
  if (!q.validUntil || lapsed) await prisma.quotation.update({ where: { id }, data: { validUntil: daysFromNow(15) } });
  const submitted = expectStatus(await sales.post(`/admin/quotations/${id}/submit`), 200).data;
  if (submitted.status === 'PENDING_APPROVAL') expectStatus(await manager.post(`/admin/quotations/${id}/approve`).send({}), 200);
  const send = sales.post(`/admin/quotations/${id}/send`);
  expectStatus(await (requestId ? send.set('X-Request-Id', requestId) : send), 200);
  if (lapsed) await prisma.quotation.update({ where: { id }, data: { validUntil: lapsed } });
  return prisma.quotation.findUnique({ where: { id } });
}

export async function uploadImage(api, color) {
  const res = await api.post('/admin/media').attach('files', await pngBuffer(color), 'test.png');
  return expectStatus(res, 201).data[0];
}
