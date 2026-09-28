import { describe, it, expect, beforeAll } from 'vitest';
import {
  as, expectStatus, createAssignedJob, pngBuffer, prisma, uid,
} from './helpers.js';

/**
 * A survey taken through the field flow to SUBMITTED, with one line of each
 * kind. The inbox tests act on this rather than on the seeded survey, which the
 * first run moves to QUOTED — the suite has to run twice against one database.
 */
async function submittedSurvey() {
  const surveyor = await as('SURVEYOR');
  const { job } = await createAssignedJob({ assignee: 'SURVEYOR', type: 'INSPECTION' });
  const survey = expectStatus(await surveyor.post(`/tech/jobs/${job.id}/survey`).send({}), 201).data;
  const [treatment, labour, compound] = await Promise.all([
    prisma.rateCardItem.findUnique({ where: { code: 'SEEP-CHEM' } }),
    prisma.rateCardItem.findUnique({ where: { code: 'LABOUR-SKILL' } }),
    prisma.material.findUnique({ where: { code: 'WP-CRYST' } }),
  ]);
  expectStatus(await surveyor.post(`/tech/surveys/${survey.id}/submit`).send({
    diagnosis: 'Rising damp from a failed DPC',
    readings: [
      { label: 'North wall, 300mm above floor', metric: 'moisture', value: 21.5, unit: '%' },
      { label: 'DPC present?', metric: 'observation', textValue: 'None visible at plinth level' },
    ],
    items: [
      { kind: 'SERVICE', rateCardItemId: treatment.id, description: 'Crystalline treatment', unit: 'sq.ft', qty: 120 },
      { kind: 'MATERIAL', materialId: compound.id, description: 'Crystalline compound', unit: 'kg', qty: 15, wastagePct: 10 },
      { kind: 'LABOUR', rateCardItemId: labour.id, description: 'Skilled applicator', unit: 'hour', qty: 16 },
      { kind: 'OTHER', description: 'Furniture shifting', unit: 'lump', qty: 1, isOptional: true },
    ],
  }), 200);
  return survey.id;
}

