import { describe, it, expect, beforeAll } from 'vitest';
import {
  anon, as, expectStatus, createCustomer, createAssignedJob, technicianIdFor, phone, uid, dayMatching, prisma, USERS,
} from './helpers.js';
import { runSlaSweep } from '../../src/services/sla.service.js';
import { loadTemplate, notify } from '../../src/services/notify.service.js';

/** Phase E: working a lead from first contact to a customer, in the admin UI. */

let admin;
let sales;
let dispatcher;
let accountant;
let salesId;
let adminId;

const publicLead = (extra = {}) => ({
  name: 'Phase E Lead', phone: phone(), message: 'Damp on the wall', elapsedMs: 6000, website: '', ...extra,
});

const newLead = async (extra = {}, client = sales) =>
  expectStatus(await client.post('/admin/leads').send({ name: 'Phase E Lead', phone: phone(), ...extra }), 201).data;

beforeAll(async () => {
  [admin, sales, dispatcher, accountant] = await Promise.all([as('ADMIN'), as('SALES'), as('DISPATCHER'), as('ACCOUNTANT')]);
  salesId = (await prisma.user.findUnique({ where: { email: USERS.SALES } })).id;
  adminId = (await prisma.user.findUnique({ where: { email: USERS.ADMIN } })).id;
});

describe('GET /admin/leads — views and filters', () => {
  it('assignedToId=me is the caller', async () => {
    const mine = await newLead({ assignedToId: salesId });
    const theirs = await newLead({ assignedToId: adminId });
    const rows = expectStatus(await sales.get('/admin/leads?assignedToId=me&limit=100&sort=-createdAt'), 200).data;
    const ids = rows.map((r) => r.id);
    expect(ids).toContain(mine.id);
    expect(ids).not.toContain(theirs.id);
    expect(rows.every((r) => r.assignedToId === salesId)).toBe(true);
    // The same view for another caller is their own leads.
    const adminRows = expectStatus(await admin.get('/admin/leads?assignedToId=me&limit=100&sort=-createdAt'), 200).data;
    expect(adminRows.map((r) => r.id)).toContain(theirs.id);
    expect(adminRows.every((r) => r.assignedToId === adminId)).toBe(true);
  });

  it('assignedToId=none is the unassigned leads', async () => {
    const lead = await newLead();
    expectStatus(await sales.patch(`/admin/leads/${lead.id}/assign`).send({ assignedToId: null }), 200);
    const rows = expectStatus(await sales.get('/admin/leads?assignedToId=none&limit=100&sort=-createdAt'), 200).data;
    expect(rows.map((r) => r.id)).toContain(lead.id);
    expect(rows.every((r) => r.assignedToId === null)).toBe(true);
  });

  it('requestedVisit=true is the leads that name a visit day', async () => {
    const number = phone();
    expectStatus(await anon().post('/public/leads').send(publicLead({
      phone: number, preferredAt: `${dayMatching((d) => d !== 6)}T06:00:00.000Z`, preferredSlot: 'morning',
    })), 201);
    const rows = expectStatus(await sales.get('/admin/leads?requestedVisit=true&limit=100&sort=-createdAt'), 200).data;
    expect(rows.some((r) => r.phone === number)).toBe(true);
    expect(rows.every((r) => r.preferredAt)).toBe(true);
    expectStatus(await sales.get('/admin/leads?requestedVisit=maybe'), 400);
  });

  it('a response-state filter and a search together answer 200', async () => {
    expectStatus(await sales.get('/admin/leads?slaRisk=ok&q=Phase'), 200);
  });

  it('exports only the picked rows with ids=', async () => {
    const a = await newLead({ name: `Export Pick ${uid()}` });
    const b = await newLead({ name: `Export Skip ${uid()}` });
    const res = await sales.get(`/admin/leads/export.csv?ids=${a.id}`);
    expectStatus(res, 200);
    const csv = res.text;
    expect(csv).toContain(a.name);
    expect(csv).not.toContain(b.name);
    expect(csv.trim().split('\n')).toHaveLength(2);
  });
});

describe('the service picker', () => {
  it('SALES reads the service catalogue (services:read) but cannot change it', async () => {
    const rows = expectStatus(await sales.get('/admin/services?q=a&limit=5'), 200).data;
    expect(rows.length).toBeGreaterThan(0);
    expectStatus(await sales.get(`/admin/services/${rows[0].id}`), 200);
    expectStatus(await sales.put(`/admin/services/${rows[0].id}`).send({ name: 'Nope' }), 403);
    expectStatus(await sales.get('/admin/faqs'), 403);
    expectStatus(await dispatcher.get('/admin/services'), 403);
  });
});

