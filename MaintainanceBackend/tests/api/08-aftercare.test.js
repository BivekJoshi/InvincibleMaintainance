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
