import { describe, it, expect, beforeAll } from 'vitest';
import {
  as, anon, expectStatus, createCompletedJob, prisma, daysFromNow,
} from './helpers.js';

let dispatcher;
let job;
let customer;
let warranty;

beforeAll(async () => {
  dispatcher = await as('DISPATCHER');
  ({ job, customer } = await createCompletedJob());
  warranty = await prisma.warranty.findFirst({ where: { jobId: job.id } });
});

describe('warranties', () => {
  it('GET /admin/warranties, /expiring and /:id', async () => {
    expect(expectStatus(await dispatcher.get('/admin/warranties'), 200).data.length).toBeGreaterThan(0);
    expectStatus(await dispatcher.get('/admin/warranties/expiring?days=60'), 200);
    expect(expectStatus(await dispatcher.get(`/admin/warranties/${warranty.id}`), 200).data.id).toBe(warranty.id);
  });

  it('PUT /admin/warranties/:id', async () => {
    expectStatus(await dispatcher.put(`/admin/warranties/${warranty.id}`).send({ scope: 'Workmanship on the repaired wall' }), 200);
  });

  it('SALES reads warranties but cannot change one', async () => {
    const sales = await as('SALES');
    expectStatus(await sales.get('/admin/warranties'), 200);
    expectStatus(await sales.put(`/admin/warranties/${warranty.id}`).send({ scope: 'x' }), 403);
  });

  it('ACCOUNTANT is kept out of aftercare', async () => {
    expectStatus(await (await as('ACCOUNTANT')).get('/admin/warranties'), 403);
  });
});

describe('warranty claims', () => {
  let claimId;

  beforeAll(async () => {
    expectStatus(await anon().post(`/public/warranties/${warranty.publicToken}/claim`).send({
      description: 'Hairline crack has reappeared above the door.',
    }), 201);
    claimId = (await prisma.warrantyClaim.findFirst({ where: { warrantyId: warranty.id } })).id;
  });

  it('GET /admin/warranty-claims', async () => {
    expect(expectStatus(await dispatcher.get('/admin/warranty-claims'), 200).data.map((c) => c.id)).toContain(claimId);
  });

  it('PATCH /admin/warranty-claims/:id needs a reason to reject', async () => {
    expectStatus(await dispatcher.patch(`/admin/warranty-claims/${claimId}`).send({ status: 'rejected' }), 400);
  });

  it('accepting a claim creates a free WARRANTY job linked to the original', async () => {
    expectStatus(await dispatcher.patch(`/admin/warranty-claims/${claimId}`).send({
      status: 'accepted', scheduledStart: daysFromNow(1).toISOString(),
    }), 200);
    const rework = await prisma.job.findFirst({ where: { parentJobId: job.id, type: 'WARRANTY' } });
    expect(rework).toBeTruthy();
    expect(rework.isBillable).toBe(false);
  });
});

describe('AMC contracts', () => {
  let contract;

  it('POST /admin/amc-contracts lays down its visit schedule', async () => {
    contract = expectStatus(await dispatcher.post('/admin/amc-contracts').send({
      customerId: customer.id, planName: 'Test Home Care', startDate: daysFromNow(0).toISOString(),
      endDate: daysFromNow(365).toISOString(), visitsPerYear: 4, amount: 24000,
    }), 201).data;
    expect(contract.number).toMatch(/^AMC-/);
    const full = expectStatus(await dispatcher.get(`/admin/amc-contracts/${contract.id}`), 200).data;
    expect(full.visits.length).toBe(4);
    expect(full.amount).toBe(2400000);
  });

  it('refuses an end date before the start', async () => {
    expectStatus(await dispatcher.post('/admin/amc-contracts').send({
      customerId: customer.id, planName: 'Backwards', startDate: daysFromNow(10).toISOString(),
      endDate: daysFromNow(1).toISOString(), amount: 1,
    }), 400);
  });

  it('GET /admin/amc-contracts and /renewals-due', async () => {
    expectStatus(await dispatcher.get('/admin/amc-contracts'), 200);
    expectStatus(await dispatcher.get('/admin/amc-contracts/renewals-due?days=400'), 200);
  });

  it('PUT and DELETE /admin/amc-contracts/:id', async () => {
    expectStatus(await dispatcher.put(`/admin/amc-contracts/${contract.id}`).send({ notes: 'Renew in writing' }), 200);
    expectStatus(await dispatcher.delete(`/admin/amc-contracts/${contract.id}`), 204);
  });
});

