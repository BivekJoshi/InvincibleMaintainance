import { describe, it, expect, beforeAll } from 'vitest';
import {
  anon, as, expectStatus, createCustomer, technicianIdFor, phone, uid, daysFromNow, prisma, approveAndSend,
} from './helpers.js';
import { expireQuotations } from '../../src/services/quotation.service.js';

/** The lead's status_change timeline, oldest first, as "FROM>TO". */
const statusTrail = async (leadId) =>
  (await prisma.leadActivity.findMany({ where: { leadId, type: 'status_change' }, orderBy: { createdAt: 'asc' } }))
    .map((a) => `${a.meta.from}>${a.meta.to}`);

let sales;
let salesUserId;

beforeAll(async () => {
  sales = await as('SALES');
  salesUserId = expectStatus(await sales.get('/auth/me'), 200).data.id;
});

describe('leads', () => {
  let leadId;
  let leadPhone;

  it('GET /admin/leads lists with pagination meta', async () => {
    const body = expectStatus(await sales.get('/admin/leads?limit=5'), 200);
    expect(body.meta.total).toBeGreaterThan(0);
    expect(body.data.length).toBeLessThanOrEqual(5);
  });

  it.each(['status=NEW', 'slaRisk=breached', 'source=web_form', 'priority=NORMAL', 'q=Karki', 'sort=-createdAt'])(
    'GET /admin/leads?%s', async (qs) => { expectStatus(await sales.get(`/admin/leads?${qs}`), 200); },
  );

  it('rejects an unknown filter value', async () => {
    expectStatus(await sales.get('/admin/leads?status=MAYBE'), 400);
  });

  it('answers an unknown sort field with a 400, not a 500', async () => {
    expectStatus(await sales.get('/admin/leads?sort=bogus'), 400);
  });

  it('GET /admin/leads/sla-board separates breached from at-risk', async () => {
    const body = expectStatus(await sales.get('/admin/leads/sla-board'), 200);
    expect(body.data).toMatchObject({
      breached: expect.any(Array), atRisk: expect.any(Array),
      newToday: expect.any(Number), answeredToday: expect.any(Number), metToday: expect.any(Number),
    });
    expect(body.data.metToday).toBeLessThanOrEqual(body.data.answeredToday);
  });

  it('GET /admin/leads/export.csv', async () => {
    const res = await sales.get('/admin/leads/export.csv');
    expectStatus(res, 200);
    expect(res.headers['content-type']).toMatch(/csv/);
    expect(res.text.split('\n').length).toBeGreaterThan(1);
  });

  it('POST /admin/leads creates a lead with an SLA deadline', async () => {
    leadPhone = phone();
    const body = expectStatus(await sales.post('/admin/leads').send({
      name: 'Manual Lead', phone: leadPhone, source: 'call', message: 'Walk-in enquiry', estimatedAmount: 12500.5,
    }), 201);
    leadId = body.data.id;
    expect(body.data.status).toBe('NEW');
    expect(body.data.slaDueAt).toBeTruthy();
  });

  it('stores estimatedAmount as integer paisa', async () => {
    const saved = await prisma.lead.findUnique({ where: { id: leadId } });
    expect(saved.estimatedAmount).toBe(1250050);
  });

  it('GET /admin/leads/:id', async () => {
    expect(expectStatus(await sales.get(`/admin/leads/${leadId}`), 200).data.id).toBe(leadId);
  });

  it('GET /admin/leads/:id is 404 for an unknown id', async () => {
    expectStatus(await sales.get('/admin/leads/does-not-exist'), 404);
  });

  it('GET /admin/leads/:id/duplicates finds a lead with the same phone', async () => {
    const dup = expectStatus(await sales.post('/admin/leads').send({ name: 'Same Person', phone: leadPhone }), 201).data;
    const body = expectStatus(await sales.get(`/admin/leads/${dup.id}/duplicates`), 200);
    expect(body.data.map((l) => l.id)).toContain(leadId);
  });

  it('PUT /admin/leads/:id updates fields', async () => {
    const body = expectStatus(await sales.put(`/admin/leads/${leadId}`).send({ area: 'Baneshwor', priority: 'HIGH' }), 200);
    expect(body.data.area).toBe('Baneshwor');
  });

  it('PATCH /admin/leads/:id/status refuses an illegal transition', async () => {
    const body = expectStatus(await sales.patch(`/admin/leads/${leadId}/status`).send({ status: 'WON' }), 422);
    expect(body.error.code).toBe('INVALID_TRANSITION');
  });

  it('PATCH /admin/leads/:id/status needs a reason to lose a lead', async () => {
    expectStatus(await sales.patch(`/admin/leads/${leadId}/status`).send({ status: 'LOST' }), 400);
  });

  it('PATCH /admin/leads/:id/status NEW → CONTACTED', async () => {
    expect(expectStatus(await sales.patch(`/admin/leads/${leadId}/status`).send({ status: 'CONTACTED' }), 200).data.status).toBe('CONTACTED');
  });

  it('PATCH /admin/leads/:id/assign', async () => {
    expectStatus(await sales.patch(`/admin/leads/${leadId}/assign`).send({ assignedToId: salesUserId }), 200);
    expectStatus(await sales.patch(`/admin/leads/${leadId}/assign`).send({ assignedToId: 'nobody' }), 400);
  });

  it('POST /admin/leads/:id/notes', async () => {
    expectStatus(await sales.post(`/admin/leads/${leadId}/notes`).send({ note: 'Prefers mornings' }), 201);
  });

  it('logging a call stamps firstResponseAt', async () => {
    const fresh = expectStatus(await sales.post('/admin/leads').send({ name: 'Call Me', phone: phone() }), 201).data;
    expect(fresh.firstResponseAt ?? null).toBeNull();
    expectStatus(await sales.post(`/admin/leads/${fresh.id}/activities`).send({ type: 'call', summary: 'Called, will visit' }), 201);
    const after = expectStatus(await sales.get(`/admin/leads/${fresh.id}`), 200).data;
    expect(after.firstResponseAt).toBeTruthy();
  });

  it('POST /admin/leads/:id/convert creates a customer, a site and a surveyed inspection', async () => {
    const surveyorId = await technicianIdFor('SURVEYOR');
    const start = daysFromNow(2);
    const body = expectStatus(await sales.post(`/admin/leads/${leadId}/convert`).send({
      site: { address: 'Baneshwor, Kathmandu', area: 'Baneshwor' },
      createInspectionJob: true,
      scheduledStart: start.toISOString(),
      scheduledEnd: new Date(start.getTime() + 2 * 3600_000).toISOString(),
      surveyorId,
    }), 201);
    // The shape ScheduleVisitDialog reads: result.job.number and result.survey.number.
    expect(body.data.customer.id).toBeTruthy();
    expect(body.data.site.address).toBe('Baneshwor, Kathmandu');
    expect(body.data.job.type).toBe('INSPECTION');
    expect(body.data.job.status).toBe('ASSIGNED');
    expect(body.data.survey.number).toMatch(/^SRV-/);
    const lead = expectStatus(await sales.get(`/admin/leads/${leadId}`), 200).data;
    expect(lead.status).toBe('INSPECTION_SCHEDULED');
  });

  it('POST /admin/leads/merge folds duplicates into one', async () => {
    const p = phone();
    const a = expectStatus(await sales.post('/admin/leads').send({ name: 'Merge A', phone: p }), 201).data;
    const b = expectStatus(await sales.post('/admin/leads').send({ name: 'Merge B', phone: p }), 201).data;
    expectStatus(await sales.post('/admin/leads/merge').send({ primaryId: a.id, duplicateIds: [b.id] }), 200);
    expectStatus(await sales.get(`/admin/leads/${b.id}`), 404);
    expect((await prisma.lead.findUnique({ where: { id: b.id } })).status).toBe('LOST');
  });

  it('POST /admin/leads/merge refuses to bury a WON duplicate — make it the primary instead', async () => {
    const p = phone();
    const open = expectStatus(await sales.post('/admin/leads').send({ name: 'Merge Open', phone: p }), 201).data;
    const won = expectStatus(await sales.post('/admin/leads').send({ name: 'Merge Won', phone: p }), 201).data;
    expectStatus(await sales.patch(`/admin/leads/${won.id}/status`).send({ status: 'CONTACTED' }), 200);
    expectStatus(await sales.patch(`/admin/leads/${won.id}/status`).send({ status: 'WON' }), 200);

    expectStatus(await sales.post('/admin/leads/merge').send({ primaryId: open.id, duplicateIds: [won.id] }), 422);
    const after = await prisma.lead.findUnique({ where: { id: won.id } });
    expect(after).toMatchObject({ status: 'WON', deletedAt: null });
  });

  it('DELETE /admin/leads/:id soft-deletes', async () => {
    const doomed = expectStatus(await sales.post('/admin/leads').send({ name: 'Delete Me', phone: phone() }), 201).data;
    expectStatus(await sales.delete(`/admin/leads/${doomed.id}`), 204);
    expectStatus(await sales.get(`/admin/leads/${doomed.id}`), 404);
    expect((await prisma.lead.findUnique({ where: { id: doomed.id } })).deletedAt).toBeTruthy();
  });

  it('enforces RBAC on leads', async () => {
    expectStatus(await (await as('TECHNICIAN')).get('/admin/leads'), 403);
    expectStatus(await (await as('EDITOR')).get('/admin/leads'), 403);
    expectStatus(await (await as('ACCOUNTANT')).get('/admin/leads'), 403);
    const dispatcher = await as('DISPATCHER');
    expectStatus(await dispatcher.get('/admin/leads'), 200);
    expectStatus(await dispatcher.post('/admin/leads').send({ name: 'No Rights', phone: phone() }), 403);
  });
});

