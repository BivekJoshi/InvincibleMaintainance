import { describe, it, expect, beforeAll } from 'vitest';
import {
  as, expectStatus, createCustomer, createAssignedJob, technicianIdFor, uploadImage,
  prisma, uid, phone, PASSWORD, daysFromNow,
} from './helpers.js';

let dispatcher;
let admin;

beforeAll(async () => {
  dispatcher = await as('DISPATCHER');
  admin = await as('ADMIN');
});

/** A material's derived balance, found by its code on the paginated stock list. */
const stockOf = async (materialId) => {
  const { code } = await prisma.material.findUnique({ where: { id: materialId } });
  const body = expectStatus(await dispatcher.get(`/admin/stock?q=${encodeURIComponent(code)}&limit=100`), 200);
  return body.data.find((r) => r.id === materialId)?.balance;
};

describe('job templates', () => {
  let templateId;

  it('GET /admin/job-templates', async () => {
    expect(expectStatus(await dispatcher.get('/admin/job-templates'), 200).data.length).toBeGreaterThan(0);
  });

  it('POST/PUT/DELETE /admin/job-templates', async () => {
    templateId = expectStatus(await dispatcher.post('/admin/job-templates').send({
      name: `Template ${uid()}`, tasks: [{ title: 'Inspect' }, { title: 'Repair' }, { title: 'Clean up' }],
    }), 201).data.id;
    expectStatus(await dispatcher.put(`/admin/job-templates/${templateId}`).send({ description: 'Updated' }), 200);
    expect(expectStatus(await dispatcher.get(`/admin/job-templates/${templateId}`), 200).data.tasks.length).toBe(3);
    expectStatus(await dispatcher.get('/admin/job-templates/nope'), 404);
    const doomed = expectStatus(await dispatcher.post('/admin/job-templates').send({ name: `Doomed ${uid()}`, tasks: [{ title: 'One' }] }), 201).data;
    expectStatus(await dispatcher.delete(`/admin/job-templates/${doomed.id}`), 204);
  });
});

