import { describe, it, expect, beforeAll } from 'vitest';
import {
  anon, as, approveAndSend, expectStatus, findKeys, phone, prisma, technicianIdFor, uid, USERS, daysFromNow,
} from './helpers.js';

/**
 * Phase L6 — won → hand-off. Accepting a quotation (or a staff convert) hands over everything the work needs in
 * one transaction: the job typed from the service with its planned days, the BOQ as job lines, the take-off
 * as requirements, and the ADVANCE invoice for the ON_ACCEPT stage — which the job then waits for (L-D3).
 */

const SCHEDULE_50_40_10 = [
  { label: 'Advance', basisPoints: 5000, trigger: 'ON_ACCEPT' },
  { label: 'Plaster done', basisPoints: 4000, trigger: 'MILESTONE' },
  { label: 'On completion', basisPoints: 1000, trigger: 'ON_COMPLETION' },
];
const NO_ADVANCE = [{ label: 'On completion', basisPoints: 10000, trigger: 'ON_COMPLETION' }];

let service;
let sales;
let dispatcher;
let accountant;
let manager;

beforeAll(async () => {
  [sales, dispatcher, accountant, manager] = await Promise.all([as('SALES'), as('DISPATCHER'), as('ACCOUNTANT'), as('MANAGER')]);
  service = await prisma.service.create({
    data: { name: `Renovation ${uid()}`, slug: uid('l6-svc-'), excerpt: 'Hand-off test service', jobType: 'RENOVATION' },
  });
});

/**
 * A BOQ quotation, sent: a plaster section priced from the rate library (its recipe gives the take-off), a
 * material row, and an optional row that must not reach the job. Its lead is on the RENOVATION service.
 */
async function boqQuote({ locale = 'en', stages = SCHEDULE_50_40_10, estimatedDays = 6, email = null } = {}) {
  const customer = expectStatus(await sales.post('/admin/customers').send({
    name: `Handoff ${uid()}`, phone: phone(), ...(email ? { email } : {}),
  }), 201).data;
  await prisma.customer.update({ where: { id: customer.id }, data: { preferredLocale: locale } });
  const salesId = (await prisma.user.findUnique({ where: { email: USERS.SALES } })).id;
  const lead = await prisma.lead.create({
    data: { name: customer.name, phone: customer.phone, customerId: customer.id, serviceId: service.id, status: 'QUOTED', assignedToId: salesId, source: 'call' },
  });
  const [plaster, tiles] = await Promise.all(['PLASTER-INT', 'TILE-FLOOR'].map((code) => prisma.rateCardItem.findUnique({ where: { code } })));
  const cryst = await prisma.material.findUnique({ where: { code: 'WP-CRYST' } });
  const q = expectStatus(await sales.post('/admin/quotations').send({
    customerId: customer.id, leadId: lead.id, estimatedDays, paymentStages: stages,
    items: [
      { rowType: 'SECTION', description: 'Plaster' },
      { rateCardItemId: plaster.id, kind: 'SERVICE', description: plaster.name, unit: plaster.unit, rate: plaster.rate / 100, qty: 200 },
      { rowType: 'SECTION', description: 'Materials' },
      { kind: 'MATERIAL', materialId: cryst.id, description: cryst.name, unit: cryst.unit, qty: 10, rate: 480 },
      { rateCardItemId: tiles.id, kind: 'SERVICE', description: tiles.name, unit: tiles.unit, rate: tiles.rate / 100, qty: 50, isOptional: true },
    ],
  }), 201).data;
  const sent = await approveAndSend(q.id);
  return { q: sent, customer, lead };
}

const accept = (token) => anon().post(`/public/quotations/${token}/decide`).set('User-Agent', 'Mozilla/5.0 (Linux; Android 14) Mobile').send({ decision: 'approve' });
const jobOf = (quotationId) => prisma.job.findFirst({ where: { quotationId }, include: { lines: { orderBy: { sortOrder: 'asc' } }, requirements: true } });

