import { describe, it, expect, beforeAll } from 'vitest';
import {
  as, expectStatus, createAssignedJob, createCustomer, findKeys, runningBoqJob, technicianIdFor, prisma, uid, phone, PASSWORD,
} from './helpers.js';
import { local } from '../../src/utils/dates.js';
import { stockBalances } from '../../src/services/material.service.js';

/**
 * Phase H1 — what the operations screens need from the API: paginated technicians behind a
 * service (D5), one-step scheduling with warnings and a customer SMS in their language, the
 * paged unassigned queue, the board's shape, the jobs list presets, registry endpoints for
 * materials and templates, and paged stock.
 */

let dispatcher;
let admin;
let sales;

beforeAll(async () => {
  [dispatcher, admin, sales] = await Promise.all([as('DISPATCHER'), as('ADMIN'), as('SALES')]);
});

/** Kathmandu's calendar day `n` days from now, `YYYY-MM-DD`. */
const ktmDay = (n = 0) => new Date(Date.now() + n * 86_400_000 + (5 * 60 + 45) * 60_000).toISOString().slice(0, 10);
/** An instant on a Kathmandu day at a Kathmandu time. */
const at = (day, hhmm) => new Date(`${day}T${hhmm}:00+05:45`).toISOString();

async function draftJob({ locale = 'en', priority = 'NORMAL', customer } = {}) {
  const owner = customer ?? expectStatus(await sales.post('/admin/customers').send({
    name: `राम बहादुर ${uid()}`, phone: phone(), preferredLocale: locale,
  }), 201).data;
  const job = expectStatus(await dispatcher.post('/admin/jobs').send({
    customerId: owner.id, title: `Seepage repair ${uid()}`, priority,
  }), 201).data;
  return { job, customer: owner };
}

/** A new field technician of our own, so capacity and clashes are not disturbed by the seed. */
async function freshTechnician(dailyCapacity = 2) {
  const user = expectStatus(await admin.post('/admin/users').send({
    name: `Test Tech ${uid()}`, email: `${uid('tech')}@example.com`, phone: phone(), password: PASSWORD, role: 'TECHNICIAN',
  }), 201).data;
  expectStatus(await dispatcher.put(`/admin/technicians/${user.technician.id}`).send({ dailyCapacity }), 200);
  return user.technician.id;
}