describe('assignment', () => {
  it('GET /admin/leads/assignees lists active sales and admin staff only', async () => {
    const rows = expectStatus(await sales.get('/admin/leads/assignees'), 200).data;
    expect(rows.map((u) => u.id)).toEqual(expect.arrayContaining([salesId, adminId]));
    expect(rows.every((u) => ['SALES', 'ADMIN'].includes(u.role))).toBe(true);
    expect(rows[0]).not.toHaveProperty('passwordHash');
    const found = expectStatus(await sales.get('/admin/leads/assignees?q=sales'), 200).data;
    expect(found.map((u) => u.id)).toContain(salesId);
    expect(expectStatus(await sales.get(`/admin/leads/assignees/${salesId}`), 200).data.name).toBeTruthy();
  });

  it('refuses to assign a lead to someone who does not work leads', async () => {
    const lead = await newLead();
    const dispatcherId = (await prisma.user.findUnique({ where: { email: USERS.DISPATCHER } })).id;
    expectStatus(await sales.patch(`/admin/leads/${lead.id}/assign`).send({ assignedToId: dispatcherId }), 400);
    expectStatus(await sales.get(`/admin/leads/assignees/${dispatcherId}`), 404);
  });

  it('POST /admin/leads/bulk-assign moves every lead, one event and one timeline entry each, one notification', async () => {
    const leads = [await newLead(), await newLead(), await newLead()];
    const ids = leads.map((l) => l.id);
    const before = await prisma.notification.count({ where: { userId: adminId, type: 'lead_assigned' } });

    const body = expectStatus(await sales.post('/admin/leads/bulk-assign').send({ ids, assignedToId: adminId }), 200).data;
    expect(body).toEqual({ assigned: 3, unchanged: 0 });

    const rows = await prisma.lead.findMany({ where: { id: { in: ids } } });
    expect(rows.every((r) => r.assignedToId === adminId)).toBe(true);
    for (const id of ids) {
      expect(await prisma.leadActivity.count({ where: { leadId: id, type: 'assignment' } })).toBeGreaterThanOrEqual(1);
      expect(await prisma.auditLog.count({ where: { event: 'lead.assigned', recordId: id, after: { path: ['assignedToId'], equals: adminId } } })).toBe(1);
    }
    const notes = await prisma.notification.findMany({
      where: { userId: adminId, type: 'lead_assigned' }, orderBy: { createdAt: 'desc' },
    });
    expect(notes.length - before).toBe(1);
    expect(notes[0].title).toBe('3 leads assigned to you');
    expect(notes[0].link).toBe('/admin/leads');

    // Again: nothing changes, nothing is sent.
    expect(expectStatus(await sales.post('/admin/leads/bulk-assign').send({ ids, assignedToId: adminId }), 200).data)
      .toEqual({ assigned: 0, unchanged: 3 });
    expect(await prisma.notification.count({ where: { userId: adminId, type: 'lead_assigned' } }) - before).toBe(1);
  });

  it('bulk-assign with an unknown id changes nothing', async () => {
    const lead = await newLead({ assignedToId: salesId });
    expectStatus(await sales.post('/admin/leads/bulk-assign').send({ ids: [lead.id, 'no-such-lead'], assignedToId: adminId }), 404);
    expect((await prisma.lead.findUnique({ where: { id: lead.id } })).assignedToId).toBe(salesId);
  });

  it('bulk-assign needs leads:write and a sane body', async () => {
    const lead = await newLead();
    expectStatus(await dispatcher.post('/admin/leads/bulk-assign').send({ ids: [lead.id], assignedToId: null }), 403);
    expectStatus(await sales.post('/admin/leads/bulk-assign').send({ ids: [], assignedToId: null }), 400);
    expectStatus(await sales.post('/admin/leads/bulk-assign').send({ ids: Array.from({ length: 101 }, (_, i) => `x${i}`), assignedToId: null }), 400);
  });
});