describe('jobs', () => {
  let job;
  let templateId;

  beforeAll(async () => {
    templateId = (await prisma.jobTemplate.findFirst({ where: { deletedAt: null } })).id;
    ({ job } = await createAssignedJob({ templateId, scheduledStart: daysFromNow(0).toISOString() }));
  });

  it('POST /admin/jobs with technicians starts ASSIGNED and pulls the template checklist', async () => {
    expect(job.status).toBe('ASSIGNED');
    expect(job.number).toMatch(/^JOB-/);
    expect(job.tasks.length).toBeGreaterThan(0);
  });

  it('POST /admin/jobs rejects a site from another customer', async () => {
    const a = await createCustomer(await as('SALES'));
    const b = await createCustomer(await as('SALES'));
    const site = expectStatus(await (await as('SALES')).post(`/admin/customers/${b.id}/sites`).send({ label: 'B', address: 'Somewhere else' }), 201).data;
    expectStatus(await dispatcher.post('/admin/jobs').send({ customerId: a.id, siteId: site.id, title: 'Wrong site' }), 400);
  });

  it('GET /admin/jobs with filters', async () => {
    expectStatus(await dispatcher.get('/admin/jobs'), 200);
    for (const qs of ['status=ASSIGNED', 'type=REPAIR', 'unassigned=true', `customerId=${job.customerId}`, 'q=Test']) {
      expectStatus(await dispatcher.get(`/admin/jobs?${qs}`), 200);
    }
  });

  it('GET/PUT /admin/jobs/:id', async () => {
    expectStatus(await dispatcher.get(`/admin/jobs/${job.id}`), 200);
    expect(expectStatus(await dispatcher.put(`/admin/jobs/${job.id}`).send({ priority: 'HIGH' }), 200).data.priority).toBe('HIGH');
  });

  it('PATCH /admin/jobs/:id/status refuses a jump to COMPLETED', async () => {
    expect(expectStatus(await dispatcher.patch(`/admin/jobs/${job.id}/status`).send({ status: 'COMPLETED' }), 422).error.code).toBe('INVALID_TRANSITION');
  });

  it('PATCH /admin/jobs/:id/status needs a reason to hold', async () => {
    expectStatus(await dispatcher.patch(`/admin/jobs/${job.id}/status`).send({ status: 'ON_HOLD' }), 400);
  });

  it('POST /admin/jobs/:id/assign', async () => {
    const lead = await technicianIdFor('TECHNICIAN');
    const second = await technicianIdFor('TECHNICIAN2');
    expectStatus(await dispatcher.post(`/admin/jobs/${job.id}/assign`).send({ technicianIds: [lead, second], leadTechnicianId: lead }), 200);
  });

  it('tasks: add, tick, delete', async () => {
    const task = expectStatus(await dispatcher.post(`/admin/jobs/${job.id}/tasks`).send({ title: 'Extra check' }), 201).data;
    expectStatus(await dispatcher.patch(`/admin/jobs/${job.id}/tasks/${task.id}`).send({ isDone: true }), 200);
    expectStatus(await dispatcher.delete(`/admin/jobs/${job.id}/tasks/${task.id}`), 204);
  });

  it('photos: attach an uploaded image, then remove it', async () => {
    const media = await uploadImage(dispatcher);
    const photo = expectStatus(await dispatcher.post(`/admin/jobs/${job.id}/photos`).send({ mediaId: media.id, kind: 'BEFORE' }), 201).data;
    expectStatus(await dispatcher.delete(`/admin/jobs/${job.id}/photos/${photo.id}`), 204);
  });

  it('materials: issuing reduces stock and removing restores it', async () => {
    const material = await prisma.material.findFirst({ where: { code: 'WP-CRYST' } });
    const before = await stockOf(material.id);
    const row = expectStatus(await dispatcher.post(`/admin/jobs/${job.id}/materials`).send({ materialId: material.id, qty: 3 }), 201).data;
    expect(await stockOf(material.id)).toBe(before - 3);
    expectStatus(await dispatcher.delete(`/admin/jobs/${job.id}/materials/${row.id}`), 204);
    expect(await stockOf(material.id)).toBe(before);
  });

  it('time logs: the office records labour by hand, for an assigned technician only', async () => {
    const hari = await technicianIdFor('TECHNICIAN');
    const surveyor = await technicianIdFor('SURVEYOR');
    const startedAt = daysFromNow(-1).toISOString();

    expectStatus(await dispatcher.post(`/admin/jobs/${job.id}/time-logs`).send({ technicianId: hari, startedAt }), 400);
    expectStatus(await dispatcher.post(`/admin/jobs/${job.id}/time-logs`).send({ technicianId: surveyor, startedAt, minutes: 30 }), 422);

    const kept = expectStatus(await dispatcher.post(`/admin/jobs/${job.id}/time-logs`).send({
      technicianId: hari, startedAt, minutes: 90, note: 'Timer was never started',
    }), 201).data;
    expect(kept.minutes).toBe(90);

    const end = new Date(new Date(startedAt).getTime() + 45 * 60_000).toISOString();
    const doomed = expectStatus(await dispatcher.post(`/admin/jobs/${job.id}/time-logs`).send({ technicianId: hari, startedAt, endedAt: end }), 201).data;
    expect(doomed.minutes).toBe(45);
    expectStatus(await dispatcher.delete(`/admin/jobs/${job.id}/time-logs/${doomed.id}`), 204);
    expectStatus(await dispatcher.delete(`/admin/jobs/${job.id}/time-logs/${doomed.id}`), 404);

    expectStatus(await (await as('SALES')).post(`/admin/jobs/${job.id}/time-logs`).send({ technicianId: hari, startedAt, minutes: 5 }), 403);
  });

  it('completing with open checklist items is refused', async () => {
    expectStatus(await dispatcher.patch(`/admin/jobs/${job.id}/status`).send({ status: 'IN_PROGRESS' }), 200);
    expectStatus(await dispatcher.post(`/admin/jobs/${job.id}/complete`).send({ note: 'Too soon' }), 422);
  });

  it('POST /admin/jobs/:id/complete creates the warranty', async () => {
    const full = expectStatus(await dispatcher.get(`/admin/jobs/${job.id}`), 200).data;
    for (const t of full.tasks.filter((x) => !x.isDone && !x.isSkipped)) {
      expectStatus(await dispatcher.patch(`/admin/jobs/${job.id}/tasks/${t.id}`).send({ isDone: true }), 200);
    }
    const done = expectStatus(await dispatcher.post(`/admin/jobs/${job.id}/complete`).send({ note: 'All good', customerRating: 4 }), 200).data;
    expect(done.status).toBe('COMPLETED');
    expect(await prisma.warranty.findFirst({ where: { jobId: job.id } })).toBeTruthy();
  });

  it('POST /admin/jobs/:id/verify', async () => {
    expect(expectStatus(await dispatcher.post(`/admin/jobs/${job.id}/verify`), 200).data.status).toBe('VERIFIED');
  });

  it('GET /admin/jobs/:id/costing', async () => {
    const body = expectStatus(await dispatcher.get(`/admin/jobs/${job.id}/costing`), 200);
    expect(body.data.cost).toBeTypeOf('object');
    expect(body.data.labourMinutes).toBe(90);
  });

  it('POST /admin/jobs/:id/publish-case-study needs cms:write', async () => {
    expectStatus(await dispatcher.post(`/admin/jobs/${job.id}/publish-case-study`).send({}), 403);
    const body = expectStatus(await admin.post(`/admin/jobs/${job.id}/publish-case-study`).send({ title: `Case study ${uid()}` }), 201);
    expect(body.data.clientName ?? null).toBeNull();
    expect(body.data.jobId).toBe(job.id);
    expect(body.data.isActive).toBe(false);
    expectStatus(await admin.post(`/admin/jobs/${job.id}/publish-case-study`).send({}), 409);
  });

  it('DELETE /admin/jobs/:id', async () => {
    const customer = await createCustomer(await as('SALES'));
    const draft = expectStatus(await dispatcher.post('/admin/jobs').send({ customerId: customer.id, title: 'Draft to delete' }), 201).data;
    expect(draft.status).toBe('DRAFT');
    expectStatus(await dispatcher.delete(`/admin/jobs/${draft.id}`), 204);
    expectStatus(await dispatcher.get(`/admin/jobs/${draft.id}`), 404);
  });

  it('SALES reads jobs but cannot create them', async () => {
    const sales = await as('SALES');
    expectStatus(await sales.get('/admin/jobs'), 200);
    expectStatus(await sales.post('/admin/jobs').send({ customerId: job.customerId, title: 'No rights' }), 403);
  });
});