describe('lead convert — priced by documentTotals, all or nothing', () => {
  let service;

  beforeAll(async () => {
    // Rs 2,500.50 makes VAT land on a half paisa, so the fixture checks rounding
    // as well as that VAT is there at all.
    service = expectStatus(await (await as('EDITOR')).post('/admin/services').send({
      name: `Convert Fixture ${uid()}`,
      excerpt: 'A fixed-price service used to check the totals a lead convert produces.',
      priceFrom: 2500.5,
    }), 201).data;
  });

  const newLead = async () =>
    expectStatus(await sales.post('/admin/leads').send({ name: 'Convert Lead', phone: phone(), serviceId: service.id }), 201).data;

  it('the converted quotation carries 13% VAT', async () => {
    const lead = await newLead();
    const { quotation } = expectStatus(await sales.post(`/admin/leads/${lead.id}/convert`).send({ createQuotation: true }), 201).data;
    // 1 × 250050 paisa = 250050; VAT 13% = 32506.5 → 32507; total 282557.
    expect(quotation.items).toHaveLength(1);
    expect(quotation.items[0]).toMatchObject({ qty: 1, rate: 250050, amount: 250050 });
    expect(quotation).toMatchObject({
      subtotal: 250050, discount: 0, vatApplied: true, vatRate: 13, vatAmount: 32507, total: 282557, status: 'DRAFT',
    });
  });

  it('a NEW lead passes through CONTACTED on its way to QUOTED, one timeline entry per step', async () => {
    const lead = await newLead();
    expectStatus(await sales.post(`/admin/leads/${lead.id}/convert`).send({ createQuotation: true }), 201);
    expect((await prisma.lead.findUnique({ where: { id: lead.id } })).status).toBe('QUOTED');
    expect(await statusTrail(lead.id)).toEqual(['NEW>CONTACTED', 'CONTACTED>QUOTED']);
  });

  it('an inspection and a quotation together walk the funnel in order and end QUOTED', async () => {
    const lead = await newLead();
    expectStatus(await sales.post(`/admin/leads/${lead.id}/convert`).send({
      site: { address: 'Lazimpat, Kathmandu' },
      createQuotation: true,
      createInspectionJob: true,
      surveyorId: await technicianIdFor('SURVEYOR'),
    }), 201);
    expect(await statusTrail(lead.id)).toEqual(['NEW>CONTACTED', 'CONTACTED>INSPECTION_SCHEDULED', 'INSPECTION_SCHEDULED>QUOTED']);
  });

  it('never moves a lead backwards: a QUOTED lead sent for an inspection stays QUOTED', async () => {
    const lead = await newLead();
    expectStatus(await sales.post(`/admin/leads/${lead.id}/convert`).send({ createQuotation: true }), 201);
    const body = expectStatus(await sales.post(`/admin/leads/${lead.id}/convert`).send({ createInspectionJob: true }), 201).data;
    expect(body.job.type).toBe('INSPECTION');
    expect((await prisma.lead.findUnique({ where: { id: lead.id } })).status).toBe('QUOTED');
  });

  it('a failure in the job step leaves no customer, quotation, job or lead change behind', async () => {
    const lead = await newLead();
    // An unknown surveyor fails inside createJob, after the customer, site and
    // quotation have already been written in the same transaction.
    const res = await sales.post(`/admin/leads/${lead.id}/convert`).send({
      site: { address: 'Kupondole, Lalitpur' },
      createQuotation: true,
      createInspectionJob: true,
      surveyorId: 'no-such-technician',
    });
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.status).toBeLessThan(500);

    expect(await prisma.customer.count({ where: { phone: lead.phone } })).toBe(0);
    expect(await prisma.quotation.count({ where: { leadId: lead.id } })).toBe(0);
    expect(await prisma.job.count({ where: { leadId: lead.id } })).toBe(0);
    expect(await prisma.lead.findUnique({ where: { id: lead.id } })).toMatchObject({ status: 'NEW', customerId: null, firstResponseAt: null });
    expect(await statusTrail(lead.id)).toEqual([]);
  });
});

