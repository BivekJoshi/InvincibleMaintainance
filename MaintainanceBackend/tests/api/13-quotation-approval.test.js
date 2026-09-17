import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import {
  anon, as, expectStatus, prisma, USERS, uid, phone, daysFromNow, approveAndSend,
} from './helpers.js';

/**
 * Phase F1: internal approval, the customer's three answers and the job hand-off.
 * Every quotation here is created by the seeded SALES user, who is also the lead's
 * salesperson — so the "salesperson and creator" notifications must arrive once.
 */

const rid = () => `t-${uid()}`;
const eventsFor = async (requestId) =>
  (await prisma.auditLog.findMany({ where: { requestId, event: { not: null } }, orderBy: { createdAt: 'asc' } }));
const eventNames = async (requestId) => (await eventsFor(requestId)).map((r) => r.event);

let admin;
let sales;
let manager;
let dispatcher;
let ids; // user ids by role

const setSettings = (values) => admin.patch('/admin/settings').send({ values });

beforeAll(async () => {
  [admin, sales, manager, dispatcher] = await Promise.all([as('ADMIN'), as('SALES'), as('MANAGER'), as('DISPATCHER')]);
  const users = await prisma.user.findMany({ where: { email: { in: Object.values(USERS) } } });
  ids = Object.fromEntries(Object.entries(USERS).map(([role, email]) => [role, users.find((u) => u.email === email)?.id]));
  expectStatus(await setSettings({ 'quotation.autoApproveBelow': 0, 'quotation.makerChecker': true }), 200);
});

afterAll(async () => {
  await setSettings({ 'quotation.autoApproveBelow': 0, 'quotation.makerChecker': true });
});

/** A customer, a lead assigned to SALES and a DRAFT quotation for them, all created by SALES. */
async function draft({
  locale = 'en', email = true, rate = 1000, qty = 2, validUntil = daysFromNow(15), client = sales, leadStatus, serviceId,
} = {}) {
  const customer = expectStatus(await sales.post('/admin/customers').send({
    name: locale === 'ne' ? `राम बहादुर ${uid()}` : `Approval Customer ${uid()}`,
    phone: phone(),
    ...(email ? { email: `${uid('q')}@example.com` } : {}),
    preferredLocale: locale,
  }), 201).data;
  const lead = expectStatus(await sales.post('/admin/leads').send({
    name: customer.name, phone: customer.phone, assignedToId: ids.SALES, ...(serviceId ? { serviceId } : {}),
  }), 201).data;
  await prisma.lead.update({ where: { id: lead.id }, data: { customerId: customer.id } });
  for (const status of leadStatus ?? []) {
    expectStatus(await sales.patch(`/admin/leads/${lead.id}/status`).send({
      status, ...(status === 'LOST' ? { lostReason: 'Chose someone else' } : {}),
    }), 200);
  }
  const quotation = expectStatus(await client.post('/admin/quotations').send({
    customerId: customer.id,
    leadId: lead.id,
    ...(validUntil ? { validUntil: validUntil.toISOString() } : {}),
    items: [{ description: 'Crack filling', unit: 'rft', qty, rate }],
  }), 201).data;
  return { customer, lead, quotation };
}

const decide = (token, body, requestId) => {
  // A phone browser always sends a user agent; supertest does not.
  const req = anon().post(`/public/quotations/${token}/decide`).set('User-Agent', 'Mozilla/5.0 (Linux; Android 14) Mobile');
  return (requestId ? req.set('X-Request-Id', requestId) : req).send(body);
};
const approversExcept = async (userId) => (await prisma.user.findMany({
  where: { role: { in: ['MANAGER', 'ADMIN'] }, isActive: true, deletedAt: null, id: { not: userId } },
  select: { id: true },
})).map((u) => u.id).sort();

// ── internal approval

describe('submit', () => {
  it('moves a draft to PENDING_APPROVAL, records the submitter and tells every approver once', async () => {
    const { quotation } = await draft();
    const requestId = rid();
    const body = expectStatus(await sales.post(`/admin/quotations/${quotation.id}/submit`).set('X-Request-Id', requestId), 200);
    expect(body.data).toMatchObject({ status: 'PENDING_APPROVAL', submittedById: ids.SALES, autoApproved: false });
    expect(body.data.submittedAt).toBeTruthy();
    expect(await eventNames(requestId)).toEqual(['quotation.submitted']);

    const notes = await prisma.notification.findMany({ where: { type: 'quotation_submitted', link: `/admin/quotations/${quotation.id}` } });
    expect(notes.map((n) => n.userId).sort()).toEqual(await approversExcept(ids.SALES));
    const managerMail = await prisma.messageLog.findFirst({
      where: { relatedId: quotation.id, channel: 'email', toAddress: USERS.MANAGER, templateKey: 'quotation_submitted' },
    });
    expect(managerMail.body).toContain(`/admin/quotations/${quotation.id}`);
  });

  it('a quotation created without a date is valid for quotation.validDays, to the end of that Kathmandu day', async () => {
    const { quotation } = await draft({ validUntil: null });
    const until = new Date(quotation.validUntil);
    const days = (until - Date.now()) / 86_400_000;
    expect(days).toBeGreaterThan(14);
    expect(days).toBeLessThan(16.1);
    // 23:59:59.999 in Kathmandu is 18:14:59.999 UTC.
    expect(until.toISOString().slice(11)).toBe('18:14:59.999Z');
  });

  it('needs a valid-until date in the future', async () => {
    const none = await draft();
    await prisma.quotation.update({ where: { id: none.quotation.id }, data: { validUntil: null } });
    const noDate = expectStatus(await sales.post(`/admin/quotations/${none.quotation.id}/submit`), 422);
    expect(noDate.error.message).toMatch(/valid/i);

    const past = await draft({ validUntil: daysFromNow(-1) });
    expectStatus(await sales.post(`/admin/quotations/${past.quotation.id}/submit`), 422);
    expect((await prisma.quotation.findUnique({ where: { id: past.quotation.id } })).status).toBe('DRAFT');
  });

  it('needs at least one line', async () => {
    const { quotation } = await draft();
    await prisma.quotationItem.deleteMany({ where: { quotationId: quotation.id } });
    expect(expectStatus(await sales.post(`/admin/quotations/${quotation.id}/submit`), 422).error.message).toMatch(/line/i);
  });

  it('only submits a draft', async () => {
    const { quotation } = await draft();
    expectStatus(await sales.post(`/admin/quotations/${quotation.id}/submit`), 200);
    expect(expectStatus(await sales.post(`/admin/quotations/${quotation.id}/submit`), 422).error.code).toBe('INVALID_TRANSITION');
  });

  it('is refused to roles without quotations:write', async () => {
    const { quotation } = await draft();
    expectStatus(await dispatcher.post(`/admin/quotations/${quotation.id}/submit`), 403);
    expectStatus(await sales.post('/admin/quotations/nope/submit'), 404);
  });

  it('a submitted quotation can no longer be edited', async () => {
    const { quotation } = await draft();
    expectStatus(await sales.post(`/admin/quotations/${quotation.id}/submit`), 200);
    expectStatus(await sales.put(`/admin/quotations/${quotation.id}`).send({ terms: 'Changed while waiting' }), 422);
  });
});