describe('typed activities', () => {
  it('logging a WhatsApp message stops the clock and says how it went', async () => {
    const lead = await newLead();
    const body = expectStatus(await sales.post(`/admin/leads/${lead.id}/activities`).send({ type: 'whatsapp', summary: 'Sent photos request' }), 201).data;
    expect(body.type).toBe('whatsapp');
    expect(body.firstResponse).toBe(true);
    expect(body.sla.state).toBe('met');
    expect(body.user.id).toBe(salesId);
    const event = await prisma.auditLog.findFirst({ where: { event: 'lead.activity_logged', recordId: lead.id } });
    expect(event.changes).toMatchObject({ type: 'whatsapp', summary: 'Sent photos request' });
    expect(event.after.firstResponseAt).toBeTruthy();

    // A second contact does not move the first response.
    const again = expectStatus(await sales.post(`/admin/leads/${lead.id}/activities`).send({ type: 'call', summary: 'Called back' }), 201).data;
    expect(again.firstResponse).toBe(false);
  });

  it('a note does not stop the clock', async () => {
    const lead = await newLead();
    const body = expectStatus(await sales.post(`/admin/leads/${lead.id}/activities`).send({ type: 'note', summary: 'Asked a neighbour' }), 201).data;
    expect(body.firstResponse).toBe(false);
    expect((await prisma.lead.findUnique({ where: { id: lead.id } })).firstResponseAt).toBeNull();
  });

  it('refuses the entries only the system writes', async () => {
    const lead = await newLead();
    for (const type of ['status_change', 'assignment']) {
      expectStatus(await sales.post(`/admin/leads/${lead.id}/activities`).send({ type, summary: 'forged' }), 400);
    }
  });
});

describe('duplicates', () => {
  it('finds a lead with the same email and says what a merge would move', async () => {
    const email = `${uid('dup')}@example.com`;
    const a = await newLead({ email });
    const b = await newLead({ email: email.toUpperCase() });
    expectStatus(await sales.post(`/admin/leads/${b.id}/notes`).send({ note: 'Same person, new number' }), 201);
    const rows = expectStatus(await sales.get(`/admin/leads/${a.id}/duplicates`), 200).data;
    const dup = rows.find((r) => r.id === b.id);
    expect(dup.matchedOn).toBe('email');
    expect(dup._count).toMatchObject({ notes: 1, quotations: 0, jobs: 0 });
    expect(dup._count.activities).toBeGreaterThanOrEqual(1);
    expect(dup.sla).toBeTruthy();
  });
});

describe('record history', () => {
  let lead;

  beforeAll(async () => {
    lead = await newLead({ assignedToId: null });
    expectStatus(await sales.patch(`/admin/leads/${lead.id}/assign`).send({ assignedToId: salesId }), 200);
    expectStatus(await sales.post(`/admin/leads/${lead.id}/activities`).send({ type: 'call', summary: 'Called' }), 201);
    expectStatus(await sales.post(`/admin/leads/${lead.id}/notes`).send({ note: 'Wants a morning visit' }), 201);
    expectStatus(await sales.patch(`/admin/leads/${lead.id}/status`).send({ status: 'CONTACTED' }), 200);
  });

  it('GET /admin/leads/:id/history shows each step, newest first, with the actor', async () => {
    const body = expectStatus(await sales.get(`/admin/leads/${lead.id}/history?limit=50`), 200);
    const events = body.data.map((r) => r.event ?? `${r.action} ${r.model}`);
    expect(events).toEqual(expect.arrayContaining([
      'lead.created', 'lead.assigned', 'lead.activity_logged', 'lead.status_changed', 'create LeadNote', 'create Lead',
    ]));
    expect(events.indexOf('lead.status_changed')).toBeLessThan(events.indexOf('lead.created'));
    const times = body.data.map((r) => new Date(r.createdAt).getTime());
    expect([...times].sort((x, y) => y - x)).toEqual(times);
    const assigned = body.data.find((r) => r.event === 'lead.assigned');
    expect(assigned.actor).toMatchObject({ id: salesId, role: 'SALES' });
    expect(assigned.actor.name).toBeTruthy();
    expect(assigned.after).toEqual({ assignedToId: salesId });
    expect(body.data[0]).not.toHaveProperty('ip');
    expect(body.data[0]).not.toHaveProperty('userAgent');
    expect(body.meta.total).toBe(body.data.length);
  });

  it('pages', async () => {
    const body = expectStatus(await sales.get(`/admin/leads/${lead.id}/history?limit=2&page=2`), 200);
    expect(body.data).toHaveLength(2);
    expect(body.meta).toMatchObject({ page: 2, limit: 2 });
  });

  it('never shows another lead\'s rows', async () => {
    const other = await newLead();
    const rows = expectStatus(await sales.get(`/admin/leads/${other.id}/history?limit=100`), 200).data;
    expect(rows.every((r) => r.recordId === other.id || r.model === 'LeadNote')).toBe(true);
    expect(rows.some((r) => r.recordId === lead.id)).toBe(false);
  });

  it('RBAC: sales reads it, dispatch does not', async () => {
    expectStatus(await dispatcher.get(`/admin/leads/${lead.id}`), 200);
    expectStatus(await dispatcher.get(`/admin/leads/${lead.id}/history`), 403);
    expectStatus(await accountant.get(`/admin/leads/${lead.id}/history`), 403);
    expectStatus(await admin.get(`/admin/leads/${lead.id}/history`), 200);
    expectStatus(await sales.get('/admin/leads/no-such-lead/history'), 404);
  });

  it('GET /admin/customers/:id/history includes the customer\'s sites', async () => {
    const customer = await createCustomer(sales);
    expectStatus(await sales.post(`/admin/customers/${customer.id}/sites`).send({ label: 'Home', address: 'Jhamsikhel, Lalitpur' }), 201);
    expectStatus(await sales.put(`/admin/customers/${customer.id}`).send({ notes: 'Prefers calls after 5' }), 200);
    const rows = expectStatus(await sales.get(`/admin/customers/${customer.id}/history`), 200).data;
    const kinds = rows.map((r) => `${r.action} ${r.model}`);
    expect(kinds).toEqual(expect.arrayContaining(['create Customer', 'create CustomerSite', 'update Customer']));
    expect(rows.find((r) => r.action === 'update' && r.model === 'Customer').after).toEqual({ notes: 'Prefers calls after 5' });
    expectStatus(await dispatcher.get(`/admin/customers/${customer.id}/history`), 403);
    expectStatus(await accountant.get(`/admin/customers/${customer.id}/history`), 403);
  });
});