describe('technicians (technician.service, D5)', () => {
  it('pages the list and says how long it is', async () => {
    const first = expectStatus(await dispatcher.get('/admin/technicians?limit=2'), 200);
    expect(first.data).toHaveLength(2);
    expect(first.meta).toMatchObject({ page: 1, limit: 2 });
    expect(first.meta.total).toBeGreaterThanOrEqual(3);
    const second = expectStatus(await dispatcher.get('/admin/technicians?limit=2&page=2'), 200);
    expect(second.data.map((t) => t.id)).not.toContain(first.data[0].id);
    for (const row of first.data) {
      expect(row.loadThisWeek).toBeTypeOf('number');
      expect(row.hourlyRate).toBeUndefined();
    }
  });

  it('searches by name, filters by role and availability, and validates the sort', async () => {
    const hari = await technicianIdFor('TECHNICIAN');
    const found = expectStatus(await dispatcher.get('/admin/technicians?q=hari'), 200).data;
    expect(found.map((t) => t.id)).toContain(hari);
    const surveyors = expectStatus(await dispatcher.get('/admin/technicians?role=SURVEYOR&sort=-name'), 200).data;
    expect(surveyors.length).toBeGreaterThan(0);
    expect(surveyors.every((t) => t.user.role === 'SURVEYOR')).toBe(true);
    // 'false' means false — z.coerce.boolean() used to read it as true.
    const away = expectStatus(await dispatcher.get('/admin/technicians?available=false'), 200).data;
    expect(away.every((t) => t.isAvailable === false)).toBe(true);
    expectStatus(await dispatcher.get('/admin/technicians?sort=hourlyRate'), 400);
  });

  it('filters by skill and service area', async () => {
    const id = await freshTechnician();
    const skill = `skill-${uid()}`;
    // A Devanagari area of this run's own: on a reused test database, every earlier run's technicians are in
    // plain "ललितपुर" too, and the new one fell off the first page.
    const area = `ललितपुर ${uid()}`;
    expectStatus(await dispatcher.put(`/admin/technicians/${id}`).send({ skills: [skill], serviceAreas: [area] }), 200);
    expect(expectStatus(await dispatcher.get(`/admin/technicians?skill=${skill}`), 200).data.map((t) => t.id)).toEqual([id]);
    const byArea = expectStatus(await dispatcher.get(`/admin/technicians?area=${encodeURIComponent(area)}`), 200).data;
    expect(byArea.map((t) => t.id)).toEqual([id]);
  });

  it('switches availability, trashes and restores, and keeps the person fixed', async () => {
    const id = await freshTechnician();
    const before = expectStatus(await dispatcher.get(`/admin/technicians/${id}`), 200).data;
    const toggled = expectStatus(await dispatcher.patch(`/admin/technicians/${id}/toggle`), 200).data;
    expect(toggled.isAvailable).toBe(!before.isAvailable);

    const other = await technicianIdFor('TECHNICIAN2');
    const otherUser = (await prisma.technician.findUnique({ where: { id: other } })).userId;
    const kept = expectStatus(await dispatcher.put(`/admin/technicians/${id}`).send({ userId: otherUser, hourlyRate: 512.5 }), 200).data;
    expect(kept.userId).toBe(before.userId);
    expect(kept.hourlyRate).toBe(51250);

    expectStatus(await dispatcher.delete(`/admin/technicians/${id}`), 204);
    const trash = expectStatus(await dispatcher.get('/admin/technicians?deleted=true&limit=100'), 200).data;
    expect(trash.map((t) => t.id)).toContain(id);
    expectStatus(await dispatcher.post('/admin/technicians').send({ userId: before.userId }), 409);
    expectStatus(await dispatcher.delete(`/admin/technicians/${id}?hard=true`), 403);
    expect(expectStatus(await dispatcher.patch(`/admin/technicians/${id}/restore`), 200).data.id).toBe(id);
    expect(await prisma.auditLog.findFirst({ where: { model: 'Technician', recordId: id, event: 'cms.restored' } })).toBeTruthy();
  });

  it('shows the rate and the trail only to the roles that set the rate', async () => {
    const id = await technicianIdFor('TECHNICIAN');
    expect(expectStatus(await sales.get(`/admin/technicians/${id}`), 200).data.hourlyRate).toBeUndefined();
    expect(expectStatus(await dispatcher.get(`/admin/technicians/${id}`), 200).data).toHaveProperty('hourlyRate');
    expectStatus(await dispatcher.get(`/admin/technicians/${id}/history`), 200);
    expectStatus(await sales.get(`/admin/technicians/${id}/history`), 403);
    expectStatus(await sales.patch(`/admin/technicians/${id}/toggle`), 403);
  });

  it('lists the people a new profile can be for', async () => {
    const hariUser = (await prisma.technician.findUnique({ where: { id: await technicianIdFor('TECHNICIAN') } })).userId;
    const body = expectStatus(await dispatcher.get('/admin/technicians/users?limit=100'), 200);
    expect(body.meta.total).toBeGreaterThan(0);
    expect(body.data.map((u) => u.id)).not.toContain(hariUser);
    expect(body.data[0].label).toMatch(/ · /);
    const salesUser = body.data.find((u) => u.role === 'SALES');
    expect(expectStatus(await dispatcher.get(`/admin/technicians/users/${salesUser.id}`), 200).data.id).toBe(salesUser.id);
    expectStatus(await sales.get('/admin/technicians/users'), 403);
  });
});