describe('accepting a 50/40/10 BOQ quotation hands over the work (L6.2)', () => {
  let ctx;
  let job;

  beforeAll(async () => {
    ctx = await boqQuote();
    const body = expectStatus(await accept(ctx.q.publicToken), 200).data;
    ctx.response = body;
    job = await jobOf(ctx.q.id);
  });

  it('the job: typed from the service, planned from the estimate; the lead WON, the quotation CONVERTED', async () => {
    expect(job).toMatchObject({ type: 'RENOVATION', plannedDays: 6, status: 'DRAFT', leadId: ctx.lead.id });
    expect((await prisma.quotation.findUnique({ where: { id: ctx.q.id } })).status).toBe('CONVERTED');
    expect((await prisma.lead.findUnique({ where: { id: ctx.lead.id } })).status).toBe('WON');
  });

  it('job lines are the non-optional rows, with their BOQ numbers and sections', async () => {
    const items = await prisma.quotationItem.findMany({ where: { quotationId: ctx.q.id }, orderBy: { sortOrder: 'asc' } });
    const priced = items.filter((i) => i.rowType === 'ITEM' && !i.isOptional);
    expect(job.lines.map((l) => [l.number, l.section, l.quotationItemId, l.quotedQty, l.rate, l.source])).toEqual([
      ['A.1', 'Plaster', priced[0].id, priced[0].qty, priced[0].rate, 'QUOTATION'],
      ['B.1', 'Materials', priced[1].id, priced[1].qty, priced[1].rate, 'QUOTATION'],
    ]);
  });

  it('requirements are the take-off — materials with packs, labour days by trade — and carry no money', async () => {
    const takeoff = expectStatus(await manager.get(`/admin/quotations/${ctx.q.id}/takeoff`), 200).data;
    const materials = job.requirements.filter((r) => r.kind === 'MATERIAL');
    const labour = job.requirements.filter((r) => r.kind === 'LABOUR');
    expect(materials.map((r) => [r.materialId, r.qty, r.packs]).sort()).toEqual(takeoff.materials.map((m) => [m.materialId, m.qty, m.packs]).sort());
    expect(labour.map((r) => [r.tradeId, r.qty]).sort()).toEqual(takeoff.labour.map((t) => [t.tradeId, t.days]).sort());
    expect(labour.every((r) => r.unit === 'day')).toBe(true);
    expect(findKeys(job.requirements, (k) => /rate|cost|amount|price|total/i.test(k))).toEqual([]);
  });

  it('one ADVANCE invoice for the ON_ACCEPT stage — exactly stage 1; the stages add up to the quotation', async () => {
    const invoices = await prisma.invoice.findMany({ where: { quotationId: ctx.q.id } });
    expect(invoices).toHaveLength(1);
    const [advance] = invoices;
    const quote = expectStatus(await sales.get(`/admin/quotations/${ctx.q.id}`), 200).data;
    const stages = quote.paymentStages;
    expect(stages.reduce((a, st) => a + st.total, 0)).toBe(quote.total);
    expect(advance).toMatchObject({
      kind: 'ADVANCE', status: 'SENT', jobId: job.id, customerId: ctx.customer.id,
      paymentStageId: stages[0].id, total: stages[0].total, vatAmount: stages[0].vat, subtotal: stages[0].taxable,
    });
    expect(advance.publicToken).toBeTruthy();
    expect(job.advanceInvoiceId).toBe(advance.id);
    const due = Math.round((advance.dueDate - advance.issuedAt) / 86_400_000);
    expect(due).toBe(7);
    // The customer's page, straight after accepting, points at it.
    expect(ctx.response.advance).toMatchObject({ number: advance.number, total: stages[0].total, url: expect.stringContaining(`/invoice/${advance.publicToken}`) });
    expect(expectStatus(await anon().get(`/public/quotations/${ctx.q.publicToken}`), 200).data.advance).toMatchObject({ number: advance.number });
  });

  it('the customer is asked for the advance: SMS with the amount and the link', async () => {
    const [sms] = await prisma.messageLog.findMany({ where: { templateKey: 'advance_due', toAddress: ctx.customer.phone } });
    const advance = await prisma.invoice.findUnique({ where: { id: job.advanceInvoiceId } });
    expect(sms.body).toContain(`/invoice/${advance.publicToken}`);
    expect(sms.body).toMatch(/Rs\. [\d,]+\.\d{2}/);
  });

  it('the job page and the Plan carry the hand-off', async () => {
    const detail = expectStatus(await dispatcher.get(`/admin/jobs/${job.id}`), 200).data;
    expect(detail.lines).toHaveLength(2);
    expect(detail.requirements.length).toBe(job.requirements.length);
    expect(detail.advance).toMatchObject({ required: true, paid: false, overridden: false, awaitingAdvance: true, invoice: { id: job.advanceInvoiceId, status: 'SENT' } });
    const plan = expectStatus(await dispatcher.get(`/admin/jobs/${job.id}/plan`), 200).data;
    expect(plan.lineCount).toBe(2);
    expect(plan.sections.map((sec) => sec.title)).toEqual(['Plaster', 'Materials']);
    expect(plan.materials.every((m) => m.shortfall === Math.max(0, Math.round((m.qty - m.onHand) * 1000) / 1000))).toBe(true);
    expect(plan.labourDays).toBeGreaterThan(0);
    expect(plan.readiness.find((r) => r.key === 'advance')).toMatchObject({ done: false });
    expect(plan.readiness.find((r) => r.key === 'boq')).toMatchObject({ done: true });
    // Quantities only — the advance block is the invoice's own figures, as on the job page.
    const { advance: _advance, ...quantities } = plan;
    expect(findKeys(quantities, (k) => /rate|cost|amount|price/i.test(k))).toEqual([]);
    // The unassigned queue shows it waiting.
    const queue = expectStatus(await dispatcher.get(`/admin/dispatch/unassigned?q=${job.number}`), 200).data;
    expect(queue.find((j) => j.id === job.id)).toMatchObject({ awaitingAdvance: true, advanceInvoice: { id: job.advanceInvoiceId } });
  });
});