describe('notification links are admin paths', () => {
  it('a new public lead notifies sales with /admin/leads/:id', async () => {
    const number = phone();
    expectStatus(await anon().post('/public/leads').send(publicLead({ phone: number })), 201);
    const lead = await prisma.lead.findFirst({ where: { phone: number } });
    const note = await prisma.notification.findFirst({ where: { userId: salesId, type: 'lead_new', link: { contains: lead.id } } });
    expect(note.link).toBe(`/admin/leads/${lead.id}`);
  });

  it('an assignment links to the lead', async () => {
    const lead = await newLead({ assignedToId: salesId });
    expectStatus(await sales.patch(`/admin/leads/${lead.id}/assign`).send({ assignedToId: adminId }), 200);
    const note = await prisma.notification.findFirst({ where: { userId: adminId, type: 'lead_assigned' }, orderBy: { createdAt: 'desc' } });
    expect(note.link).toBe(`/admin/leads/${lead.id}`);
  });

  it('the SLA sweep links to the lead, and its email to the web app', async () => {
    const lead = await newLead();
    await prisma.lead.update({ where: { id: lead.id }, data: { slaDueAt: new Date(Date.now() - 60_000), assignedToId: salesId } });
    await runSlaSweep();
    const note = await prisma.notification.findFirst({ where: { userId: adminId, type: 'lead_sla_breach', link: { contains: lead.id } } });
    expect(note.link).toBe(`/admin/leads/${lead.id}`);
    const mail = await prisma.messageLog.findFirst({ where: { relatedId: lead.id, templateKey: 'lead_sla_breach' } });
    expect(mail.body).toContain(`http://localhost:5400/admin/leads/${lead.id}`);
  });

  it('a new lead\'s staff email points at the web app, not the API', async () => {
    const lead = await newLead();
    // The on-call SMS and sales email are sent only when those settings exist; send one directly the same way.
    await notify({
      templateKey: 'lead_new', channel: 'email', to: 'sales@example.com',
      vars: { leadName: lead.name, phone: lead.phone, link: (await import('../../src/utils/links.js')).webUrl(`/admin/leads/${lead.id}`) },
      related: { model: 'Lead', id: lead.id },
    });
    const mail = await prisma.messageLog.findFirst({ where: { relatedId: lead.id, templateKey: 'lead_new', channel: 'email' } });
    expect(mail.body).toContain(`http://localhost:5400/admin/leads/${lead.id}`);
    expect(mail.body).not.toContain('localhost:4000');
  });

  it('a customer decision links to the quotation', async () => {
    const customer = await createCustomer(sales);
    const q = expectStatus(await sales.post('/admin/quotations').send({
      customerId: customer.id, items: [{ description: 'Link check', qty: 1, rate: 100 }],
    }), 201).data;
    expectStatus(await sales.post(`/admin/quotations/${q.id}/send`), 200);
    const { publicToken } = await prisma.quotation.findUnique({ where: { id: q.id } });
    expectStatus(await anon().post(`/public/quotations/${publicToken}/decide`).send({ decision: 'reject' }), 200);
    const note = await prisma.notification.findFirst({ where: { userId: salesId, type: 'quotation_rejected', link: { contains: q.id } } });
    expect(note.link).toBe(`/admin/quotations/${q.id}`);
  });

  it('a completed job links to the job for accounts', async () => {
    const { job } = await createAssignedJob();
    const dispatch = await as('DISPATCHER');
    for (const status of ['EN_ROUTE', 'IN_PROGRESS', 'COMPLETED']) {
      expectStatus(await dispatch.patch(`/admin/jobs/${job.id}/status`).send({ status }), 200);
    }
    const note = await prisma.notification.findFirst({ where: { type: 'job_completed', link: { contains: job.id } } });
    expect(note.link).toBe(`/admin/jobs/${job.id}`);
  });

  it('a technician\'s assignment stays in the field app', async () => {
    const { job, technicianId } = await createAssignedJob();
    const tech = await prisma.technician.findUnique({ where: { id: technicianId } });
    const note = await prisma.notification.findFirst({ where: { userId: tech.userId, type: 'job_assigned', link: { contains: job.id } } });
    expect(note.link).toBe(`/tech/jobs/${job.id}`);
  });
});

