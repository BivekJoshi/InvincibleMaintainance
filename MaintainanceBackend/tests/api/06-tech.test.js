import { describe, it, expect, beforeAll } from 'vitest';
import {
  as, expectStatus, createAssignedJob, pngBuffer, prisma, uid, daysFromNow,
} from './helpers.js';

let tech;
let job;
let othersJob;

beforeAll(async () => {
  tech = await as('TECHNICIAN');
  const templateId = (await prisma.jobTemplate.findFirst({ where: { deletedAt: null } })).id;
  ({ job } = await createAssignedJob({ templateId, scheduledStart: daysFromNow(0).toISOString() }));
  ({ job: othersJob } = await createAssignedJob({ assignee: 'TECHNICIAN2' }));
});

describe('technician queue', () => {
  it('GET /tech/jobs/today includes a job scheduled today', async () => {
    const body = expectStatus(await tech.get('/tech/jobs/today'), 200);
    expect(body.data.map((j) => j.id)).toContain(job.id);
  });

  it('GET /tech/jobs', async () => {
    expectStatus(await tech.get('/tech/jobs'), 200);
  });

  it('GET /tech/jobs/:id for an own job, 403 for someone else\'s', async () => {
    expectStatus(await tech.get(`/tech/jobs/${job.id}`), 200);
    expectStatus(await tech.get(`/tech/jobs/${othersJob.id}`), 403);
  });

  it('an ADMIN with no technician profile has an empty queue, not an error', async () => {
    const admin = await as('ADMIN');
    expect(expectStatus(await admin.get('/tech/jobs/today'), 200).data).toEqual([]);
    expectStatus(await admin.get('/tech/jobs/today?technicianId=nope'), 404);
  });

  it('SALES and ACCOUNTANT are kept out of the field app', async () => {
    expectStatus(await (await as('SALES')).get('/tech/jobs'), 403);
    expectStatus(await (await as('ACCOUNTANT')).get('/tech/jobs'), 403);
  });
});

describe('working a job', () => {
  it('PATCH /tech/jobs/:id/status EN_ROUTE → IN_PROGRESS', async () => {
    expectStatus(await tech.patch(`/tech/jobs/${job.id}/status`).send({ status: 'EN_ROUTE', lat: 27.68, lng: 85.31 }), 200);
    expectStatus(await tech.patch(`/tech/jobs/${job.id}/status`).send({ status: 'IN_PROGRESS' }), 200);
  });

  it('cannot move someone else\'s job', async () => {
    expectStatus(await tech.patch(`/tech/jobs/${othersJob.id}/status`).send({ status: 'EN_ROUTE' }), 403);
  });

  it('timer: start, a second start is refused, stop records minutes', async () => {
    expectStatus(await tech.post(`/tech/jobs/${job.id}/time/start`).send({}), 201);
    expectStatus(await tech.post(`/tech/jobs/${job.id}/time/start`).send({}), 400);
    const log = expectStatus(await tech.post(`/tech/jobs/${job.id}/time/stop`).send({ note: 'Lunch' }), 200).data;
    expect(log.minutes).toBeGreaterThanOrEqual(1);
    expectStatus(await tech.post(`/tech/jobs/${job.id}/time/stop`).send({}), 400);
  });

  it('POST /tech/jobs/:id/materials', async () => {
    const material = await prisma.material.findFirst({ where: { code: 'PUTTY-WALL' } });
    expectStatus(await tech.post(`/tech/jobs/${job.id}/materials`).send({ materialId: material.id, qty: 1.5 }), 201);
  });

  it('POST /tech/jobs/:id/photos uploads and attaches', async () => {
    const res = await tech.post(`/tech/jobs/${job.id}/photos`).field('kind', 'AFTER').attach('files', await pngBuffer(), 'after.png');
    expect(expectStatus(res, 201).data.photos[0].kind).toBe('AFTER');
  });

  it('refuses an upload that is not an image', async () => {
    const res = await tech.post(`/tech/jobs/${job.id}/photos`).attach('files', Buffer.from('not an image at all'), 'fake.png');
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.status).toBeLessThan(500);
  });

  it('PATCH /tech/jobs/:id/tasks/:taskId, then complete', async () => {
    const full = expectStatus(await tech.get(`/tech/jobs/${job.id}`), 200).data;
    for (const t of full.tasks) {
      expectStatus(await tech.patch(`/tech/jobs/${job.id}/tasks/${t.id}`).send({ isDone: true }), 200);
    }
    const done = expectStatus(await tech.post(`/tech/jobs/${job.id}/complete`).send({ note: 'Handed over', customerRating: 5 }), 200);
    expect(done.data.status).toBe('COMPLETED');
  });
});

describe('offline reference data', () => {
  it('GET /tech/materials and /tech/rate-card carry no rates', async () => {
    const materials = expectStatus(await tech.get('/tech/materials'), 200).data;
    const rates = expectStatus(await tech.get('/tech/rate-card'), 200).data;
    expect(materials.length).toBeGreaterThan(0);
    expect(rates.length).toBeGreaterThan(0);
    expect(JSON.stringify([...materials, ...rates])).not.toMatch(/"(rate|sellRate|purchaseRate)"/);
  });
});

describe('POST /tech/sync', () => {
  let syncJob;

  beforeAll(async () => {
    ({ job: syncJob } = await createAssignedJob());
  });

  it('applies a queue in order, and a replay changes nothing', async () => {
    const t0 = Date.now();
    const mutations = [
      { idempotencyKey: uid('k-'), at: new Date(t0).toISOString(), kind: 'status', jobId: syncJob.id, payload: { status: 'EN_ROUTE' } },
      { idempotencyKey: uid('k-'), at: new Date(t0 + 1000).toISOString(), kind: 'status', jobId: syncJob.id, payload: { status: 'IN_PROGRESS' } },
      { idempotencyKey: uid('k-'), at: new Date(t0 + 2000).toISOString(), kind: 'time_start', jobId: syncJob.id, payload: {} },
    ];
    const first = expectStatus(await tech.post('/tech/sync').send({ mutations }), 200);
    expect(first.data.applied).toBe(3);
    const replay = expectStatus(await tech.post('/tech/sync').send({ mutations }), 200);
    expect(replay.data.duplicates).toBe(3);
    expect(replay.data.applied).toBe(0);
  });

  it('a mutation on someone else\'s job fails without failing the batch', async () => {
    const body = expectStatus(await tech.post('/tech/sync').send({
      mutations: [{ idempotencyKey: uid('k-'), at: new Date().toISOString(), kind: 'status', jobId: othersJob.id, payload: { status: 'EN_ROUTE' } }],
    }), 200);
    expect(body.data.failed).toBe(1);
  });

  it('validates the mutation shape', async () => {
    expectStatus(await tech.post('/tech/sync').send({
      mutations: [{ idempotencyKey: uid('k-'), at: new Date().toISOString(), kind: 'status', payload: {} }],
    }), 400);
  });
});