describe('approve, send back, pull back', () => {
  it('a manager approves: OFFICE_APPROVED, the approver recorded, the creator told', async () => {
    const { quotation } = await draft();
    expectStatus(await sales.post(`/admin/quotations/${quotation.id}/submit`), 200);
    const requestId = rid();
    const body = expectStatus(await manager.post(`/admin/quotations/${quotation.id}/approve`)
      .set('X-Request-Id', requestId).send({ note: 'Rates checked' }), 200);
    expect(body.data).toMatchObject({ status: 'OFFICE_APPROVED', approvedById: ids.MANAGER, approvalNote: 'Rates checked', autoApproved: false });
    expect(body.data.approvedAt).toBeTruthy();
    expect(await eventNames(requestId)).toEqual(['quotation.office_approved']);
    const [event] = await eventsFor(requestId);
    expect(event).toMatchObject({ actorId: ids.MANAGER, actorType: 'user' });

    const notes = await prisma.notification.findMany({ where: { type: 'quotation_office_approved', link: `/admin/quotations/${quotation.id}` } });
    expect(notes.map((n) => n.userId)).toEqual([ids.SALES]);
  });

  it('SALES cannot approve, and nothing approves a quotation that is not waiting', async () => {
    const { quotation } = await draft();
    expectStatus(await manager.post(`/admin/quotations/${quotation.id}/approve`).send({}), 422);
    expectStatus(await sales.post(`/admin/quotations/${quotation.id}/submit`), 200);
    expectStatus(await sales.post(`/admin/quotations/${quotation.id}/approve`).send({}), 403);
    expectStatus(await (await as('ACCOUNTANT')).post(`/admin/quotations/${quotation.id}/approve`).send({}), 403);
  });

  it('nobody approves their own quotation while maker-checker is on — 403 SELF_APPROVAL', async () => {
    const { quotation } = await draft({ client: manager });
    expectStatus(await manager.post(`/admin/quotations/${quotation.id}/submit`), 200);
    const res = expectStatus(await manager.post(`/admin/quotations/${quotation.id}/approve`).send({}), 403);
    expect(res.error.code).toBe('SELF_APPROVAL');
    expect((await prisma.quotation.findUnique({ where: { id: quotation.id } })).status).toBe('PENDING_APPROVAL');
    // ADMIN is a different person, so ADMIN may.
    expectStatus(await admin.post(`/admin/quotations/${quotation.id}/approve`).send({}), 200);
  });

  it('with maker-checker off the creator may approve their own', async () => {
    expectStatus(await setSettings({ 'quotation.makerChecker': false }), 200);
    try {
      const { quotation } = await draft({ client: manager });
      expectStatus(await manager.post(`/admin/quotations/${quotation.id}/submit`), 200);
      expect(expectStatus(await manager.post(`/admin/quotations/${quotation.id}/approve`).send({}), 200).data.status).toBe('OFFICE_APPROVED');
    } finally {
      expectStatus(await setSettings({ 'quotation.makerChecker': true }), 200);
    }
  });

  it('send back needs a note, returns it to DRAFT with the reason and tells the creator', async () => {
    const { quotation } = await draft();
    expectStatus(await sales.post(`/admin/quotations/${quotation.id}/submit`), 200);
    expectStatus(await manager.post(`/admin/quotations/${quotation.id}/send-back`).send({}), 400);
    expectStatus(await sales.post(`/admin/quotations/${quotation.id}/send-back`).send({ note: 'Recheck the rate' }), 403);

    const requestId = rid();
    const body = expectStatus(await manager.post(`/admin/quotations/${quotation.id}/send-back`)
      .set('X-Request-Id', requestId).send({ note: 'Recheck the rate' }), 200);
    expect(body.data).toMatchObject({ status: 'DRAFT', sentBackReason: 'Recheck the rate' });
    expect(await eventNames(requestId)).toEqual(['quotation.sent_back']);
    const notes = await prisma.notification.findMany({ where: { type: 'quotation_sent_back', link: `/admin/quotations/${quotation.id}` } });
    expect(notes.map((n) => n.userId)).toEqual([ids.SALES]);

    // Editable again, and a resubmission needs approval again.
    expectStatus(await sales.put(`/admin/quotations/${quotation.id}`).send({ items: [{ description: 'Rechecked', qty: 1, rate: 900 }] }), 200);
    const again = expectStatus(await sales.post(`/admin/quotations/${quotation.id}/submit`), 200).data;
    expect(again).toMatchObject({ status: 'PENDING_APPROVAL', approvedById: null });
  });

  it('pull back takes an approved, unsent quotation back to DRAFT and voids the approval', async () => {
    const { quotation } = await draft();
    expectStatus(await sales.post(`/admin/quotations/${quotation.id}/submit`), 200);
    expectStatus(await manager.post(`/admin/quotations/${quotation.id}/approve`).send({}), 200);
    expectStatus(await sales.post(`/admin/quotations/${quotation.id}/pull-back`).send({ note: '' }), 400);

    const requestId = rid();
    const body = expectStatus(await sales.post(`/admin/quotations/${quotation.id}/pull-back`)
      .set('X-Request-Id', requestId).send({ note: 'Customer called with a new size' }), 200);
    expect(body.data).toMatchObject({ status: 'DRAFT', approvedById: null, approvedAt: null, sentBackReason: 'Customer called with a new size' });
    expect(await eventNames(requestId)).toEqual(['quotation.pulled_back']);
    expectStatus(await sales.post(`/admin/quotations/${quotation.id}/send`), 422);
  });

  it('pull back is only for OFFICE_APPROVED', async () => {
    const { quotation } = await draft();
    expectStatus(await sales.post(`/admin/quotations/${quotation.id}/pull-back`).send({ note: 'Not yet' }), 422);
  });
});

