import { describe, it, expect, beforeAll } from 'vitest';
import {
  anon, as, approveAndSend, expectStatus, findKeys, payAdvance, prisma, technicianIdFor, uid, phone, USERS,
} from './helpers.js';
import { documentTotals, lineAmount, proRata } from '../../src/utils/money.js';

/**
 * Phase L8 — close-out. A BOQ job is billed advance (L6) → running bills per MILESTONE stage → a FINAL bill by the
 * contract type (L-D2), which deducts every earlier stage bill, so advance + running + final = the contract to the
 * paisa, VAT included, and jobCosting.invoiced = the contract's taxable value.
 */

const STAGES = [
  { label: 'Advance', basisPoints: 5000, trigger: 'ON_ACCEPT' },
  { label: 'Plaster done', basisPoints: 4000, trigger: 'MILESTONE' },
  { label: 'On completion', basisPoints: 1000, trigger: 'ON_COMPLETION' },
];

let sales;
let manager;
let dispatcher;
let accountant;
let plaster;

beforeAll(async () => {
  [sales, manager, dispatcher, accountant] = await Promise.all([as('SALES'), as('MANAGER'), as('DISPATCHER'), as('ACCOUNTANT')]);
  plaster = await prisma.rateCardItem.findUnique({ where: { code: 'PLASTER-INT' } });
});

const accept = (token) => anon().post(`/public/quotations/${token}/decide`).set('User-Agent', 'Mozilla/5.0 (Linux; Android 14) Mobile').send({ decision: 'approve' });

/**
 * A 50/40/10 BOQ job of `contractType`: A.1 plaster 200 sq.ft (rate library), A.2 waterproof coat 150 sq.ft at
 * Rs 95, Rs 1,000 off — accepted, its advance paid, scheduled on the TECHNICIAN and in progress.
 */
async function contractJob(contractType, { provisional = false } = {}) {
  const customer = expectStatus(await sales.post('/admin/customers').send({ name: `Contract ${uid()}`, phone: phone() }), 201).data;
  const q = expectStatus(await sales.post('/admin/quotations').send({
    customerId: customer.id, contractType, estimatedDays: 5, discount: 1000, paymentStages: STAGES,
    items: [
      { rowType: 'SECTION', description: 'Walls' },
      { rateCardItemId: plaster.id, kind: 'SERVICE', description: plaster.name, unit: plaster.unit, rate: plaster.rate / 100, qty: 200 },
      { kind: 'OTHER', description: 'Waterproof coat', unit: 'sq.ft', rate: 95, qty: 150, isProvisional: provisional },
    ],
  }), 201).data;
  const sent = await approveAndSend(q.id);
  expectStatus(await accept(sent.publicToken), 200);
  const job = await prisma.job.findFirst({ where: { quotationId: q.id } });
  const advance = await payAdvance(job.id);
  expectStatus(await dispatcher.post(`/admin/jobs/${job.id}/schedule`).send({
    scheduledStart: new Date().toISOString(), technicianIds: [await technicianIdFor('TECHNICIAN')],
  }), 200);
  expectStatus(await dispatcher.patch(`/admin/jobs/${job.id}/status`).send({ status: 'IN_PROGRESS' }), 200);
  const quote = expectStatus(await sales.get(`/admin/quotations/${q.id}`), 200).data;
  const lines = await prisma.jobLine.findMany({ where: { jobId: job.id }, orderBy: { sortOrder: 'asc' } });
  return { job, quote, advance, customer, lines };
}

/** Raises the MILESTONE stage's running bill, sends it and pays it in full. */
async function runningBill(job, quote) {
  const stage = quote.paymentStages.find((st) => st.trigger === 'MILESTONE');
  const inv = expectStatus(await accountant.post(`/admin/jobs/${job.id}/invoices/stage`).send({ paymentStageId: stage.id }), 201).data;
  expect(inv).toMatchObject({ kind: 'RUNNING', status: 'DRAFT', paymentStageId: stage.id, jobId: job.id, total: stage.total, vatAmount: stage.vat });
  const sent = expectStatus(await accountant.post(`/admin/invoices/${inv.id}/send`), 200).data;
  expectStatus(await accountant.post(`/admin/invoices/${inv.id}/payments`).send({ amount: sent.total / 100, method: 'BANK' }), 201);
  return sent;
}