describe('the advance gate (L6.3)', () => {
  it('schedule, assign and moves are 422 ADVANCE_UNPAID until the advance is paid; then the dispatchers hear', async () => {
    const { q } = await boqQuote();
    expectStatus(await accept(q.publicToken), 200);
    const job = await jobOf(q.id);
    const tech = await technicianIdFor('TECHNICIAN');
    const start = daysFromNow(3);
    const refused = expectStatus(await dispatcher.post(`/admin/jobs/${job.id}/schedule`).send({ scheduledStart: start.toISOString(), technicianIds: [tech] }), 422);
    expect(refused.error).toMatchObject({ code: 'ADVANCE_UNPAID', details: { invoiceId: job.advanceInvoiceId, balance: expect.any(Number) } });
    expect(expectStatus(await dispatcher.post(`/admin/jobs/${job.id}/assign`).send({ technicianIds: [tech] }), 422).error.code).toBe('ADVANCE_UNPAID');
    expect(expectStatus(await dispatcher.patch(`/admin/jobs/${job.id}/status`).send({ status: 'SCHEDULED' }), 422).error.code).toBe('ADVANCE_UNPAID');

    const advance = await prisma.invoice.findUnique({ where: { id: job.advanceInvoiceId } });
    expectStatus(await accountant.post(`/admin/invoices/${advance.id}/payments`).send({ amount: 1000, method: 'ESEWA' }), 201);
    expect(expectStatus(await dispatcher.post(`/admin/jobs/${job.id}/schedule`).send({ scheduledStart: start.toISOString() }), 422).error.code).toBe('ADVANCE_UNPAID');
    expectStatus(await accountant.post(`/admin/invoices/${advance.id}/payments`).send({ amount: (advance.total - 100_000) / 100, method: 'BANK' }), 201);

    const dispatchUser = await prisma.user.findUnique({ where: { email: USERS.DISPATCHER } });
    expect(await prisma.notification.findFirst({ where: { userId: dispatchUser.id, type: 'advance_paid', link: `/admin/jobs/${job.id}` } })).toBeTruthy();

    // Paid: scheduling works, and without an end the window runs the planned 6 days.
    const scheduled = expectStatus(await dispatcher.post(`/admin/jobs/${job.id}/schedule`).send({ scheduledStart: start.toISOString(), technicianIds: [tech] }), 200).data;
    expect(new Date(scheduled.scheduledEnd) - new Date(scheduled.scheduledStart)).toBe(6 * 86_400_000);
    expect(scheduled.status).toBe('ASSIGNED');
    const detail = expectStatus(await dispatcher.get(`/admin/jobs/${job.id}`), 200).data;
    expect(detail.advance).toMatchObject({ paid: true, awaitingAdvance: false });
  });

  it('a manager may override with a reason — audited; a dispatcher may not', async () => {
    const { q } = await boqQuote();
    expectStatus(await accept(q.publicToken), 200);
    const job = await jobOf(q.id);
    expectStatus(await dispatcher.post(`/admin/jobs/${job.id}/advance-override`).send({ reason: 'Known customer, pays on site' }), 403);
    expectStatus(await manager.post(`/admin/jobs/${job.id}/advance-override`).send({}), 400);
    const body = expectStatus(await manager.post(`/admin/jobs/${job.id}/advance-override`).send({ reason: 'Known customer, pays on site' }), 200).data;
    const managerUser = await prisma.user.findUnique({ where: { email: USERS.MANAGER } });
    expect(body.advance).toMatchObject({ overridden: true, awaitingAdvance: false, override: { reason: 'Known customer, pays on site', by: { id: managerUser.id } } });
    const audit = await prisma.auditLog.findFirst({ where: { event: 'job.advance_overridden', recordId: job.id } });
    expect(audit).toMatchObject({ actorId: managerUser.id });
    expect(audit.changes).toMatchObject({ reason: 'Known customer, pays on site', invoiceId: job.advanceInvoiceId });
    expectStatus(await manager.post(`/admin/jobs/${job.id}/advance-override`).send({ reason: 'Again' }), 422);
    expectStatus(await dispatcher.post(`/admin/jobs/${job.id}/schedule`).send({
      scheduledStart: daysFromNow(4).toISOString(), scheduledEnd: daysFromNow(5).toISOString(),
    }), 200);
  });

  it('a quotation with no ON_ACCEPT stage raises no advance and no gate', async () => {
    const { q } = await boqQuote({ stages: NO_ADVANCE });
    expectStatus(await accept(q.publicToken), 200);
    const job = await jobOf(q.id);
    expect(job.advanceInvoiceId).toBeNull();
    expect(await prisma.invoice.count({ where: { quotationId: q.id } })).toBe(0);
    expect(job.lines).toHaveLength(2);
    const detail = expectStatus(await dispatcher.get(`/admin/jobs/${job.id}`), 200).data;
    expect(detail.advance).toMatchObject({ required: false, awaitingAdvance: false, invoice: null });
    expectStatus(await dispatcher.post(`/admin/jobs/${job.id}/schedule`).send({ scheduledStart: daysFromNow(2).toISOString() }), 200);
  });
});