describe('send', () => {
  it('is refused before approval — draft or waiting', async () => {
    const { quotation } = await draft();
    expect(expectStatus(await sales.post(`/admin/quotations/${quotation.id}/send`), 422).error.code).toBe('INVALID_TRANSITION');
    expectStatus(await sales.post(`/admin/quotations/${quotation.id}/submit`), 200);
    expectStatus(await sales.post(`/admin/quotations/${quotation.id}/send`), 422);
    const row = await prisma.quotation.findUnique({ where: { id: quotation.id } });
    expect(row).toMatchObject({ status: 'PENDING_APPROVAL', publicToken: null, sentAt: null });
    expect(await prisma.messageLog.count({ where: { relatedId: quotation.id, templateKey: 'quotation_sent' } })).toBe(0);
  });

  it('sends an approved quotation and records quotation.sent', async () => {
    const { quotation } = await draft();
    const requestId = rid();
    const sent = await approveAndSend(quotation.id, { requestId });
    expect(sent.status).toBe('SENT');
    expect(await eventNames(requestId)).toEqual(['quotation.sent']);
  });

  it('refuses an approved quotation whose valid-until date has passed meanwhile', async () => {
    const { quotation } = await draft();
    expectStatus(await sales.post(`/admin/quotations/${quotation.id}/submit`), 200);
    expectStatus(await manager.post(`/admin/quotations/${quotation.id}/approve`).send({}), 200);
    await prisma.quotation.update({ where: { id: quotation.id }, data: { validUntil: daysFromNow(-1) } });
    expect(expectStatus(await sales.post(`/admin/quotations/${quotation.id}/send`), 422).error.message).toMatch(/valid/i);
  });
});

describe('auto-approval', () => {
  afterEach(async () => { await setSettings({ 'quotation.autoApproveBelow': 0 }); });

  it('threshold 0 never auto-approves, however small the total', async () => {
    const { quotation } = await draft({ rate: 1, qty: 1 });
    expect(expectStatus(await sales.post(`/admin/quotations/${quotation.id}/submit`), 200).data.status).toBe('PENDING_APPROVAL');
  });

  it('a total below the threshold goes straight to OFFICE_APPROVED, approved by the system, and no approver is paged', async () => {
    const { quotation } = await draft();
    expectStatus(await setSettings({ 'quotation.autoApproveBelow': quotation.total + 1 }), 200);
    const requestId = rid();
    const body = expectStatus(await sales.post(`/admin/quotations/${quotation.id}/submit`).set('X-Request-Id', requestId), 200);
    expect(body.data).toMatchObject({ status: 'OFFICE_APPROVED', autoApproved: true, approvedById: null });
    const events = await eventsFor(requestId);
    expect(events.map((e) => e.event)).toEqual(['quotation.submitted', 'quotation.auto_approved']);
    expect(events[0]).toMatchObject({ actorType: 'user', actorId: ids.SALES });
    expect(events[1]).toMatchObject({ actorType: 'system', actorId: null });
    expect(await prisma.notification.count({ where: { type: 'quotation_submitted', link: `/admin/quotations/${quotation.id}` } })).toBe(0);
    expectStatus(await sales.post(`/admin/quotations/${quotation.id}/send`), 200);
  });

  it('a total equal to the threshold is not below it', async () => {
    const { quotation } = await draft();
    expectStatus(await setSettings({ 'quotation.autoApproveBelow': quotation.total }), 200);
    expect(expectStatus(await sales.post(`/admin/quotations/${quotation.id}/submit`), 200).data.status).toBe('PENDING_APPROVAL');
  });

  it('applies to a revision too', async () => {
    const { quotation } = await draft();
    const { publicToken } = await approveAndSend(quotation.id);
    expectStatus(await decide(publicToken, { decision: 'request_changes', note: 'Please drop the second coat' }), 200);
    const v2 = expectStatus(await sales.post(`/admin/quotations/${quotation.id}/revise`), 201).data;
    expectStatus(await setSettings({ 'quotation.autoApproveBelow': v2.total + 1 }), 200);
    const body = expectStatus(await sales.post(`/admin/quotations/${v2.id}/submit`), 200);
    expect(body.data).toMatchObject({ status: 'OFFICE_APPROVED', autoApproved: true, version: 2 });
  });
});