describe('dispatch', () => {
  it('GET /admin/dispatch/board day and week', async () => {
    expectStatus(await dispatcher.get('/admin/dispatch/board'), 200);
    expectStatus(await dispatcher.get(`/admin/dispatch/board?view=week&date=${new Date().toISOString().slice(0, 10)}`), 200);
  });

  it('GET /admin/dispatch/unassigned', async () => {
    expectStatus(await dispatcher.get('/admin/dispatch/unassigned'), 200);
  });
});

describe('technicians', () => {
  it('GET /admin/technicians with role filter, and no hourly rate', async () => {
    const all = expectStatus(await dispatcher.get('/admin/technicians'), 200);
    expect(all.data.length).toBeGreaterThanOrEqual(3);
    expect(all.data[0].hourlyRate).toBeUndefined();
    const surveyors = expectStatus(await dispatcher.get('/admin/technicians?role=SURVEYOR'), 200);
    expect(surveyors.data.every((t) => t.user.role === 'SURVEYOR')).toBe(true);
  });

  it('a TECHNICIAN account comes with its profile, and a person has one profile', async () => {
    const user = expectStatus(await admin.post('/admin/users').send({
      name: 'New Technician', email: `${uid('tech')}@example.com`, phone: phone(), password: PASSWORD, role: 'TECHNICIAN',
    }), 201).data;
    expect(expectStatus(await dispatcher.get(`/admin/technicians/${user.technician.id}`), 200).data.user.id).toBe(user.id);
    expectStatus(await dispatcher.post('/admin/technicians').send({ userId: user.id }), 409);
  });

  it('POST/PUT/DELETE /admin/technicians', async () => {
    // An account from before Phase G, which has no profile yet.
    const user = expectStatus(await admin.post('/admin/users').send({
      name: 'New Technician', email: `${uid('tech')}@example.com`, phone: phone(), password: PASSWORD, role: 'SALES',
    }), 201).data;
    const tech = expectStatus(await dispatcher.post('/admin/technicians').send({
      userId: user.id, employeeCode: uid('E-'), skills: ['plumbing'], hourlyRate: 450,
    }), 201).data;
    expect(tech.hourlyRate).toBe(45000);
    expect(expectStatus(await dispatcher.get(`/admin/technicians/${tech.id}`), 200).data.hourlyRate).toBe(45000);
    const seenBySales = expectStatus(await (await as('SALES')).get(`/admin/technicians/${tech.id}`), 200).data;
    expect(seenBySales.hourlyRate).toBeUndefined();
    expect(seenBySales.user.id).toBe(user.id);
    expectStatus(await dispatcher.put(`/admin/technicians/${tech.id}`).send({ dailyCapacity: 6 }), 200);
    expectStatus(await dispatcher.delete(`/admin/technicians/${tech.id}`), 204);
    expectStatus(await dispatcher.get(`/admin/technicians/${tech.id}`), 404);
  });
});