describe('convert — a matching phone is never taken on trust', () => {
  let existing;
  let sharedPhone;

  beforeAll(async () => {
    sharedPhone = phone();
    existing = expectStatus(await sales.post('/admin/customers').send({
      name: 'Existing Household', phone: sharedPhone, email: 'household@example.com',
    }), 201).data;
    const { job } = await createAssignedJob();
    // Give the existing customer a visit to show.
    await prisma.job.update({ where: { id: job.id }, data: { customerId: existing.id, scheduledStart: new Date('2026-08-01T04:15:00Z') } });
  });

  const sharedLead = (extra = {}) => newLead({ phone: sharedPhone, email: `${uid('tenant')}@example.com`, ...extra });

  it('GET /admin/leads/:id/customer-matches describes the candidates', async () => {
    const lead = await sharedLead();
    const rows = expectStatus(await sales.get(`/admin/leads/${lead.id}/customer-matches`), 200).data;
    const match = rows.find((c) => c.id === existing.id);
    expect(match).toMatchObject({ name: 'Existing Household', email: 'household@example.com', jobCount: 1, preferredLocale: 'en' });
    expect(new Date(match.lastVisitAt).toISOString()).toBe('2026-08-01T04:15:00.000Z');
  });

  it('with no decision it answers 409 CUSTOMER_MATCH and writes nothing', async () => {
    const lead = await sharedLead();
    const customersBefore = await prisma.customer.count({ where: { phone: sharedPhone } });
    const body = expectStatus(await sales.post(`/admin/leads/${lead.id}/convert`).send({ createQuotation: true }), 409);
    expect(body.error.code).toBe('CUSTOMER_MATCH');
    expect(body.error.details.candidates.map((c) => c.id)).toContain(existing.id);
    expect(await prisma.customer.count({ where: { phone: sharedPhone } })).toBe(customersBefore);
    expect(await prisma.lead.findUnique({ where: { id: lead.id } })).toMatchObject({ customerId: null, status: 'NEW' });
    expect(await prisma.quotation.count({ where: { leadId: lead.id } })).toBe(0);
  });

  it('"different person" creates a second customer with the same phone and the lead\'s email', async () => {
    const lead = await sharedLead({ preferredLocale: 'ne' });
    const body = expectStatus(await sales.post(`/admin/leads/${lead.id}/convert`).send({
      createNewCustomer: true, site: { address: 'Flat 2, Kupondole' },
    }), 201).data;
    expect(body.customerCreated).toBe(true);
    expect(body.customer.id).not.toBe(existing.id);
    expect(body.customer).toMatchObject({ phone: sharedPhone, email: lead.email, preferredLocale: 'ne' });
    expect(body.site).toMatchObject({ address: 'Flat 2, Kupondole', isPrimary: true });
    expect(await prisma.customer.count({ where: { phone: sharedPhone, deletedAt: null } })).toBeGreaterThanOrEqual(2);
    expect((await prisma.customer.findUnique({ where: { id: existing.id } })).email).toBe('household@example.com');
  });

  it('"same person" without confirmEmail links the lead and leaves the customer\'s email alone', async () => {
    const lead = await sharedLead();
    const body = expectStatus(await sales.post(`/admin/leads/${lead.id}/convert`).send({ customerId: existing.id }), 201).data;
    expect(body.customerCreated).toBe(false);
    expect(body.customer.id).toBe(existing.id);
    expect((await prisma.lead.findUnique({ where: { id: lead.id } })).customerId).toBe(existing.id);
    expect((await prisma.customer.findUnique({ where: { id: existing.id } })).email).toBe('household@example.com');
    expect(await prisma.auditLog.count({ where: { event: 'customer.email_confirmed', recordId: existing.id } })).toBe(0);
  });

  it('"same person" with confirmEmail saves the email as the audited customer.email_confirmed', async () => {
    const other = expectStatus(await sales.post('/admin/customers').send({ name: 'No Email Yet', phone: phone() }), 201).data;
    const lead = await newLead({ phone: other.phone, email: `  ${uid('Confirm')}@Example.com ` });
    expect(lead.email).toBe(lead.email.trim().toLowerCase());
    const body = expectStatus(await sales.post(`/admin/leads/${lead.id}/convert`).send({ customerId: other.id, confirmEmail: true }), 201).data;
    expect(body.customer.email).toBe(lead.email);
    const event = await prisma.auditLog.findFirst({ where: { event: 'customer.email_confirmed', recordId: other.id } });
    expect(event).toMatchObject({ actorId: salesId, actorType: 'user', model: 'Customer' });
    expect(event.before).toEqual({ email: null });
    expect(event.after).toEqual({ email: lead.email });
    expect(event.changes).toEqual({ leadId: lead.id });
  });

  it('an existing customer keeps its language unless staff change it', async () => {
    const lead = await sharedLead({ preferredLocale: 'ne' });
    expectStatus(await sales.post(`/admin/leads/${lead.id}/convert`).send({ customerId: existing.id }), 201);
    expect((await prisma.customer.findUnique({ where: { id: existing.id } })).preferredLocale).toBe('en');

    const again = await sharedLead({ preferredLocale: 'ne' });
    expectStatus(await sales.post(`/admin/leads/${again.id}/convert`).send({ customerId: existing.id, preferredLocale: 'ne' }), 201);
    expect((await prisma.customer.findUnique({ where: { id: existing.id } })).preferredLocale).toBe('ne');
    await prisma.customer.update({ where: { id: existing.id }, data: { preferredLocale: 'en' } });
  });

  it('GET /admin/leads/:id shows the visit it led to, with its survey', async () => {
    const lead = await newLead();
    const { job, survey } = expectStatus(await sales.post(`/admin/leads/${lead.id}/convert`).send({
      site: { address: 'Kupondole' }, createInspectionJob: true, surveyorId: await technicianIdFor('SURVEYOR'),
    }), 201).data;
    const detail = expectStatus(await sales.get(`/admin/leads/${lead.id}`), 200).data;
    expect(detail.jobs).toEqual([expect.objectContaining({
      id: job.id, number: job.number, title: job.title, survey: expect.objectContaining({ id: survey.id, number: survey.number }),
    })]);
    expect(detail.customer.id).toBe(detail.customerId);
  });

  it('a lead already linked converts again onto its customer without asking', async () => {
    const lead = await sharedLead();
    expectStatus(await sales.post(`/admin/leads/${lead.id}/convert`).send({ customerId: existing.id }), 201);
    const body = expectStatus(await sales.post(`/admin/leads/${lead.id}/convert`).send({
      createInspectionJob: true, surveyorId: await technicianIdFor('SURVEYOR'),
    }), 201).data;
    expect(body.customer.id).toBe(existing.id);
    expect(body.job.customerId).toBe(existing.id);
  });

  it('an address staff type for an existing customer becomes a site of its own', async () => {
    const lead = await sharedLead();
    const body = expectStatus(await sales.post(`/admin/leads/${lead.id}/convert`).send({
      customerId: existing.id, site: { label: 'Parents\' house', address: `Bhaisepati ${uid()}` },
    }), 201).data;
    expect(body.site).toMatchObject({ customerId: existing.id, label: 'Parents\' house' });
    const sites = await prisma.customerSite.findMany({ where: { customerId: existing.id, deletedAt: null } });
    expect(sites.filter((s) => s.isPrimary)).toHaveLength(1);
  });

  it('refuses both choices at once', async () => {
    const lead = await sharedLead();
    expectStatus(await sales.post(`/admin/leads/${lead.id}/convert`).send({ customerId: existing.id, createNewCustomer: true }), 400);
  });

  it('with no customer on that phone it creates one without asking, in the lead\'s language', async () => {
    const lead = await newLead({ preferredLocale: 'ne', email: `${uid('fresh')}@example.com` });
    const body = expectStatus(await sales.post(`/admin/leads/${lead.id}/convert`).send({ site: { address: 'Sanepa, Lalitpur' } }), 201).data;
    expect(body.customerCreated).toBe(true);
    expect(body.customer).toMatchObject({ phone: lead.phone, email: lead.email, preferredLocale: 'ne' });
  });
});

