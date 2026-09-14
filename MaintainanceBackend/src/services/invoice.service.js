import { prisma } from '../lib/prisma.js';
import { env } from '../config/env.js';
import { notFound, badRequest, unprocessable } from '../utils/AppError.js';
import { parseListQuery, meta, dateRange } from '../utils/pagination.js';
import { documentTotals, toPaisa, formatNpr, sum } from '../utils/money.js';
import { nextNumber } from '../utils/numbering.js';
import { publicToken } from '../utils/tokens.js';
import { INVOICE_TRANSITIONS, assertTransition } from '../shared/stateMachines.js';
import { getSetting } from './settings.service.js';
import { notify, notifyRoles } from './notify.service.js';
import { addDays } from '../utils/dates.js';
import { recordEvent } from './audit.service.js';

const INCLUDE = {
  customer: { select: { id: true, name: true, phone: true, email: true, panVatNo: true } },
  items: { orderBy: { sortOrder: 'asc' } },
  payments: { orderBy: { receivedAt: 'desc' } },
  quotation: { select: { id: true, number: true } },
};

async function buildTotals(items, { discount = 0, vatApplied = true }) {
  const vatRate = Number(await getSetting('finance.vatRate', env.business.vatRate));
  const paisaItems = items.map((i, idx) => ({ ...i, qty: Number(i.qty), rate: toPaisa(i.rate), sortOrder: i.sortOrder ?? idx }));
  const totals = documentTotals(paisaItems, { discount: toPaisa(discount), vatApplied, vatRate });
  return { ...totals, items: totals.lines };
}

/** Payment total drives status — status is never set directly from a client. */
function deriveStatus(invoice, paidAmount) {
  if (invoice.status === 'VOID' || invoice.status === 'DRAFT') return invoice.status;
  if (paidAmount >= invoice.total) return 'PAID';
  if (paidAmount > 0) return 'PARTIAL';
  if (invoice.dueDate && invoice.dueDate < new Date()) return 'OVERDUE';
  return 'SENT';
}

export async function listInvoices(query) {
  const { page, limit, skip, take, orderBy, q } = parseListQuery(query);
  const issued = dateRange(query.from, query.to);
  const where = {
    deletedAt: null,
    ...(query.status ? { status: query.status } : {}),
    ...(query.customerId ? { customerId: query.customerId } : {}),
    ...(query.overdueOnly ? { status: { in: ['SENT', 'PARTIAL', 'OVERDUE'] }, dueDate: { lt: new Date() } } : {}),
    ...(issued ? { issuedAt: issued } : {}),
    ...(q ? { OR: [{ number: { contains: q, mode: 'insensitive' } }, { customer: { name: { contains: q, mode: 'insensitive' } } }] } : {}),
  };
  const [items, total] = await Promise.all([
    prisma.invoice.findMany({ where, orderBy, skip, take, include: INCLUDE }),
    prisma.invoice.count({ where }),
  ]);
  return { items, meta: meta({ page, limit, total }) };
}

export async function getInvoice(id) {
  const inv = await prisma.invoice.findFirst({ where: { id, deletedAt: null }, include: INCLUDE });
  if (!inv) throw notFound('Invoice');
  return inv;
}

export async function createInvoice(input) {
  const { items, discount = 0, vatApplied = true, ...rest } = input;
  const totals = await buildTotals(items, { discount, vatApplied });
  const dueDays = Number(await getSetting('finance.paymentTermDays', 15));

  return prisma.$transaction(async (tx) => {
    const number = await nextNumber(tx, 'INV');
    const invoice = await tx.invoice.create({
      data: {
        ...rest,
        number,
        dueDate: rest.dueDate ?? addDays(new Date(), dueDays),
        subtotal: totals.subtotal, discount: totals.discount, vatApplied: totals.vatApplied,
        vatRate: totals.vatRate, vatAmount: totals.vatAmount, total: totals.total,
        items: { create: totals.items },
      },
      include: INCLUDE,
    });
    await recordEvent('invoice.created', {
      model: 'Invoice',
      recordId: invoice.id,
      after: { number, status: invoice.status, total: invoice.total, customerId: invoice.customerId, quotationId: invoice.quotationId },
    }, tx);
    return invoice;
  });
}

/**
 * Builds an invoice from the job's ACTUAL consumption — billable materials and
 * logged labour — rather than the estimate that was quoted.
 */