describe('scheduling (POST /admin/jobs/:id/schedule)', () => {
  const day = ktmDay(3);

  it('puts a draft on the calendar, records it and tells the customer in their language', async () => {
    const { job, customer } = await draftJob({ locale: 'ne' });
    const res = await dispatcher.post(`/admin/jobs/${job.id}/schedule`).set('X-Request-Id', `sched-${uid()}`)
      .send({ scheduledStart: at(day, '10:00'), scheduledEnd: at(day, '12:00') });
    const body = expectStatus(res, 200);
    expect(body.data.status).toBe('SCHEDULED');
    expect(body.meta.warnings).toEqual([]);

    const event = await prisma.auditLog.findFirst({ where: { event: 'job.scheduled', recordId: job.id } });
    expect(event?.requestId).toMatch(/^sched-/);
    expect(event.after.status).toBe('SCHEDULED');
    const sms = await prisma.messageLog.findFirst({ where: { relatedId: job.id, templateKey: 'job_scheduled' } });
    expect(sms.body).toContain('समय मिलाइएको');
    expect(sms.body).toContain(customer.name);
    expect(sms.body).toContain('10:00–12:00');
    const timeline = expectStatus(await dispatcher.get(`/admin/jobs/${job.id}`), 200).data.events;
    expect(timeline[0]).toMatchObject({ from: 'DRAFT', to: 'SCHEDULED' });
  });

  it('assigns and schedules in one step, and warns about a double booking', async () => {
    const tech = await freshTechnician(4);
    const { job: first } = await draftJob();
    const one = expectStatus(await dispatcher.post(`/admin/jobs/${first.id}/schedule`).send({
      scheduledStart: at(day, '09:00'), scheduledEnd: at(day, '11:00'), technicianIds: [tech],
    }), 200);
    expect(one.data.status).toBe('ASSIGNED');
    expect(one.data.assignments).toHaveLength(1);
    expect(one.data.assignments[0].isLead).toBe(true);

    const { job: second } = await draftJob();
    const two = expectStatus(await dispatcher.post(`/admin/jobs/${second.id}/schedule`).send({
      scheduledStart: at(day, '10:30'), scheduledEnd: at(day, '12:00'), technicianIds: [tech],
    }), 200);
    expect(two.meta.warnings).toEqual([
      expect.objectContaining({ kind: 'conflict', technicianId: tech, with: first.number, day }),
    ]);

    // Moving it clear of the first clears the warning.
    const moved = expectStatus(await dispatcher.post(`/admin/jobs/${second.id}/schedule`).send({
      scheduledStart: at(day, '13:00'), scheduledEnd: at(day, '15:00'),
    }), 200);
    expect(moved.meta.warnings).toEqual([]);
    expect(moved.data.status).toBe('ASSIGNED');
  });

  it('warns when a day goes past the technician’s capacity', async () => {
    const tech = await freshTechnician(1);
    const { job: a } = await draftJob();
    const { job: b } = await draftJob();
    expectStatus(await dispatcher.post(`/admin/jobs/${a.id}/schedule`).send({
      scheduledStart: at(day, '08:00'), scheduledEnd: at(day, '09:00'), technicianIds: [tech],
    }), 200);
    const res = expectStatus(await dispatcher.post(`/admin/jobs/${b.id}/schedule`).send({
      scheduledStart: at(day, '15:00'), scheduledEnd: at(day, '16:00'), technicianIds: [tech],
    }), 200);
    expect(res.meta.warnings).toEqual([expect.objectContaining({ kind: 'capacity', day, load: 2, capacity: 1 })]);
  });

  it('refuses a bad window, a lead who is not on the job, and work under way', async () => {
    const { job } = await draftJob();
    const hari = await technicianIdFor('TECHNICIAN');
    const suresh = await technicianIdFor('TECHNICIAN2');
    expectStatus(await dispatcher.post(`/admin/jobs/${job.id}/schedule`).send({
      scheduledStart: at(day, '12:00'), scheduledEnd: at(day, '11:00'),
    }), 400);
    expectStatus(await dispatcher.post(`/admin/jobs/${job.id}/schedule`).send({
      scheduledStart: at(day, '10:00'), scheduledEnd: at(day, '11:00'), technicianIds: [hari], leadTechnicianId: suresh,
    }), 400);
    expectStatus(await dispatcher.post(`/admin/jobs/${job.id}/schedule`).send({
      scheduledStart: at(day, '10:00'), scheduledEnd: at(day, '11:00'), technicianIds: [],
    }), 400);
    expectStatus(await sales.post(`/admin/jobs/${job.id}/schedule`).send({
      scheduledStart: at(day, '10:00'), scheduledEnd: at(day, '11:00'),
    }), 403);

    expectStatus(await dispatcher.post(`/admin/jobs/${job.id}/schedule`).send({
      scheduledStart: at(day, '10:00'), scheduledEnd: at(day, '11:00'), technicianIds: [hari],
    }), 200);
    expectStatus(await dispatcher.patch(`/admin/jobs/${job.id}/status`).send({ status: 'IN_PROGRESS' }), 200);
    const refused = expectStatus(await dispatcher.post(`/admin/jobs/${job.id}/schedule`).send({
      scheduledStart: at(day, '14:00'), scheduledEnd: at(day, '15:00'),
    }), 422);
    expect(refused.error.message).toMatch(/in progress/);
  });

  it('brings a held job back to SCHEDULED, and stays quiet when asked to', async () => {
    const { job } = await draftJob();
    const hari = await technicianIdFor('TECHNICIAN');
    expectStatus(await dispatcher.post(`/admin/jobs/${job.id}/schedule`).send({
      scheduledStart: at(day, '10:00'), scheduledEnd: at(day, '11:00'), technicianIds: [hari],
    }), 200);
    expectStatus(await dispatcher.patch(`/admin/jobs/${job.id}/status`).send({ status: 'EN_ROUTE' }), 200);
    expectStatus(await dispatcher.patch(`/admin/jobs/${job.id}/status`).send({ status: 'ON_HOLD', note: 'Customer away' }), 200);
    const before = await prisma.messageLog.count({ where: { relatedId: job.id, templateKey: 'job_scheduled' } });
    const back = expectStatus(await dispatcher.post(`/admin/jobs/${job.id}/schedule`).send({
      scheduledStart: at(ktmDay(4), '10:00'), scheduledEnd: at(ktmDay(4), '11:00'), notifyCustomer: false,
    }), 200).data;
    expect(back.status).toBe('SCHEDULED');
    expect(back.holdReason).toBeNull();
    expect(await prisma.messageLog.count({ where: { relatedId: job.id, templateKey: 'job_scheduled' } })).toBe(before);
  });
});