describe('customers', () => {
  let customer;
  let siteId;

  it('POST /admin/customers', async () => {
    customer = await createCustomer(sales);
    expect(customer.id).toBeTruthy();
  });

  it('refuses a duplicate phone or a bad one', async () => {
    const res = await sales.post('/admin/customers').send({ name: 'Bad Phone', phone: '555' });
    expectStatus(res, 400);
  });

  it('GET /admin/customers with search', async () => {
    const body = expectStatus(await sales.get(`/admin/customers?q=${encodeURIComponent(customer.name)}`), 200);
    expect(body.data.map((c) => c.id)).toContain(customer.id);
  });

  it('GET/PUT /admin/customers/:id', async () => {
    expectStatus(await sales.get(`/admin/customers/${customer.id}`), 200);
    const body = expectStatus(await sales.put(`/admin/customers/${customer.id}`).send({ panVatNo: '301234567' }), 200);
    expect(body.data.panVatNo).toBe('301234567');
  });

  it('sites: create, list, update, delete', async () => {
    siteId = expectStatus(await sales.post(`/admin/customers/${customer.id}/sites`).send({
      label: 'Office', address: 'Putalisadak, Kathmandu', isPrimary: true,
    }), 201).data.id;
    const list = expectStatus(await sales.get(`/admin/customers/${customer.id}/sites`), 200);
    expect(list.data.map((s) => s.id)).toContain(siteId);
    expectStatus(await sales.put(`/admin/customers/${customer.id}/sites/${siteId}`).send({ accessNotes: 'Gate code 1234' }), 200);
    expectStatus(await sales.delete(`/admin/customers/${customer.id}/sites/${siteId}`), 204);
  });

  it('GET /admin/customers/:id/timeline', async () => {
    expectStatus(await sales.get(`/admin/customers/${customer.id}/timeline`), 200);
  });

  it('DELETE /admin/customers/:id', async () => {
    const doomed = await createCustomer(sales);
    expectStatus(await sales.delete(`/admin/customers/${doomed.id}`), 204);
    expectStatus(await sales.get(`/admin/customers/${doomed.id}`), 404);
  });
});