// ── the customer's side

describe('the customer link', () => {
  it('shows version, status and the actions available, and nothing internal', async () => {
    const { quotation } = await draft();
    await prisma.quotation.update({ where: { id: quotation.id }, data: { internalNote: 'Margin is thin here' } });
    const { publicToken } = await approveAndSend(quotation.id);
    const { data } = expectStatus(await anon().get(`/public/quotations/${publicToken}`), 200);
    expect(data).toMatchObject({
      number: quotation.number, version: 1, status: 'SENT', replaced: null, requestedChanges: null,
      actions: ['approve', 'request_changes', 'reject'],
    });
    expect(data.items).toHaveLength(1);
    for (const hidden of ['internalNote', 'decidedIp', 'decidedUserAgent', 'createdById', 'approvedById', 'approvalNote', 'sentBackReason', 'publicToken']) {
      expect(data, hidden).not.toHaveProperty(hidden);
    }
  });

  it('decide is validated: unknown decision 400, a change request needs 5–1000 characters', async () => {
    const { quotation } = await draft();
    const { publicToken } = await approveAndSend(quotation.id);
    expectStatus(await decide(publicToken, { decision: 'maybe' }), 400);
    expectStatus(await decide(publicToken, { decision: 'request_changes' }), 400);
    expectStatus(await decide(publicToken, { decision: 'request_changes', note: 'abc' }), 400);
    expectStatus(await decide(publicToken, { decision: 'request_changes', note: 'x'.repeat(1001) }), 400);
    expect((await prisma.quotation.findUnique({ where: { id: quotation.id } })).status).toBe('SENT');
  });

  it('is rate limited', async () => {
    const ip = '10.250.13.1';
    const statuses = [];
    for (let i = 0; i < 25; i += 1) {
      statuses.push((await anon(ip).post(`/public/quotations/${'r'.repeat(43)}/decide`).send({ decision: 'approve' })).status);
    }
    expect(statuses).toContain(404);
    expect(statuses).toContain(429);
  });
});