describe('dispatch', () => {
  it('pages the unassigned queue, most urgent first', async () => {
    const { job: urgent } = await draftJob({ priority: 'URGENT' });
    const body = expectStatus(await dispatcher.get('/admin/dispatch/unassigned?limit=1'), 200);
    expect(body.data).toHaveLength(1);
    expect(body.meta.limit).toBe(1);
    expect(body.meta.total).toBeGreaterThanOrEqual(1);
    expect(body.data[0].priority).toBe('URGENT');
    const found = expectStatus(await dispatcher.get(`/admin/dispatch/unassigned?q=${urgent.number}`), 200).data;
    expect(found.map((j) => j.id)).toEqual([urgent.id]);
    expect(found[0]).toMatchObject({ customer: expect.any(Object), assignments: [] });
    expectStatus(await dispatcher.get('/admin/dispatch/unassigned?sort=title'), 400);
    expectStatus(await sales.get('/admin/dispatch/unassigned'), 403);
  });

  it('draws the board: days, hours, lanes with their load and warnings', async () => {
    const day = ktmDay(5);
    const tech = await freshTechnician(1);
    const { job } = await draftJob();
    const { job: other } = await draftJob();
    for (const j of [job, other]) {
      expectStatus(await dispatcher.post(`/admin/jobs/${j.id}/schedule`).send({
        scheduledStart: at(day, '10:00'), scheduledEnd: at(day, '12:00'), technicianIds: [tech],
      }), 200);
    }
    const board = expectStatus(await dispatcher.get(`/admin/dispatch/board?date=${day}&view=week`), 200).data;
    expect(board.days).toHaveLength(7);
    expect(board.days[0]).toBe(day);
    expect(board.hours).toEqual({ start: 8, end: 18 });
    expect(board.unassignedCount).toBeTypeOf('number');
    const lane = board.lanes.find((l) => l.technician.id === tech);
    expect(lane.jobs.map((j) => j.id).sort()).toEqual([job.id, other.id].sort());
    expect(lane.loadByDay[day]).toBe(2);
    expect(lane.overCapacityDays).toEqual([day]);
    expect(lane.conflicts).toEqual([expect.objectContaining({ day })]);
    expect(lane.technician).toMatchObject({ dailyCapacity: 1, skills: [], serviceAreas: [] });
    expect(lane.technician.hourlyRate).toBeUndefined();

    const dayView = expectStatus(await dispatcher.get(`/admin/dispatch/board?date=${ktmDay(6)}`), 200).data;
    expect(dayView.days).toEqual([ktmDay(6)]);
    expect(dayView.lanes.find((l) => l.technician.id === tech).jobs).toEqual([]);
    expectStatus(await dispatcher.get('/admin/dispatch/board?date=tomorrow'), 400);
  });
});

describe('jobs list presets', () => {
  it('reads from / to as Kathmandu days', async () => {
    const { job } = await draftJob();
    const today = ktmDay(0);
    // 00:30 in Kathmandu is still the previous day in UTC.
    expectStatus(await dispatcher.post(`/admin/jobs/${job.id}/schedule`).send({
      scheduledStart: at(today, '00:30'), scheduledEnd: at(today, '01:30'), notifyCustomer: false,
    }), 200);
    const rows = expectStatus(await dispatcher.get(`/admin/jobs?from=${today}&to=${today}&limit=100&q=${job.number}`), 200).data;
    expect(rows.map((j) => j.id)).toEqual([job.id]);
    const yesterday = expectStatus(await dispatcher.get(`/admin/jobs?from=${ktmDay(-1)}&to=${ktmDay(-1)}&q=${job.number}`), 200).data;
    expect(yesterday).toEqual([]);
  });

  it('finds finished work not yet invoiced', async () => {
    const hari = await technicianIdFor('TECHNICIAN');
    const { job } = await draftJob();
    expectStatus(await dispatcher.post(`/admin/jobs/${job.id}/assign`).send({ technicianIds: [hari] }), 200);
    expectStatus(await dispatcher.patch(`/admin/jobs/${job.id}/status`).send({ status: 'IN_PROGRESS' }), 200);
    expectStatus(await dispatcher.post(`/admin/jobs/${job.id}/complete`).send({ note: 'Done' }), 200);

    const open = expectStatus(await dispatcher.get('/admin/jobs?invoiced=false&limit=100'), 200).data;
    expect(open.map((j) => j.id)).toContain(job.id);
    expect(open.every((j) => ['COMPLETED', 'VERIFIED'].includes(j.status) && j.isBillable && !j.invoicedAt)).toBe(true);
    const completed = expectStatus(await dispatcher.get('/admin/jobs?invoiced=false&status=COMPLETED&limit=100'), 200).data;
    expect(completed.every((j) => j.status === 'COMPLETED')).toBe(true);

    await prisma.job.update({ where: { id: job.id }, data: { invoicedAt: new Date() } });
    const after = expectStatus(await dispatcher.get(`/admin/jobs?invoiced=false&q=${job.number}`), 200).data;
    expect(after).toEqual([]);
  });

  it('treats unassigned=false as false and refuses an unknown sort', async () => {
    const hari = await technicianIdFor('TECHNICIAN');
    const all = expectStatus(await dispatcher.get(`/admin/jobs?technicianId=${hari}&unassigned=false&limit=1`), 200);
    expect(all.meta.total).toBeGreaterThan(0);
    expectStatus(await dispatcher.get('/admin/jobs?sort=customer'), 400);
    expectStatus(await dispatcher.get('/admin/jobs?from=yesterday'), 400);
  });

  it('carries the source links on the detail', async () => {
    const { job } = await draftJob();
    const full = expectStatus(await dispatcher.get(`/admin/jobs/${job.id}`), 200).data;
    for (const key of ['survey', 'project', 'parentJob', 'createdBy', 'quotation', 'lead']) expect(full).toHaveProperty(key);
    expect(full.createdBy.name).toBeTruthy();
  });
});