describe('service reminders', () => {
  let reminderId;

  it('POST/GET/PUT/DELETE /admin/service-reminders', async () => {
    reminderId = expectStatus(await dispatcher.post('/admin/service-reminders').send({
      customerId: customer.id, jobId: job.id, dueAt: daysFromNow(180).toISOString(),
      message: 'Time for your six-month check-up.',
    }), 201).data.id;
    expect(expectStatus(await dispatcher.get('/admin/service-reminders?sort=-createdAt'), 200).data.map((r) => r.id)).toContain(reminderId);

    const moved = daysFromNow(200);
    const updated = expectStatus(await dispatcher.put(`/admin/service-reminders/${reminderId}`).send({
      dueAt: moved.toISOString(), message: 'Moved: time for your check-up.',
    }), 200).data;
    expect(new Date(updated.dueAt).getTime()).toBe(moved.getTime());
    expect(updated.channel).toBe('sms');

    expectStatus(await dispatcher.delete(`/admin/service-reminders/${reminderId}`), 204);
    expectStatus(await dispatcher.put(`/admin/service-reminders/${reminderId}`).send({ message: 'Gone already' }), 404);
  });

  it('a reminder that was already sent cannot be changed', async () => {
    const sent = await prisma.serviceReminder.create({
      data: { customerId: customer.id, dueAt: daysFromNow(-1), message: 'Already went out', status: 'sent', sentAt: new Date() },
    });
    expectStatus(await dispatcher.put(`/admin/service-reminders/${sent.id}`).send({ message: 'Too late' }), 422);
  });

  it('SALES can list reminders but not schedule one', async () => {
    const sales = await as('SALES');
    expectStatus(await sales.get('/admin/service-reminders'), 200);
    expectStatus(await sales.post('/admin/service-reminders').send({
      customerId: customer.id, dueAt: daysFromNow(10).toISOString(), message: 'Not allowed',
    }), 403);
  });
});

// ── Phase I: capabilities in place of role lists, the claims queue, void with a reason, the AMC schedule preview

describe('aftercare access by capability — the same as the role lists gave', () => {
  it('SALES and MANAGER read; DISPATCHER writes; ACCOUNTANT has none', async () => {
    const [sales, manager, accountant] = await Promise.all([as('SALES'), as('MANAGER'), as('ACCOUNTANT')]);
    for (const path of ['/admin/warranties', '/admin/warranty-claims', '/admin/amc-contracts', '/admin/service-reminders']) {
      expectStatus(await sales.get(path), 200);
      expectStatus(await manager.get(path), 200);
      expectStatus(await accountant.get(path), 403);
    }
    const body = { startDate: daysFromNow(0).toISOString(), endDate: daysFromNow(365).toISOString(), visitsPerYear: 4 };
    expectStatus(await manager.post('/admin/amc-contracts/preview').send(body), 403);
    expectStatus(await dispatcher.post('/admin/amc-contracts/preview').send(body), 200);
  });
});

describe('warranties: search, the certificate link, void with a reason (Phase I)', () => {
  let own;

  beforeAll(async () => {
    const done = await createCompletedJob();
    own = { ...(await prisma.warranty.findFirst({ where: { jobId: done.job.id } })), job: done.job, customer: done.customer };
  });

  it('found by the job number or the customer; ending soon; the certificate link', async () => {
    const byJob = expectStatus(await dispatcher.get(`/admin/warranties?q=${own.job.number}`), 200).data;
    expect(byJob.map((w) => w.id)).toEqual([own.id]);
    expect(byJob[0].publicUrl).toMatch(new RegExp(`/warranty/${own.publicToken}$`));
    const days = Math.ceil((own.endsAt - Date.now()) / 86_400_000) + 1;
    expect(expectStatus(await dispatcher.get(`/admin/warranties?expiringDays=${days}&limit=100`), 200).data.map((w) => w.id)).toContain(own.id);
  });

  it('the status is not edited by hand; voiding needs a reason and happens once', async () => {
    expectStatus(await dispatcher.put(`/admin/warranties/${own.id}`).send({ status: 'VOID' }), 400);
    expectStatus(await dispatcher.post(`/admin/warranties/${own.id}/void`).send({}), 400);
    const voided = expectStatus(await dispatcher.post(`/admin/warranties/${own.id}/void`).send({ reason: 'Customer re-plastered over the work' }), 200).data;
    expect(voided).toMatchObject({ status: 'VOID', voidReason: 'Customer re-plastered over the work' });
    expect(expectStatus(await dispatcher.post(`/admin/warranties/${own.id}/void`).send({ reason: 'Again' }), 422).error.code).toBe('UNPROCESSABLE');
    expectStatus(await dispatcher.put(`/admin/warranties/${own.id}`).send({ scope: 'x' }), 422);
    const audit = await prisma.auditLog.findFirst({ where: { event: 'warranty.voided', recordId: own.id } });
    expect(audit.changes).toMatchObject({ reason: 'Customer re-plastered over the work' });
    const trail = expectStatus(await dispatcher.get(`/admin/warranties/${own.id}/history`), 200).data;
    expect(trail.map((e) => e.event)).toContain('warranty.voided');
    expectStatus(await (await as('ACCOUNTANT')).get(`/admin/warranties/${own.id}/history`), 403);
    // The customer's certificate says so, and takes no claim.
    expectStatus(await anon().post(`/public/warranties/${own.publicToken}/claim`).send({ description: 'Damp is back on the same wall.' }), 422);
  });
});

