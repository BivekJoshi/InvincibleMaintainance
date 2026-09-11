import { describe, it, expect, beforeAll } from 'vitest';
import {
  as, expectStatus, createCustomer, createCompletedJob, prisma,
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

  it('DELETE a payment reopens the balance', async () => {
    const payment = await prisma.payment.findFirst({ where: { invoiceId: invoice.id, method: 'BANK' } });
    expectStatus(await accountant.delete(`/admin/invoices/${invoice.id}/payments/${payment.id}`), 204);
    expect((await prisma.invoice.findUnique({ where: { id: invoice.id } })).status).toBe('PARTIAL');
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