describe('job costing', () => {
  it('adds up to the paisa: labour + materials, each line rounded once', async () => {
    const tech = await freshTechnician(4);
    expectStatus(await dispatcher.put(`/admin/technicians/${tech}`).send({ hourlyRate: 333.33 }), 200);
    const material = expectStatus(await dispatcher.post('/admin/materials').send({
      code: uid('CST-').toUpperCase(), name: 'Crystalline slurry', unit: 'kg', purchaseRate: 12.345, sellRate: 20.01,
    }), 201).data;
    const { job } = await draftJob();
    expectStatus(await dispatcher.post(`/admin/jobs/${job.id}/assign`).send({ technicianIds: [tech] }), 200);
    expectStatus(await dispatcher.post(`/admin/jobs/${job.id}/materials`).send({ materialId: material.id, qty: 22 }), 201);
    expectStatus(await dispatcher.post(`/admin/jobs/${job.id}/materials`).send({ materialId: material.id, qty: 1.5, isBillable: false }), 201);
    expectStatus(await dispatcher.post(`/admin/jobs/${job.id}/time-logs`).send({
      technicianId: tech, startedAt: new Date().toISOString(), minutes: 50,
    }), 201);

    // Costing is costs:read since Phase L2 — a manager's view, not the dispatcher's.
    const c = expectStatus(await (await as('MANAGER')).get(`/admin/jobs/${job.id}/costing`), 200).data;
    // 12.345 rupees is stored as 1235 paisa (toPaisa rounds): 22 × 1235 = 27170, 1.5 × 1235 = 1852.5 → 1853.
    expect(c.breakdown.materials.map((m) => m.cost)).toEqual([27170, 1853]);
    expect(c.cost.materials).toBe(27170 + 1853);
    // 20.01 → 2001 paisa, billed only on the first line: 22 × 2001 = 44022.
    expect(c.billable.materials).toBe(44022);
    // 50 min at 33333 paisa an hour = 27777.5 → 27778.
    expect(c.breakdown.labour).toEqual([expect.objectContaining({ minutes: 50, cost: 27778 })]);
    expect(c.cost.labour).toBe(27778);
    expect(c.cost.total).toBe(c.cost.materials + c.cost.labour + c.cost.expenses);
    expect(c.margin).toBe(0 - c.cost.total);
  });
});