describe('contact details from the public forms', () => {
  it('stores an email trimmed and lower-case', async () => {
    const number = phone();
    expectStatus(await anon().post('/public/leads').send(publicLead({ phone: number, email: '  Sita.Rai@Example.COM ' })), 201);
    expect((await prisma.lead.findFirst({ where: { phone: number } })).email).toBe('sita.rai@example.com');
    const customer = expectStatus(await sales.post('/admin/customers').send({ name: 'Case Test', phone: phone(), email: ' MIXED@Case.Org' }), 201).data;
    expect(customer.email).toBe('mixed@case.org');
  });

  it('a booking with and without an email both create a lead', async () => {
    const day = `${dayMatching((d) => d !== 6)}T06:00:00.000Z`;
    for (const email of ['booker@example.com', undefined, '']) {
      const number = phone();
      expectStatus(await anon().post('/public/leads').send(publicLead({ phone: number, email, preferredAt: day, preferredSlot: 'morning' })), 201);
      const saved = await prisma.lead.findFirst({ where: { phone: number } });
      expect(saved.source).toBe('booking');
      expect(saved.email).toBe(email || null);
    }
  });

  it('refuses a malformed email', async () => {
    expectStatus(await anon().post('/public/leads').send(publicLead({ email: 'not-an-email' })), 400);
  });
});