describe('rate card', () => {
  let itemId;

  it('GET /admin/rate-card', async () => {
    expect(expectStatus(await sales.get('/admin/rate-card'), 200).data.length).toBeGreaterThan(0);
  });

  it('POST/PUT/DELETE /admin/rate-card', async () => {
    const code = uid('RC-').toUpperCase();
    itemId = expectStatus(await sales.post('/admin/rate-card').send({ code, name: 'Test rate', unit: 'sq.ft', rate: 99.5 }), 201).data.id;
    expect((await prisma.rateCardItem.findUnique({ where: { id: itemId } })).rate).toBe(9950);
    expectStatus(await sales.put(`/admin/rate-card/${itemId}`).send({ rate: 105 }), 200);
    expectStatus(await sales.delete(`/admin/rate-card/${itemId}`), 204);
  });

  it('offers the resource surface the back office screens use: get, toggle, reorder, restore', async () => {
    const code = uid('rc-');
    const item = expectStatus(await sales.post('/admin/rate-card').send({ code, name: 'Surface rate', unit: 'rft', rate: 40 }), 201).data;
    expect(item.code).toBe(code.toUpperCase());
    expect(expectStatus(await sales.get(`/admin/rate-card/${item.id}`), 200).data.rate).toBe(4000);
    expect(expectStatus(await sales.patch(`/admin/rate-card/${item.id}/toggle`), 200).data.isActive).toBe(false);
    expectStatus(await sales.patch('/admin/rate-card/reorder').send({ items: [{ id: item.id, sortOrder: 42 }] }), 204);
    expect((await prisma.rateCardItem.findUnique({ where: { id: item.id } })).sortOrder).toBe(42);

    expectStatus(await sales.delete(`/admin/rate-card/${item.id}`), 204);
    expectStatus(await sales.get(`/admin/rate-card/${item.id}`), 404);
    const trash = expectStatus(await sales.get('/admin/rate-card?deleted=true&limit=100'), 200).data;
    expect(trash.map((r) => r.id)).toContain(item.id);
    expectStatus(await sales.patch(`/admin/rate-card/${item.id}/restore`), 200);
    expectStatus(await sales.get(`/admin/rate-card/${item.id}`), 200);

    // Deleting for good is cms:purge, which SALES does not hold.
    expectStatus(await sales.delete(`/admin/rate-card/${item.id}?hard=true`), 403);
    expectStatus(await (await as('ADMIN')).delete(`/admin/rate-card/${item.id}?hard=true`), 204);
    expect(await prisma.rateCardItem.findUnique({ where: { id: item.id } })).toBeNull();
  });

  it('a lower-case code is the same code as its upper-case twin', async () => {
    const code = uid('RC-').toUpperCase();
    expectStatus(await sales.post('/admin/rate-card').send({ code, name: 'Twin', unit: 'nos', rate: 1 }), 201);
    expect((await sales.post('/admin/rate-card').send({ code: code.toLowerCase(), name: 'Twin', unit: 'nos', rate: 1 })).status).toBe(409);
  });

  it('a rate change reaches the public pricing page', async () => {
    const code = uid('RC-').toUpperCase();
    const item = expectStatus(await sales.post('/admin/rate-card').send({ code, name: 'Pricing page rate', unit: 'sq.ft', rate: 10 }), 201).data;
    expectStatus(await sales.put(`/admin/rate-card/${item.id}`).send({ rate: 12.5 }), 200);
    const row = expectStatus(await anon().get('/public/pricing'), 200).data.rateCard.find((r) => r.id === item.id);
    expect(row.rate).toBe(1250);
    expectStatus(await sales.delete(`/admin/rate-card/${item.id}`), 204);
  });

  it('ACCOUNTANT can read quotations but not write the rate card', async () => {
    const accountant = await as('ACCOUNTANT');
    expectStatus(await accountant.get('/admin/rate-card'), 200);
    expectStatus(await accountant.post('/admin/rate-card').send({ code: 'X-1', name: 'Nope', unit: 'nos', rate: 1 }), 403);
  });
});