describe('registry endpoints for operations', () => {
  it('materials: toggle, trash, restore and history', async () => {
    const material = expectStatus(await dispatcher.post('/admin/materials').send({
      code: uid('MAT-').toUpperCase(), name: 'वाटरप्रुफ सिलेन्ट', unit: 'litre', purchaseRate: 1234.56, sellRate: 1500,
    }), 201).data;
    expect(material.purchaseRate).toBe(123456);
    expect(expectStatus(await dispatcher.patch(`/admin/materials/${material.id}/toggle`), 200).data.isActive).toBe(false);
    expectStatus(await dispatcher.delete(`/admin/materials/${material.id}`), 204);
    expectStatus(await dispatcher.patch(`/admin/materials/${material.id}/restore`), 200);
    const history = expectStatus(await dispatcher.get(`/admin/materials/${material.id}/history`), 200);
    expect(history.data.map((e) => e.event)).toContain('cms.restored');
    expectStatus(await dispatcher.delete(`/admin/materials/${material.id}?hard=true`), 403);
    expectStatus(await (await as('ACCOUNTANT')).get(`/admin/materials/${material.id}/history`), 403);
  });

  it('suppliers, categories and job templates answer the same calls', async () => {
    const supplier = expectStatus(await dispatcher.post('/admin/suppliers').send({ name: `Supplier ${uid()}` }), 201).data;
    expectStatus(await dispatcher.patch(`/admin/suppliers/${supplier.id}/toggle`), 200);
    expectStatus(await dispatcher.get(`/admin/suppliers/${supplier.id}/history`), 200);
    const category = expectStatus(await dispatcher.post('/admin/material-categories').send({ name: `Category ${uid()}` }), 201).data;
    expectStatus(await dispatcher.patch(`/admin/material-categories/${category.id}/toggle`), 200);

    const service = await prisma.service.findFirst({ where: { deletedAt: null } });
    const template = expectStatus(await dispatcher.post('/admin/job-templates').send({
      name: `Template ${uid()}`, serviceId: service.id, tasks: [{ title: 'Inspect', description: 'Moisture readings' }],
    }), 201).data;
    expect(template.service.id).toBe(service.id);
    const filtered = expectStatus(await dispatcher.get(`/admin/job-templates?serviceId=${service.id}&limit=100`), 200).data;
    expect(filtered.map((t) => t.id)).toContain(template.id);
    expect(expectStatus(await dispatcher.patch(`/admin/job-templates/${template.id}/toggle`), 200).data.isActive).toBe(false);
    expectStatus(await dispatcher.get(`/admin/job-templates/${template.id}/history`), 200);
    expectStatus(await sales.patch(`/admin/job-templates/${template.id}/toggle`), 403);
  });
});

describe('stock', () => {
  let material;

  beforeAll(async () => {
    material = expectStatus(await dispatcher.post('/admin/materials').send({
      code: uid('STK-').toUpperCase(), name: `Cement ${uid()}`, unit: 'kg', purchaseRate: 18.5, sellRate: 22, reorderLevel: 10,
    }), 201).data;
  });

  it('pages the stock list and counts what is low', async () => {
    const body = expectStatus(await dispatcher.get('/admin/stock?limit=2'), 200);
    expect(body.data.length).toBeLessThanOrEqual(2);
    expect(body.meta).toMatchObject({ page: 1, limit: 2 });
    expect(body.meta.lowCount).toBeTypeOf('number');
    // No movements yet: 0 ≤ 10 is low.
    const low = expectStatus(await dispatcher.get('/admin/stock?lowOnly=true&limit=100'), 200).data;
    expect(low.map((r) => r.id)).toContain(material.id);
    expect(low.every((r) => r.isLow)).toBe(true);
    expectStatus(await dispatcher.get('/admin/stock?sort=-balance'), 200);
    expectStatus(await dispatcher.get('/admin/stock?sort=stockValue'), 400);
  });

  it('a purchase and a wastage move the balance; issuing to a job is the job’s business', async () => {
    expectStatus(await dispatcher.post('/admin/stock/movements').send({
      materialId: material.id, type: 'PURCHASE', qty: 50, rate: 18.5, reference: 'Bill 2083-114',
    }), 201);
    expectStatus(await dispatcher.post('/admin/stock/movements').send({
      materialId: material.id, type: 'WASTAGE', qty: 22, note: 'बोरा भिज्यो',
    }), 201);
    const refused = expectStatus(await dispatcher.post('/admin/stock/movements').send({
      materialId: material.id, type: 'ISSUE_TO_JOB', qty: 1,
    }), 400);
    expect(JSON.stringify(refused.error.details)).toMatch(/from the job/);

    const row = expectStatus(await dispatcher.get(`/admin/stock?q=${material.code}`), 200).data[0];
    expect(row.balance).toBe(28);
    expect(row.stockValue).toBe(28 * 1850);
    expect(row.isLow).toBe(false);
  });

  it('pages the movements with who recorded them', async () => {
    const body = expectStatus(await dispatcher.get(`/admin/stock/movements?materialId=${material.id}&limit=1`), 200);
    expect(body.data).toHaveLength(1);
    expect(body.meta.total).toBe(2);
    expect(body.data[0]).toMatchObject({ type: 'WASTAGE', qty: -22, actor: { name: expect.any(String) }, job: null });
    const purchases = expectStatus(await dispatcher.get(`/admin/stock/movements?materialId=${material.id}&type=PURCHASE`), 200).data;
    expect(purchases.map((m) => m.reference)).toEqual(['Bill 2083-114']);
    const today = expectStatus(await dispatcher.get(`/admin/stock/movements?materialId=${material.id}&from=${ktmDay(0)}&to=${ktmDay(0)}`), 200);
    expect(today.meta.total).toBe(2);
  });

  it('names the job an issue went to', async () => {
    const hari = await technicianIdFor('TECHNICIAN');
    const customer = await createCustomer(sales);
    const job = expectStatus(await dispatcher.post('/admin/jobs').send({
      customerId: customer.id, title: `Stock job ${uid()}`, technicianIds: [hari],
    }), 201).data;
    expectStatus(await dispatcher.post(`/admin/jobs/${job.id}/materials`).send({ materialId: material.id, qty: 22 }), 201);
    const issued = expectStatus(await dispatcher.get(`/admin/stock/movements?jobId=${job.id}`), 200).data;
    expect(issued[0]).toMatchObject({ type: 'ISSUE_TO_JOB', qty: -22, job: { number: job.number } });
    const row = expectStatus(await dispatcher.get(`/admin/stock?q=${material.code}`), 200).data[0];
    expect(row.balance).toBe(6);
    expect(row.isLow).toBe(true);
  });

  it('shows the dispatcher how many materials are low', async () => {
    const cards = expectStatus(await dispatcher.get('/admin/dashboard'), 200).data.cards;
    expect(cards.stockLow).toBeGreaterThanOrEqual(1);
    expect(expectStatus(await sales.get('/admin/dashboard'), 200).data.cards).not.toHaveProperty('stockLow');
  });
});