describe('preferred language', () => {
  it('a booking in Nepali is acknowledged in Nepali', async () => {
    const number = phone();
    expectStatus(await anon().post('/public/leads').send(publicLead({
      phone: number, preferredLocale: 'ne',
      preferredAt: `${dayMatching((d) => d !== 6)}T06:00:00.000Z`, preferredSlot: 'afternoon',
    })), 201);
    const lead = await prisma.lead.findFirst({ where: { phone: number } });
    expect(lead.preferredLocale).toBe('ne');
    const sms = await prisma.messageLog.findFirst({ where: { relatedId: lead.id, templateKey: 'lead_ack', channel: 'sms' } });
    expect(sms.body).toContain('धन्यवाद');
    expect(sms.body).toContain(lead.name);
  });

  it('a lead with no language is English, and is acknowledged in English', async () => {
    const number = phone();
    expectStatus(await anon().post('/public/leads').send(publicLead({ phone: number })), 201);
    const lead = await prisma.lead.findFirst({ where: { phone: number } });
    expect(lead.preferredLocale).toBe('en');
    const sms = await prisma.messageLog.findFirst({ where: { relatedId: lead.id, templateKey: 'lead_ack' } });
    expect(sms.body).toMatch(/^Thank you/);
  });

  it('refuses a language the site does not speak', async () => {
    expectStatus(await anon().post('/public/leads').send(publicLead({ preferredLocale: 'fr' })), 400);
    expectStatus(await sales.post('/admin/customers').send({ name: 'French', phone: phone(), preferredLocale: 'fr' }), 400);
  });

  it('a missing Nepali template falls back to the English one', async () => {
    const en = await loadTemplate('quotation_sent', 'sms', 'en');
    expect(await prisma.messageTemplate.findFirst({ where: { key: 'quotation_sent', channel: 'sms', locale: 'ne' } })).toBeNull();
    expect((await loadTemplate('quotation_sent', 'sms', 'ne')).id).toBe(en.id);
    expect(await loadTemplate('no_such_template', 'sms', 'ne')).toBeNull();
  });

  it('a quotation to a Nepali customer with no Nepali template still goes out, in English', async () => {
    const customer = expectStatus(await sales.post('/admin/customers').send({ name: 'नेपाली ग्राहक', phone: phone(), preferredLocale: 'ne' }), 201).data;
    expect(customer.preferredLocale).toBe('ne');
    const q = expectStatus(await sales.post('/admin/quotations').send({
      customerId: customer.id, items: [{ description: 'Fallback check', qty: 1, rate: 100 }],
    }), 201).data;
    expectStatus(await sales.post(`/admin/quotations/${q.id}/send`), 200);
    const sms = await prisma.messageLog.findFirst({ where: { relatedId: q.id, templateKey: 'quotation_sent', channel: 'sms' } });
    expect(sms.body).toMatch(/^Quotation /);
    expect(sms.body).toContain('http://localhost:5400/quotation/');
  });

  it('a customer-facing message uses the Nepali template once one exists', async () => {
    const tpl = await prisma.messageTemplate.create({
      data: { key: 'quotation_sent', channel: 'sms', locale: 'ne', body: 'कोटेसन {{number}} तयार छ: {{link}}' },
    });
    try {
      const customer = expectStatus(await sales.post('/admin/customers').send({ name: 'Nepali Reader', phone: phone(), preferredLocale: 'ne' }), 201).data;
      const q = expectStatus(await sales.post('/admin/quotations').send({
        customerId: customer.id, items: [{ description: 'Nepali check', qty: 1, rate: 100 }],
      }), 201).data;
      expectStatus(await sales.post(`/admin/quotations/${q.id}/send`), 200);
      const sms = await prisma.messageLog.findFirst({ where: { relatedId: q.id, templateKey: 'quotation_sent', channel: 'sms' } });
      expect(sms.body).toContain('कोटेसन');
    } finally {
      await prisma.messageTemplate.delete({ where: { id: tpl.id } });
    }
  });

  it('a lead\'s language can be edited, and an edit that leaves it out keeps it', async () => {
    const lead = await newLead({ preferredLocale: 'ne' });
    expect(lead.preferredLocale).toBe('ne');
    expect(expectStatus(await sales.put(`/admin/leads/${lead.id}`).send({ area: 'Patan' }), 200).data.preferredLocale).toBe('ne');
    expect(expectStatus(await sales.put(`/admin/leads/${lead.id}`).send({ preferredLocale: 'en' }), 200).data.preferredLocale).toBe('en');
  });
});

