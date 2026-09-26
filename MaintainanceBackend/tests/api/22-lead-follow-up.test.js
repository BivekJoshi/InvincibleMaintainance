import { describe, it, expect, beforeAll } from 'vitest';
import {
  anon, as, approveAndSend, expectStatus, phone, prisma, technicianIdFor, uid, USERS,
} from './helpers.js';
import { runFollowUps, runStaleSweep } from '../../src/services/pipeline.service.js';
import { expireQuotations } from '../../src/services/quotation.service.js';

/** Phase L1: every open lead has a next action and a clock; LOST says why and where. */

let sales;
let salesId;
const MINUTE = 60_000;

const newLead = async (extra = {}) =>
  expectStatus(await sales.post('/admin/leads').send({ name: 'L1 Lead', phone: phone(), assignedToId: salesId, ...extra }), 201).data;
const leadRow = (id) => prisma.lead.findUnique({ where: { id } });
const log = (leadId, body) => sales.post(`/admin/leads/${leadId}/activities`).send({ type: 'call', summary: 'Called', ...body });

/** A day no other run of this suite uses, so "once per day" is checkable on a reused database. */
const uniqueFutureDay = () => new Date(Date.UTC(2031, 0, 1) + (Date.now() % 5000) * 86_400_000);
/** That day at a Kathmandu wall-clock time (UTC+05:45). */
const ktm = (day, hh, mm = 0) => new Date(day.getTime() + (hh * 60 + mm - 345) * MINUTE);

beforeAll(async () => {
  sales = await as('SALES');
  salesId = (await prisma.user.findUnique({ where: { email: USERS.SALES } })).id;
});

describe('call outcomes', () => {
  it('No answer on a NEW lead stops the SLA clock, counts the attempt, books the next call — and leaves it NEW', async () => {
    const lead = await newLead();
    const before = Date.now();
    const body = expectStatus(await log(lead.id, { outcome: 'no_answer', summary: 'Rang twice, no answer' }), 201).data;
    expect(body).toMatchObject({ outcome: 'no_answer', firstResponse: true, dialog: null });
    const row = await leadRow(lead.id);
    expect(row).toMatchObject({ status: 'NEW', contactAttempts: 1, nextActionType: 'CALL' });
    expect(row.firstResponseAt).not.toBeNull();
    // The retry delay is pipeline.noAnswerRetryMinutes (120 by default).
    expect(row.nextActionAt.getTime() - before).toBeGreaterThan(100 * MINUTE);
    expect(row.nextActionAt.getTime() - before).toBeLessThan(140 * MINUTE);
  });

  it('Book visit moves the lead to CONTACTED and asks the client for the booking dialog', async () => {
    const lead = await newLead();
    const body = expectStatus(await log(lead.id, { outcome: 'book_visit' }), 201).data;
    expect(body.dialog).toBe('visit');
    expect(body.lead).toMatchObject({ status: 'CONTACTED', nextActionType: 'BOOK_VISIT' });
    const trail = await prisma.leadActivity.findMany({ where: { leadId: lead.id, type: 'status_change' } });
    expect(trail.map((a) => a.summary)).toEqual([expect.stringMatching(/^NEW → CONTACTED/)]);
  });

  it('Quote without a visit asks for the quotation sheet', async () => {
    const lead = await newLead();
    const body = expectStatus(await log(lead.id, { outcome: 'quote_without_visit' }), 201).data;
    expect(body.dialog).toBe('quotation');
    expect(body.lead.nextActionType).toBe('SEND_QUOTE');
  });

  it('Call back needs the time the customer gave; with it, that is the next action', async () => {
    const lead = await newLead();
    const refused = expectStatus(await log(lead.id, { outcome: 'call_back' }), 422);
    expect(refused.error.code).toBe('NEXT_ACTION_REQUIRED');
    const at = new Date(Date.now() + 26 * 60 * MINUTE).toISOString();
    expectStatus(await log(lead.id, { outcome: 'call_back', nextAction: { at, type: 'CALL', note: 'After office hours' } }), 201);
    expect(await leadRow(lead.id)).toMatchObject({
      status: 'CONTACTED', nextActionAt: new Date(at), nextActionType: 'CALL', nextActionNote: 'After office hours',
    });
  });

  it('Not interested closes the lead as LOST in the same request — and needs a category to do it', async () => {
    const lead = await newLead();
    expect(expectStatus(await log(lead.id, { outcome: 'not_interested' }), 422).error.code).toBe('NEXT_ACTION_REQUIRED');
    const body = expectStatus(await log(lead.id, {
      outcome: 'not_interested', close: { lostCategory: 'OWN_LABOUR', lostReason: 'Their own mistri will do it' },
    }), 201).data;
    expect(body.lead.status).toBe('LOST');
    expect(await leadRow(lead.id)).toMatchObject({
      status: 'LOST', lostCategory: 'OWN_LABOUR', lostAtStage: 'CONTACTED', lostReason: 'Their own mistri will do it', nextActionAt: null,
    });
  });

  it('an outcome belongs to a contact, not a note', async () => {
    const lead = await newLead();
    expectStatus(await sales.post(`/admin/leads/${lead.id}/activities`).send({ type: 'note', summary: 'x', outcome: 'no_answer' }), 400);
  });

  it('a plain call with no outcome still logs, and still counts as an attempt', async () => {
    const lead = await newLead();
    expectStatus(await log(lead.id, {}), 201);
    expect((await leadRow(lead.id)).contactAttempts).toBe(1);
  });
});

