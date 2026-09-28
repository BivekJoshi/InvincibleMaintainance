import { describe, it, expect, beforeAll } from 'vitest';
import {
  anon, as, expectStatus, phone, prisma, uid, USERS,
} from './helpers.js';

/**
 * Phase L7 — a variation order is a quotation of kind VARIATION against a running job: the same builder,
 * approval (maker-checker, LOW_MARGIN) and no-login customer link. Only it may omit work (negative rows).
 * Accepting it adds job lines and requirements — no new job, no lead change, no advance.
 */

const NO_ADVANCE = [{ label: 'On completion', basisPoints: 10000, trigger: 'ON_COMPLETION' }];
const accept = (token) => anon().post(`/public/quotations/${token}/decide`).set('User-Agent', 'Mozilla/5.0 (Linux; Android 14) Mobile').send({ decision: 'approve' });

let sales;
let manager;
let admin;
let dispatcher;

/** A running job: a BOQ quotation accepted (paid on completion, so no advance holds it) with its lead WON. */
async function runningJob() {
  const customer = expectStatus(await sales.post('/admin/customers').send({ name: `Variation ${uid()}`, phone: phone() }), 201).data;
  const salesId = (await prisma.user.findUnique({ where: { email: USERS.SALES } })).id;
  const lead = await prisma.lead.create({ data: { name: customer.name, phone: customer.phone, customerId: customer.id, status: 'QUOTED', assignedToId: salesId, source: 'call' } });
  const plaster = await prisma.rateCardItem.findUnique({ where: { code: 'PLASTER-INT' } });
  const q = expectStatus(await sales.post('/admin/quotations').send({
    customerId: customer.id, leadId: lead.id, paymentStages: NO_ADVANCE,
    items: [{ rateCardItemId: plaster.id, kind: 'SERVICE', description: plaster.name, unit: plaster.unit, rate: plaster.rate / 100, qty: 300 }],
  }), 201).data;
  expectStatus(await sales.post(`/admin/quotations/${q.id}/submit`), 200);
  const submitted = await prisma.quotation.findUnique({ where: { id: q.id } });
  if (submitted.status === 'PENDING_APPROVAL') expectStatus(await manager.post(`/admin/quotations/${q.id}/approve`).send({ acknowledgeLowMargin: true }), 200);
  const sent = expectStatus(await sales.post(`/admin/quotations/${q.id}/send`), 200).data;
  expectStatus(await accept(sent.publicToken), 200);
  const job = await prisma.job.findFirst({ where: { quotationId: q.id } });
  return { job, lead, customer, plaster };
}

/** A variation on `job` by MANAGER: 30 sq.ft of damp treatment added, 20 sq.ft of plaster omitted. */
async function variationFor(job, plaster, author = manager) {
  const damp = await prisma.rateCardItem.findUnique({ where: { code: 'SEEP-CHEM' } });
  return expectStatus(await author.post('/admin/quotations').send({
    jobId: job.id,
    items: [
      { rowType: 'SECTION', description: 'Store room' },
      { rateCardItemId: damp.id, kind: 'SERVICE', description: 'Damp treatment, store room wall', unit: damp.unit, rate: damp.rate / 100, qty: 30 },
      { rateCardItemId: plaster.id, kind: 'SERVICE', description: 'Omit: plaster on the store room', unit: plaster.unit, rate: plaster.rate / 100, qty: -20 },
    ],
  }), 201).data;
}

beforeAll(async () => {
  [sales, manager, admin, dispatcher] = await Promise.all([as('SALES'), as('MANAGER'), as('ADMIN'), as('DISPATCHER')]);
});