export async function createFromJob(jobId, opts = {}) {
  const job = await prisma.job.findFirst({
    where: { id: jobId, deletedAt: null },
    include: {
      customer: true,
      quotation: { include: { items: { orderBy: { sortOrder: 'asc' } } } },
      materials: { include: { material: { select: { name: true, unit: true } } } },
      timeLogs: { include: { technician: { select: { hourlyRate: true, user: { select: { name: true } } } } } },
    },
  });
  if (!job) throw notFound('Job');
  if (!['COMPLETED', 'VERIFIED'].includes(job.status)) {
    throw unprocessable('Only completed jobs can be invoiced');
  }
  if (!job.isBillable) throw unprocessable('This job is marked non-billable');
  if (job.invoicedAt) throw unprocessable('This job has already been invoiced');

  const items = [];
  let sortOrder = 0;

  // Quoted scope forms the base line items; it is what the customer agreed to.
  if (job.quotation?.items?.length) {
    for (const qi of job.quotation.items) {
      items.push({ jobId, description: qi.description, unit: qi.unit, qty: qi.qty, rate: qi.rate / 100, sortOrder: sortOrder++ });
    }
  } else {
    items.push({ jobId, description: job.title, unit: 'lump', qty: 1, rate: 0, sortOrder: sortOrder++ });
  }

  if (opts.includeMaterials !== false) {
    for (const m of job.materials.filter((x) => x.isBillable)) {
      items.push({
        jobId, description: `Material: ${m.material.name}`, unit: m.material.unit,
        qty: m.qty, rate: m.rate / 100, sortOrder: sortOrder++,
      });
    }
  }

  if (opts.includeLabour !== false) {
    const minutes = sum(job.timeLogs.map((t) => t.minutes ?? 0));
    const rate = job.timeLogs.find((t) => t.technician.hourlyRate)?.technician.hourlyRate ?? 0;
    if (minutes && rate) {
      items.push({
        jobId, description: 'Labour', unit: 'hour',
        qty: Number((minutes / 60).toFixed(2)), rate: rate / 100, sortOrder: sortOrder++,
      });
    }
  }

  const invoice = await createInvoice({
    customerId: job.customerId,
    quotationId: job.quotationId ?? null,
    dueDate: opts.dueDate,
    discount: opts.discount ?? 0,
    vatApplied: opts.vatApplied ?? true,
    note: `Invoice for job ${job.number}`,
    items,
  });

  await prisma.job.update({ where: { id: jobId }, data: { invoicedAt: new Date() } });
  return invoice;
}

export async function updateInvoice(id, input) {
  const existing = await getInvoice(id);
  if (existing.status === 'VOID') throw unprocessable('A void invoice cannot be edited');
  if (existing.paidAmount > 0) throw unprocessable('An invoice with payments cannot be edited');

  const { items, discount, vatApplied, ...rest } = input;
  if (!items) return prisma.invoice.update({ where: { id }, data: rest, include: INCLUDE });

  const totals = await buildTotals(items, {
    discount: discount ?? existing.discount / 100,
    vatApplied: vatApplied ?? existing.vatApplied,
  });
  return prisma.$transaction(async (tx) => {
    await tx.invoiceItem.deleteMany({ where: { invoiceId: id } });
    return tx.invoice.update({
      where: { id },
      data: {
        ...rest,
        subtotal: totals.subtotal, discount: totals.discount, vatApplied: totals.vatApplied,
        vatRate: totals.vatRate, vatAmount: totals.vatAmount, total: totals.total,
        items: { create: totals.items },
      },
      include: INCLUDE,
    });
  });
}

export async function sendInvoice(id) {
  const inv = await getInvoice(id);
  assertTransition(INVOICE_TRANSITIONS, inv.status, 'SENT', 'invoice');
  const token = inv.publicToken ?? publicToken();
  const updated = await prisma.$transaction(async (tx) => {
    const row = await tx.invoice.update({
      where: { id }, data: { status: 'SENT', sentAt: new Date(), publicToken: token }, include: INCLUDE,
    });
    await recordEvent('invoice.sent', { model: 'Invoice', recordId: id, before: { status: inv.status }, after: { status: 'SENT' } }, tx);
    return row;
  });

  const webOrigin = env.corsOrigins[0] ?? env.appUrl;
  const vars = {
    customerName: inv.customer.name, number: inv.number, total: formatNpr(inv.total),
    dueDate: inv.dueDate?.toISOString().slice(0, 10) ?? '-',
    link: `${webOrigin}/invoice/${token}`, appName: env.appName,
  };
  if (inv.customer.email) {
    await notify({
      templateKey: 'invoice_sent', channel: 'email', to: inv.customer.email, vars,
      related: { model: 'Invoice', id },
      fallbackSubject: 'Invoice {{number}} from {{appName}}',
      fallbackBody: 'Dear {{customerName}},\n\nInvoice {{number}} for {{total}} is due on {{dueDate}}.\n{{link}}',
    });
  }
  await notify({
    templateKey: 'invoice_sent', channel: 'sms', to: inv.customer.phone, vars,
    related: { model: 'Invoice', id },
    fallbackBody: 'Invoice {{number}}: {{total}}, due {{dueDate}}. {{link}} - {{appName}}',
  });
  return updated;
}

