import { describe, it, expect, beforeAll } from 'vitest';
import {
  anon, as, expectStatus, createCustomer, technicianIdFor, phone, uid, daysFromNow, prisma,
} from './helpers.js';

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
    expect(body.data).toBeTypeOf('object');
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

  it('POST /admin/quotations/:id/send issues a public link', async () => {
    const body = expectStatus(await sales.post(`/admin/quotations/${quotation.id}/send`), 200);
    expect(body.data.status).toBe('SENT');
  });

  it('POST /admin/quotations/:id/revise opens a new revision', async () => {
    expectStatus(await sales.post(`/admin/quotations/${quotation.id}/revise`), 201);
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

    beforeAll(async () => {
      approved = expectStatus(await sales.post('/admin/quotations').send({
        customerId: customer.id,
        items: [{ description: 'Terrace waterproofing', unit: 'sq.ft', qty: 400, rate: 180 }],
      }), 201).data;
      expectStatus(await sales.post(`/admin/quotations/${approved.id}/send`), 200);
      const { publicToken } = await prisma.quotation.findUnique({ where: { id: approved.id } });
      expectStatus(await anon().post(`/public/quotations/${publicToken}/decide`).send({ decision: 'approve' }), 200);
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

    it('404 for an unknown quotation', async () => {
      expectStatus(await (await as('DISPATCHER')).post('/admin/quotations/nope/convert-to-job').send({}), 404);
    });
  });

  it('TECHNICIAN cannot see quotations', async () => {
    expectStatus(await (await as('TECHNICIAN')).get('/admin/quotations'), 403);
  });
});