describe('admin survey inbox', () => {
  let sales;
  let inbox;

  beforeAll(async () => {
    sales = await as('SALES');
    inbox = { id: await submittedSurvey() };
  });

  it('GET /admin/surveys lists with filters', async () => {
    const body = expectStatus(await sales.get('/admin/surveys'), 200);
    expect(body.data.length).toBeGreaterThan(0);
    expectStatus(await sales.get('/admin/surveys?status=SUBMITTED'), 200);
    // A work queue is several statuses at once.
    const queue = expectStatus(await sales.get('/admin/surveys?status=SUBMITTED,IN_REVIEW&limit=100'), 200).data;
    expect(queue.map((s) => s.id)).toContain(inbox.id);
    expect(queue.every((s) => ['SUBMITTED', 'IN_REVIEW'].includes(s.status))).toBe(true);
    expectStatus(await sales.get('/admin/surveys?status=SUBMITTED,MAYBE'), 400);
  });

  it('GET /admin/surveys/:id returns readings and items', async () => {
    const body = expectStatus(await sales.get(`/admin/surveys/${inbox.id}`), 200);
    expect(body.data.readings.length).toBeGreaterThan(0);
    expect(body.data.items.length).toBeGreaterThan(0);
  });

  it('the money wall: DISPATCHER reads the survey but not its pricing', async () => {
    const dispatcher = await as('DISPATCHER');
    expectStatus(await dispatcher.get(`/admin/surveys/${inbox.id}`), 200);
    expectStatus(await dispatcher.get(`/admin/surveys/${inbox.id}/pricing`), 403);
  });

  it('SURVEYOR cannot use the admin inbox', async () => {
    expectStatus(await (await as('SURVEYOR')).get('/admin/surveys'), 403);
  });

  it('GET /admin/surveys/:id/pricing prices lines and lists what it could not', async () => {
    const body = expectStatus(await sales.get(`/admin/surveys/${inbox.id}/pricing`), 200);
    // The OTHER line has nothing in the catalogue to price it from.
    expect(body.data.missing.length).toBeGreaterThan(0);
  });

  it('PATCH /admin/surveys/:id/review needs a note to return', async () => {
    expectStatus(await sales.patch(`/admin/surveys/${inbox.id}/review`).send({ status: 'RETURNED' }), 400);
    expect(expectStatus(await sales.patch(`/admin/surveys/${inbox.id}/review`).send({ status: 'IN_REVIEW' }), 200).data.status).toBe('IN_REVIEW');
  });

  it('POST /admin/surveys/:id/quotation builds a quotation once', async () => {
    const body = expectStatus(await sales.post(`/admin/surveys/${inbox.id}/quotation`).send({}), 201);
    expect(body.data.quotation.id).toBeTruthy();
    expect(body.data.survey.status).toBe('QUOTED');

    // Phase L3: what the surveyor recorded reaches the BOQ — kind, material, wastage on the raw quantity —
    // grouped into sections by category (the unpriced, hand-priced line stays out of an automatic build).
    const q = body.data.quotation;
    const compound = await prisma.material.findUnique({ where: { code: 'WP-CRYST' } });
    expect(q.items.filter((r) => r.rowType === 'SECTION').map((r) => r.description)).toEqual(['Waterproofing', 'Labour']);
    expect(q.items.find((r) => r.materialId === compound.id)).toMatchObject({
      rowType: 'ITEM', kind: 'MATERIAL', netQty: 15, wastagePct: 10, qty: 16.5, number: 'A.2',
    });
    expect(q.items.find((r) => r.kind === 'LABOUR')).toMatchObject({ number: 'B.1', unit: 'hour', qty: 16 });
    const again = await sales.post(`/admin/surveys/${inbox.id}/quotation`).send({});
    expect([409, 422]).toContain(again.status);
  });

  it('DELETE /admin/surveys/:id only removes a draft', async () => {
    const res = await sales.delete(`/admin/surveys/${inbox.id}`);
    expect([409, 422]).toContain(res.status);
  });

  it('a survey the office has quoted refuses a late submit', async () => {
    const res = await (await as('ADMIN')).post(`/tech/surveys/${inbox.id}/submit`).send({});
    expect(expectStatus(res, 422).error.code).toBe('INVALID_TRANSITION');
  });
});

