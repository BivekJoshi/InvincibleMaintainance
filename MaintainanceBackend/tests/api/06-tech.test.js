import { describe, it, expect, beforeAll } from 'vitest';
import {
  anon, as, approveAndSend, expectStatus, createAssignedJob, findKeys, payAdvance, pngBuffer, prisma, runningBoqJob, technicianIdFor, uid, daysFromNow,
} from './helpers.js';
import { local } from '../../src/utils/dates.js';

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

describe('the field app never carries money (D1, defect #17)', () => {
  /**
   * Any key that names a price, cost, pay or amount — words split on camelCase. Its own list, not the
   * server's `isMoneyKey`, so the test checks the wall rather than repeating it.
   */
  const MONEY_WORDS = new Set(['rate', 'rates', 'amount', 'total', 'subtotal', 'discount', 'margin', 'balance',
    'cost', 'costs', 'price', 'prices', 'wage', 'wages', 'paid', 'vat', 'estimate', 'overhead', 'profit']);
  const ALLOWED = new Set(['priceUnit']); // "sq.ft" — the unit a service is sold in, not a price
  // A foreign key (`rateCardItemId`) links to a record; it carries no amount.
  const moneyNamed = (k) => !ALLOWED.has(k) && !k.endsWith('Id')
    && k.split(/(?=[A-Z])/).some((w) => MONEY_WORDS.has(w.toLowerCase()));
  const moneyKeys = (value) => findKeys(value, moneyNamed);

  it('no /tech response names a rate, cost, total or pay — on a quoted job with materials and time', async () => {
    const [sales, dispatcher] = await Promise.all([as('SALES'), as('DISPATCHER')]);
    const customer = expectStatus(await sales.post('/admin/customers').send({ name: `Money wall ${uid()}`, phone: `98${String(Date.now()).slice(-8)}` }), 201).data;
    const quote = expectStatus(await sales.post('/admin/quotations').send({
      customerId: customer.id, items: [{ description: 'Seepage treatment', unit: 'sq.ft', qty: 100, rate: 220 }],
    }), 201).data;
    const { publicToken } = await approveAndSend(quote.id);
    expectStatus(await anon().post(`/public/quotations/${publicToken}/decide`)
      .set('User-Agent', 'Mozilla/5.0 (Linux; Android 14) Mobile').send({ decision: 'approve' }), 200);
    const quotedJob = await prisma.job.findFirst({ where: { quotationId: quote.id } });
    await payAdvance(quotedJob.id); // accepting asked for the advance, and the job waits for it (Phase L6)
    const [me, colleague] = await Promise.all([technicianIdFor('TECHNICIAN'), technicianIdFor('TECHNICIAN2')]);
    expectStatus(await dispatcher.post(`/admin/jobs/${quotedJob.id}/schedule`).send({
      scheduledStart: new Date().toISOString(), scheduledEnd: new Date(Date.now() + 4 * 3600e3).toISOString(),
      technicianIds: [me, colleague], notifyCustomer: false,
    }), 200);
    const material = await prisma.material.findFirst({ where: { deletedAt: null, isActive: true } });

    const responses = {
      status: await tech.patch(`/tech/jobs/${quotedJob.id}/status`).send({ status: 'IN_PROGRESS' }),
      material: await tech.post(`/tech/jobs/${quotedJob.id}/materials`).send({ materialId: material.id, qty: 1 }),
      timeStart: await tech.post(`/tech/jobs/${quotedJob.id}/time/start`).send({}),
      timeStop: await tech.post(`/tech/jobs/${quotedJob.id}/time/stop`).send({}),
      today: await tech.get('/tech/jobs/today'),
      list: await tech.get('/tech/jobs'),
      detail: await tech.get(`/tech/jobs/${quotedJob.id}`),
      materials: await tech.get('/tech/materials'),
      rateCard: await tech.get('/tech/rate-card'),
      surveys: await (await as('SURVEYOR')).get('/tech/surveys'),
    };
    const leaks = Object.entries(responses).flatMap(([name, res]) => {
      expect(res.status, `${name} → ${res.status}`).toBeLessThan(300);
      return moneyKeys(res.body.data).map((k) => `${name}: ${k.replace(/\[\d+\]/g, '[]')}`);
    });
    expect([...new Set(leaks)]).toEqual([]);
    // Still a working screen: the job, its people and its materials are there, without the money.
    const job = responses.detail.body.data;
    expect(job.assignments.map((a) => a.technician.user.name)).toHaveLength(2);
    expect(job.materials[0]).toMatchObject({ qty: 1, material: { id: material.id } });
  });
});