describe('the full loop: changes requested, revised, re-approved, accepted', () => {
  const ctx = {};

  beforeAll(async () => {
    const service = await prisma.service.findUnique({ where: { slug: 'seepage-and-damp-treatment' } });
    Object.assign(ctx, await draft({ locale: 'ne', serviceId: service.id }), { service });
    ctx.v1 = await approveAndSend(ctx.quotation.id);
  });

  it('1 · the customer asks for changes (in Nepali)', async () => {
    const note = 'कृपया दोस्रो कोट हटाउनुहोस् र मूल्य घटाउनुहोस्।';
    const requestId = rid();
    const body = expectStatus(await decide(ctx.v1.publicToken, { decision: 'request_changes', note }, requestId), 200);
    expect(body.data).toMatchObject({ status: 'CHANGES_REQUESTED', decisionNote: note });
    expect(await eventNames(requestId)).toEqual(['quotation.customer_changes_requested']);
    const [event] = await eventsFor(requestId);
    expect(event).toMatchObject({ actorType: 'public', actorId: null });

    const row = await prisma.quotation.findUnique({ where: { id: ctx.v1.id } });
    expect(row.decidedAt).toBeTruthy();
    expect(row.decidedIp).toBeTruthy();
    expect(row.decidedUserAgent).toBeTruthy();

    // The lead stays where it was, with the message on its timeline.
    const lead = await prisma.lead.findUnique({ where: { id: ctx.lead.id } });
    expect(lead.status).toBe(ctx.lead.status);
    const activity = await prisma.leadActivity.findFirst({ where: { leadId: ctx.lead.id, summary: { startsWith: 'Customer asked for changes' } } });
    expect(activity.summary).toContain(note);

    // Salesperson = creator: one in-app note and one email, with the message.
    const notes = await prisma.notification.findMany({ where: { type: 'quotation_changes_requested', link: `/admin/quotations/${ctx.v1.id}` } });
    expect(notes.map((n) => n.userId)).toEqual([ids.SALES]);
    expect(notes[0].body).toContain(note);
    const staffMail = await prisma.messageLog.findMany({ where: { relatedId: ctx.v1.id, templateKey: 'quotation_changes_requested_staff' } });
    expect(staffMail.map((m) => m.toAddress)).toEqual([USERS.SALES]);
    expect(staffMail[0].body).toContain(note);

    // The customer's acknowledgement, from the Nepali template.
    const ne = await prisma.messageTemplate.findUnique({ where: { key_channel_locale: { key: 'quotation_changes_received', channel: 'sms', locale: 'ne' } } });
    const sms = await prisma.messageLog.findMany({ where: { relatedId: ctx.v1.id, templateKey: 'quotation_changes_received' } });
    expect(sms).toHaveLength(1);
    expect(sms[0]).toMatchObject({ channel: 'sms', toAddress: ctx.customer.phone });
    expect(sms[0].body).toContain(ne.body.slice(0, 10));
    expect(sms[0].body).toContain(ctx.v1.number);
  });

  it('2 · a second answer on the same version is refused kindly', async () => {
    const res = expectStatus(await decide(ctx.v1.publicToken, { decision: 'approve' }), 422);
    expect(res.error.message).toMatch(/already/i);
    const { data } = expectStatus(await anon().get(`/public/quotations/${ctx.v1.publicToken}`), 200);
    expect(data).toMatchObject({ status: 'CHANGES_REQUESTED', actions: [] });
  });

  it('3 · staff revise: v2 DRAFT with the lines and the message, v1 SUPERSEDED', async () => {
    const requestId = rid();
    const v2 = expectStatus(await sales.post(`/admin/quotations/${ctx.v1.id}/revise`).set('X-Request-Id', requestId), 201).data;
    expect(v2).toMatchObject({
      status: 'DRAFT', version: 2, parentId: ctx.v1.id, requestedChanges: ctx.v1.decisionNote ?? expect.any(String),
      customerId: ctx.customer.id, leadId: ctx.lead.id, total: ctx.v1.total, publicToken: null,
    });
    expect(v2.items).toHaveLength(1);
    expect(await eventNames(requestId)).toEqual(['quotation.revised', 'quotation.superseded']);

    const v1 = await prisma.quotation.findUnique({ where: { id: ctx.v1.id } });
    expect(v1).toMatchObject({ status: 'SUPERSEDED', supersededById: v2.id });
    expect(v2.requestedChanges).toBe(v1.decisionNote);

    // A superseded quotation is closed: no second revision, no answer.
    expectStatus(await sales.post(`/admin/quotations/${ctx.v1.id}/revise`), 422);
    const { data } = expectStatus(await anon().get(`/public/quotations/${ctx.v1.publicToken}`), 200);
    expect(data).toMatchObject({ status: 'SUPERSEDED', actions: [], replaced: null });

    // The admin view carries the whole version chain.
    const detail = expectStatus(await sales.get(`/admin/quotations/${v2.id}`), 200).data;
    expect(detail.versions.map((v) => [v.version, v.status])).toEqual([[1, 'SUPERSEDED'], [2, 'DRAFT']]);
    ctx.v2 = v2;
  });

  it('4 · v2 is edited, needs approval again, and is sent; the old link points to it', async () => {
    expectStatus(await sales.put(`/admin/quotations/${ctx.v2.id}`).send({ items: [{ description: 'Crack filling, one coat', unit: 'rft', qty: 2, rate: 800 }] }), 200);
    expectStatus(await sales.post(`/admin/quotations/${ctx.v2.id}/send`), 422);
    ctx.v2 = await approveAndSend(ctx.v2.id);
    expect(ctx.v2.approvedById).toBe(ids.MANAGER);

    const old = expectStatus(await anon().get(`/public/quotations/${ctx.v1.publicToken}`), 200).data;
    expect(old.replaced).toEqual({ token: ctx.v2.publicToken });
    const res = expectStatus(await decide(ctx.v1.publicToken, { decision: 'approve' }), 422);
    expect(res.error.message).toMatch(/newer|replaced/i);
    expect(await prisma.job.count({ where: { quotationId: ctx.v1.id } })).toBe(0);

    const current = expectStatus(await anon().get(`/public/quotations/${ctx.v2.publicToken}`), 200).data;
    expect(current).toMatchObject({ version: 2, status: 'SENT', requestedChanges: ctx.v2.requestedChanges, replaced: null });
    expect(current.requestedChanges).toMatch(/दोस्रो कोट/);
  });

  it('5 · the customer accepts: one transaction converts, wins the lead and creates one job', async () => {
    const requestId = rid();
    ctx.acceptedAt = new Date();
    const body = expectStatus(await decide(ctx.v2.publicToken, { decision: 'approve' }, requestId), 200);
    expect(body.data.status).toBe('CONVERTED');

    const events = await eventNames(requestId);
    expect(events).toEqual(expect.arrayContaining(['quotation.customer_approved', 'lead.status_changed', 'job.created']));

    const jobs = await prisma.job.findMany({ where: { quotationId: ctx.v2.id }, include: { tasks: true } });
    expect(jobs).toHaveLength(1);
    const [job] = jobs;
    expect(job).toMatchObject({
      status: 'DRAFT', type: 'REPAIR', scheduledStart: null, customerId: ctx.customer.id, leadId: ctx.lead.id,
      siteId: ctx.v2.siteId, createdById: null,
    });
    expect(job.title).toContain(ctx.service.name);
    expect(job.title).toContain(ctx.v2.number);
    const template = await prisma.jobTemplate.findFirst({ where: { serviceId: ctx.service.id, deletedAt: null, isActive: true } });
    expect(job.tasks.map((t) => t.title)).toEqual(template.tasks.map((t) => t.title));
    expect(body.data.jobId ?? body.data.job?.id).toBe(job.id);
    ctx.job = job;

    const lead = await prisma.lead.findUnique({ where: { id: ctx.lead.id } });
    expect(lead.status).toBe('WON');
    const won = await prisma.leadActivity.findFirst({ where: { leadId: ctx.lead.id, type: 'status_change', summary: { contains: '→ WON' } } });
    expect(won.summary).toContain(`Customer accepted ${ctx.v2.number} v2`);
    expect(won.summary).toContain('NPR');

    const timeline = expectStatus(await sales.get(`/admin/customers/${ctx.customer.id}/timeline`), 200).data;
    expect(timeline.map((e) => e.label)).toEqual(expect.arrayContaining([expect.stringMatching(new RegExp(`^Customer accepted ${ctx.v2.number} v2 · NPR`))]));
  });

  it('6 · everyone agreed is told exactly once', async () => {
    const dispatchers = (await prisma.user.findMany({ where: { role: 'DISPATCHER', isActive: true, deletedAt: null }, select: { id: true } })).map((u) => u.id);
    const notes = await prisma.notification.findMany({
      where: { type: 'quotation_accepted', createdAt: { gte: ctx.acceptedAt } },
    });
    const mine = notes.filter((n) => n.link === `/admin/quotations/${ctx.v2.id}` || n.link === `/admin/jobs/${ctx.job.id}`);
    const byUser = mine.map((n) => n.userId).sort();
    // SALES is both the salesperson and the creator: one notification, not two.
    expect(byUser).toEqual([ids.SALES, ids.MANAGER, ...dispatchers].sort());
    for (const id of dispatchers) expect(mine.find((n) => n.userId === id).link).toBe(`/admin/jobs/${ctx.job.id}`);
    expect(mine.find((n) => n.userId === ids.MANAGER).link).toBe(`/admin/quotations/${ctx.v2.id}`);
    expect(mine.some((n) => n.userId === ids.ADMIN)).toBe(false);

    // Staff email: salesperson/creator once, and each dispatcher; the manager is in-app only.
    const staffMail = await prisma.messageLog.findMany({ where: { relatedId: ctx.v2.id, templateKey: 'quotation_accepted_staff' } });
    const dispatcherEmails = (await prisma.user.findMany({ where: { id: { in: dispatchers } } })).map((u) => u.email);
    expect(staffMail.map((m) => m.toAddress).sort()).toEqual([USERS.SALES, ...dispatcherEmails].sort());

    // The customer: one SMS in Nepali, one email.
    const ne = await prisma.messageTemplate.findUnique({ where: { key_channel_locale: { key: 'quotation_accepted', channel: 'sms', locale: 'ne' } } });
    const customerMsgs = await prisma.messageLog.findMany({ where: { relatedId: ctx.v2.id, templateKey: 'quotation_accepted' } });
    expect(customerMsgs.map((m) => m.channel).sort()).toEqual(['email', 'sms']);
    const sms = customerMsgs.find((m) => m.channel === 'sms');
    expect(sms.toAddress).toBe(ctx.customer.phone);
    expect(sms.body).toContain(ne.body.slice(0, 10));
    expect(sms.body).toMatch(/[ऀ-ॿ]/);
  });

  it('7 · a replayed accept creates nothing more', async () => {
    expectStatus(await decide(ctx.v2.publicToken, { decision: 'approve' }), 422);
    expect(await prisma.job.count({ where: { quotationId: ctx.v2.id } })).toBe(1);
    // The legacy convert-to-job endpoint agrees.
    expectStatus(await dispatcher.post(`/admin/quotations/${ctx.v2.id}/convert-to-job`).send({}), 422);
    expect(await prisma.job.count({ where: { quotationId: ctx.v2.id } })).toBe(1);
  });

  it('8 · the job waits in the dispatch queue and on the dashboard', async () => {
    const list = expectStatus(await dispatcher.get('/admin/jobs?status=DRAFT&limit=100'), 200).data;
    expect(list.map((j) => j.id)).toContain(ctx.job.id);
    const dash = expectStatus(await dispatcher.get('/admin/dashboard'), 200).data;
    expect(dash.cards.acceptedJobsUnscheduled).toBeGreaterThanOrEqual(1);
  });
});