/** A variation on the job, approved by the manager and accepted on the customer's link. */
async function acceptedVariation(job, items) {
  const vo = expectStatus(await sales.post('/admin/quotations').send({ jobId: job.id, items }), 201).data;
  expectStatus(await sales.post(`/admin/quotations/${vo.id}/submit`), 200);
  if ((await prisma.quotation.findUnique({ where: { id: vo.id } })).status === 'PENDING_APPROVAL') {
    expectStatus(await manager.post(`/admin/quotations/${vo.id}/approve`).send({ acknowledgeLowMargin: true }), 200);
  }
  const sent = expectStatus(await sales.post(`/admin/quotations/${vo.id}/send`), 200).data;
  expectStatus(await accept(sent.publicToken), 200);
  return sent;
}

const complete = (job) => dispatcher.post(`/admin/jobs/${job.id}/complete`).send({ note: 'Handed over' });
const measure = (api, job, line, qty) => api.put(`/admin/jobs/${job.id}/lines/${line.id}/measure`).send({ measurements: [{ description: 'Measured on site', nos: 1, l: qty }] });

describe('ITEM_RATE: measured × rate + the variation − the stage bills (L-D2)', () => {
  let ctx;
  let running;
  let vo;
  let final;

  beforeAll(async () => {
    ctx = await contractJob('ITEM_RATE');
    running = await runningBill(ctx.job, ctx.quote);
    const progress = expectStatus(await accountant.get(`/admin/jobs/${ctx.job.id}/progress`), 200).data;
    expect(progress.stages.find((st) => st.trigger === 'MILESTONE')).toMatchObject({ billed: true, invoice: { id: running.id, number: running.number } });
    vo = await acceptedVariation(ctx.job, [{ rateCardItemId: plaster.id, kind: 'SERVICE', description: 'Store room plaster', unit: plaster.unit, rate: plaster.rate / 100, qty: 40 }]);
  });

  it('the final waits for the measurement: 422 MEASUREMENT_INCOMPLETE while it is open', async () => {
    expectStatus(await complete(ctx.job), 200);
    const res = expectStatus(await accountant.post(`/admin/invoices/from-job/${ctx.job.id}`).send({}), 422);
    expect(res.error.code).toBe('MEASUREMENT_INCOMPLETE');
    const preview = expectStatus(await accountant.get(`/admin/jobs/${ctx.job.id}/final-bill`), 200).data;
    expect(preview).toMatchObject({ boq: true, contractType: 'ITEM_RATE', measurementRequired: true, measurementClosed: false });
    expect(preview.blocking.map((b) => b.code)).toContain('MEASUREMENT_INCOMPLETE');
  });

  it('measured 5 % over — from the office and the field — then closed', async () => {
    const lines = await prisma.jobLine.findMany({ where: { jobId: ctx.job.id }, orderBy: { sortOrder: 'asc' } });
    const [a1, a2, v1] = lines;
    const tech = await as('TECHNICIAN');
    const field = expectStatus(await tech.put(`/tech/jobs/${ctx.job.id}/lines/${a1.id}/measure`).send({ measurements: [{ area: 'North wall', nos: 1, l: 30, h: 7 }] }), 200).data;
    expect(field).toMatchObject({ id: a1.id, measuredQty: 210, quotedQty: 200 });
    expect(findKeys(field, (k) => /rate|amount|total|value|cost/i.test(k) && !k.endsWith('Id'))).toEqual([]);
    expectStatus(await (await as('TECHNICIAN2')).put(`/tech/jobs/${ctx.job.id}/lines/${a1.id}/measure`).send({ measurements: [{ nos: 1, l: 1 }] }), 403);
    expect(expectStatus(await measure(dispatcher, ctx.job, a2, 157.5), 200).data.measuredQty).toBe(157.5);

    const early = expectStatus(await dispatcher.post(`/admin/jobs/${ctx.job.id}/measurement/close`), 422);
    expect(early.error).toMatchObject({ code: 'MEASUREMENT_INCOMPLETE', details: [{ lineId: v1.id }] });
    expectStatus(await measure(dispatcher, ctx.job, v1, 40), 200);
    const closed = expectStatus(await dispatcher.post(`/admin/jobs/${ctx.job.id}/measurement/close`), 200).data;
    expect(closed.measurementClosedAt).toBeTruthy();
    expect(closed.measurementClosedBy).toMatchObject({ name: expect.any(String) });
    expect(expectStatus(await measure(dispatcher, ctx.job, a1, 1), 422).error.code).toBe('MEASUREMENT_CLOSED');
    expect(await prisma.auditLog.findFirst({ where: { event: 'job.measurement_closed', recordId: ctx.job.id } })).toBeTruthy();
  });

  it('the FINAL bills measured × rate + the variation, discount pro rata, less the advance and the running bill', async () => {
    const preview = expectStatus(await accountant.get(`/admin/jobs/${ctx.job.id}/final-bill`), 200).data;
    expect(preview.blocking).toEqual([]);
    final = expectStatus(await accountant.post(`/admin/invoices/from-job/${ctx.job.id}`).send({}), 201).data;
    expect(final).toMatchObject({ kind: 'FINAL', status: 'DRAFT', jobId: ctx.job.id });

    // By hand: measured quantities at the quoted rates; the quotation's Rs 1,000 discount scaled to what was
    // measured of its own lines; the variation has none.
    const rate2 = 9500;
    const measuredQuote = lineAmount(210, plaster.rate) + lineAmount(157.5, rate2);
    const quotedQuote = lineAmount(200, plaster.rate) + lineAmount(150, rate2);
    const discount = proRata(100_000, measuredQuote, quotedQuote);
    const contract = documentTotals([
      { qty: 210, rate: plaster.rate }, { qty: 157.5, rate: rate2 }, { qty: 40, rate: plaster.rate },
    ], { discount, vatRate: ctx.quote.vatRate, vatApplied: ctx.quote.vatApplied });

    expect(final.items.filter((i) => i.kind === 'ITEM').map((i) => i.qty)).toEqual([210, 157.5, 40]);
    const deductions = final.items.filter((i) => i.kind === 'DEDUCTION');
    expect(deductions.map((d) => d.description)).toEqual([`Less: advance ${ctx.advance.number}`, `Less: running bill ${running.number}`]);
    expect(deductions.every((d) => d.amount < 0)).toBe(true);
    expect(final.discount).toBe(discount);
    expect(ctx.advance.total + running.total + final.total).toBe(contract.total);
    expect(ctx.advance.vatAmount + running.vatAmount + final.vatAmount).toBe(contract.vatAmount);
    expect(preview.totals.due.total).toBe(final.total);
    expect(preview.totals.contract.total).toBe(contract.total);
    expect(vo.kind).toBe('VARIATION');

    // Costing counts what was billed, net of discount, and nothing voided: the contract's taxable value.
    const costing = expectStatus(await manager.get(`/admin/jobs/${ctx.job.id}/costing`), 200).data;
    expect(costing.billable.invoiced).toBe(contract.subtotal - contract.discount);
    expect(costing.quoted).toMatchObject({ total: expect.any(Number) });
  });

  it('after the final: no more stage bills, no reopening, no second final', async () => {
    const stage = ctx.quote.paymentStages.find((st) => st.trigger === 'ON_COMPLETION');
    expect(expectStatus(await accountant.post(`/admin/jobs/${ctx.job.id}/invoices/stage`).send({ paymentStageId: stage.id }), 422).error.code).toBe('STAGE_NOT_MILESTONE');
    expect(expectStatus(await dispatcher.post(`/admin/jobs/${ctx.job.id}/measurement/reopen`), 422).error.code).toBe('FINAL_ALREADY_BILLED');
    expectStatus(await accountant.post(`/admin/invoices/from-job/${ctx.job.id}`).send({}), 422);
  });
});