// ── Phase L7: planned vs actual, OVER_PLAN, purchase lists

describe('planned vs actual, and OVER_PLAN (Phase L7)', () => {
  let job;
  let cryst;

  beforeAll(async () => {
    ({ job } = await runningBoqJob());
    cryst = await prisma.material.findUnique({ where: { code: 'WP-CRYST' } });
  });

  it('issuing more than planned warns in meta.warnings — and still issues', async () => {
    const planned = job.requirements.find((r) => r.materialId === cryst.id).qty;
    const within = expectStatus(await dispatcher.post(`/admin/jobs/${job.id}/materials`).send({ materialId: cryst.id, qty: planned - 1 }), 201);
    expect(within.meta).toBeUndefined();
    const over = expectStatus(await dispatcher.post(`/admin/jobs/${job.id}/materials`).send({ materialId: cryst.id, qty: 2 }), 201);
    expect(over.data).toMatchObject({ materialId: cryst.id, qty: 2 });
    expect(over.meta.warnings).toEqual([{ code: 'OVER_PLAN', materialId: cryst.id, name: cryst.name, unit: cryst.unit, planned, issued: planned + 1 }]);
    // A material the plan never had is over plan too; a job with no plan never warns.
    const other = await prisma.material.findFirst({ where: { deletedAt: null, isActive: true, id: { notIn: job.requirements.map((r) => r.materialId).filter(Boolean) } } });
    expect(expectStatus(await dispatcher.post(`/admin/jobs/${job.id}/materials`).send({ materialId: other.id, qty: 1 }), 201).meta.warnings[0]).toMatchObject({ code: 'OVER_PLAN', planned: 0, issued: 1 });
    const { job: plain } = await createAssignedJob();
    expect(expectStatus(await dispatcher.post(`/admin/jobs/${plain.id}/materials`).send({ materialId: cryst.id, qty: 50 }), 201).meta).toBeUndefined();
  });

  it('planned vs issued vs logged, per material and per trade — a rain half-day counts half', async () => {
    const tech = await as('TECHNICIAN');
    const labour = job.requirements.find((r) => r.kind === 'LABOUR');
    const day = (n) => local(new Date(Date.now() - n * 86_400_000), 'YYYY-MM-DD');
    const base = { progress: [], photoMediaIds: [], headcount: [{ tradeId: labour.tradeId, count: 4 }] };
    expectStatus(await tech.put(`/tech/jobs/${job.id}/diary/${day(1)}`).send({ ...base, received: [{ materialId: cryst.id, description: cryst.name, qty: 5, challanNo: 'CH-1' }] }), 200);
    expectStatus(await tech.put(`/tech/jobs/${job.id}/diary/${day(0)}`).send({ ...base, lostHours: 4, lostReason: 'RAIN', received: [] }), 200);

    const body = expectStatus(await dispatcher.get(`/admin/jobs/${job.id}/planned-vs-actual`), 200).data;
    const row = body.materials.find((m) => m.materialId === cryst.id);
    const planned = job.requirements.find((r) => r.materialId === cryst.id).qty;
    expect(row).toMatchObject({ planned, issued: planned + 1, received: 5, variance: 1, overPlan: true });
    expect(body.labour.find((t) => t.tradeId === labour.tradeId)).toMatchObject({ plannedDays: labour.qty, loggedDays: 6 });
    expect(body.workdayHours).toBe(8);
    expect(findKeys(body, (k) => /rate|cost|amount|price/i.test(k))).toEqual([]);
  });
});

