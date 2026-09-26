import { describe, it, expect, beforeAll } from 'vitest';
import {
  anon, as, approveAndSend, expectStatus, createCustomer, createAssignedJob, createCompletedJob, daysFromNow, prisma, technicianIdFor,
} from './helpers.js';

let accountant;

beforeAll(async () => { accountant = await as('ACCOUNTANT'); });

describe('invoices', () => {
  let customer;
  let invoice;

  beforeAll(async () => { customer = await createCustomer(await as('SALES')); });

  it('GET /admin/invoices with filters', async () => {
    expect(expectStatus(await accountant.get('/admin/invoices'), 200).data.length).toBeGreaterThan(0);
    for (const qs of ['status=PARTIAL', 'overdueOnly=true', `customerId=${customer.id}`, 'q=INV']) {
      expectStatus(await accountant.get(`/admin/invoices?${qs}`), 200);
    }
  });

  it('POST /admin/invoices computes totals in paisa', async () => {
    invoice = expectStatus(await accountant.post('/admin/invoices').send({
      customerId: customer.id,
      items: [
        { description: 'Labour', unit: 'hour', qty: 7.5, rate: 650 },
        { description: 'Materials', unit: 'lump', qty: 1, rate: 2333.33 },
      ],
    }), 201).data;
    const subtotal = Math.round(7.5 * 65000) + 233333;
    expect(invoice.subtotal).toBe(subtotal);
    expect(invoice.vatAmount).toBe(Math.round((subtotal * 13) / 100));
    expect(invoice.total).toBe(invoice.subtotal + invoice.vatAmount);
  });

  it('GET/PUT /admin/invoices/:id', async () => {
    expectStatus(await accountant.get(`/admin/invoices/${invoice.id}`), 200);
    const updated = expectStatus(await accountant.put(`/admin/invoices/${invoice.id}`).send({
      items: [{ description: 'Flat fee', unit: 'lump', qty: 1, rate: 10000 }], vatApplied: true,
    }), 200).data;
    expect(updated.total).toBe(1000000 + 130000);
    invoice = updated;
  });

  it('POST /admin/invoices/:id/send', async () => {
    expect(expectStatus(await accountant.post(`/admin/invoices/${invoice.id}/send`), 200).data.status).toBe('SENT');
  });

  it('payments: an overpayment is refused, a part payment is PARTIAL, the balance settles', async () => {
    const over = await accountant.post(`/admin/invoices/${invoice.id}/payments`).send({ amount: 20000, method: 'CASH' });
    expect(over.status).toBeGreaterThanOrEqual(400);
    expect(over.status).toBeLessThan(500);

    const part = expectStatus(await accountant.post(`/admin/invoices/${invoice.id}/payments`).send({ amount: 5000, method: 'ESEWA', reference: 'ESW-1' }), 201);
    expect(part.data.id).toBeTruthy();
    expect((await prisma.invoice.findUnique({ where: { id: invoice.id } })).status).toBe('PARTIAL');

    const rest = expectStatus(await accountant.post(`/admin/invoices/${invoice.id}/payments`).send({ amount: 6300, method: 'BANK' }), 201);
    expect(rest.data.id).toBeTruthy();
    expect((await prisma.invoice.findUnique({ where: { id: invoice.id } })).status).toBe('PAID');
  });

  it('GET /admin/payments finds a payment by its reference', async () => {
    const all = expectStatus(await accountant.get('/admin/payments'), 200);
    expect(all.meta.total).toBeGreaterThan(0);
    const byRef = expectStatus(await accountant.get('/admin/payments?q=ESW-1'), 200);
    expect(byRef.data.some((p) => p.invoice.id === invoice.id && p.reference === 'ESW-1')).toBe(true);
    const byMethod = expectStatus(await accountant.get('/admin/payments?method=BANK'), 200);
    expect(byMethod.data.every((p) => p.method === 'BANK')).toBe(true);
    const byCustomer = expectStatus(await accountant.get(`/admin/payments?customerId=${customer.id}`), 200);
    expect(byCustomer.data.every((p) => p.invoice.customer.id === customer.id)).toBe(true);
    expectStatus(await accountant.get('/admin/payments?method=BITCOIN'), 400);
    expectStatus(await (await as('SALES')).get('/admin/payments'), 403);
  });

  describe('voiding a payment', () => {
    const voidUrl = (invoiceId, paymentId) => `/admin/invoices/${invoiceId}/payments/${paymentId}/void`;
    const bank = () => prisma.payment.findFirst({ where: { invoiceId: invoice.id, method: 'BANK' } });

    it('the old DELETE route is gone — money records are voided, never removed', async () => {
      const payment = await bank();
      expectStatus(await accountant.delete(`/admin/invoices/${invoice.id}/payments/${payment.id}`), 404);
      expect(await prisma.payment.findUnique({ where: { id: payment.id } })).toBeTruthy();
    });

    it('needs a reason', async () => {
      const payment = await bank();
      expectStatus(await accountant.post(voidUrl(invoice.id, payment.id)).send({}), 400);
      expect((await prisma.payment.findUnique({ where: { id: payment.id } })).voidedAt).toBeNull();
    });

    it('SALES cannot void a payment', async () => {
      const payment = await bank();
      expectStatus(await (await as('SALES')).post(voidUrl(invoice.id, payment.id)).send({ reason: 'Not mine to void' }), 403);
    });

    it('on a PAID invoice: PAID → PARTIAL, paidAmount drops, the row stays and is flagged', async () => {
      const me = expectStatus(await accountant.get('/auth/me'), 200).data;
      const payment = await bank();
      const voided = expectStatus(await accountant.post(voidUrl(invoice.id, payment.id)).send({ reason: 'Cheque bounced' }), 200).data;
      expect(voided.voidedAt).toBeTruthy();
      expect(voided.voidReason).toBe('Cheque bounced');
      expect(voided.voidedById).toBe(me.id);

      const detail = expectStatus(await accountant.get(`/admin/invoices/${invoice.id}`), 200).data;
      expect(detail.status).toBe('PARTIAL');
      expect(detail.paidAmount).toBe(500000);
      expect(detail.payments).toHaveLength(2);
      expect(detail.payments.find((p) => p.id === payment.id).voidedAt).toBeTruthy();

      const listed = expectStatus(await accountant.get(`/admin/payments?customerId=${customer.id}`), 200).data;
      expect(listed.find((p) => p.id === payment.id).voidedAt).toBeTruthy();
    });

    it('voiding the same payment twice is 422', async () => {
      const payment = await bank();
      expectStatus(await accountant.post(voidUrl(invoice.id, payment.id)).send({ reason: 'Again' }), 422);
    });

    it('a payment from another invoice is 404', async () => {
      const other = await prisma.payment.findFirst({ where: { invoiceId: { not: invoice.id } } });
      expectStatus(await accountant.post(voidUrl(invoice.id, other.id)).send({ reason: 'Wrong invoice' }), 404);
    });

    it('the balance can be paid again after a void — voided money is not counted as received', async () => {
      // Rs 6,300 outstanding again; paying it must be accepted, not refused as an overpayment.
      expectStatus(await accountant.post(`/admin/invoices/${invoice.id}/payments`).send({ amount: 6300, method: 'CASH' }), 201);
      expect((await prisma.invoice.findUnique({ where: { id: invoice.id } })).status).toBe('PAID');
    });

    it('voiding every payment returns the invoice to SENT, or OVERDUE once it is past due', async () => {
      const make = async () => {
        const inv = expectStatus(await accountant.post('/admin/invoices').send({
          customerId: customer.id, items: [{ description: 'Void all', qty: 1, rate: 1000 }], vatApplied: false,
        }), 201).data;
        expectStatus(await accountant.post(`/admin/invoices/${inv.id}/send`), 200);
        const pay = expectStatus(await accountant.post(`/admin/invoices/${inv.id}/payments`).send({ amount: 1000, method: 'CASH' }), 201).data;
        return { inv, pay };
      };

      const current = await make();
      expectStatus(await accountant.post(voidUrl(current.inv.id, current.pay.id)).send({ reason: 'Recorded twice' }), 200);
      const back = await prisma.invoice.findUnique({ where: { id: current.inv.id } });
      expect(back).toMatchObject({ status: 'SENT', paidAmount: 0 });

      const late = await make();
      await prisma.invoice.update({ where: { id: late.inv.id }, data: { dueDate: daysFromNow(-3) } });
      expectStatus(await accountant.post(voidUrl(late.inv.id, late.pay.id)).send({ reason: 'Recorded twice' }), 200);
      expect(await prisma.invoice.findUnique({ where: { id: late.inv.id } })).toMatchObject({ status: 'OVERDUE', paidAmount: 0 });
    });

    it('the customer sees the voided payment struck through, and reports ignore it', async () => {
      const payment = await prisma.payment.findFirst({ where: { invoiceId: invoice.id, method: 'BANK' } });
      const { publicToken } = await prisma.invoice.findUnique({ where: { id: invoice.id } });
      const pub = expectStatus(await anon().get(`/public/invoices/${publicToken}`), 200).data;
      expect(pub.payments.filter((p) => p.voidedAt)).toHaveLength(1);

      const collections = expectStatus(await accountant.get('/admin/reports/collections'), 200).data;
      expect(collections.payments.some((p) => p.id === payment.id)).toBe(false);

      const statement = expectStatus(await accountant.get(`/admin/customers/${customer.id}/statement`), 200).data;
      const invoices = await prisma.invoice.findMany({ where: { customerId: customer.id, status: { not: 'VOID' } } });
      expect(statement.totals.paid).toBe(invoices.reduce((s, i) => s + i.paidAmount, 0));
    });
  });

  it('POST /admin/invoices/:id/void needs a reason, and a void invoice takes no payment', async () => {
    const other = expectStatus(await accountant.post('/admin/invoices').send({
      customerId: customer.id, items: [{ description: 'To void', qty: 1, rate: 100 }],
    }), 201).data;
    expectStatus(await accountant.post(`/admin/invoices/${other.id}/void`).send({}), 400);
    expect(expectStatus(await accountant.post(`/admin/invoices/${other.id}/void`).send({ reason: 'Raised in error' }), 200).data.status).toBe('VOID');
    const pay = await accountant.post(`/admin/invoices/${other.id}/payments`).send({ amount: 10, method: 'CASH' });
    expect(pay.status).toBeGreaterThanOrEqual(400);
    expect(pay.status).toBeLessThan(500);
  });

  it('POST /admin/invoices/from-job/:jobId invoices once', async () => {
    const { job } = await createCompletedJob({ withMaterial: true });
    const inv = expectStatus(await accountant.post(`/admin/invoices/from-job/${job.id}`).send({}), 201).data;
    expect(inv.total).toBeGreaterThan(0);
    expect(expectStatus(await accountant.post(`/admin/invoices/from-job/${job.id}`).send({}), 422).error).toBeTruthy();
  });

  describe('a job is billed by one rule, never two (defect #16)', () => {
    /** Takes a job IN_PROGRESS → material issued → 90 minutes logged → COMPLETED. */
    async function finish(job, technicianId) {
      const dispatcher = await as('DISPATCHER');
      expectStatus(await dispatcher.patch(`/admin/jobs/${job.id}/status`).send({ status: 'IN_PROGRESS' }), 200);
      const material = await prisma.material.findFirst({ where: { deletedAt: null, isActive: true } });
      expectStatus(await dispatcher.post(`/admin/jobs/${job.id}/materials`).send({ materialId: material.id, qty: 2 }), 201);
      expectStatus(await dispatcher.post(`/admin/jobs/${job.id}/time-logs`).send({
        technicianId, startedAt: daysFromNow(-1).toISOString(), minutes: 90,
      }), 201);
      expectStatus(await dispatcher.post(`/admin/jobs/${job.id}/complete`).send({ note: 'Done in test' }), 200);
    }

    async function quotedJob() {
      const sales = await as('SALES');
      const quote = expectStatus(await sales.post('/admin/quotations').send({
        customerId: customer.id,
        discount: 500,
        items: [
          { description: 'Terrace membrane waterproofing', unit: 'sq.ft', qty: 420, rate: 275 },
          { description: 'Epoxy crack injection', unit: 'rft', qty: 18.5, rate: 165 },
        ],
      }), 201).data;
      // The real path: approved, sent, and accepted on the customer's link, which creates the job.
      const { publicToken } = await approveAndSend(quote.id);
      expectStatus(await anon().post(`/public/quotations/${publicToken}/decide`)
        .set('User-Agent', 'Mozilla/5.0 (Linux; Android 14) Mobile').send({ decision: 'approve' }), 200);
      const job = await prisma.job.findFirst({ where: { quotationId: quote.id } });
      const technicianId = await technicianIdFor('TECHNICIAN');
      expectStatus(await (await as('DISPATCHER')).post(`/admin/jobs/${job.id}/assign`).send({ technicianIds: [technicianId] }), 200);
      await finish(job, technicianId);
      return { quote: await prisma.quotation.findUnique({ where: { id: quote.id } }), job };
    }

    it('a quoted job bills exactly the quotation — not its materials and labour on top', async () => {
      const { quote, job } = await quotedJob();
      const inv = expectStatus(await accountant.post(`/admin/invoices/from-job/${job.id}`).send({}), 201).data;
      expect(inv.items.map((i) => i.description)).toEqual(['Terrace membrane waterproofing', 'Epoxy crack injection']);
      expect(inv.discount).toBe(quote.discount);
      expect(inv.total).toBe(quote.total);
    });

    it('asking for actuals on a quoted job is refused, and leaves it billable', async () => {
      const { job } = await quotedJob();
      const refused = expectStatus(await accountant.post(`/admin/invoices/from-job/${job.id}`).send({ includeMaterials: true }), 422);
      expect(refused.error.code).toBe('QUOTED_JOB_BILLS_SCOPE');
      expect((await prisma.job.findUnique({ where: { id: job.id } })).invoicedAt).toBeNull();
      expectStatus(await accountant.post(`/admin/invoices/from-job/${job.id}`).send({}), 201);
    });

    it('an unquoted job bills labour at the rate card, never the technician\'s own hourly rate', async () => {
      const technicianId = await technicianIdFor('TECHNICIAN');
      const { hourlyRate } = await prisma.technician.findUnique({ where: { id: technicianId } });
      const labour = await prisma.rateCardItem.findUnique({ where: { code: 'LABOUR-SKILL' } });
      // A pay rate that differs from the selling rate, so billing the wrong one shows.
      await prisma.technician.update({ where: { id: technicianId }, data: { hourlyRate: labour.rate + 12345 } });
      try {
        const { job } = await createAssignedJob();
        await finish(job, technicianId);
        const inv = expectStatus(await accountant.post(`/admin/invoices/from-job/${job.id}`).send({}), 201).data;
        const line = inv.items.find((i) => i.unit === 'hour');
        expect(line).toMatchObject({ description: labour.name, qty: 1.5, rate: labour.rate });
        expect(inv.items.some((i) => i.description.startsWith('Material:'))).toBe(true);
      } finally {
        await prisma.technician.update({ where: { id: technicianId }, data: { hourlyRate } });
      }
    });
  });

  it('SALES and DISPATCHER cannot see invoices', async () => {
    expectStatus(await (await as('SALES')).get('/admin/invoices'), 403);
    expectStatus(await (await as('DISPATCHER')).get('/admin/invoices'), 403);
  });
});