describe('a variation order (L7.4)', () => {
  let ctx;
  let vo;

  beforeAll(async () => {
    ctx = await runningJob();
    vo = await variationFor(ctx.job, ctx.plaster);
  });

  it('is kind VARIATION on the job, numbered VO-, with its customer and no schedule — omissions allowed', async () => {
    expect(vo).toMatchObject({ kind: 'VARIATION', jobId: ctx.job.id, customerId: ctx.customer.id, leadId: null, status: 'DRAFT' });
    expect(vo.number).toMatch(/^VO-/);
    expect(vo.paymentStages).toEqual([]);
    const omission = vo.items.find((i) => i.description.startsWith('Omit'));
    expect(omission.qty).toBe(-20);
    expect(omission.amount).toBeLessThan(0);
    expect(vo.subtotal).toBe(vo.items.filter((i) => i.rowType === 'ITEM').reduce((a, i) => a + i.amount, 0));
    const detail = expectStatus(await sales.get(`/admin/quotations/${vo.id}`), 200).data;
    expect(detail.job).toMatchObject({ id: ctx.job.id, number: ctx.job.number });
  });

  it('a negative row on an ordinary quotation is 422 NEGATIVE_LINE', async () => {
    const res = expectStatus(await sales.post('/admin/quotations').send({
      customerId: ctx.customer.id, items: [{ description: 'Omit something', unit: 'sq.ft', qty: -5, rate: 100 }],
    }), 422);
    expect(res.error.code).toBe('NEGATIVE_LINE');
  });

  it('goes through the same approval: no self-approval, the margin gate, then the customer\'s link', async () => {
    expectStatus(await manager.post(`/admin/quotations/${vo.id}/submit`), 200);
    expect(expectStatus(await manager.post(`/admin/quotations/${vo.id}/approve`).send({ acknowledgeLowMargin: true }), 403).error.code).toBe('SELF_APPROVAL');
    const margin = await prisma.quotation.findUnique({ where: { id: vo.id } });
    if (!margin.costComplete) expect(expectStatus(await admin.post(`/admin/quotations/${vo.id}/approve`).send({}), 422).error.code).toBe('LOW_MARGIN');
    expectStatus(await admin.post(`/admin/quotations/${vo.id}/approve`).send({ acknowledgeLowMargin: true }), 200);
    const sent = expectStatus(await sales.post(`/admin/quotations/${vo.id}/send`), 200).data;
    const page = expectStatus(await anon().get(`/public/quotations/${sent.publicToken}`), 200).data;
    expect(page).toMatchObject({ kind: 'VARIATION', job: { number: ctx.job.number }, advance: null });
    vo = sent;
  });

  it('accepted by the customer — once — it adds VARIATION lines and requirements to the job; the lead is untouched', async () => {
    const leadBefore = await prisma.lead.findUnique({ where: { id: ctx.lead.id } });
    const jobsBefore = await prisma.job.count({ where: { customerId: ctx.customer.id } });
    const [a, b] = await Promise.all([accept(vo.publicToken), accept(vo.publicToken)]);
    expect([a.status, b.status].sort()).toEqual([200, 422]);
    const ok = a.status === 200 ? a : b;
    expect(ok.body.data.job).toMatchObject({ id: ctx.job.id, number: ctx.job.number });

    const lines = await prisma.jobLine.findMany({ where: { jobId: ctx.job.id }, orderBy: { sortOrder: 'asc' } });
    const added = lines.filter((l) => l.source === 'VARIATION');
    expect(added.map((l) => [l.number, l.section, l.quotedQty])).toEqual([
      [`${vo.number} · A.1`, `Variation ${vo.number} — Store room`, 30],
      [`${vo.number} · A.2`, `Variation ${vo.number} — Store room`, -20],
    ]);
    expect(Math.min(...added.map((l) => l.sortOrder))).toBeGreaterThan(Math.max(...lines.filter((l) => l.source === 'QUOTATION').map((l) => l.sortOrder)));
    expect(await prisma.jobRequirement.count({ where: { jobId: ctx.job.id, source: 'VARIATION' } })).toBeGreaterThan(0);
    expect((await prisma.quotation.findUnique({ where: { id: vo.id } })).status).toBe('CONVERTED');
    expect(await prisma.job.count({ where: { customerId: ctx.customer.id } })).toBe(jobsBefore);
    expect(await prisma.invoice.count({ where: { quotationId: vo.id } })).toBe(0);
    const leadAfter = await prisma.lead.findUnique({ where: { id: ctx.lead.id } });
    expect([leadAfter.status, leadAfter.stageEnteredAt?.getTime()]).toEqual([leadBefore.status, leadBefore.stageEnteredAt?.getTime()]);
    expect(await prisma.auditLog.findFirst({ where: { event: 'job.variation_added', recordId: ctx.job.id } })).toBeTruthy();
  });

  it('shows on the job: the variations list (money for quotation readers only) and the BOQ progress', async () => {
    const forSales = expectStatus(await sales.get(`/admin/jobs/${ctx.job.id}/variations`), 200).data;
    expect(forSales[0]).toMatchObject({ id: vo.id, status: 'CONVERTED', total: expect.any(Number) });
    const forDispatch = expectStatus(await dispatcher.get(`/admin/jobs/${ctx.job.id}/variations`), 200).data;
    expect(forDispatch[0]).not.toHaveProperty('total');
    const progress = expectStatus(await sales.get(`/admin/jobs/${ctx.job.id}/progress`), 200).data;
    expect(progress.sections.map((s) => s.title)).toContain(`Variation ${vo.number} — Store room`);
    const omission = progress.sections.flatMap((s) => s.lines).find((l) => l.quotedQty === -20);
    expect(omission.value).toBeLessThan(0);
  });
});

describe('variations, the other ways in (L7.4)', () => {
  it('a staff convert of an accepted-by-phone variation adds its lines; a revision keeps kind and job', async () => {
    const { job, plaster, lead } = await runningJob();
    const vo = await variationFor(job, plaster, sales);
    await prisma.quotation.update({ where: { id: vo.id }, data: { status: 'APPROVED', decidedAt: new Date() } });
    const body = expectStatus(await dispatcher.post(`/admin/quotations/${vo.id}/convert-to-job`).send({}), 201).data;
    expect(body.id).toBe(job.id);
    expect(body.lines.filter((l) => l.source === 'VARIATION')).toHaveLength(2);
    expect((await prisma.lead.findUnique({ where: { id: lead.id } })).status).toBe('WON');
    expect(expectStatus(await dispatcher.post(`/admin/quotations/${vo.id}/convert-to-job`).send({}), 422).error.code).toBe('INVALID_TRANSITION');

    const other = await variationFor(job, plaster, sales);
    await prisma.quotation.update({ where: { id: other.id }, data: { status: 'CHANGES_REQUESTED' } });
    const revised = expectStatus(await sales.post(`/admin/quotations/${other.id}/revise`), 201).data;
    expect(revised).toMatchObject({ kind: 'VARIATION', jobId: job.id, version: 2 });
    expect(revised.number).toMatch(/^VO-/);
  });

  it('a closed job takes no variation', async () => {
    const { job, plaster } = await runningJob();
    await prisma.job.update({ where: { id: job.id }, data: { status: 'CANCELLED' } });
    const res = expectStatus(await sales.post('/admin/quotations').send({
      jobId: job.id, items: [{ rateCardItemId: plaster.id, kind: 'SERVICE', description: 'More plaster', unit: plaster.unit, rate: plaster.rate / 100, qty: 10 }],
    }), 422);
    expect(res.error.code).toBe('VARIATION_JOB_CLOSED');
  });
});