describe('the field app never carries money — the Phase L5 survey shapes', () => {
  const MONEY_WORDS = new Set(['rate', 'rates', 'amount', 'total', 'subtotal', 'discount', 'margin', 'balance',
    'cost', 'costs', 'price', 'prices', 'wage', 'wages', 'paid', 'vat', 'estimate', 'overhead', 'profit', 'budget']);
  const moneyNamed = (k) => k !== 'priceUnit' && !k.endsWith('Id') && k.split(/(?=[A-Z])/).some((w) => MONEY_WORDS.has(w.toLowerCase()));

  it('the checklist, the customer\'s photos, the measurements and the visit answer reach the phone without money', async () => {
    const surveyor = await as('SURVEYOR');
    // The seeded site-visit demo: a draft with the customer's photos, and a submitted one with everything.
    const [draft, submitted] = await Promise.all(['9841800001', '9841800003'].map((p) => prisma.siteSurvey.findFirst({
      where: { customer: { phone: p }, deletedAt: null }, orderBy: { createdAt: 'desc' },
    })));
    const saved = await surveyor.put(`/tech/surveys/${draft.id}`).send({
      readings: [{ questionKey: 'moisture_low', label: 'Moisture 300 mm above the floor', value: 22 }],
      items: [{ kind: 'OTHER', description: 'Measured wall', unit: 'sq.ft', measurements: [{ area: 'Bedroom', nos: 1, l: 10, h: 9 }] }],
    });
    const responses = {
      draft: await surveyor.get(`/tech/surveys/${draft.id}`),
      submitted: await surveyor.get(`/tech/surveys/${submitted.id}`),
      list: await surveyor.get('/tech/surveys'),
      saved,
      job: await surveyor.get(`/tech/jobs/${draft.jobId}`),
    };
    const leaks = Object.entries(responses).flatMap(([name, res]) => {
      expect(res.status, `${name} → ${res.status}`).toBeLessThan(300);
      return findKeys(res.body.data, moneyNamed).map((k) => `${name}: ${k}`);
    });
    expect(leaks).toEqual([]);
    const body = responses.draft.body.data;
    expect(body.template.questions.length).toBeGreaterThan(0);
    expect(body.lead.photos[0]).toMatchObject({ url: expect.any(String), thumb: expect.any(String) });
    expect(body.lead.qualification).not.toHaveProperty('budgetBand');
    expect(responses.saved.body.data.readings[0].flagged).toBe(true);
    // The visit link answers for the customer — it is theirs, not the field's.
    expect(responses.job.body.data).not.toHaveProperty('visitToken');
  });
});