describe('LUMP_SUM: the contract ± variations − the stage bills (L-D2)', () => {
  it('bills the quoted lines (provisional at measured) and the variation, less the advance and running bill', async () => {
    const ctx = await contractJob('LUMP_SUM', { provisional: true });
    const running = await runningBill(ctx.job, ctx.quote);
    await acceptedVariation(ctx.job, [{ rateCardItemId: plaster.id, kind: 'SERVICE', description: 'Omit: plaster behind the stair', unit: plaster.unit, rate: plaster.rate / 100, qty: -5 }]);
    expectStatus(await complete(ctx.job), 200);
    // The provisional coat is billed at what was measured: until then the final is incomplete.
    expect(expectStatus(await accountant.post(`/admin/invoices/from-job/${ctx.job.id}`).send({}), 422).error.code).toBe('MEASUREMENT_INCOMPLETE');
    const [, coat, omission] = await prisma.jobLine.findMany({ where: { jobId: ctx.job.id }, orderBy: { sortOrder: 'asc' } });
    expect(expectStatus(await measure(dispatcher, ctx.job, omission, 30), 422).error.code).toBe('LINE_NOT_MEASURED');
    expectStatus(await measure(dispatcher, ctx.job, coat, 160), 200);

    const final = expectStatus(await accountant.post(`/admin/invoices/from-job/${ctx.job.id}`).send({}), 201).data;
    const contract = documentTotals([
      { qty: 200, rate: plaster.rate }, { qty: 160, rate: 9500 }, { qty: -5, rate: plaster.rate },
    ], { discount: 100_000, vatRate: ctx.quote.vatRate, vatApplied: ctx.quote.vatApplied });
    expect(final.items.filter((i) => i.kind === 'ITEM').map((i) => i.qty)).toEqual([200, 160, -5]);
    expect(final.discount).toBe(100_000);
    expect(ctx.advance.total + running.total + final.total).toBe(contract.total);
    const costing = expectStatus(await manager.get(`/admin/jobs/${ctx.job.id}/costing`), 200).data;
    expect(costing.billable.invoiced).toBe(contract.subtotal - contract.discount);
  });

  it('a final below what was already billed is refused — credit notes are deferred', async () => {
    const ctx = await contractJob('LUMP_SUM');
    await runningBill(ctx.job, ctx.quote);
    // 90 % billed; the customer drops most of the plaster: the contract falls under it.
    await acceptedVariation(ctx.job, [{ rateCardItemId: plaster.id, kind: 'SERVICE', description: 'Omit most plaster', unit: plaster.unit, rate: plaster.rate / 100, qty: -150 }]);
    expectStatus(await complete(ctx.job), 200);
    const res = expectStatus(await accountant.post(`/admin/invoices/from-job/${ctx.job.id}`).send({}), 422);
    expect(res.error.code).toBe('FINAL_BELOW_BILLED');
    expect((await prisma.job.findUnique({ where: { id: ctx.job.id } })).invoicedAt).toBeNull();
  });
});