describe('customer acceptance edge cases', () => {
  it('two taps at once create exactly one job', async () => {
    const { quotation } = await draft();
    const { publicToken } = await approveAndSend(quotation.id);
    const results = await Promise.all([1, 2, 3].map(() => decide(publicToken, { decision: 'approve' })));
    expect(results.map((r) => r.status).sort()).toEqual([200, 422, 422]);
    expect(await prisma.job.count({ where: { quotationId: quotation.id } })).toBe(1);
    expect(await prisma.auditLog.count({ where: { recordId: quotation.id, event: 'quotation.customer_approved' } })).toBe(1);
  });

  it('a lead already LOST stays LOST, gets a note, and the acceptance still succeeds', async () => {
    const { quotation, lead } = await draft({ leadStatus: ['CONTACTED', 'LOST'] });
    const { publicToken } = await approveAndSend(quotation.id);
    expect(expectStatus(await decide(publicToken, { decision: 'approve' }), 200).data.status).toBe('CONVERTED');
    expect((await prisma.lead.findUnique({ where: { id: lead.id } })).status).toBe('LOST');
    const note = await prisma.leadActivity.findFirst({ where: { leadId: lead.id, type: 'note', summary: { contains: 'Customer accepted' } } });
    expect(note.summary).toMatch(/LOST/);
    expect(await prisma.job.count({ where: { quotationId: quotation.id } })).toBe(1);
  });

  it('a lead already WON stays WON and gets a note', async () => {
    const { quotation, lead } = await draft({ leadStatus: ['CONTACTED', 'WON'] });
    const { publicToken } = await approveAndSend(quotation.id);
    expectStatus(await decide(publicToken, { decision: 'approve' }), 200);
    expect((await prisma.lead.findUnique({ where: { id: lead.id } })).status).toBe('WON');
    const note = await prisma.leadActivity.findFirst({ where: { leadId: lead.id, type: 'note', summary: { contains: 'Customer accepted' } } });
    expect(note).toBeTruthy();
  });

  it('an auto-approved quotation notifies no manager on acceptance', async () => {
    const { quotation } = await draft();
    expectStatus(await setSettings({ 'quotation.autoApproveBelow': quotation.total + 1 }), 200);
    let sent;
    try {
      sent = await approveAndSend(quotation.id);
    } finally {
      await setSettings({ 'quotation.autoApproveBelow': 0 });
    }
    expect(sent.autoApproved).toBe(true);
    expectStatus(await decide(sent.publicToken, { decision: 'approve' }), 200);
    const notes = await prisma.notification.findMany({ where: { type: 'quotation_accepted', link: `/admin/quotations/${quotation.id}` } });
    expect(notes.map((n) => n.userId)).toEqual([ids.SALES]);
  });

  it('a customer with no email gets the SMS only', async () => {
    const { quotation } = await draft({ email: false });
    const { publicToken } = await approveAndSend(quotation.id);
    expectStatus(await decide(publicToken, { decision: 'approve' }), 200);
    const msgs = await prisma.messageLog.findMany({ where: { relatedId: quotation.id, templateKey: 'quotation_accepted' } });
    expect(msgs.map((m) => m.channel)).toEqual(['sms']);
    // An English customer gets the English template.
    expect(msgs[0].body).not.toMatch(/[ऀ-ॿ]/);
  });

  it('an expired quotation cannot be accepted — 422 and EXPIRED', async () => {
    const { quotation } = await draft();
    const { publicToken } = await approveAndSend(quotation.id);
    await prisma.quotation.update({ where: { id: quotation.id }, data: { validUntil: daysFromNow(-1) } });
    const res = expectStatus(await decide(publicToken, { decision: 'approve' }), 422);
    expect(res.error.message).toMatch(/expired/i);
    expect((await prisma.quotation.findUnique({ where: { id: quotation.id } })).status).toBe('EXPIRED');
    expect(await prisma.job.count({ where: { quotationId: quotation.id } })).toBe(0);
    // Expired → revise is allowed.
    expectStatus(await sales.post(`/admin/quotations/${quotation.id}/revise`), 201);
  });
});