describe('once, and only once (L6.2 idempotency)', () => {
  it('a double tap, and a replayed decide, make one job and one invoice', async () => {
    const { q } = await boqQuote();
    const [a, b] = await Promise.all([accept(q.publicToken), accept(q.publicToken)]);
    expect([a.status, b.status].sort()).toEqual([200, 422]);
    expectStatus(await accept(q.publicToken), 422);
    expect(await prisma.job.count({ where: { quotationId: q.id } })).toBe(1);
    expect(await prisma.invoice.count({ where: { quotationId: q.id, kind: 'ADVANCE' } })).toBe(1);
    const job = await jobOf(q.id);
    expect(await prisma.jobLine.count({ where: { jobId: job.id } })).toBe(2);
  });
});

describe('a staff convert-to-job hands over the same way (L6.2)', () => {
  /** A quotation the customer accepted by phone: APPROVED, no job yet. */
  async function acceptedOffline(opts) {
    const ctx = await boqQuote(opts);
    await prisma.quotation.update({ where: { id: ctx.q.id }, data: { status: 'APPROVED', decidedAt: new Date() } });
    return ctx;
  }

  it('wins the lead, types the job from the service, and raises the advance', async () => {
    const { q, lead } = await acceptedOffline();
    const job = expectStatus(await dispatcher.post(`/admin/quotations/${q.id}/convert-to-job`).send({}), 201).data;
    expect(job).toMatchObject({ type: 'RENOVATION', plannedDays: 6, status: 'DRAFT' });
    expect((await prisma.lead.findUnique({ where: { id: lead.id } })).status).toBe('WON');
    expect(await prisma.jobLine.count({ where: { jobId: job.id } })).toBe(2);
    expect(await prisma.invoice.count({ where: { quotationId: q.id, kind: 'ADVANCE' } })).toBe(1);
    expect(expectStatus(await dispatcher.post(`/admin/quotations/${q.id}/convert-to-job`).send({}), 422).error.code).toBe('INVALID_TRANSITION');
  });

  it('with a date or a crew, while an advance is due, it is refused before anything is written', async () => {
    const { q } = await acceptedOffline();
    const res = expectStatus(await dispatcher.post(`/admin/quotations/${q.id}/convert-to-job`).send({ scheduledStart: daysFromNow(2).toISOString() }), 422);
    expect(res.error.code).toBe('ADVANCE_UNPAID');
    expect(await prisma.job.count({ where: { quotationId: q.id } })).toBe(0);
    expect(await prisma.invoice.count({ where: { quotationId: q.id } })).toBe(0);
    expect((await prisma.quotation.findUnique({ where: { id: q.id } })).status).toBe('APPROVED');
  });
});