describe('running bills (L8.1)', () => {
  it('once per stage; a voided one frees its stage; another job\'s stage is 404; the advance is not a running bill', async () => {
    const ctx = await contractJob('LUMP_SUM');
    const milestone = ctx.quote.paymentStages.find((st) => st.trigger === 'MILESTONE');
    const first = expectStatus(await accountant.post(`/admin/jobs/${ctx.job.id}/invoices/stage`).send({ paymentStageId: milestone.id }), 201).data;
    expect(expectStatus(await accountant.post(`/admin/jobs/${ctx.job.id}/invoices/stage`).send({ paymentStageId: milestone.id }), 409).error.code).toBe('STAGE_BILLED');
    expectStatus(await accountant.post(`/admin/invoices/${first.id}/void`).send({ reason: 'Wrong date' }), 200);
    expectStatus(await accountant.post(`/admin/jobs/${ctx.job.id}/invoices/stage`).send({ paymentStageId: milestone.id }), 201);
    const advanceStage = ctx.quote.paymentStages.find((st) => st.trigger === 'ON_ACCEPT');
    expect(expectStatus(await accountant.post(`/admin/jobs/${ctx.job.id}/invoices/stage`).send({ paymentStageId: advanceStage.id }), 409).error.code).toBe('STAGE_BILLED');

    const other = await contractJob('LUMP_SUM');
    expect(expectStatus(await accountant.post(`/admin/jobs/${ctx.job.id}/invoices/stage`).send({
      paymentStageId: other.quote.paymentStages.find((st) => st.trigger === 'MILESTONE').id,
    }), 404).error.code).toBe('STAGE_NOT_FOUND');
    expectStatus(await (await as('SALES')).post(`/admin/jobs/${ctx.job.id}/invoices/stage`).send({ paymentStageId: milestone.id }), 403);
  });
});

describe('handover: Offer AMC (L8.4)', () => {
  it('makes one lead for sales, linked to the customer and the site', async () => {
    const ctx = await contractJob('LUMP_SUM');
    const lead = expectStatus(await dispatcher.post(`/admin/jobs/${ctx.job.id}/offer-amc`), 201).data;
    expect(lead).toMatchObject({ source: 'amc_offer', status: 'NEW', customerId: ctx.customer.id, phone: ctx.customer.phone });
    expect(lead.message).toContain(ctx.job.number);
    const again = expectStatus(await dispatcher.post(`/admin/jobs/${ctx.job.id}/offer-amc`), 200).data;
    expect(again).toMatchObject({ id: lead.id, assignedTo: { id: expect.any(String), name: expect.any(String) } });
    const salesUser = await prisma.user.findUnique({ where: { email: USERS.SALES } });
    expect(lead.assignedToId ?? lead.assignedTo?.id).toBeTruthy();
    expect(salesUser).toBeTruthy();
    expectStatus(await (await as('ACCOUNTANT')).post(`/admin/jobs/${ctx.job.id}/offer-amc`), 403);
  });
});