describe('field survey flow', () => {
  let surveyor;
  let job;
  let surveyId;

  beforeAll(async () => {
    surveyor = await as('SURVEYOR');
    ({ job } = await createAssignedJob({ assignee: 'SURVEYOR', type: 'INSPECTION' }));
  });

  it('POST /tech/jobs/:id/survey creates, then returns the same survey', async () => {
    const first = expectStatus(await surveyor.post(`/tech/jobs/${job.id}/survey`).send({}), 201);
    surveyId = first.data.id;
    const second = expectStatus(await surveyor.post(`/tech/jobs/${job.id}/survey`).send({}), 200);
    expect(second.data.id).toBe(surveyId);
  });

  it('GET /tech/surveys and /tech/surveys/:id carry no money', async () => {
    const list = expectStatus(await surveyor.get('/tech/surveys'), 200);
    expect(list.data.map((s) => s.id)).toContain(surveyId);
    const one = expectStatus(await surveyor.get(`/tech/surveys/${surveyId}`), 200);
    expect(JSON.stringify(one.data)).not.toMatch(/"(rate|amount|sellRate|purchaseRate)"/);
  });

  it('another technician cannot read this survey', async () => {
    const res = await (await as('TECHNICIAN')).get(`/tech/surveys/${surveyId}`);
    expect([403, 404]).toContain(res.status);
  });

  it('PUT /tech/surveys/:id refuses a line that carries a rate', async () => {
    expectStatus(await surveyor.put(`/tech/surveys/${surveyId}`).send({
      items: [{ kind: 'OTHER', description: 'Priced line', unit: 'nos', qty: 1, rate: 500 }],
    }), 400);
  });

  it('PUT /tech/surveys/:id saves a draft as a full replace', async () => {
    const body = expectStatus(await surveyor.put(`/tech/surveys/${surveyId}`).send({
      problemSummary: 'Crack above the lintel',
      readings: [
        { label: 'Crack width at mid-span', metric: 'crack_width', value: 2.5, unit: 'mm' },
        { label: 'Structural movement?', metric: 'observation', textValue: 'None apparent' },
      ],
      items: [{ kind: 'OTHER', description: 'Crack stitching', unit: 'rft', qty: 6 }],
    }), 200);
    expect(body.data.readings.length).toBe(2);
    const replaced = expectStatus(await surveyor.put(`/tech/surveys/${surveyId}`).send({
      readings: [{ label: 'Only reading', metric: 'observation', textValue: 'ok' }],
    }), 200);
    expect(replaced.data.readings.length).toBe(1);
  });

  it('a reading needs a value or an observation', async () => {
    expectStatus(await surveyor.put(`/tech/surveys/${surveyId}`).send({
      readings: [{ label: 'Empty reading', metric: 'moisture' }],
    }), 400);
  });

  it('POST /tech/surveys/:id/photos attaches evidence to the inspection job', async () => {
    const res = await surveyor.post(`/tech/surveys/${surveyId}/photos`).attach('files', await pngBuffer(), 'crack.png');
    expect(expectStatus(res, 201).data.photos[0].kind).toBe('ISSUE');
  });

  it('the office review resolves each site photo to its image (defect #18)', async () => {
    const body = expectStatus(await (await as('SALES')).get(`/admin/surveys/${surveyId}`), 200).data;
    const photo = body.job.photos.at(-1);
    expect(body.media[photo.mediaId]).toMatchObject({ id: photo.mediaId, url: expect.any(String) });
  });

  it('POST /tech/surveys/:id/submit closes the inspection job', async () => {
    const body = expectStatus(await surveyor.post(`/tech/surveys/${surveyId}/submit`).send({
      items: [{ kind: 'OTHER', description: 'Crack stitching', unit: 'rft', qty: 6 }],
      readings: [{ label: 'Crack width', metric: 'crack_width', value: 2.5, unit: 'mm' }],
    }), 200);
    expect(body.data.status).toBe('SUBMITTED');
    expect((await prisma.job.findUnique({ where: { id: job.id } })).status).toBe('COMPLETED');
  });

  it('a replayed submit — bare or carrying its payload — returns the survey unchanged', async () => {
    const before = await prisma.siteSurvey.findUnique({ where: { id: surveyId }, include: { items: true, readings: true } });
    const payload = { items: [{ kind: 'OTHER', description: 'Something else entirely', unit: 'nos', qty: 99 }] };

    const sync = expectStatus(await surveyor.post('/tech/sync').send({
      mutations: [
        { idempotencyKey: uid('sync-'), at: new Date().toISOString(), kind: 'survey_submit', surveyId, payload: {} },
        { idempotencyKey: uid('sync-'), at: new Date(Date.now() + 1).toISOString(), kind: 'survey_submit', surveyId, payload },
      ],
    }), 200);
    expect(sync.data.applied).toBe(2);
    expectStatus(await surveyor.post(`/tech/surveys/${surveyId}/submit`).send(payload), 200);

    const after = await prisma.siteSurvey.findUnique({ where: { id: surveyId }, include: { items: true, readings: true } });
    expect(after.status).toBe('SUBMITTED');
    expect(after.submittedAt.getTime()).toBe(before.submittedAt.getTime());
    expect(after.items.map((i) => i.description)).toEqual(before.items.map((i) => i.description));
    expect(after.readings.length).toBe(before.readings.length);
  });

  it('DISPATCHER cannot write a survey through the field app', async () => {
    expectStatus(await (await as('DISPATCHER')).put(`/tech/surveys/${surveyId}`).send({ problemSummary: 'x' }), 403);
  });
});