describe('next action, stage clock and qualification', () => {
  it('PATCH next-action sets and clears it; a closed lead has none', async () => {
    const lead = await newLead();
    const at = new Date(Date.now() + 3 * 86_400_000).toISOString();
    const set = expectStatus(await sales.patch(`/admin/leads/${lead.id}/next-action`).send({ at, type: 'FOLLOW_UP', note: 'Ask about the terrace' }), 200).data;
    expect(set).toMatchObject({ nextActionType: 'FOLLOW_UP', nextActionNote: 'Ask about the terrace' });
    expectStatus(await sales.patch(`/admin/leads/${lead.id}/next-action`).send({ at }), 400); // a time needs a type
    expect(expectStatus(await sales.patch(`/admin/leads/${lead.id}/next-action`).send({ at: null }), 200).data.nextActionAt).toBeNull();

    expectStatus(await sales.patch(`/admin/leads/${lead.id}/status`).send({ status: 'LOST', lostCategory: 'UNREACHABLE' }), 200);
    const closed = expectStatus(await sales.patch(`/admin/leads/${lead.id}/next-action`).send({ at, type: 'CALL' }), 422);
    expect(closed.error.code).toBe('LEAD_CLOSED');
  });

  it('LOST needs a category; OTHER also needs the reason; the stage it was lost at is recorded', async () => {
    const lead = await newLead();
    expectStatus(await sales.patch(`/admin/leads/${lead.id}/status`).send({ status: 'LOST', lostReason: 'Too pricey' }), 400);
    expectStatus(await sales.patch(`/admin/leads/${lead.id}/status`).send({ status: 'LOST', lostCategory: 'OTHER' }), 400);
    expectStatus(await sales.patch(`/admin/leads/${lead.id}/status`).send({ status: 'CONTACTED' }), 200);
    expectStatus(await sales.patch(`/admin/leads/${lead.id}/status`).send({ status: 'LOST', lostCategory: 'PRICE', lostReason: 'Too pricey' }), 200);
    expect(await leadRow(lead.id)).toMatchObject({ lostCategory: 'PRICE', lostAtStage: 'CONTACTED', lostReason: 'Too pricey' });
    // Reopened, the lost details go.
    expectStatus(await sales.patch(`/admin/leads/${lead.id}/status`).send({ status: 'CONTACTED' }), 200);
    expect(await leadRow(lead.id)).toMatchObject({ lostCategory: null, lostAtStage: null, lostReason: null });
  });

  it('every status move restarts the stage clock', async () => {
    const lead = await newLead();
    await prisma.lead.update({ where: { id: lead.id }, data: { stageEnteredAt: new Date('2026-01-01T00:00:00Z') } });
    expectStatus(await sales.patch(`/admin/leads/${lead.id}/status`).send({ status: 'CONTACTED' }), 200);
    expect((await leadRow(lead.id)).stageEnteredAt.getTime()).toBeGreaterThan(Date.now() - MINUTE);
  });

  it('qualification is saved as one checked object', async () => {
    const lead = await newLead();
    const q = { propertyType: 'house', floors: 3, buildingAgeYears: 18, budgetBand: '1l_5l', decisionMaker: 'owner_abroad', note: 'Son in Doha decides' };
    expect(expectStatus(await sales.put(`/admin/leads/${lead.id}`).send({ qualification: q }), 200).data.qualification).toEqual(q);
    expectStatus(await sales.put(`/admin/leads/${lead.id}`).send({ qualification: { budgetBand: 'lots' } }), 400);
  });

  it('the list filters by next action: overdue, due today, none', async () => {
    const overdue = await newLead();
    const today = await newLead();
    const none = await newLead();
    await prisma.lead.update({ where: { id: overdue.id }, data: { nextActionAt: new Date(Date.now() - 2 * 86_400_000), nextActionType: 'CALL' } });
    await prisma.lead.update({ where: { id: today.id }, data: { nextActionAt: new Date(Date.now() + MINUTE), nextActionType: 'CALL' } });
    const ids = async (filter) => expectStatus(await sales.get(`/admin/leads?nextAction=${filter}&limit=100&sort=-createdAt`), 200).data.map((r) => r.id);
    expect(await ids('overdue')).toContain(overdue.id);
    expect(await ids('overdue')).not.toContain(today.id);
    expect(await ids('none')).toContain(none.id);
    expect(await ids('none')).not.toContain(overdue.id);
    // "Due today" is the Kathmandu day; a minute from now is today unless this runs at 23:59.
    if (new Date(Date.now() + MINUTE + 345 * MINUTE).getUTCDate() === new Date(Date.now() + 345 * MINUTE).getUTCDate()) {
      expect(await ids('due_today')).toContain(today.id);
    }
    expectStatus(await sales.get('/admin/leads?nextAction=someday'), 400);
  });
});