describe('the field app, as H2 uses it', () => {
  const HOUR = 3_600_000;
  const key = () => uid('k-sync-');

  it('an offline timer keeps the times the technician tapped, not the time it synced', async () => {
    const { job } = await createAssignedJob();
    const started = new Date(Date.now() - 3 * HOUR);
    const stopped = new Date(Date.now() - 2 * HOUR);
    const body = expectStatus(await tech.post('/tech/sync').send({
      mutations: [
        { idempotencyKey: key(), at: started.toISOString(), kind: 'time_start', jobId: job.id, payload: {} },
        { idempotencyKey: key(), at: stopped.toISOString(), kind: 'time_stop', jobId: job.id, payload: {} },
      ],
    }), 200).data;
    expect(body.applied).toBe(2);
    const log = await prisma.timeLog.findFirst({ where: { jobId: job.id } });
    expect(log.startedAt).toEqual(started);
    expect(log.endedAt).toEqual(stopped);
    expect(log.minutes).toBe(60);
  });

  it('a time from the future is taken as now', async () => {
    const { job } = await createAssignedJob();
    const body = expectStatus(await tech.post('/tech/sync').send({
      mutations: [{ idempotencyKey: key(), at: new Date(Date.now() + 5 * HOUR).toISOString(), kind: 'time_start', jobId: job.id, payload: {} }],
    }), 200).data;
    expect(body.applied).toBe(1);
    const log = await prisma.timeLog.findFirst({ where: { jobId: job.id } });
    expect(log.startedAt.getTime()).toBeLessThanOrEqual(Date.now());
  });

  it('a job is completed once: a second completion is refused, not re-run', async () => {
    const { job } = await createAssignedJob();
    expectStatus(await tech.patch(`/tech/jobs/${job.id}/status`).send({ status: 'IN_PROGRESS' }), 200);
    expectStatus(await tech.post(`/tech/jobs/${job.id}/complete`).send({ note: 'Done' }), 200);
    expect(expectStatus(await tech.post(`/tech/jobs/${job.id}/complete`).send({ note: 'Again' }), 422).error.code).toBe('INVALID_TRANSITION');
  });

  it('a malformed mutation is reported as such — terminal, not worth retrying', async () => {
    const { job } = await createAssignedJob();
    const body = expectStatus(await tech.post('/tech/sync').send({
      mutations: [{ idempotencyKey: key(), at: new Date().toISOString(), kind: 'status', jobId: job.id, payload: { status: 'FLYING' } }],
    }), 200).data;
    expect(body.results[0]).toMatchObject({ status: 'failed', code: 'INVALID_MUTATION' });
  });

  it('history reads Kathmandu days, like the office lists', async () => {
    // 02:00 in Kathmandu on a day is 20:15 UTC the day before.
    const day = new Date(Date.now() + 4 * 86_400_000).toISOString().slice(0, 10);
    const scheduledStart = new Date(`${day}T02:00:00+05:45`).toISOString();
    const { job } = await createAssignedJob({ scheduledStart });
    const ids = expectStatus(await tech.get(`/tech/jobs?from=${day}&to=${day}`), 200).data.map((j) => j.id);
    expect(ids).toContain(job.id);
  });

  it('a job\'s and a survey\'s photos come with their images, so the phone can show them', async () => {
    const { job } = await createAssignedJob();
    const up = expectStatus(await tech.post(`/tech/jobs/${job.id}/photos`).field('kind', 'BEFORE').attach('files', await pngBuffer(), 'before.png'), 201).data;
    const got = expectStatus(await tech.get(`/tech/jobs/${job.id}`), 200).data;
    const photo = got.photos.find((p) => p.mediaId === up.media[0].id);
    expect(got.media[photo.mediaId]).toMatchObject({ id: photo.mediaId, url: expect.any(String) });

    const surveyor = await as('SURVEYOR');
    const { job: visit } = await createAssignedJob({ assignee: 'SURVEYOR', type: 'INSPECTION' });
    const survey = expectStatus(await surveyor.post(`/tech/jobs/${visit.id}/survey`).send({}), 201).data;
    expectStatus(await surveyor.post(`/tech/surveys/${survey.id}/photos`).attach('files', await pngBuffer(), 'crack.png'), 201);
    const read = expectStatus(await surveyor.get(`/tech/surveys/${survey.id}`), 200).data;
    expect(read.job.photos).toHaveLength(1);
    expect(read.media[read.job.photos[0].mediaId].url).toEqual(expect.any(String));
  });
});