// ── Phase L5: the site-visit kit — checklist, measurement sheet, photos by area

/** A service of the test's own, so its checklist cannot reach any other survey in the suite. */
async function serviceWithTemplate(questions) {
  const service = await prisma.service.create({
    data: { name: `L5 service ${uid()}`, slug: uid('l5-svc-'), excerpt: 'Test service' },
  });
  const sales = await as('SALES');
  const template = expectStatus(await sales.post('/admin/inspection-templates').send({
    serviceId: service.id, name: `Damp checklist ${uid()}`, questions,
  }), 201).data;
  return { service, template };
}

/** A fresh inspection survey for the SURVEYOR, on `serviceId`. */
async function surveyOn(serviceId) {
  const surveyor = await as('SURVEYOR');
  const { job } = await createAssignedJob({ assignee: 'SURVEYOR', type: 'INSPECTION' });
  const survey = expectStatus(await surveyor.post(`/tech/jobs/${job.id}/survey`).send({}), 201).data;
  await prisma.siteSurvey.update({ where: { id: survey.id }, data: { serviceId } });
  return { surveyor, job, survey };
}

const DAMP = [
  { key: 'moisture', label: 'Moisture at 300 mm', type: 'NUMBER', unit: '%', metric: 'moisture', flag: { above: 20 }, required: true, photoRequired: true },
  { key: 'dpc_visible', label: 'DPC visible at plinth?', type: 'YES_NO', flag: { equals: 'no' }, required: true },
  { key: 'salt', label: 'Salt deposits', type: 'CHOICE', options: ['None', 'Light', 'Heavy'], flag: { values: ['Heavy'] } },
  { key: 'source', label: 'Likely source of water', type: 'TEXT' },
];

/**
 * Two rooms, measured as the surveyor walks them (feet): the bedroom's two walls less its door, the
 * kitchen's wall less its window — one line per room, and the labour.
 */
const ROOMS = {
  bedroom: [
    { area: 'Bedroom', description: 'North and east walls', nos: 2, l: 12.5, h: 9 },
    { area: 'Bedroom', description: 'Door', nos: 1, l: 3, h: 7, deduct: true },
  ],
  kitchen: [
    { area: 'Kitchen', description: 'Back wall', nos: 1, l: 10, h: 9 },
    { area: 'Kitchen', description: 'Window', nos: 1, l: 4, h: 4, deduct: true },
  ],
};

describe('inspection templates (Phase L5)', () => {
  it('a registry resource with a checked question schema', async () => {
    const sales = await as('SALES');
    const bad = async (questions) => expectStatus(await sales.post('/admin/inspection-templates').send({ name: 'Bad', questions }), 400);
    await bad([{ key: 'kind', label: 'Kind', type: 'CHOICE', options: ['Only one'] }]);
    await bad([{ key: 'a', label: 'A', type: 'TEXT' }, { key: 'a', label: 'A again', type: 'TEXT' }]);
    await bad([{ key: 'dpc', label: 'DPC?', type: 'YES_NO', flag: { above: 3 } }]);
    await bad([{ key: 'salt', label: 'Salt', type: 'CHOICE', options: ['None', 'Heavy'], flag: { values: ['Some'] } }]);
    await bad([{ key: 'Bad Key', label: 'x', type: 'TEXT' }]);
    // An empty threshold box is "no threshold", not zero.
    const { template } = await serviceWithTemplate([{ key: 'm', label: 'M', type: 'NUMBER', flag: { above: 20, below: '' } }]);
    expect(template.questions[0].flag).toEqual({ above: 20 });
    expectStatus(await (await as('DISPATCHER')).get('/admin/inspection-templates'), 200);
    expectStatus(await (await as('DISPATCHER')).post('/admin/inspection-templates').send({ name: 'x', questions: DAMP }), 403);
    expectStatus(await (await as('SURVEYOR')).get('/admin/inspection-templates'), 403);
  });

  it('the surveyor gets the service\'s checklist with the survey', async () => {
    const { service, template } = await serviceWithTemplate(DAMP);
    const { surveyor, survey } = await surveyOn(service.id);
    const body = expectStatus(await surveyor.get(`/tech/surveys/${survey.id}`), 200).data;
    expect(body.template).toMatchObject({ id: template.id, questions: [{ key: 'moisture', flag: { above: 20 } }, {}, {}, {}] });
    const list = expectStatus(await surveyor.get('/tech/surveys'), 200).data;
    expect(list.find((s) => s.id === survey.id).template.id).toBe(template.id);
  });
});