describe('decline', () => {
  it('REJECTED with an optional reason; the lead is not marked LOST; sales is told', async () => {
    const { quotation, lead } = await draft({ leadStatus: ['CONTACTED'] });
    const { publicToken } = await approveAndSend(quotation.id);
    const requestId = rid();
    const body = expectStatus(await decide(publicToken, { decision: 'reject', note: 'Too expensive for now' }, requestId), 200);
    expect(body.data).toMatchObject({ status: 'REJECTED', decisionNote: 'Too expensive for now' });
    expect(await eventNames(requestId)).toEqual(['quotation.customer_rejected']);
    expect((await prisma.lead.findUnique({ where: { id: lead.id } })).status).toBe('CONTACTED');
    const activity = await prisma.leadActivity.findFirst({ where: { leadId: lead.id, summary: { startsWith: 'Customer declined' } } });
    expect(activity.summary).toContain('Too expensive for now');
    const notes = await prisma.notification.findMany({ where: { type: 'quotation_rejected', link: `/admin/quotations/${quotation.id}` } });
    expect(notes.map((n) => n.userId)).toEqual([ids.SALES]);
    expect(await prisma.job.count({ where: { quotationId: quotation.id } })).toBe(0);
  });

  it('works without a reason, and can be revised afterwards', async () => {
    const { quotation } = await draft();
    const { publicToken } = await approveAndSend(quotation.id);
    expectStatus(await decide(publicToken, { decision: 'reject' }), 200);
    expectStatus(await sales.post(`/admin/quotations/${quotation.id}/send`), 422);
    const v2 = expectStatus(await sales.post(`/admin/quotations/${quotation.id}/revise`), 201).data;
    expect(v2.requestedChanges).toBeNull();
  });
});

describe('revise', () => {
  it('is refused before the customer has it', async () => {
    const { quotation } = await draft();
    expectStatus(await sales.post(`/admin/quotations/${quotation.id}/revise`), 422);
    expectStatus(await sales.post(`/admin/quotations/${quotation.id}/submit`), 200);
    expectStatus(await sales.post(`/admin/quotations/${quotation.id}/revise`), 422);
  });

  it('from SENT closes the live link, which then points at the new version once sent', async () => {
    const { quotation } = await draft();
    const { publicToken } = await approveAndSend(quotation.id);
    const requestId = rid();
    const v2 = expectStatus(await sales.post(`/admin/quotations/${quotation.id}/revise`).set('X-Request-Id', requestId), 201).data;
    const superseded = (await eventsFor(requestId)).find((e) => e.event === 'quotation.superseded');
    expect(superseded).toMatchObject({ recordId: quotation.id, before: { status: 'SENT' }, after: { status: 'SUPERSEDED' } });
    expectStatus(await decide(publicToken, { decision: 'approve' }), 422);
    const sent = await approveAndSend(v2.id);
    expect(expectStatus(await anon().get(`/public/quotations/${publicToken}`), 200).data.replaced).toEqual({ token: sent.publicToken });
  });

  it('is refused to roles without quotations:write', async () => {
    const { quotation } = await draft();
    await approveAndSend(quotation.id);
    expectStatus(await dispatcher.post(`/admin/quotations/${quotation.id}/revise`), 403);
  });
});

// ── lists and dashboard

describe('GET /admin/quotations?stage=', () => {
  const made = {};

  beforeAll(async () => {
    made.draft = (await draft()).quotation.id;
    made.approval = (await draft()).quotation.id;
    expectStatus(await sales.post(`/admin/quotations/${made.approval}/submit`), 200);
    made.ready = (await draft()).quotation.id;
    expectStatus(await sales.post(`/admin/quotations/${made.ready}/submit`), 200);
    expectStatus(await manager.post(`/admin/quotations/${made.ready}/approve`).send({}), 200);
    made.with_customer = (await draft()).quotation.id;
    const sent = await approveAndSend(made.with_customer);
    made.changes_requested = (await draft()).quotation.id;
    const changes = await approveAndSend(made.changes_requested);
    expectStatus(await decide(changes.publicToken, { decision: 'request_changes', note: 'Smaller area please' }), 200);
    made.won = (await draft()).quotation.id;
    const won = await approveAndSend(made.won);
    expectStatus(await decide(won.publicToken, { decision: 'approve' }), 200);
    made.lost = (await draft()).quotation.id;
    const lost = await approveAndSend(made.lost);
    expectStatus(await decide(lost.publicToken, { decision: 'reject' }), 200);
    made.sentToken = sent.publicToken;
  });

  const STAGES = {
    drafts: ['DRAFT'],
    approval: ['PENDING_APPROVAL'],
    ready: ['OFFICE_APPROVED'],
    with_customer: ['SENT'],
    changes_requested: ['CHANGES_REQUESTED'],
    won: ['APPROVED', 'CONVERTED'],
    lost: ['REJECTED', 'EXPIRED'],
  };

  it.each(Object.entries(STAGES))('stage=%s lists only %j', async (stage, statuses) => {
    const body = expectStatus(await manager.get(`/admin/quotations?stage=${stage}&limit=100`), 200);
    expect(body.data.every((q) => statuses.includes(q.status))).toBe(true);
    const key = stage === 'drafts' ? 'draft' : stage;
    const inStage = await prisma.quotation.count({ where: { deletedAt: null, status: { in: statuses } } });
    expect(body.meta.total).toBe(inStage);
    if (inStage <= 100) expect(body.data.map((q) => q.id)).toContain(made[key]);
  });

  it('stage=all includes superseded versions; a bad stage or status is 400', async () => {
    const all = expectStatus(await manager.get('/admin/quotations?stage=all&limit=1'), 200);
    expect(all.meta.total).toBe(await prisma.quotation.count({ where: { deletedAt: null } }));
    expectStatus(await manager.get('/admin/quotations?stage=nope'), 400);
    expectStatus(await manager.get('/admin/quotations?status=nope'), 400);
    expectStatus(await manager.get('/admin/quotations?status=PENDING_APPROVAL'), 200);
  });
});