describe('QUOTED means the customer has a quotation', () => {
  it('building a quotation from the survey leaves the lead at the visit, with "send the quotation" next', async () => {
    const lead = await newLead();
    const surveyorId = await technicianIdFor('SURVEYOR');
    const { survey } = expectStatus(await sales.post(`/admin/leads/${lead.id}/convert`).send({
      site: { address: 'Baluwatar, Kathmandu' }, createInspectionJob: true, surveyorId,
    }), 201).data;
    expectStatus(await (await as('SURVEYOR')).post(`/tech/surveys/${survey.id}/submit`).send({
      items: [{ kind: 'OTHER', description: 'Crack stitching', unit: 'rft', qty: 6 }],
    }), 200);
    const { quotation } = expectStatus(await sales.post(`/admin/surveys/${survey.id}/quotation`).send({
      items: [{ description: 'Crack stitching', unit: 'rft', qty: 6, rate: 165 }],
    }), 201).data;
    expect(await leadRow(lead.id)).toMatchObject({ status: 'INSPECTION_SCHEDULED', nextActionType: 'SEND_QUOTE' });
    await approveAndSend(quotation.id);
    expect((await leadRow(lead.id)).status).toBe('QUOTED');
  });

  it('a draft leaves the lead where it was; sending it moves the lead to QUOTED and books the follow-up', async () => {
    const lead = await newLead();
    const { quotation } = expectStatus(await sales.post(`/admin/leads/${lead.id}/convert`).send({ createQuotation: true }), 201).data;
    expect((await leadRow(lead.id)).status).toBe('CONTACTED');
    await approveAndSend(quotation.id);
    const row = await leadRow(lead.id);
    expect(row).toMatchObject({ status: 'QUOTED', nextActionType: 'FOLLOW_UP' });
    expect(row.nextActionAt.getTime()).toBeGreaterThan(Date.now() + 2 * 86_400_000);
  });
});

