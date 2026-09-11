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