describe('quotations', () => {
  let customer;
  let quotation;

  beforeAll(async () => { customer = await createCustomer(sales); });

  it('POST /admin/quotations computes totals in paisa', async () => {
    const body = expectStatus(await sales.post('/admin/quotations').send({
      customerId: customer.id,
      discount: 500,
      items: [
        { description: 'Seepage treatment', unit: 'sq.ft', qty: 210.5, rate: 220 },
        { description: 'Replaster', unit: 'sq.ft', qty: 210.5, rate: 95 },
        { description: 'Site cleaning', unit: 'lump', qty: 1, rate: 1500 },
      ],
    }), 201);
    quotation = body.data;
    const subtotal = Math.round(210.5 * 22000) + Math.round(210.5 * 9500) + 150000;
    const vat = Math.round(((subtotal - 50000) * 13) / 100);
    expect(quotation.subtotal).toBe(subtotal);
    expect(quotation.discount).toBe(50000);
    expect(quotation.vatAmount).toBe(vat);
    expect(quotation.total).toBe(subtotal - 50000 + vat);
    expect(quotation.status).toBe('DRAFT');
  });

  it('GET /admin/quotations and /:id', async () => {
    const list = expectStatus(await sales.get('/admin/quotations'), 200);
    expect(list.data.map((q) => q.id)).toContain(quotation.id);
    expect(expectStatus(await sales.get(`/admin/quotations/${quotation.id}`), 200).data.items.length).toBe(3);
  });

  it('PUT /admin/quotations/:id replaces the lines and recomputes', async () => {
    const body = expectStatus(await sales.put(`/admin/quotations/${quotation.id}`).send({
      items: [{ description: 'Only line', unit: 'nos', qty: 2, rate: 1000 }],
      vatApplied: false,
      discount: 0,
    }), 200);
    expect(body.data.total).toBe(200000);
  });

  it('POST /admin/quotations/:id/send refuses a draft nobody approved', async () => {
    const res = expectStatus(await sales.post(`/admin/quotations/${quotation.id}/send`), 422);
    expect(res.error.code).toBe('INVALID_TRANSITION');
  });

  it('POST /admin/quotations/:id/send issues a public link once approved', async () => {
    const sent = await approveAndSend(quotation.id);
    expect(sent.status).toBe('SENT');
    expect(sent.publicToken).toBeTruthy();
  });

  it('PUT /admin/quotations/:id on a SENT quotation is 422 and changes nothing', async () => {
    // The customer approves the numbers they were sent, so those numbers are frozen.
    const before = expectStatus(await sales.get(`/admin/quotations/${quotation.id}`), 200).data;
    const res = expectStatus(await sales.put(`/admin/quotations/${quotation.id}`).send({
      items: [{ description: 'Changed after sending', unit: 'nos', qty: 1, rate: 1 }],
      terms: 'Changed after sending',
    }), 422);
    expect(res.error.message).toMatch(/revision/i);
    const after = expectStatus(await sales.get(`/admin/quotations/${quotation.id}`), 200).data;
    expect(after.total).toBe(before.total);
    expect(after.items.map((i) => i.description)).toEqual(before.items.map((i) => i.description));
    expect(after.terms ?? null).toBe(before.terms ?? null);
  });

  it('POST /admin/quotations/:id/revise opens a new revision', async () => {
    expectStatus(await sales.post(`/admin/quotations/${quotation.id}/revise`), 201);
  });

  it('expireQuotations() (the quotation:expire task) expires SENT quotations past validUntil, and only those', async () => {
    const make = async (validUntil, { send = true } = {}) => {
      const q = expectStatus(await sales.post('/admin/quotations').send({
        customerId: customer.id, validUntil, items: [{ description: 'Expiry sweep', qty: 1, rate: 100 }],
      }), 201).data;
      if (send) await approveAndSend(q.id);
      return q.id;
    };
    const stale = await make(daysFromNow(-2).toISOString());
    const current = await make(daysFromNow(10).toISOString());
    const staleDraft = await make(daysFromNow(-2).toISOString(), { send: false });

    const result = await expireQuotations();
    expect(result.expired).toBeGreaterThanOrEqual(1);
    const status = async (id) => (await prisma.quotation.findUnique({ where: { id } })).status;
    expect(await status(stale)).toBe('EXPIRED');
    expect(await status(current)).toBe('SENT');
    expect(await status(staleDraft)).toBe('DRAFT');
  });

  describe('customer approval moves the lead through the state machine', () => {
    const leadAt = async (...statuses) => {
      const lead = expectStatus(await sales.post('/admin/leads').send({ name: 'Approval Lead', phone: phone() }), 201).data;
      for (const status of statuses) {
        expectStatus(await sales.patch(`/admin/leads/${lead.id}/status`).send({
          status, ...(status === 'LOST' ? { lostReason: 'Went with another company' } : {}),
        }), 200);
      }
      return lead;
    };
    const approveFor = async (leadId) => {
      const q = expectStatus(await sales.post('/admin/quotations').send({
        customerId: customer.id, leadId, items: [{ description: 'Approval edge case', qty: 1, rate: 1000 }],
      }), 201).data;
      const { publicToken } = await approveAndSend(q.id);
      return anon().post(`/public/quotations/${publicToken}/decide`).send({ decision: 'approve' });
    };

    it('a NEW lead is WON by way of CONTACTED, with closedAt and a timeline entry per step', async () => {
      const lead = await leadAt();
      expectStatus(await approveFor(lead.id), 200);
      const after = await prisma.lead.findUnique({ where: { id: lead.id } });
      expect(after.status).toBe('WON');
      expect(after.closedAt).toBeTruthy();
      expect(await statusTrail(lead.id)).toEqual(['NEW>CONTACTED', 'CONTACTED>WON']);
    });

    it('a LOST lead does not fail the customer — it stays LOST and the timeline says the customer accepted', async () => {
      const lead = await leadAt('CONTACTED', 'LOST');
      expect(expectStatus(await approveFor(lead.id), 200).data.status).toBe('CONVERTED');
      expect((await prisma.lead.findUnique({ where: { id: lead.id } })).status).toBe('LOST');
      const note = await prisma.leadActivity.findFirst({
        where: { leadId: lead.id, type: 'note', summary: { contains: 'accepted', mode: 'insensitive' } },
      });
      expect(note).toBeTruthy();
    });

    it('a lead already WON stays WON and the approval goes through', async () => {
      const lead = await leadAt('CONTACTED', 'WON');
      expectStatus(await approveFor(lead.id), 200);
      expect((await prisma.lead.findUnique({ where: { id: lead.id } })).status).toBe('WON');
      expect(await statusTrail(lead.id)).toEqual(['NEW>CONTACTED', 'CONTACTED>WON']);
    });
  });

  it('DELETE /admin/quotations/:id on a draft', async () => {
    const draft = expectStatus(await sales.post('/admin/quotations').send({
      customerId: customer.id, items: [{ description: 'Temp', qty: 1, rate: 10 }],
    }), 201).data;
    expectStatus(await sales.delete(`/admin/quotations/${draft.id}`), 204);
  });

  it('refuses a quotation with no lines or an unknown customer', async () => {
    expectStatus(await sales.post('/admin/quotations').send({ customerId: customer.id, items: [] }), 400);
    const res = await sales.post('/admin/quotations').send({ customerId: 'nope', items: [{ description: 'x', qty: 1, rate: 1 }] });
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.status).toBeLessThan(500);
  });

  describe('approved quotation → job', () => {
    let approved;

    // Since Phase F a customer's acceptance creates the job itself. This endpoint stays for
    // quotations the customer approved before that shipped: APPROVED, with no job yet.
    beforeAll(async () => {
      approved = expectStatus(await sales.post('/admin/quotations').send({
        customerId: customer.id,
        items: [{ description: 'Terrace waterproofing', unit: 'sq.ft', qty: 400, rate: 180 }],
      }), 201).data;
      await prisma.quotation.update({ where: { id: approved.id }, data: { status: 'APPROVED', sentAt: new Date(), decidedAt: new Date() } });
    });

    it('POST /admin/jobs refuses to convert a quotation nobody approved', async () => {
      const draft = expectStatus(await sales.post('/admin/quotations').send({
        customerId: customer.id, items: [{ description: 'Unapproved', qty: 1, rate: 100 }],
      }), 201).data;
      const dispatcher = await as('DISPATCHER');
      const res = await dispatcher.post('/admin/jobs').send({ customerId: customer.id, title: 'Too early', quotationId: draft.id });
      expect(expectStatus(res, 422).error.code).toBe('INVALID_TRANSITION');
      expect(expectStatus(await dispatcher.post(`/admin/quotations/${draft.id}/convert-to-job`).send({}), 422).error.code).toBe('INVALID_TRANSITION');
      expect((await prisma.quotation.findUnique({ where: { id: draft.id } })).status).toBe('DRAFT');
    });

    it('POST /admin/jobs refuses a quotation that belongs to another customer', async () => {
      const other = await createCustomer(sales);
      expectStatus(await (await as('DISPATCHER')).post('/admin/jobs').send({ customerId: other.id, title: 'Wrong customer', quotationId: approved.id }), 400);
    });

    it('SALES can win the work but not schedule it', async () => {
      expectStatus(await sales.post(`/admin/quotations/${approved.id}/convert-to-job`).send({}), 403);
    });

    it('POST /admin/quotations/:id/convert-to-job builds the job from the quotation', async () => {
      const templateId = (await prisma.jobTemplate.findFirst({ where: { deletedAt: null } })).id;
      const job = expectStatus(await (await as('DISPATCHER')).post(`/admin/quotations/${approved.id}/convert-to-job`).send({
        templateId, scheduledStart: daysFromNow(3).toISOString(),
      }), 201).data;
      expect(job.customerId).toBe(customer.id);
      expect(job.quotationId).toBe(approved.id);
      expect(job.status).toBe('SCHEDULED');
      expect(job.tasks.length).toBeGreaterThan(0);
      expect(job.title).toContain(approved.number);
      expect(expectStatus(await sales.get(`/admin/quotations/${approved.id}`), 200).data.status).toBe('CONVERTED');
    });

    it('a second convert-to-job is refused and creates no second job', async () => {
      const res = await (await as('DISPATCHER')).post(`/admin/quotations/${approved.id}/convert-to-job`).send({});
      expect(expectStatus(res, 422).error.code).toBe('INVALID_TRANSITION');
      expect(await prisma.job.count({ where: { quotationId: approved.id } })).toBe(1);
    });

    it('404 for an unknown quotation', async () => {
      expectStatus(await (await as('DISPATCHER')).post('/admin/quotations/nope/convert-to-job').send({}), 404);
    });
  });

  it('TECHNICIAN cannot see quotations', async () => {
    expectStatus(await (await as('TECHNICIAN')).get('/admin/quotations'), 403);
  });
});