describe('GET /admin/dashboard', () => {
  it('shows approval and customer-response counts by role', async () => {
    const count = (where) => prisma.quotation.count({ where: { deletedAt: null, ...where } });
    const m = expectStatus(await manager.get('/admin/dashboard'), 200).data;
    expect(m.role).toBe('MANAGER');
    expect(m.cards).toMatchObject({
      quotationsPendingApproval: await count({ status: 'PENDING_APPROVAL' }),
      quotationsChangesRequested: await count({ status: 'CHANGES_REQUESTED' }),
      quotationsAwaitingCustomer: await count({ status: 'SENT' }),
      acceptedJobsUnscheduled: expect.any(Number),
    });
    expect(m.funnel).toBeTruthy();

    const s = expectStatus(await sales.get('/admin/dashboard'), 200).data.cards;
    expect(s).toHaveProperty('quotationsPendingApproval');
    expect(s).toHaveProperty('quotationsChangesRequested');
    expect(s).not.toHaveProperty('acceptedJobsUnscheduled');

    const d = expectStatus(await dispatcher.get('/admin/dashboard'), 200).data.cards;
    expect(d).toHaveProperty('acceptedJobsUnscheduled');
    expect(d).not.toHaveProperty('quotationsPendingApproval');
    expect(d.acceptedJobsUnscheduled).toBe(await prisma.job.count({
      where: { deletedAt: null, quotationId: { not: null }, status: 'DRAFT', scheduledStart: null },
    }));
  });
});

describe('the staff detail and history', () => {
  it('GET /admin/quotations/:id carries the survey it was priced from and the customer messages', async () => {
    const { quotation } = await draft();
    await approveAndSend(quotation.id);
    const detail = expectStatus(await sales.get(`/admin/quotations/${quotation.id}`), 200).data;
    expect(detail.survey).toBeNull();
    expect(detail.makerChecker).toBe(true);
    expect(detail.messages.map((m) => [m.channel, m.templateKey, m.status])).toEqual(
      expect.arrayContaining([['sms', 'quotation_sent', 'sent'], ['email', 'quotation_sent', 'sent']]),
    );
    // Staff emails about it are not the customer's messages.
    expect(detail.messages.every((m) => !m.templateKey.endsWith('_staff') && m.templateKey !== 'quotation_submitted')).toBe(true);
  });

  it('a revision still names the survey its first version was priced from', async () => {
    const survey = await prisma.siteSurvey.findFirst({ where: { quotationId: { not: null } } });
    if (!survey) return;
    const q = await prisma.quotation.findUnique({ where: { id: survey.quotationId } });
    const detail = expectStatus(await sales.get(`/admin/quotations/${q.id}`), 200).data;
    expect(detail.survey).toMatchObject({ id: survey.id, number: survey.number });
  });

  it('GET /admin/quotations/:id/history is the approval and response trail, for quotations:history', async () => {
    const { quotation } = await draft();
    const { publicToken } = await approveAndSend(quotation.id);
    expectStatus(await decide(publicToken, { decision: 'request_changes', note: 'Smaller area please' }), 200);
    const body = expectStatus(await manager.get(`/admin/quotations/${quotation.id}/history?limit=50`), 200);
    const events = body.data.map((r) => r.event).filter(Boolean);
    expect(events).toEqual(expect.arrayContaining([
      'quotation.created', 'quotation.submitted', 'quotation.office_approved', 'quotation.sent', 'quotation.customer_changes_requested',
    ]));
    expect(body.data[0]).not.toHaveProperty('ip');
    expectStatus(await (await as('ACCOUNTANT')).get(`/admin/quotations/${quotation.id}/history`), 403);
    expectStatus(await dispatcher.get(`/admin/quotations/${quotation.id}/history`), 403);
    expectStatus(await sales.get('/admin/quotations/nope/history'), 404);
  });
});

describe('MANAGER', () => {
  it('works leads and quotations like sales, but not dispatch, finance or users', async () => {
    expectStatus(await manager.get('/admin/leads'), 200);
    expectStatus(await manager.get('/admin/quotations'), 200);
    expectStatus(await manager.get('/admin/leads/assignees'), 200);
    expectStatus(await manager.post('/admin/jobs').send({}), 403);
    expectStatus(await manager.get('/admin/invoices'), 403);
    expectStatus(await manager.get('/admin/users'), 403);
  });

  it('can be assigned a lead', async () => {
    const lead = expectStatus(await sales.post('/admin/leads').send({ name: 'For the manager', phone: phone() }), 201).data;
    expectStatus(await sales.patch(`/admin/leads/${lead.id}/assign`).send({ assignedToId: ids.MANAGER }), 200);
  });
});