export async function voidInvoice(id, reason) {
  const inv = await getInvoice(id);
  if (inv.paidAmount > 0) throw unprocessable('Refund the payments before voiding this invoice');
  return prisma.$transaction(async (tx) => {
    const row = await tx.invoice.update({ where: { id }, data: { status: 'VOID', voidReason: reason }, include: INCLUDE });
    await recordEvent('invoice.voided', {
      model: 'Invoice', recordId: id, before: { status: inv.status }, after: { status: 'VOID' }, meta: { reason },
    }, tx);
    return row;
  });
}

export async function recordPayment(invoiceId, input, userId) {
  const inv = await getInvoice(invoiceId);
  if (inv.status === 'VOID') throw unprocessable('Cannot take payment against a void invoice');
  if (inv.status === 'DRAFT') throw unprocessable('Send the invoice before recording a payment');

  const amount = toPaisa(input.amount);
  const outstanding = inv.total - inv.paidAmount;
  if (amount > outstanding) {
    throw badRequest(`Payment exceeds the outstanding balance of ${formatNpr(outstanding)}`);
  }

  return prisma.$transaction(async (tx) => {
    const payment = await tx.payment.create({
      data: {
        invoiceId, amount, method: input.method, reference: input.reference ?? null,
        receivedAt: input.receivedAt ?? new Date(), receivedBy: userId ?? null, note: input.note ?? null,
      },
    });
    const paidAmount = inv.paidAmount + amount;
    await tx.invoice.update({
      where: { id: invoiceId },
      data: { paidAmount, status: deriveStatus(inv, paidAmount) },
    });
    await recordEvent('payment.recorded', {
      model: 'Payment',
      recordId: payment.id,
      after: { invoiceId, amount, method: payment.method, reference: payment.reference },
      meta: { invoiceStatus: deriveStatus(inv, paidAmount), paidAmount },
    }, tx);
    return payment;
  });
}

/**
 * A payment is never deleted — a bounced cheque or a double entry is voided, and
 * the row stays with who voided it and why. The paid total is recomputed from the
 * payments still standing, and the invoice status follows it back down through
 * the state machine (PAID → PARTIAL, or → SENT / OVERDUE when none are left).
 */
export async function voidPayment(invoiceId, paymentId, reason, userId) {
  const payment = await prisma.payment.findFirst({ where: { id: paymentId, invoiceId } });
  if (!payment) throw notFound('Payment');
  if (payment.voidedAt) throw unprocessable('This payment has already been voided');
  const inv = await getInvoice(invoiceId);

  return prisma.$transaction(async (tx) => {
    // Guarded, so two people voiding the same payment cannot both recompute the balance.
    const { count } = await tx.payment.updateMany({
      where: { id: paymentId, voidedAt: null },
      data: { voidedAt: new Date(), voidReason: reason, voidedById: userId ?? null },
    });
    if (count === 0) throw unprocessable('This payment has already been voided');

    const standing = await tx.payment.findMany({ where: { invoiceId, voidedAt: null }, select: { amount: true } });
    const paidAmount = sum(standing.map((p) => p.amount));
    const status = deriveStatus(inv, paidAmount);
    assertTransition(INVOICE_TRANSITIONS, inv.status, status, 'invoice');
    await tx.invoice.update({ where: { id: invoiceId }, data: { paidAmount, status } });
    await recordEvent('payment.voided', {
      model: 'Payment',
      recordId: paymentId,
      before: { voidedAt: null, amount: payment.amount },
      after: { voidedAt: new Date(), voidReason: reason },
      meta: { invoiceId, invoiceStatus: status, paidAmount },
    }, tx);
    return tx.payment.findUnique({ where: { id: paymentId } });
  });
}

/**
 * Every payment received, searchable by the reference a customer quotes — an
 * eSewa transaction id, a cheque number — which is how a payment is actually
 * reconciled. The collections report sums a period; this finds one payment.
 */
