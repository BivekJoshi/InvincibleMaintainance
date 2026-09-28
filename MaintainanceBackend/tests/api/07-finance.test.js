import { describe, it, expect, beforeAll } from 'vitest';
import {
  anon, as, approveAndSend, expectStatus, createCustomer, createAssignedJob, createCompletedJob, daysFromNow, pngBuffer, prisma, technicianIdFor,
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

// ── Phase I: the finance screens' API — status tabs, the DRAFT-only edit, balances, totals and the reports

/** The README fixture: 3 lines × 210.5 sq.ft at Rs 220 / 95 / 45, Rs 1,500 off, 13 % VAT. */
const README_LINES = [
  { description: 'Crystalline treatment', unit: 'sq.ft', qty: 210.5, rate: 220 },
  { description: 'Waterproof plaster', unit: 'sq.ft', qty: 210.5, rate: 95 },
  { description: 'Anti-fungal paint', unit: 'sq.ft', qty: 210.5, rate: 45 },
];
const csvLines = (res) => res.text.replace(/^\uFEFF/, '').split('\r\n');

describe('invoices, as the finance screens use them (Phase I)', () => {
  let customer;
  let draft;

  beforeAll(async () => {
    customer = await createCustomer(await as('SALES'));
    draft = expectStatus(await accountant.post('/admin/invoices').send({ customerId: customer.id, items: README_LINES, discount: 1500 }), 201).data;
  });

  it('the README fixture reconciles to the paisa, and the balance is the server\'s', async () => {
    expect(draft).toMatchObject({ subtotal: 7_578_000, discount: 150_000, vatAmount: 965_640, total: 8_393_640 });
    const body = expectStatus(await accountant.get(`/admin/invoices/${draft.id}`), 200).data;
    expect(body).toMatchObject({ balance: 8_393_640, publicUrl: null, jobs: [] });
  });

  it('a draft re-prices when only the discount or VAT changes; a sent invoice is locked', async () => {
    const noVat = expectStatus(await accountant.put(`/admin/invoices/${draft.id}`).send({ vatApplied: false }), 200).data;
    expect(noVat).toMatchObject({ subtotal: 7_578_000, discount: 150_000, vatAmount: 0, total: 7_428_000, balance: 7_428_000 });
    expect(noVat.items).toHaveLength(3);
    const back = expectStatus(await accountant.put(`/admin/invoices/${draft.id}`).send({ vatApplied: true, note: 'Monsoon job' }), 200).data;
    expect(back).toMatchObject({ total: 8_393_640, note: 'Monsoon job' });

    const sent = expectStatus(await accountant.post(`/admin/invoices/${draft.id}/send`), 200).data;
    expect(sent.publicUrl).toMatch(new RegExp(`/invoice/${sent.publicToken}$`));
    const locked = expectStatus(await accountant.put(`/admin/invoices/${draft.id}`).send({ note: 'changed after sending' }), 422);
    expect(locked.error.code).toBe('INVOICE_LOCKED');
  });

  it('partial ESEWA, void it, then two payments settle it — the balance follows and never goes below zero', async () => {
    const pay = (amount, method = 'ESEWA', reference) => accountant.post(`/admin/invoices/${draft.id}/payments`).send({ amount, method, reference });
    const first = expectStatus(await pay(30_000, 'ESEWA', `ES-${Date.now()}`), 201).data;
    expect(expectStatus(await accountant.get(`/admin/invoices/${draft.id}`), 200).data).toMatchObject({ status: 'PARTIAL', balance: 5_393_640 });
    expectStatus(await accountant.post(`/admin/invoices/${draft.id}/payments/${first.id}/void`).send({ reason: 'Wrong invoice' }), 200);
    expect(expectStatus(await accountant.get(`/admin/invoices/${draft.id}`), 200).data).toMatchObject({ status: 'SENT', balance: 8_393_640 });
    expectStatus(await pay(50_000, 'BANK'), 201);
    expectStatus(await pay(33_936.41, 'CASH'), 400);
    expectStatus(await pay(33_936.40, 'CASH'), 201);
    expect(expectStatus(await accountant.get(`/admin/invoices/${draft.id}`), 200).data).toMatchObject({ status: 'PAID', paidAmount: 8_393_640, balance: 0 });
  });

  it('the list carries the balance and counts per status for the tabs', async () => {
    const all = expectStatus(await accountant.get(`/admin/invoices?customerId=${customer.id}`), 200);
    expect(all.data.every((i) => i.balance === Math.max(0, i.total - i.paidAmount))).toBe(true);
    expect(all.meta.counts).toMatchObject({ PAID: 1, all: 1, DRAFT: 0 });
    // The tab narrows the rows, never the counts.
    const drafts = expectStatus(await accountant.get(`/admin/invoices?customerId=${customer.id}&status=DRAFT`), 200);
    expect(drafts.data).toHaveLength(0);
    expect(drafts.meta.counts.PAID).toBe(1);
    // 'false' is false, not a truthy string.
    expect(expectStatus(await accountant.get(`/admin/invoices?customerId=${customer.id}&overdueOnly=false`), 200).data).toHaveLength(1);
    expectStatus(await accountant.get('/admin/invoices?from=18-09-2026'), 400);
    expectStatus(await accountant.get('/admin/invoices?sort=password'), 400);
  });

  it('payments: searchable, with the footer\'s totals by method — voided money not counted', async () => {
    const body = expectStatus(await accountant.get(`/admin/payments?customerId=${customer.id}`), 200);
    expect(body.data).toHaveLength(3);
    expect(body.meta.totals).toEqual({ total: 8_393_640, count: 2, byMethod: { BANK: 5_000_000, CASH: 3_393_640 } });
    const esewa = expectStatus(await accountant.get(`/admin/payments?customerId=${customer.id}&method=ESEWA`), 200);
    expect(esewa.data[0].voidedAt).toBeTruthy();
    expect(esewa.meta.totals).toEqual({ total: 0, count: 0, byMethod: {} });
  });
});

describe('expenses, a registry resource (Phase I)', () => {
  it('approver from the session, bill photo, totals, categories, trash and restore — no toggle', async () => {
    const category = `Fuel ${Date.now()}`;
    const bill = await prisma.media.findFirst({ where: { mime: { startsWith: 'image/' } } });
    const made = expectStatus(await accountant.post('/admin/expenses').send({
      category, amount: 1250.75, vendor: 'Nepal Oil Corporation', billMediaId: bill?.id ?? null, approvedBy: 'someone-else',
    }), 201).data;
    const me = await prisma.user.findUnique({ where: { email: 'accounts@gharjatan.com.np' } });
    expect(made).toMatchObject({ amount: 125_075, approvedBy: me.id, approver: { id: me.id, name: me.name } });
    if (bill) expect(made.bill).toMatchObject({ id: bill.id, url: expect.any(String) });
    expectStatus(await accountant.post('/admin/expenses').send({ category, amount: 99.25 }), 201);

    const list = expectStatus(await accountant.get(`/admin/expenses?category=${encodeURIComponent(category)}`), 200);
    expect(list.data).toHaveLength(2);
    expect(list.meta.totals.total).toBe(125_075 + 9_925);
    expect(expectStatus(await accountant.get('/admin/expenses/categories'), 200).data).toContain(category);

    // A search narrows the footer's total too.
    expect(expectStatus(await accountant.get(`/admin/expenses?category=${encodeURIComponent(category)}&q=Nepal Oil`), 200).meta.totals.total).toBe(125_075);
    expect((await accountant.patch(`/admin/expenses/${made.id}/toggle`)).status).toBe(404);
    expectStatus(await accountant.delete(`/admin/expenses/${made.id}`), 204);
    expect(expectStatus(await accountant.get(`/admin/expenses?category=${encodeURIComponent(category)}`), 200).meta.totals.total).toBe(9_925);
    expect(expectStatus(await accountant.get('/admin/expenses?deleted=true'), 200).data.map((e) => e.id)).toContain(made.id);
    expectStatus(await accountant.patch(`/admin/expenses/${made.id}/restore`), 200);
    expectStatus(await accountant.get(`/admin/expenses/${made.id}/history`), 200);
    expectStatus(await (await as('SALES')).get('/admin/expenses'), 403);
  });
});

describe('finance reports and their CSV (Phase I)', () => {
  let customer;
  let overdue;
  let dueToday;

  beforeAll(async () => {
    customer = await createCustomer(await as('SALES'));
    const invoice = async (dueDate) => {
      const inv = expectStatus(await accountant.post('/admin/invoices').send({ customerId: customer.id, items: README_LINES, discount: 1500, dueDate }), 201).data;
      return expectStatus(await accountant.post(`/admin/invoices/${inv.id}/send`), 200).data;
    };
    // Due yesterday (Kathmandu) → 1 day overdue; due later today → not yet due.
    overdue = await invoice(new Date(Date.now() - 86_400_000).toISOString());
    dueToday = await invoice(new Date(Date.now() + 60_000).toISOString());
    expectStatus(await accountant.post(`/admin/invoices/${overdue.id}/payments`).send({ amount: 10_000, method: 'KHALTI' }), 201);
  });

  it('aging buckets by Kathmandu calendar days, with the drill-down', async () => {
    const body = expectStatus(await accountant.get('/admin/reports/aging'), 200).data;
    const row = (id) => body.invoices.find((i) => i.id === id);
    expect(row(overdue.id)).toMatchObject({ bucket: 'd0_30', daysOverdue: 1, outstanding: 7_393_640, paid: 1_000_000, customer: { id: customer.id } });
    expect(row(dueToday.id)).toMatchObject({ bucket: 'current', daysOverdue: 0, outstanding: 8_393_640 });
    expect(body.total).toBe(Object.values(body.buckets).reduce((a, b) => a + b, 0));
    expect(body.labels.d0_30).toBe('1–30 days');
  });

  it('revenue reconciles: taxable + VAT = invoiced, by month, service and technician; drafts are not revenue', async () => {
    for (const groupBy of ['month', 'day', 'service', 'technician']) {
      const body = expectStatus(await accountant.get(`/admin/reports/revenue?groupBy=${groupBy}`), 200).data;
      expect(body.totals.taxable + body.totals.vat).toBe(body.totals.invoiced);
      for (const r of body.rows) expect(r.taxable + r.vat, `${groupBy} ${r.label}`).toBe(r.invoiced);
      expect(body.totals.invoiced).toBe(body.rows.reduce((a, r) => a + r.invoiced, 0));
    }
    expectStatus(await accountant.get('/admin/reports/revenue?groupBy=planet'), 400);
  });

  it('collections by method over the period, voided money left out', async () => {
    const body = expectStatus(await accountant.get('/admin/reports/collections'), 200).data;
    expect(body.byMethod.KHALTI).toBeGreaterThanOrEqual(1_000_000);
    expect(body.total).toBe(Object.values(body.byMethod).reduce((a, b) => a + b, 0));
    expect(body.payments.length).toBeLessThanOrEqual(500);
    expect(body.payments.every((p) => !p.voidedAt)).toBe(true);
  });

  it('a CSV is the report\'s table under the same filters — rupees, a BOM, audited', async () => {
    const res = await accountant.get('/admin/reports/aging?format=csv');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/text\/csv/);
    expect(res.headers['content-disposition']).toMatch(/attachment; filename="aging-/);
    expect(res.text.startsWith('\uFEFF')).toBe(true);
    const lines = csvLines(res);
    expect(lines[0]).toBe('Invoice,Customer,Issued,Due,Days overdue,Bucket,Total (Rs),Paid (Rs),Outstanding (Rs)');
    expect(lines.find((l) => l.startsWith(`${overdue.number},`))).toMatch(/,1,1–30 days,83936\.40,10000\.00,73936\.40$/);

    // The filter reaches the file: a period with no invoices is a header only.
    const empty = csvLines(await accountant.get('/admin/reports/revenue?format=csv&from=2020-01-01&to=2020-01-31'));
    expect(empty).toEqual(['Group,Invoices,Taxable (Rs),VAT (Rs),Invoiced (Rs),Collected (Rs),Outstanding (Rs)']);
    const audit = await prisma.auditLog.findFirst({ where: { event: 'export.csv', model: 'Report' }, orderBy: { createdAt: 'desc' } });
    expect(audit.changes).toMatchObject({ report: 'revenue', from: '2020-01-01', to: '2020-01-31', rows: 0, truncated: false });
  });

  it('the customer statement — its ledger, as JSON and CSV; 404 for nobody', async () => {
    const body = expectStatus(await accountant.get(`/admin/customers/${customer.id}/statement`), 200).data;
    expect(body.totals).toEqual({ invoiced: 2 * 8_393_640, paid: 1_000_000, outstanding: 2 * 8_393_640 - 1_000_000 });
    expect(body.ledger.at(-1).balance).toBe(body.totals.outstanding);
    const lines = csvLines(await accountant.get(`/admin/customers/${customer.id}/statement?format=csv`));
    expect(lines[0]).toBe('Date,Entry,Invoice,Debit (Rs),Credit (Rs),Balance (Rs)');
    expect(lines.find((l) => l.includes('Payment (KHALTI)'))).toMatch(new RegExp(`,Payment \\(KHALTI\\),${overdue.number},0\\.00,10000\\.00,\\d+\\.\\d{2}$`));
    expect(lines.at(-1).split(',').at(-1)).toBe('157872.80');
    expectStatus(await accountant.get('/admin/customers/cmdoesnotexist000000000000/statement'), 404);
  });

  it('who reads what: finance reports are ACCOUNTANT\'s, job margin costs:read, ops and sales reports theirs — CSV too', async () => {
    const [sales, dispatcher, manager] = await Promise.all([as('SALES'), as('DISPATCHER'), as('MANAGER')]);
    expectStatus(await sales.get('/admin/reports/aging?format=csv'), 403);
    expectStatus(await dispatcher.get('/admin/reports/job-margin?format=csv'), 403);
    expectStatus(await accountant.get('/admin/reports/lead-sources'), 403);
    for (const path of ['lead-sources', 'funnel', 'sla', 'lost']) {
      const res = await sales.get(`/admin/reports/${path}?format=csv`);
      expect(res.status, path).toBe(200);
      expect(res.headers['content-type'], path).toMatch(/text\/csv/);
    }
    for (const path of ['technicians', 'warranty-claims']) expect((await dispatcher.get(`/admin/reports/${path}?format=csv`)).status, path).toBe(200);
    expect(csvLines(await manager.get('/admin/reports/job-margin?format=csv'))[0]).toMatch(/^Job,Title,Type,Invoiced \(Rs\)/);
  });
});

describe('the accountant attaches a bill without the media library (Phase I)', () => {
  it('POST /admin/expenses/bill stores the photo in "Expense bills" — expenses:write, not media:write', async () => {
    expectStatus(await accountant.post('/admin/media').attach('files', await pngBuffer(), 'x.png'), 403);
    const bill = expectStatus(await accountant.post('/admin/expenses/bill').attach('files', await pngBuffer('#dddddd'), 'bill.png'), 201).data;
    expect(bill).toMatchObject({ id: expect.any(String), url: expect.any(String) });
    const folder = await prisma.mediaFolder.findFirst({ where: { name: 'Expense bills' } });
    expect((await prisma.media.findUnique({ where: { id: bill.id } })).folderId).toBe(folder.id);
    const expense = expectStatus(await accountant.post('/admin/expenses').send({ category: 'Hardware', amount: 450, billMediaId: bill.id }), 201).data;
    expect(expense.bill).toMatchObject({ id: bill.id, thumb: expect.any(String) });
    expectStatus(await (await as('SALES')).post('/admin/expenses/bill').attach('files', await pngBuffer(), 'bill.png'), 403);
  });
});

describe('balances everywhere they are shown (Phase I)', () => {
  it('a void invoice owes nothing; the customer\'s page gets the office\'s balance', async () => {
    const customer = await createCustomer(await as('SALES'));
    const inv = expectStatus(await accountant.post('/admin/invoices').send({ customerId: customer.id, items: README_LINES, discount: 1500 }), 201).data;
    const sent = expectStatus(await accountant.post(`/admin/invoices/${inv.id}/send`), 200).data;
    expectStatus(await accountant.post(`/admin/invoices/${inv.id}/payments`).send({ amount: 3_936.40, method: 'FONEPAY' }), 201);
    expect(expectStatus(await anon().get(`/public/invoices/${sent.publicToken}`), 200).data.balance).toBe(8_000_000);

    const other = expectStatus(await accountant.post('/admin/invoices').send({ customerId: customer.id, items: README_LINES }), 201).data;
    expect(expectStatus(await accountant.post(`/admin/invoices/${other.id}/void`).send({ reason: 'Duplicate' }), 200).data).toBeTruthy();
    expect(expectStatus(await accountant.get(`/admin/invoices/${other.id}`), 200).data).toMatchObject({ status: 'VOID', balance: 0 });
  });
});