describe('the checklist blocks submit and flags answers (Phase L5)', () => {
  let surveyor;
  let survey;
  let job;
  const line = { kind: 'OTHER', description: 'Damp-proof plaster', unit: 'sq.ft', qty: 100 };

  beforeAll(async () => {
    const { service } = await serviceWithTemplate(DAMP);
    ({ surveyor, survey, job } = await surveyOn(service.id));
  });

  it('a missing required answer or photo is refused with each one named', async () => {
    const res = expectStatus(await surveyor.post(`/tech/surveys/${survey.id}/submit`).send({
      items: [line],
      readings: [{ questionKey: 'moisture', label: 'Moisture at 300 mm', value: 24 }],
    }), 422);
    expect(res.error.code).toBe('SURVEY_INCOMPLETE');
    expect(res.error.details).toEqual([
      { questionKey: 'moisture', label: 'Moisture at 300 mm', missing: 'photo' },
      { questionKey: 'dpc_visible', label: 'DPC visible at plinth?', missing: 'answer' },
    ]);
    // The same answer through the offline queue names the same gaps, so the phone can point at them.
    const sync = expectStatus(await surveyor.post('/tech/sync').send({
      mutations: [{ idempotencyKey: uid('l5-'), at: new Date().toISOString(), kind: 'survey_submit', surveyId: survey.id, payload: {} }],
    }), 200).data;
    expect(sync.results[0]).toMatchObject({ status: 'failed', code: 'SURVEY_INCOMPLETE', details: expect.arrayContaining([expect.objectContaining({ questionKey: 'dpc_visible' })]) });
    expect((await prisma.siteSurvey.findUnique({ where: { id: survey.id } })).status).toBe('DRAFT');
  });

  it('flagged is the server\'s, from the template — whatever the phone says', async () => {
    const body = expectStatus(await surveyor.put(`/tech/surveys/${survey.id}`).send({
      readings: [
        { questionKey: 'moisture', label: 'Moisture at 300 mm', value: 24, flagged: false },
        { questionKey: 'dpc_visible', label: 'DPC visible at plinth?', textValue: 'no' },
        { questionKey: 'salt', label: 'Salt deposits', textValue: 'Light', flagged: true },
        { label: 'Free reading', metric: 'humidity', value: 80, unit: '%' },
      ],
    }), 200).data;
    const byKey = Object.fromEntries(body.readings.map((r) => [r.questionKey ?? r.label, r]));
    expect(byKey.moisture).toMatchObject({ flagged: true, metric: 'moisture', unit: '%' });
    expect(byKey.dpc_visible.flagged).toBe(true);
    expect(byKey.salt.flagged).toBe(false);
    expect(byKey['Free reading'].flagged).toBe(false);
    const below = expectStatus(await surveyor.put(`/tech/surveys/${survey.id}`).send({
      readings: [{ questionKey: 'moisture', label: 'Moisture at 300 mm', value: 12 }],
    }), 200).data;
    expect(below.readings[0].flagged).toBe(false);
  });

  it('with every answer and the photo on its answer, it submits', async () => {
    const photo = expectStatus(await surveyor.post(`/tech/surveys/${survey.id}/photos`)
      .field('area', 'Bedroom').field('caption', 'Meter at 24 %').attach('files', await pngBuffer(), 'meter.png'), 201).data;
    const mediaId = photo.media[0].id;
    const body = expectStatus(await surveyor.post(`/tech/surveys/${survey.id}/submit`).send({
      items: [line],
      readings: [
        { questionKey: 'moisture', label: 'Moisture at 300 mm', value: 24, mediaId },
        { questionKey: 'dpc_visible', label: 'DPC visible at plinth?', textValue: 'no' },
      ],
    }), 200).data;
    expect(body.status).toBe('SUBMITTED');
    expect((await prisma.job.findUnique({ where: { id: job.id } })).status).toBe('COMPLETED');
    // The office sees the answer's photo, and the flagged reading.
    const office = expectStatus(await (await as('SALES')).get(`/admin/surveys/${survey.id}`), 200).data;
    expect(office.media[mediaId]).toMatchObject({ url: expect.any(String) });
    expect(office.readings.find((r) => r.questionKey === 'moisture')).toMatchObject({ flagged: true, mediaId });
    expect(office.template.questions.map((q) => q.key)).toEqual(['moisture', 'dpc_visible', 'salt', 'source']);
  });
});