describe('the site diary (Phase L7)', () => {
  const ktmDay = (daysAgo) => local(new Date(Date.now() - daysAgo * 86_400_000), 'YYYY-MM-DD');
  const MONEY = ['rate', 'rates', 'amount', 'total', 'cost', 'price', 'paid', 'vat', 'balance', 'wage', 'margin', 'value', 'earned'];
  const moneyNamed = (k) => !k.endsWith('Id') && k !== 'priceUnit' && k.split(/(?=[A-Z])/).some((w) => MONEY.includes(w.toLowerCase()));
  let job;
  let trade;

  beforeAll(async () => {
    ({ job } = await runningBoqJob());
    trade = await prisma.trade.findFirst({ where: { deletedAt: null } });
  });

  const entry = (pct, extra = {}) => ({
    weather: 'SUNNY', headcount: [{ tradeId: trade.id, count: 3 }],
    progress: [{ jobLineId: job.lines[0].id, progressPct: pct }], received: [], photoMediaIds: [], ...extra,
  });

  it('three days filed offline apply once each; a replay reports duplicates; one entry per job per day', async () => {
    const days = [ktmDay(2), ktmDay(1), ktmDay(0)];
    const cryst = await prisma.material.findUnique({ where: { code: 'WP-CRYST' } });
    const payloads = [
      { day: days[0], ...entry(20) },
      { day: days[1], ...entry(35, { weather: 'HEAVY_RAIN', lostHours: 4, lostReason: 'RAIN', issues: 'Rain stopped work after lunch' }) },
      { day: days[2], ...entry(60, { received: [{ materialId: cryst.id, description: cryst.name, qty: 10, unit: cryst.unit, challanNo: 'CH-4471' }] }) },
    ];
    const mutations = payloads.map((payload, i) => ({
      idempotencyKey: uid('diary-'), at: new Date(Date.now() - (3 - i) * 60_000).toISOString(), kind: 'diary_save', jobId: job.id, payload,
    }));
    const first = expectStatus(await tech.post('/tech/sync').send({ mutations }), 200).data;
    expect(first.applied).toBe(3);
    const replay = expectStatus(await tech.post('/tech/sync').send({ mutations }), 200).data;
    expect(replay).toMatchObject({ applied: 0, duplicates: 3 });
    // The same day saved again with a new key replaces it: still three entries.
    expectStatus(await tech.post('/tech/sync').send({
      mutations: [{ idempotencyKey: uid('diary-'), at: new Date().toISOString(), kind: 'diary_save', jobId: job.id, payload: payloads[2] }],
    }), 200);
    expect(await prisma.siteDiary.count({ where: { jobId: job.id } })).toBe(3);
    const rain = await prisma.siteDiary.findUnique({ where: { jobId_day: { jobId: job.id, day: days[1] } } });
    expect(rain).toMatchObject({ lostHours: 4, lostReason: 'RAIN', weather: 'HEAVY_RAIN' });
  });

  it('the latest day sets the line\'s progress — an older day filed later never rolls it back', async () => {
    expect((await prisma.jobLine.findUnique({ where: { id: job.lines[0].id } })).progressPct).toBe(60);
    expectStatus(await tech.put(`/tech/jobs/${job.id}/diary/${ktmDay(2)}`).send(entry(90)), 200);
    expect((await prisma.jobLine.findUnique({ where: { id: job.lines[0].id } })).progressPct).toBe(60);
    expectStatus(await tech.put(`/tech/jobs/${job.id}/diary/${ktmDay(0)}`).send(entry(70)), 200);
    expect((await prisma.jobLine.findUnique({ where: { id: job.lines[0].id } })).progressPct).toBe(70);
  });

  it('a material over plan, logged through the offline queue, comes back with its warning', async () => {
    const cryst = await prisma.material.findUnique({ where: { code: 'WP-CRYST' } });
    const planned = job.requirements.find((r) => r.materialId === cryst.id).qty;
    const body = expectStatus(await tech.post('/tech/sync').send({
      mutations: [{ idempotencyKey: uid('mat-'), at: new Date().toISOString(), kind: 'material', jobId: job.id, payload: { materialId: cryst.id, qty: planned + 2 } }],
    }), 200).data;
    expect(body.results[0]).toMatchObject({ status: 'applied', warnings: [{ code: 'OVER_PLAN', materialId: cryst.id, planned }] });
  });

  it('only people on the job file it; a future day, a stranger line or lost hours without a reason are refused', async () => {
    const other = await as('TECHNICIAN2');
    expectStatus(await other.put(`/tech/jobs/${job.id}/diary/${ktmDay(0)}`).send(entry(10)), 403);
    expectStatus(await tech.put(`/tech/jobs/${job.id}/diary/${local(new Date(Date.now() + 2 * 86_400_000), 'YYYY-MM-DD')}`).send(entry(10)), 400);
    const stranger = expectStatus(await tech.put(`/tech/jobs/${job.id}/diary/${ktmDay(0)}`).send({ ...entry(10), progress: [{ jobLineId: 'not-a-line', progressPct: 10 }] }), 422);
    expect(stranger.error.code).toBe('UNKNOWN_LINE');
    expectStatus(await tech.put(`/tech/jobs/${job.id}/diary/${ktmDay(0)}`).send({ ...entry(10), lostHours: 2 }), 400);
    expectStatus(await tech.put(`/tech/jobs/${job.id}/diary/${ktmDay(0)}`).send({ ...entry(10), rate: 5 }), 400);
  });

  it('no diary response carries money (D1)', async () => {
    const responses = {
      days: await tech.get(`/tech/jobs/${job.id}/diary`),
      day: await tech.get(`/tech/jobs/${job.id}/diary/${ktmDay(0)}`),
      saved: await tech.put(`/tech/jobs/${job.id}/diary/${ktmDay(0)}`).send(entry(70)),
      job: await tech.get(`/tech/jobs/${job.id}`),
    };
    const leaks = Object.entries(responses).flatMap(([name, res]) => {
      expect(res.status, `${name} → ${res.status}`).toBeLessThan(300);
      return findKeys(res.body.data, moneyNamed).map((k) => `${name}: ${k}`);
    });
    expect(leaks).toEqual([]);
    const day = responses.day.body.data;
    expect(day.lines.map((l) => l.id)).toEqual(job.lines.map((l) => l.id));
    expect(day.trades.length).toBeGreaterThan(0);
    expect(responses.days.body.data.days.map((d) => d.day)).toEqual([ktmDay(0), ktmDay(1), ktmDay(2)]);
  });
});
