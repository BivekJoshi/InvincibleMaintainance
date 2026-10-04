import { describe, it, expect, beforeAll } from 'vitest';
import { as, expectStatus, createCustomer, phone, uid, daysFromNow, prisma, USERS } from './helpers.js';

/** The SLA board's calendar: everything dated still waiting, for a span of Kathmandu days, and everything late. */

let admin;
let sales;
let salesId;

/** A Kathmandu day `n` days from now, as the query takes it. */
const ktmDay = (n) => new Date(daysFromNow(n).getTime() + 345 * 60_000).toISOString().slice(0, 10);
const FROM = ktmDay(400);
const TO = ktmDay(410);
const span = `from=${FROM}&to=${TO}`;

const lead = (data) => prisma.lead.create({ data: { name: `Agenda ${uid()}`, phone: phone(), ...data } });

beforeAll(async () => {
  [admin, sales] = await Promise.all([as('ADMIN'), as('SALES')]);
  salesId = (await prisma.user.findUnique({ where: { email: USERS.SALES } })).id;
});

describe('GET /admin/agenda', () => {
  it('lists what falls in the span and every late thing before it, each with where it stands', async () => {
    // Late long ago, so it sorts first whatever else the suite has left unanswered.
    const late = await lead({ slaDueAt: new Date('2001-01-01T05:00:00Z'), assignedToId: salesId });
    const next = await lead({ nextActionAt: daysFromNow(405), nextActionType: 'CALL', nextActionNote: 'Ask about the roof' });
    const closed = await lead({ status: 'WON', nextActionAt: daysFromNow(405), nextActionType: 'CALL' });

    const body = expectStatus(await sales.get(`/admin/agenda?${span}`), 200).data;
    expect(body).toMatchObject({ from: FROM, to: TO });

    const response = body.items.find((i) => i.key === `response:${late.id}`);
    expect(response).toMatchObject({
      kind: 'response', state: 'overdue', ownable: true, ownerId: salesId, href: `/admin/leads/${late.id}`, allDay: false,
    });
    const followUp = body.items.find((i) => i.key === `followUp:${next.id}`);
    expect(followUp).toMatchObject({ state: 'upcoming', type: 'CALL', note: 'Ask about the roof', ownerId: null });
    expect(body.items.some((i) => i.id === closed.id)).toBe(false);

    expect(body.overdue.byKind.response).toBeGreaterThanOrEqual(1);
    expect(body.overdue.total).toBe(Object.values(body.overdue.byKind).reduce((n, c) => n + c, 0));
    // Oldest first.
    const times = body.items.map((i) => new Date(i.at).getTime());
    expect(times).toEqual([...times].sort((a, b) => a - b));
  });

  it('reads each kind only for a role that reads its records', async () => {
    const forSales = expectStatus(await sales.get(`/admin/agenda?${span}`), 200).data;
    expect(forSales.kinds).toEqual(expect.arrayContaining(['response', 'followUp', 'visit', 'job', 'quotation', 'amcVisit', 'renewal']));
    expect(forSales.kinds).not.toContain('invoice');
    expect(forSales.items.some((i) => i.kind === 'invoice')).toBe(false);

    const dispatcher = await as('DISPATCHER');
    const forDispatch = expectStatus(await dispatcher.get(`/admin/agenda?${span}`), 200).data;
    expect(forDispatch.kinds).not.toContain('quotation');

    // The calendar lives on the SLA board: no leads:read, no calendar.
    expectStatus(await (await as('ACCOUNTANT')).get(`/admin/agenda?${span}`), 403);
  });

  it('an invoice sits on its due day with what is still owed, in paisa', async () => {
    const customer = await createCustomer(admin);
    const invoice = await prisma.invoice.create({
      data: {
        number: uid('INV-AG-'), customerId: customer.id, status: 'PARTIAL',
        dueDate: daysFromNow(403), total: 1_000_000, paidAmount: 250_050,
      },
    });
    const body = expectStatus(await admin.get(`/admin/agenda?${span}`), 200).data;
    expect(body.items.find((i) => i.key === `invoice:${invoice.id}`)).toMatchObject({
      kind: 'invoice', allDay: true, amount: 749_950, state: 'upcoming', title: customer.name, href: `/admin/invoices/${invoice.id}`,
    });
  });

  it('an unpaid invoice is late the day after it falls due, not on the day', async () => {
    const customer = await createCustomer(admin);
    const startOfToday = new Date(`${ktmDay(0)}T00:00:00+05:45`);
    const dueToday = await prisma.invoice.create({
      data: { number: uid('INV-AG-'), customerId: customer.id, status: 'SENT', dueDate: startOfToday, total: 50_000 },
    });
    const dueYesterday = await prisma.invoice.create({
      data: { number: uid('INV-AG-'), customerId: customer.id, status: 'SENT', dueDate: new Date(startOfToday.getTime() - 86_400_000), total: 50_000 },
    });
    const body = expectStatus(await admin.get(`/admin/agenda?from=${ktmDay(-1)}&to=${ktmDay(0)}`), 200).data;
    expect(body.items.find((i) => i.id === dueToday.id)?.state).toBe('today');
    expect(body.items.find((i) => i.id === dueYesterday.id)?.state).toBe('overdue');
  });

  it('refuses a backwards or too-wide span', async () => {
    expectStatus(await sales.get(`/admin/agenda?from=${TO}&to=${FROM}`), 400);
    expectStatus(await sales.get(`/admin/agenda?from=${ktmDay(0)}&to=${ktmDay(70)}`), 400);
    expectStatus(await sales.get('/admin/agenda?from=2026-13-45'), 400);
    // Without a span: this week.
    const week = expectStatus(await sales.get('/admin/agenda'), 200).data;
    expect(week).toMatchObject({ from: ktmDay(0), to: ktmDay(6) });
  });
});