describe('the advance speaks the customer\'s language (L6.3)', () => {
  it('a Nepali customer gets the ne template; email too when on file', async () => {
    const email = `${uid('adv')}@example.com`;
    const { q, customer } = await boqQuote({ locale: 'ne', email });
    expectStatus(await accept(q.publicToken), 200);
    const [sms] = await prisma.messageLog.findMany({ where: { templateKey: 'advance_due', toAddress: customer.phone } });
    expect(sms.body).toMatch(/अग्रिम/);
    // Phase J1: a Nepali message writes रु. and the due date in Bikram Sambat, in Nepali words.
    expect(sms.body).toMatch(/रु\. [\d,]+\.\d{2}/);
    expect(sms.body).toMatch(/\d{1,2} (बैशाख|जेठ|असार|साउन|भदौ|असोज|कात्तिक|मंसिर|पुष|माघ|फागुन|चैत) \d{4} भित्र/);
    const [mail] = await prisma.messageLog.findMany({ where: { templateKey: 'advance_due', toAddress: email } });
    expect(mail.subject).toMatch(/अग्रिम भुक्तानी/);
  });
});

describe('the field app still carries no money on a BOQ job (D1)', () => {
  it('a technician on a paid, assigned BOQ job reads lines and requirements without rates', async () => {
    const { q } = await boqQuote({ stages: NO_ADVANCE });
    expectStatus(await accept(q.publicToken), 200);
    const job = await jobOf(q.id);
    expectStatus(await dispatcher.post(`/admin/jobs/${job.id}/schedule`).send({
      scheduledStart: daysFromNow(1).toISOString(), technicianIds: [await technicianIdFor('TECHNICIAN')],
    }), 200);
    const body = expectStatus(await (await as('TECHNICIAN')).get(`/tech/jobs/${job.id}`), 200).data;
    expect(body.lines.length).toBe(2);
    const money = (k) => !k.endsWith('Id') && k !== 'priceUnit' && k.split(/(?=[A-Z])/).some((w) => ['rate', 'amount', 'total', 'cost', 'price', 'paid', 'vat', 'balance'].includes(w.toLowerCase()));
    expect(findKeys(body, money)).toEqual([]);
  });
});