describe('purchase lists (Phase L7)', () => {
  let job;
  let supplier;

  beforeAll(async () => {
    ({ job } = await runningBoqJob());
    supplier = await prisma.supplier.create({ data: { name: `Supplier ${uid()}`, phone: '9841555000' } });
    // The shared test database holds plenty of stock: plan more than it has, so the job is short.
    const req = job.requirements.find((r) => r.kind === 'MATERIAL');
    const onHand = (await stockBalances([req.materialId]))[req.materialId] ?? 0;
    await prisma.jobRequirement.update({ where: { id: req.id }, data: { qty: Math.max(0, onHand) + 40 } });
  });

  it('from the shortfall, DRAFT → ORDERED → RECEIVED, and receiving raises stock with the supplier', async () => {
    const list = expectStatus(await dispatcher.post(`/admin/jobs/${job.id}/purchase-lists/from-shortfall`), 201).data;
    expect(list).toMatchObject({ status: 'DRAFT', jobId: job.id });
    expect(list.number).toMatch(/^PL-/);
    expect(list.items.length).toBeGreaterThan(0);
    expectStatus(await dispatcher.put(`/admin/purchase-lists/${list.id}`).send({ supplierId: supplier.id }), 200);
    expect(expectStatus(await dispatcher.post(`/admin/purchase-lists/${list.id}/receive`).send({}), 422).error.code).toBe('INVALID_TRANSITION');

    const ordered = expectStatus(await dispatcher.post(`/admin/purchase-lists/${list.id}/order`), 200).data;
    expect(ordered.status).toBe('ORDERED');
    expect(ordered.orderedAt).toBeTruthy();
    expectStatus(await dispatcher.put(`/admin/purchase-lists/${list.id}`).send({ note: 'too late' }), 422);

    const [first, ...rest] = ordered.items;
    const before = await stockBalances(ordered.items.map((i) => i.materialId));
    const received = expectStatus(await dispatcher.post(`/admin/purchase-lists/${list.id}/receive`).send({
      items: [{ itemId: first.id, receivedQty: first.qty - 1 }],
    }), 200).data;
    expect(received.status).toBe('RECEIVED');
    const after = await stockBalances(ordered.items.map((i) => i.materialId));
    expect(after[first.materialId] - before[first.materialId]).toBeCloseTo(first.qty - 1, 3);
    for (const item of rest) expect(after[item.materialId] - (before[item.materialId] ?? 0)).toBeCloseTo(item.qty, 3);
    const movement = await prisma.stockMovement.findFirst({ where: { reference: list.number, materialId: first.materialId } });
    expect(movement).toMatchObject({ type: 'PURCHASE', supplierId: supplier.id, jobId: job.id, qty: first.qty - 1 });
    expect(await prisma.auditLog.findFirst({ where: { event: 'purchase_list.received', recordId: list.id } })).toBeTruthy();

    // RECEIVED is final.
    expect(expectStatus(await dispatcher.post(`/admin/purchase-lists/${list.id}/cancel`).send({ reason: 'Changed mind' }), 422).error.code).toBe('INVALID_TRANSITION');
    expect(expectStatus(await dispatcher.post(`/admin/purchase-lists/${list.id}/receive`).send({}), 422).error.code).toBe('INVALID_TRANSITION');
  });

  it('a hand-made list, cancelled; a draft deleted and restored; who may', async () => {
    const cryst = await prisma.material.findUnique({ where: { code: 'WP-CRYST' } });
    const list = expectStatus(await dispatcher.post('/admin/purchase-lists').send({ supplierId: supplier.id, items: [{ materialId: cryst.id, qty: 25, packs: 1 }] }), 201).data;
    expect(expectStatus(await dispatcher.get(`/admin/purchase-lists?q=${list.number}`), 200).data.map((l) => l.id)).toEqual([list.id]);
    expectStatus(await dispatcher.delete(`/admin/purchase-lists/${list.id}`), 204);
    expectStatus(await dispatcher.patch(`/admin/purchase-lists/${list.id}/restore`), 200);
    expectStatus(await dispatcher.post(`/admin/purchase-lists/${list.id}/order`), 200);
    expectStatus(await dispatcher.delete(`/admin/purchase-lists/${list.id}`), 422);
    const cancelled = expectStatus(await dispatcher.post(`/admin/purchase-lists/${list.id}/cancel`).send({ reason: 'Supplier out of stock' }), 200).data;
    expect(cancelled).toMatchObject({ status: 'CANCELLED', cancelReason: 'Supplier out of stock' });
    expectStatus(await (await as('SALES')).post('/admin/purchase-lists').send({ items: [{ materialId: cryst.id, qty: 1 }] }), 403);
    expect((await dispatcher.patch(`/admin/purchase-lists/${list.id}/toggle`)).status).toBe(404);
  });

  it('a job short of nothing gets no list', async () => {
    const { job: plain } = await createAssignedJob();
    expect(expectStatus(await dispatcher.post(`/admin/jobs/${plain.id}/purchase-lists/from-shortfall`), 422).error.code).toBe('NO_SHORTFALL');
  });
});