describe('expenses', () => {
  it('CRUD, amounts in paisa', async () => {
    const created = expectStatus(await accountant.post('/admin/expenses').send({ category: 'Transport', amount: 850.5, vendor: 'Pathao' }), 201).data;
    expect(created.amount).toBe(85050);
    expectStatus(await accountant.get('/admin/expenses'), 200);
    expect(expectStatus(await accountant.get(`/admin/expenses/${created.id}`), 200).data.vendor).toBe('Pathao');
    expectStatus(await accountant.put(`/admin/expenses/${created.id}`).send({ note: 'Fuel' }), 200);
    expectStatus(await accountant.delete(`/admin/expenses/${created.id}`), 204);
    expectStatus(await accountant.get(`/admin/expenses/${created.id}`), 404);
  });
});

describe('finance reports', () => {
  it.each(['/admin/reports/aging', '/admin/reports/revenue', '/admin/reports/revenue?groupBy=month', '/admin/reports/collections'])(
    'GET %s', async (path) => { expectStatus(await accountant.get(path), 200); },
  );

  it('GET /admin/customers/:id/statement', async () => {
    const customer = await prisma.customer.findFirst({ where: { name: 'Sunita Shrestha' } });
    expectStatus(await accountant.get(`/admin/customers/${customer.id}/statement`), 200);
  });

  it('SALES cannot read finance reports', async () => {
    expectStatus(await (await as('SALES')).get('/admin/reports/aging'), 403);
  });
});