describe('customers', () => {
  it('lists with type and tag filters, counts, and a balance only for finance', async () => {
    const tag = uid('vip');
    const company = expectStatus(await sales.post('/admin/customers').send({
      type: 'company', name: `Tagged Co ${uid()}`, phone: phone(), tags: [tag], panVatNo: '609876543',
    }), 201).data;
    expectStatus(await sales.post(`/admin/customers/${company.id}/sites`).send({ label: 'Office', address: 'Durbar Marg' }), 201);

    const rows = expectStatus(await sales.get(`/admin/customers?tag=${tag}`), 200).data;
    expect(rows.map((r) => r.id)).toEqual([company.id]);
    expect(rows[0]).toMatchObject({ siteCount: 1, openJobs: 0 });
    expect(rows[0]).not.toHaveProperty('balanceDue');

    const companies = expectStatus(await sales.get('/admin/customers?type=company&limit=100'), 200).data;
    expect(companies.every((r) => r.type === 'company')).toBe(true);
    expectStatus(await sales.get('/admin/customers?type=household'), 400);

    const forAccounts = expectStatus(await accountant.get(`/admin/customers?tag=${tag}`), 200).data;
    expect(forAccounts[0].balanceDue).toBe(0);
  });

  it('keeps exactly one primary site', async () => {
    const customer = await createCustomer(sales);
    const first = expectStatus(await sales.post(`/admin/customers/${customer.id}/sites`).send({ label: 'First', address: 'Baluwatar' }), 201).data;
    expect(first.isPrimary).toBe(true);
    const second = expectStatus(await sales.post(`/admin/customers/${customer.id}/sites`).send({ label: 'Second', address: 'Budhanilkantha' }), 201).data;
    expect(second.isPrimary).toBe(false);

    const primaries = async () => (await prisma.customerSite.findMany({ where: { customerId: customer.id, deletedAt: null, isPrimary: true } })).map((s) => s.id);

    expectStatus(await sales.put(`/admin/customers/${customer.id}/sites/${second.id}`).send({ isPrimary: true }), 200);
    expect(await primaries()).toEqual([second.id]);

    const refused = expectStatus(await sales.put(`/admin/customers/${customer.id}/sites/${second.id}`).send({ isPrimary: false }), 422);
    expect(refused.error.message).toMatch(/primary/);

    expectStatus(await sales.delete(`/admin/customers/${customer.id}/sites/${second.id}`), 204);
    expect(await primaries()).toEqual([first.id]);

    const third = expectStatus(await sales.post(`/admin/customers/${customer.id}/sites`).send({ label: 'Third', address: 'Kalanki', isPrimary: true }), 201).data;
    expect(await primaries()).toEqual([third.id]);
  });

  it('keeps a site with jobs, and validates site addresses', async () => {
    const customer = await createCustomer(sales);
    const site = expectStatus(await sales.post(`/admin/customers/${customer.id}/sites`).send({ label: 'Job site', address: 'Thamel' }), 201).data;
    const job = expectStatus(await dispatcher.post('/admin/jobs').send({ customerId: customer.id, siteId: site.id, title: 'Site lock' }), 201).data;
    expect(job.siteId).toBe(site.id);
    expectStatus(await sales.delete(`/admin/customers/${customer.id}/sites/${site.id}`), 400);
    expectStatus(await sales.put(`/admin/customers/${customer.id}/sites/${site.id}`).send({ lat: 200 }), 400);
    expectStatus(await sales.put(`/admin/customers/other/sites/${site.id}`).send({ label: 'x' }), 404);
  });

  it('a customer can be written in Devanagari and edited without losing it', async () => {
    const customer = expectStatus(await sales.post('/admin/customers').send({ name: 'रमेश श्रेष्ठ', phone: '01-5407720' }), 201).data;
    expect(customer.phone).toBe('01-5407720');
    const updated = expectStatus(await sales.put(`/admin/customers/${customer.id}`).send({ notes: 'बिहान फोन गर्नु' }), 200).data;
    expect(updated.name).toBe('रमेश श्रेष्ठ');
    expect(updated.notes).toBe('बिहान फोन गर्नु');
  });
});