describe('reminders', () => {
  /** A lead whose quotation went out `daysAgo` days ago and is still unanswered. */
  async function sentQuote(daysAgo) {
    const lead = await newLead();
    const { quotation } = expectStatus(await sales.post(`/admin/leads/${lead.id}/convert`).send({ createQuotation: true }), 201).data;
    await approveAndSend(quotation.id);
    await prisma.quotation.update({ where: { id: quotation.id }, data: { sentAt: new Date(Date.now() - daysAgo * 86_400_000) } });
    return { lead, quotation };
  }

  it('an unanswered quote reminds its owner once, however often the sweep runs', async () => {
    const { quotation } = await sentQuote(4);
    await runStaleSweep();
    await runStaleSweep();
    const sent = await prisma.notification.findMany({ where: { type: 'pipeline_quote_unanswered', dedupeKey: { startsWith: `stale:quote_unanswered:${quotation.id}:` } } });
    expect(sent).toHaveLength(1);
    expect(sent[0].userId).toBe(salesId);
  });

  it('a quote sent yesterday is not stale yet', async () => {
    const { quotation } = await sentQuote(1);
    await runStaleSweep();
    expect(await prisma.notification.count({ where: { dedupeKey: { startsWith: `stale:quote_unanswered:${quotation.id}:` } } })).toBe(0);
  });

  it('a due next action tells its owner once; the digest goes once per Kathmandu day, after the digest hour', async () => {
    const lead = await newLead();
    const day = uniqueFutureDay();
    await prisma.lead.update({ where: { id: lead.id }, data: { nextActionAt: ktm(day, 8, 30), nextActionType: 'CALL' } });
    const dayKey = day.toISOString().slice(0, 10);
    const digests = () => prisma.notification.count({ where: { dedupeKey: `followup:digest:${dayKey}:${salesId}` } });

    await runFollowUps(ktm(day, 7, 45));
    expect(await digests()).toBe(0);
    await runFollowUps(ktm(day, 9, 5));
    await runFollowUps(ktm(day, 11, 0));
    expect(await digests()).toBe(1);
    const due = await prisma.notification.findMany({ where: { type: 'lead_followup_due', link: `/admin/leads/${lead.id}` } });
    expect(due).toHaveLength(1);
    expect(due[0].userId).toBe(salesId);
  });
});

describe('a decline or an expiry asks a person — it never loses the lead', () => {
  async function answeredQuote(decision) {
    const lead = await newLead();
    const { quotation } = expectStatus(await sales.post(`/admin/leads/${lead.id}/convert`).send({ createQuotation: true }), 201).data;
    const { publicToken } = await approveAndSend(quotation.id);
    if (decision) {
      expectStatus(await anon().post(`/public/quotations/${publicToken}/decide`)
        .set('User-Agent', 'Mozilla/5.0 (Linux; Android 14) Mobile').send({ decision, note: 'Too expensive for now' }), 200);
    }
    return { lead, quotation };
  }
  const markLost = (leadId) => prisma.notification.findMany({ where: { type: 'lead_mark_lost', link: `/admin/leads/${leadId}?markLost=1` } });

  it('decline', async () => {
    const { lead } = await answeredQuote('reject');
    expect((await markLost(lead.id)).map((n) => n.userId)).toContain(salesId);
    expect((await leadRow(lead.id)).status).toBe('QUOTED');
  });

  it('expiry', async () => {
    const { lead, quotation } = await answeredQuote(null);
    await prisma.quotation.update({ where: { id: quotation.id }, data: { validUntil: new Date(Date.now() - MINUTE) } });
    await expireQuotations();
    expect((await markLost(lead.id)).map((n) => n.userId)).toContain(salesId);
    expect((await leadRow(lead.id)).status).toBe('QUOTED');
  });
});

describe('GET /admin/reports/lost', () => {
  it('groups lost leads by category, stage and service', async () => {
    const service = await prisma.service.findFirst({ where: { deletedAt: null } });
    const lead = await newLead({ serviceId: service.id, name: `Lost ${uid()}` });
    expectStatus(await sales.patch(`/admin/leads/${lead.id}/status`).send({ status: 'LOST', lostCategory: 'COMPETITOR', lostReason: 'Went with the cheaper one' }), 200);
    const today = new Date(Date.now() + 345 * MINUTE).toISOString().slice(0, 10);
    const report = expectStatus(await sales.get(`/admin/reports/lost?from=${today}&to=${today}`), 200).data;
    expect(report.rows).toContainEqual(expect.objectContaining({
      category: 'COMPETITOR', stage: 'NEW', serviceId: service.id, serviceName: service.name, count: expect.any(Number),
    }));
    expect(report.byCategory.find((c) => c.category === 'COMPETITOR').count).toBeGreaterThan(0);
    expect(report.total).toBe(report.byCategory.reduce((n, c) => n + c.count, 0));
  });

  it('is a sales report', async () => {
    expectStatus(await (await as('DISPATCHER')).get('/admin/reports/lost'), 403);
  });
});