describe('the claims queue (Phase I)', () => {
  const claimFor = async () => {
    const done = await createCompletedJob();
    const w = await prisma.warranty.findFirst({ where: { jobId: done.job.id } });
    expectStatus(await anon().post(`/public/warranties/${w.publicToken}/claim`).send({ description: 'Seepage is back below the window.' }), 201);
    return { claim: await prisma.warrantyClaim.findFirst({ where: { warrantyId: w.id } }), job: done.job };
  };

  it('open claims first, and each one readable where its notification links', async () => {
    const { claim } = await claimFor();
    const list = expectStatus(await dispatcher.get('/admin/warranty-claims?limit=100'), 200).data;
    const firstNotOpen = list.findIndex((c) => c.status !== 'open');
    const lastOpen = list.map((c) => c.status).lastIndexOf('open');
    expect(firstNotOpen === -1 || lastOpen < firstNotOpen).toBe(true);
    expect(list.map((c) => c.id)).toContain(claim.id);
    const one = expectStatus(await dispatcher.get(`/admin/warranty-claims/${claim.id}`), 200).data;
    expect(one).toMatchObject({ status: 'open', resolvedJob: null, warranty: { job: { id: expect.any(String) }, customer: { name: expect.any(String) } } });
    // The job's service, as the warranty-claims report groups it (null for this job, which came without a lead).
    expect(one.warranty.job).toHaveProperty('service', null);
    expect(one.warranty.job).not.toHaveProperty('lead');
  });

  it('two accepts at once make one free job; the second is CLAIM_DECIDED', async () => {
    const { claim, job: original } = await claimFor();
    const body = { status: 'accepted', scheduledStart: daysFromNow(2).toISOString() };
    const [a, b] = await Promise.all([
      dispatcher.patch(`/admin/warranty-claims/${claim.id}`).send(body),
      dispatcher.patch(`/admin/warranty-claims/${claim.id}`).send(body),
    ]);
    expect([a.status, b.status].sort()).toEqual([200, 422]);
    expect((a.status === 422 ? a : b).body.error.code).toBe('CLAIM_DECIDED');
    const jobs = await prisma.job.findMany({ where: { parentJobId: original.id, type: 'WARRANTY' } });
    expect(jobs).toHaveLength(1);
    expect(jobs[0]).toMatchObject({ status: 'SCHEDULED', isBillable: false });
    const accepted = (a.status === 200 ? a : b).body.data;
    expect(accepted).toMatchObject({ status: 'accepted', resolvedJob: { id: jobs[0].id, number: jobs[0].number } });
    // The free job is numbered, evented and audited like any other, and unassigned — dispatch's to plan.
    expect(await prisma.auditLog.findFirst({ where: { event: 'job.created', recordId: jobs[0].id } })).toBeTruthy();
    expect(await prisma.jobAssignment.count({ where: { jobId: jobs[0].id } })).toBe(0);
    expect(await prisma.auditLog.findFirst({ where: { event: 'warranty.claim_decided', recordId: claim.id } })).toBeTruthy();

    // Accepted, it can only be resolved.
    expect(expectStatus(await dispatcher.patch(`/admin/warranty-claims/${claim.id}`).send({ status: 'rejected', rejectReason: 'Too late' }), 422).error.code).toBe('CLAIM_DECIDED');
    expect(expectStatus(await dispatcher.patch(`/admin/warranty-claims/${claim.id}`).send({ status: 'resolved' }), 200).data.status).toBe('resolved');
  });

  it('SALES reads the queue and decides nothing', async () => {
    const { claim } = await claimFor();
    const sales = await as('SALES');
    expectStatus(await sales.get(`/admin/warranty-claims/${claim.id}`), 200);
    expectStatus(await sales.patch(`/admin/warranty-claims/${claim.id}`).send({ status: 'resolved' }), 403);
  });
});