describe('the measurement sheet (Phase L5)', () => {
  let surveyor;
  let survey;
  let job;

  beforeAll(async () => {
    ({ surveyor, survey, job } = await surveyOn(null));
  });

  it('two rooms with a door and a window deducted derive the quantities', async () => {
    const body = expectStatus(await surveyor.put(`/tech/surveys/${survey.id}`).send({
      items: [
        // A stale qty from the phone is ignored when the sheet is there.
        { kind: 'OTHER', description: 'Damp-proof plaster, bedroom', unit: 'sq.ft', qty: 1, measurements: ROOMS.bedroom },
        { kind: 'OTHER', description: 'Damp-proof plaster, kitchen', unit: 'sq.ft', measurements: ROOMS.kitchen },
        { kind: 'OTHER', description: 'Both rooms, one line', unit: 'sq.ft', measurements: [...ROOMS.bedroom, ...ROOMS.kitchen] },
      ],
    }), 200).data;
    // 2 × 12.5 × 9 − 3 × 7 = 204; 10 × 9 − 4 × 4 = 74.
    expect(body.items.map((i) => i.qty)).toEqual([204, 74, 278]);
    expect(body.items[0].measurements).toEqual(ROOMS.bedroom);
  });

  it('a sheet whose deductions are larger than the wall is refused', async () => {
    const res = expectStatus(await surveyor.put(`/tech/surveys/${survey.id}`).send({
      items: [{ kind: 'OTHER', description: 'Too much door', unit: 'sq.ft', measurements: [
        { area: 'Hall', nos: 1, l: 3, h: 7 }, { area: 'Hall', nos: 1, l: 4, h: 7, deduct: true },
      ] }],
    }), 422);
    expect(res.error.code).toBe('NEGATIVE_LINE');
    expectStatus(await surveyor.put(`/tech/surveys/${survey.id}`).send({
      items: [{ kind: 'OTHER', description: 'Neither qty nor sheet', unit: 'sq.ft' }],
    }), 400);
  });

  it('survey_draft replays idempotently with measurements, readings and the site pin', async () => {
    const site = await prisma.customerSite.create({ data: { customerId: job.customerId, label: 'Home', address: 'Jhamsikhel, Lalitpur' } });
    await prisma.siteSurvey.update({ where: { id: survey.id }, data: { siteId: site.id } });
    const payload = {
      readings: [{ label: 'Humidity', metric: 'humidity', value: 78, unit: '%' }],
      items: [
        { kind: 'OTHER', description: 'Damp-proof plaster, bedroom', unit: 'sq.ft', qty: 204, measurements: ROOMS.bedroom },
        { kind: 'OTHER', description: 'Damp-proof plaster, kitchen', unit: 'sq.ft', qty: 74, measurements: ROOMS.kitchen },
      ],
      sitePin: { lat: 27.6784, lng: 85.3094, accuracy: 8 },
    };
    const draft = (key) => ({ idempotencyKey: key, at: new Date().toISOString(), kind: 'survey_draft', surveyId: survey.id, payload });
    const keyA = uid('l5-draft-');
    const first = expectStatus(await surveyor.post('/tech/sync').send({ mutations: [draft(keyA), draft(uid('l5-draft-'))] }), 200).data;
    expect(first.results).toEqual([expect.objectContaining({ status: 'applied' }), expect.objectContaining({ status: 'applied' })]);
    expect(first.applied).toBe(2);
    const again = expectStatus(await surveyor.post('/tech/sync').send({ mutations: [draft(keyA)] }), 200).data;
    expect(again.duplicates).toBe(1);

    const stored = await prisma.siteSurvey.findUnique({ where: { id: survey.id }, include: { items: { orderBy: { sortOrder: 'asc' } }, readings: true } });
    expect(stored.items.map((i) => [i.qty, i.measurements])).toEqual([[204, ROOMS.bedroom], [74, ROOMS.kitchen]]);
    expect(stored.readings).toHaveLength(1);
    expect(await prisma.customerSite.findUnique({ where: { id: site.id } })).toMatchObject({ lat: 27.6784, lng: 85.3094 });
    // Two drafts setting the same pin record one move.
    const pins = await prisma.auditLog.findMany({ where: { model: 'CustomerSite', recordId: site.id, event: 'site.pinned' } });
    expect(pins).toHaveLength(1);
  });

  it('photos carry their area, and a SKETCH is a photo of a paper sketch', async () => {
    const sketch = expectStatus(await surveyor.post(`/tech/surveys/${survey.id}/photos`)
      .field('kind', 'SKETCH').field('area', 'Bedroom').field('caption', 'Plan with sizes')
      .attach('files', await pngBuffer('#ffffff'), 'sketch.png'), 201).data;
    expect(sketch.photos[0]).toMatchObject({ kind: 'SKETCH', area: 'Bedroom', caption: 'Plan with sizes' });
    expectStatus(await surveyor.post(`/tech/surveys/${survey.id}/photos`).field('kind', 'SIGNATURE')
      .attach('files', await pngBuffer(), 'x.png'), 400);
    const body = expectStatus(await surveyor.get(`/tech/surveys/${survey.id}`), 200).data;
    expect(body.job.photos.find((p) => p.kind === 'SKETCH')).toMatchObject({ area: 'Bedroom' });
  });

  it('Build quotation keeps the rooms as sections and the measurement rows', async () => {
    const [treatment, labour] = await Promise.all([
      prisma.rateCardItem.findUnique({ where: { code: 'SEEP-CHEM' } }),
      prisma.rateCardItem.findUnique({ where: { code: 'LABOUR-SKILL' } }),
    ]);
    expectStatus(await surveyor.post(`/tech/surveys/${survey.id}/submit`).send({
      items: [
        { kind: 'SERVICE', rateCardItemId: treatment.id, description: 'Crystalline treatment, bedroom', unit: 'sq.ft', measurements: ROOMS.bedroom },
        { kind: 'SERVICE', rateCardItemId: treatment.id, description: 'Crystalline treatment, kitchen', unit: 'sq.ft', measurements: ROOMS.kitchen },
        { kind: 'LABOUR', rateCardItemId: labour.id, description: 'Skilled applicator', unit: 'hour', qty: 16 },
      ],
    }), 200);
    const q = expectStatus(await (await as('SALES')).post(`/admin/surveys/${survey.id}/quotation`).send({}), 201).data.quotation;
    expect(q.items.filter((r) => r.rowType === 'SECTION').map((r) => r.description)).toEqual(['Bedroom', 'Kitchen', 'Labour']);
    const rows = q.items.filter((r) => r.rowType === 'ITEM');
    expect(rows.map((r) => [r.number, r.netQty, r.qty])).toEqual([['A.1', 204, 204], ['B.1', 74, 74], ['C.1', 16, 16]]);
    expect(rows[0].measurements).toEqual(ROOMS.bedroom);
    expect(rows[1].measurements).toEqual(ROOMS.kitchen);
  });
});