export async function listPayments(query) {
  const { page, limit, skip, take, orderBy, q } = parseListQuery(query, { defaultSort: '-receivedAt' });
  const received = dateRange(query.from, query.to);
  const where = {
    invoice: { deletedAt: null, ...(query.customerId ? { customerId: query.customerId } : {}) },
    ...(query.method ? { method: query.method } : {}),
    ...(received ? { receivedAt: received } : {}),
    ...(q ? {
      OR: [
        { reference: { contains: q, mode: 'insensitive' } },
        { invoice: { number: { contains: q, mode: 'insensitive' } } },
        { invoice: { customer: { name: { contains: q, mode: 'insensitive' } } } },
      ],
    } : {}),
  };
  const [items, total] = await Promise.all([
    prisma.payment.findMany({
      where, orderBy, skip, take,
      include: { invoice: { select: { id: true, number: true, status: true, customer: { select: { id: true, name: true } } } } },
    }),
    prisma.payment.count({ where }),
  ]);
  return { items, meta: meta({ page, limit, total }) };
}

export async function getByPublicToken(token) {
  const inv = await prisma.invoice.findFirst({
    where: { publicToken: token, deletedAt: null },
    include: {
      customer: { select: { name: true, phone: true, panVatNo: true } },
      items: { orderBy: { sortOrder: 'asc' } },
      // Voided payments stay visible to the customer, marked, so the history never changes silently.
      payments: { select: { amount: true, method: true, receivedAt: true, voidedAt: true }, orderBy: { receivedAt: 'asc' } },
    },
  });
  if (!inv) throw notFound('Invoice');
  return inv;
}

/** Marks past-due invoices OVERDUE and nudges the customer. Run daily by cron. */
export async function sweepOverdue() {
  const now = new Date();
  const due = await prisma.invoice.findMany({
    where: { deletedAt: null, status: { in: ['SENT', 'PARTIAL'] }, dueDate: { lt: now } },
    include: { customer: { select: { name: true, phone: true, email: true } } },
    take: 500,
  });
  for (const inv of due) {
    await prisma.invoice.update({ where: { id: inv.id }, data: { status: 'OVERDUE' } });
    const days = Math.floor((now - new Date(inv.dueDate)) / 86400000);
    if ([1, 7, 15].includes(days) || days % 30 === 0) {
      await notify({
        templateKey: 'invoice_overdue', channel: 'sms', to: inv.customer.phone,
        vars: {
          customerName: inv.customer.name, number: inv.number,
          outstanding: formatNpr(inv.total - inv.paidAmount), days, appName: env.appName,
        },
        related: { model: 'Invoice', id: inv.id },
        fallbackBody: 'Reminder: invoice {{number}} ({{outstanding}}) is {{days}} day(s) overdue. - {{appName}}',
      });
    }
  }
  if (due.length) {
    await notifyRoles(['ACCOUNTANT', 'ADMIN'], {
      type: 'invoices_overdue', title: `${due.length} invoice(s) went overdue`, link: '/invoices?overdueOnly=true',
    });
  }
  return { marked: due.length };
}

export const expenses = {
  async list(query) {
    const { page, limit, skip, take, orderBy } = parseListQuery(query, { defaultSort: '-spentAt' });
    const spent = dateRange(query.from, query.to);
    const where = {
      deletedAt: null,
      ...(query.category ? { category: query.category } : {}),
      ...(query.jobId ? { jobId: query.jobId } : {}),
      ...(spent ? { spentAt: spent } : {}),
    };
    const [items, total] = await Promise.all([
      prisma.expense.findMany({ where, orderBy, skip, take, include: { job: { select: { id: true, number: true } } } }),
      prisma.expense.count({ where }),
    ]);
    return { items, meta: meta({ page, limit, total }) };
  },
  async get(id) {
    const row = await prisma.expense.findFirst({
      where: { id, deletedAt: null }, include: { job: { select: { id: true, number: true } } },
    });
    if (!row) throw notFound('Expense');
    return row;
  },
  async create(data, userId) {
    return prisma.expense.create({ data: { ...data, amount: toPaisa(data.amount), approvedBy: userId ?? null } });
  },
  async update(id, data) {
    const row = await prisma.expense.findFirst({ where: { id, deletedAt: null } });
    if (!row) throw notFound('Expense');
    return prisma.expense.update({
      where: { id },
      data: { ...data, ...(data.amount !== undefined ? { amount: toPaisa(data.amount) } : {}) },
    });
  },
  async remove(id) {
    await prisma.expense.update({ where: { id }, data: { deletedAt: new Date() } });
  },
};