describe('materials and stock', () => {
  let supplierId;
  let categoryId;
  let materialId;

  it('suppliers CRUD', async () => {
    supplierId = expectStatus(await dispatcher.post('/admin/suppliers').send({ name: `Supplier ${uid()}` }), 201).data.id;
    expectStatus(await dispatcher.get('/admin/suppliers'), 200);
    expectStatus(await dispatcher.get(`/admin/suppliers/${supplierId}`), 200);
    expectStatus(await dispatcher.put(`/admin/suppliers/${supplierId}`).send({ phone: '01-5551234' }), 200);
  });

  it('material categories CRUD', async () => {
    categoryId = expectStatus(await dispatcher.post('/admin/material-categories').send({ name: `Category ${uid()}` }), 201).data.id;
    expectStatus(await dispatcher.get('/admin/material-categories'), 200);
    expectStatus(await dispatcher.patch('/admin/material-categories/reorder').send({ items: [{ id: categoryId, sortOrder: 3 }] }), 204);
  });

  it('materials CRUD, prices in paisa', async () => {
    const created = expectStatus(await dispatcher.post('/admin/materials').send({
      code: uid('MAT-').toUpperCase(), name: 'Test sealant', unit: 'litre', categoryId, supplierId,
      purchaseRate: 320.25, sellRate: 410, reorderLevel: 5,
    }), 201).data;
    materialId = created.id;
    expect(created.purchaseRate).toBe(32025);
    expect(created.sellRate).toBe(41000);
    expectStatus(await dispatcher.get(`/admin/materials/${materialId}`), 200);
    expectStatus(await dispatcher.put(`/admin/materials/${materialId}`).send({ reorderLevel: 8 }), 200);
    expectStatus(await dispatcher.get('/admin/materials?q=sealant'), 200);
  });

  it('stock: a purchase raises the derived balance', async () => {
    expectStatus(await dispatcher.post('/admin/stock/movements').send({ materialId, type: 'PURCHASE', qty: 20, rate: 320 }), 201);
    expect(await stockOf(materialId)).toBe(20);
    expectStatus(await dispatcher.post('/admin/stock/movements').send({ materialId, type: 'ADJUSTMENT', qty: 0 }), 400);
  });

  it('GET /admin/stock/low and /admin/stock/movements', async () => {
    expectStatus(await dispatcher.get('/admin/stock/low'), 200);
    expectStatus(await dispatcher.get(`/admin/stock/movements?materialId=${materialId}`), 200);
  });

  it('DELETE a material, supplier and category', async () => {
    expectStatus(await dispatcher.delete(`/admin/materials/${materialId}`), 204);
    expectStatus(await dispatcher.delete(`/admin/suppliers/${supplierId}`), 204);
    expectStatus(await dispatcher.delete(`/admin/material-categories/${categoryId}`), 204);
  });

  it('ACCOUNTANT cannot touch stock', async () => {
    expectStatus(await (await as('ACCOUNTANT')).get('/admin/stock'), 403);
  });
});