describe('AMC: the schedule is previewed before it is saved (Phase I)', () => {
  it('the preview is exactly what create lays down; the schedule is not edited afterwards', async () => {
    const body = { startDate: daysFromNow(1).toISOString(), endDate: daysFromNow(366).toISOString(), visitsPerYear: 3 };
    const preview = expectStatus(await dispatcher.post('/admin/amc-contracts/preview').send(body), 200).data;
    expect(preview).toMatchObject({ totalVisits: 3, intervalDays: 121 });
    const made = expectStatus(await dispatcher.post('/admin/amc-contracts').send({
      ...body, customerId: customer.id, planName: 'Monsoon care', amount: 18_000.5, coveredServices: ['Seepage check', 'Roof drains'],
    }), 201).data;
    expect(made.amount).toBe(1_800_050);
    expect(made.visits.map((v) => v.dueDate)).toEqual(preview.visits.map((v) => v.dueDate));
    expect(made.visits[0]).toMatchObject({ status: 'pending', job: null });

    expectStatus(await dispatcher.put(`/admin/amc-contracts/${made.id}`).send({ visitsPerYear: 12 }), 400);
    expect(expectStatus(await dispatcher.put(`/admin/amc-contracts/${made.id}`).send({ amount: 20_000, notes: 'Price agreed on the phone' }), 200).data.amount).toBe(2_000_000);
    expectStatus(await dispatcher.get(`/admin/amc-contracts/${made.id}/history`), 200);
    expectStatus(await dispatcher.post('/admin/amc-contracts/preview').send({ ...body, endDate: body.startDate }), 400);
    expectStatus(await dispatcher.post('/admin/amc-contracts/preview').send({ ...body, endDate: daysFromNow(3000).toISOString() }), 400);
  });

  it('renewals due within N days, and search', async () => {
    const soon = expectStatus(await dispatcher.post('/admin/amc-contracts').send({
      customerId: customer.id, planName: `Ending soon ${Date.now()}`, amount: 5000,
      startDate: daysFromNow(-300).toISOString(), endDate: daysFromNow(20).toISOString(), visitsPerYear: 2,
    }), 201).data;
    expect(expectStatus(await dispatcher.get('/admin/amc-contracts?renewalsDays=30&limit=100'), 200).data.map((c) => c.id)).toContain(soon.id);
    expect(expectStatus(await dispatcher.get('/admin/amc-contracts?renewalsDays=10&limit=100'), 200).data.map((c) => c.id)).not.toContain(soon.id);
    expect(expectStatus(await dispatcher.get(`/admin/amc-contracts?q=${soon.number}`), 200).data.map((c) => c.id)).toEqual([soon.id]);
  });
});

describe('service reminders: status, search, and history kept (Phase I)', () => {
  it('filtered by status; a sent reminder cannot be deleted; a customer without email is skipped, not sent', async () => {
    const sent = await prisma.serviceReminder.create({
      data: { customerId: customer.id, dueAt: daysFromNow(-2), message: 'Went out already', status: 'sent', sentAt: new Date() },
    });
    expectStatus(await dispatcher.delete(`/admin/service-reminders/${sent.id}`), 422);
    const rows = expectStatus(await dispatcher.get(`/admin/service-reminders?status=sent&customerId=${customer.id}`), 200).data;
    expect(rows.every((r) => r.status === 'sent')).toBe(true);
    expect(rows.map((r) => r.id)).toContain(sent.id);
    expectStatus(await dispatcher.get('/admin/service-reminders?status=lost'), 400);

    const { dispatchReminders } = await import('../../src/services/warranty.service.js');
    await prisma.customer.update({ where: { id: customer.id }, data: { email: null } });
    const byEmail = await prisma.serviceReminder.create({
      data: { customerId: customer.id, dueAt: daysFromNow(-1), channel: 'email', message: 'Your yearly check-up is due.' },
    });
    const bySms = await prisma.serviceReminder.create({
      data: { customerId: customer.id, dueAt: daysFromNow(-1), channel: 'sms', message: 'तपाईंको वार्षिक जाँच आउँदैछ।' },
    });
    await dispatchReminders();
    expect((await prisma.serviceReminder.findUnique({ where: { id: byEmail.id } })).status).toBe('skipped');
    expect(await prisma.serviceReminder.findUnique({ where: { id: bySms.id } })).toMatchObject({ status: 'sent', sentAt: expect.any(Date) });
    // The staff-written text is what the customer gets.
    const log = await prisma.messageLog.findFirst({ where: { relatedModel: 'ServiceReminder', relatedId: bySms.id } });
    expect(log.body).toBe('तपाईंको वार्षिक जाँच आउँदैछ।');
  });
});
