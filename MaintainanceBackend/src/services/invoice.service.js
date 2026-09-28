import { prisma } from '../lib/prisma.js';
import { env } from '../config/env.js';
import { AppError, notFound, badRequest, unprocessable } from '../utils/AppError.js';
import { parseListQuery, meta, searchOr } from '../utils/pagination.js';
import { documentTotals, finalBillDocument, stageDocument, toPaisa, toRupees, formatNpr, outstanding, sum } from '../utils/money.js';
import { nextNumber } from '../utils/numbering.js';
import { publicToken } from '../utils/tokens.js';
import { INVOICE_TRANSITIONS, assertTransition } from '../shared/stateMachines.js';
import { getSetting } from './settings.service.js';
import { notify, notifyRoles } from './notify.service.js';
import { addDays, kathmanduDayRange, local } from '../utils/dates.js';
import { recordEvent } from './audit.service.js';
import { adminJobPath, webUrl } from '../utils/links.js';
import { makeCrud } from './crud.service.js';
import { resolveMediaMap, uploadFiles } from './media.service.js';

const INCLUDE = {
  customer: { select: { id: true, name: true, phone: true, email: true, panVatNo: true, preferredLocale: true } },
  items: { orderBy: { sortOrder: 'asc' } },
  payments: { orderBy: { receivedAt: 'desc' } },
  quotation: { select: { id: true, number: true } },
  // A stage bill's job and stage (Phase L6).
  job: { select: { id: true, number: true } },
  paymentStage: { select: { id: true, label: true, basisPoints: true, trigger: true } },
};

/** The customer's invoice page. */
const invoiceUrl = (token) => (token ? webUrl(`/invoice/${token}`) : null);

/**
 * An invoice as the screens show it (Phase I): its `balance` — what is still owed, from the server, never
 * below zero — and `publicUrl` once it has been sent. The UI never works a total out itself.
 */
const present = (inv) => ({
  ...inv,
  // A void invoice is owed by nobody, whatever its total.
  balance: inv.status === 'VOID' ? 0 : outstanding(inv.total, inv.paidAmount),
  publicUrl: invoiceUrl(inv.publicToken),
});

const currentVatRate = async () => Number(await getSetting('finance.vatRate', env.business.vatRate));

async function buildTotals(items, { discount = 0, vatApplied = true }) {
  const vatRate = await currentVatRate();
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

/**
 * GET /admin/invoices. `from`/`to` are Kathmandu days on the issue date. `meta.counts` is the number in each
 * status under the other filters — the list's status tabs.
 */
export async function listInvoices(query) {
  const { page, limit, skip, take, orderBy, q } = parseListQuery(query);
  const issued = kathmanduDayRange(query.from, query.to);
  const base = {
    deletedAt: null,
    ...(query.kind ? { kind: query.kind } : {}),
    ...(query.customerId ? { customerId: query.customerId } : {}),
    ...(query.overdueOnly ? { status: { in: ['SENT', 'PARTIAL', 'OVERDUE'] }, dueDate: { lt: new Date() } } : {}),
    ...(issued ? { issuedAt: issued } : {}),
    ...(q ? { OR: [{ number: { contains: q, mode: 'insensitive' } }, { customer: { name: { contains: q, mode: 'insensitive' } } }] } : {}),
  };
  const where = query.status ? { ...base, AND: [{ status: query.status }] } : base;
  const [items, total, byStatus] = await Promise.all([
    prisma.invoice.findMany({ where, orderBy, skip, take, include: INCLUDE }),
    prisma.invoice.count({ where }),
    prisma.invoice.groupBy({ by: ['status'], where: base, _count: { _all: true } }),
  ]);
  const counts = Object.fromEntries(['DRAFT', 'SENT', 'PARTIAL', 'OVERDUE', 'PAID', 'VOID'].map((st) => [st, 0]));
  for (const row of byStatus) counts[row.status] = row._count._all;
  counts.all = sum(Object.values(counts));
  return { items: items.map(present), meta: { ...meta({ page, limit, total }), counts } };
}

/** The invoice row, for the service's own checks. */
async function findInvoice(id) {
  const inv = await prisma.invoice.findFirst({ where: { id, deletedAt: null }, include: INCLUDE });
  if (!inv) throw notFound('Invoice');
  return inv;
}

/** GET /admin/invoices/:id — with its balance, its public link and the jobs its lines bill. */
export async function getInvoice(id) {
  const inv = await findInvoice(id);
  const jobIds = [...new Set(inv.items.map((i) => i.jobId).filter(Boolean))];
  const jobs = jobIds.length
    ? await prisma.job.findMany({ where: { id: { in: jobIds } }, select: { id: true, number: true, title: true } })
    : [];
  return { ...present(inv), jobs };
}

/**
 * Writes an invoice from lines already in paisa, inside the caller's transaction. Every invoice is
 * created here, so its totals only ever come from `documentTotals`.
 *
 * @param {import('@prisma/client').Prisma.TransactionClient} tx
 * @param {object} header customerId, quotationId, dueDate, note, …
 * @param {{ description: string, unit?: string, qty: number, rate: number, jobId?: string }[]} items rate in paisa
 * @param {{ discount?: number, vatApplied?: boolean, vatRate: number }} opts discount in paisa
 */
async function insertInvoice(tx, header, items, { discount = 0, vatApplied = true, vatRate }, presetTotals) {
  // A closing bill after stage bills (Phase L6) comes with its totals worked out by money.js#finalBillDocument.
  const totals = presetTotals ?? documentTotals(
    items.map((i, idx) => ({ ...i, qty: Number(i.qty), sortOrder: i.sortOrder ?? idx })),
    { discount, vatApplied, vatRate },
  );
  const number = await nextNumber(tx, 'INV');
  const invoice = await tx.invoice.create({
    data: {
      ...header,
      number,
      subtotal: totals.subtotal, discount: totals.discount, vatApplied: totals.vatApplied,
      vatRate: totals.vatRate, vatAmount: totals.vatAmount, total: totals.total,
      items: { create: totals.lines },
    },
    include: INCLUDE,
  });
  await recordEvent('invoice.created', {
    model: 'Invoice',
    recordId: invoice.id,
    after: { number, status: invoice.status, total: invoice.total, customerId: invoice.customerId, quotationId: invoice.quotationId },
  }, tx);
  return invoice;
}

/**
 * One payment-schedule stage as an invoice, inside the caller's transaction (Phase L6: the ADVANCE on
 * acceptance; L8: RUNNING bills). Its totals are the stage's — `money.js#stageDocument`, never VAT worked out
 * again — so the stage bills add up to the quotation to the paisa. `paymentStageId` is unique: a stage is
 * billed once, whatever replays. Sent at once (it has a public link) unless `status` says DRAFT.
 *
 * @param {import('@prisma/client').Prisma.TransactionClient} tx
 * @param {{ kind: 'ADVANCE'|'RUNNING', quotation: object, stage: object, jobId: string, dueDate: Date, status?: 'SENT'|'DRAFT' }} opts
 *   `stage` is a `paymentSchedule` stage with its stored id and label
 */
export async function createStageInvoice(tx, { kind, quotation: q, stage, jobId, dueDate, status = 'SENT' }) {
  const share = `${stage.basisPoints / 100}%`;
  const totals = stageDocument(stage, {
    description: `${stage.label} — ${share} of quotation ${q.number} v${q.version}`, vatApplied: q.vatApplied, vatRate: q.vatRate,
  });
  const number = await nextNumber(tx, 'INV');
  const sent = status === 'SENT';
  const invoice = await tx.invoice.create({
    data: {
      number, kind, status, customerId: q.customerId, quotationId: q.id, jobId, paymentStageId: stage.id, dueDate,
      subtotal: totals.subtotal, discount: 0, vatApplied: totals.vatApplied, vatRate: totals.vatRate,
      vatAmount: totals.vatAmount, total: totals.total,
      note: `${stage.label} (${share}) of quotation ${q.number}`,
      ...(sent ? { sentAt: new Date(), publicToken: publicToken() } : {}),
      items: { create: totals.lines.map((l) => ({ ...l, jobId })) },
    },
    include: INCLUDE,
  });
  await recordEvent('invoice.created', {
    model: 'Invoice', recordId: invoice.id,
    after: { number, kind, status, total: invoice.total, customerId: invoice.customerId, quotationId: q.id },
    meta: { jobId, paymentStageId: stage.id },
  }, tx);
  return invoice;
}

const defaultDueDate = async () => addDays(new Date(), Number(await getSetting('finance.paymentTermDays', 15)));

/** A hand-made invoice; money arrives in rupees. */
export async function createInvoice(input) {
  const { items, discount = 0, vatApplied = true, ...rest } = input;
  const [vatRate, dueDate] = await Promise.all([currentVatRate(), rest.dueDate ?? defaultDueDate()]);
  const paisaItems = items.map((i) => ({ ...i, rate: toPaisa(i.rate) }));
  return prisma.$transaction((tx) => insertInvoice(tx, { ...rest, dueDate }, paisaItems, {
    discount: toPaisa(discount), vatApplied, vatRate,
  }));
}

/**
 * Logged time as one line at the rate card's labour rate (`finance.labourRateCode`, per hour).
 * A technician's own hourly rate is what they cost the company, never what the customer pays.
 */
async function labourLine(jobId, minutes) {
  const code = await getSetting('finance.labourRateCode', 'LABOUR-SKILL');
  const item = await prisma.rateCardItem.findFirst({ where: { code, deletedAt: null } });
  if (!item || item.unit !== 'hour') {
    throw new AppError(422, 'LABOUR_RATE_MISSING',
      `Logged time is billed at the rate-card item "${code}", priced per hour, and there is none. `
      + 'Add it to the rate card, point finance.labourRateCode at another, or invoice without labour.');
  }
  return { jobId, description: item.name, unit: 'hour', qty: Number((minutes / 60).toFixed(2)), rate: item.rate };
}

/** What an unquoted job consumed: billable materials at the rate they were issued at, and labour. */
async function actualLines(job, opts) {
  const items = [];
  if (opts.includeMaterials !== false) {
    for (const m of job.materials.filter((x) => x.isBillable)) {
      items.push({ jobId: job.id, description: `Material: ${m.material.name}`, unit: m.material.unit, qty: m.qty, rate: m.rate });
    }
  }
  if (opts.includeLabour !== false) {
    const minutes = sum(job.timeLogs.map((t) => t.minutes ?? 0));
    if (minutes) items.push(await labourLine(job.id, minutes));
  }
  // Nothing recorded: one line to price by hand while the invoice is a draft.
  if (!items.length) items.push({ jobId: job.id, description: job.title, unit: 'lump', qty: 1, rate: 0 });
  return items;
}

/**
 * Invoices a finished job by exactly one rule — never both (defect #16 billed both):
 * - **From a quotation:** its lines, discount and VAT choice — what the customer accepted. Asking to
 *   add materials or labour on top is 422 `QUOTED_JOB_BILLS_SCOPE`; extra work is invoiced on its own.
 * - **Otherwise:** what it consumed (`actualLines`).
 * `opts.discount` (rupees) and `opts.vatApplied` override the quotation's.
 */
export async function createFromJob(jobId, opts = {}) {
  const job = await prisma.job.findFirst({
    where: { id: jobId, deletedAt: null },
    include: {
      customer: true,
      quotation: { include: { items: { orderBy: { sortOrder: 'asc' } } } },
      materials: { include: { material: { select: { name: true, unit: true } } } },
      timeLogs: { select: { minutes: true } },
    },
  });
  if (!job) throw notFound('Job');
  if (!['COMPLETED', 'VERIFIED'].includes(job.status)) {
    throw unprocessable('Only completed jobs can be invoiced');
  }
  if (!job.isBillable) throw unprocessable('This job is marked non-billable');
  if (job.invoicedAt) throw unprocessable('This job has already been invoiced');

  // The priced rows: a SECTION or NOTE carries no money and an optional row is not in the total (Phase L3).
  const quoted = job.quotation?.items?.filter((qi) => qi.rowType === 'ITEM' && !qi.isOptional) ?? [];
  const quote = quoted.length ? job.quotation : null;
  if (quote && (opts.includeMaterials || opts.includeLabour)) {
    throw new AppError(422, 'QUOTED_JOB_BILLS_SCOPE',
      `Job ${job.number} is billed at quotation ${quote.number}, which is what the customer accepted. `
      + 'Invoice extra materials or labour separately.');
  }
  const items = quote
    ? quoted.map((qi) => ({ jobId, description: qi.description, unit: qi.unit, qty: qi.qty, rate: qi.rate }))
    : await actualLines(job, opts);

  const [vatRate, dueDate] = await Promise.all([currentVatRate(), opts.dueDate ?? defaultDueDate()]);
  const discount = opts.discount != null ? toPaisa(opts.discount) : (quote?.discount ?? 0);
  const vatApplied = opts.vatApplied ?? quote?.vatApplied ?? true;

  // Billed in stages (Phase L6): the advance (and, from L8, running bills) already asked for part of the
  // quotation, so this closing bill is the quotation less each of them — never the whole again.
  const stageBills = quote
    ? await prisma.invoice.findMany({
      where: { jobId, kind: { in: ['ADVANCE', 'RUNNING'] }, deletedAt: null, status: { notIn: ['DRAFT', 'VOID'] } },
      orderBy: { issuedAt: 'asc' },
    })
    : [];
  const final = stageBills.length
    ? finalBillDocument(items.map((i, idx) => ({ ...i, sortOrder: idx })), stageBills.map((b) => ({
      description: `Less: ${b.kind === 'ADVANCE' ? 'advance' : 'running bill'} ${b.number}`,
      taxable: b.subtotal - b.discount, vat: b.vatAmount,
    })), { discount, vatApplied, vatRate: quote.vatRate })
    : null;

  const header = {
    customerId: job.customerId, quotationId: job.quotationId ?? null, jobId, dueDate, note: `Invoice for job ${job.number}`,
    ...(final ? { kind: 'FINAL' } : {}),
  };
  return prisma.$transaction(async (tx) => {
    // Claimed first, so two accountants pressing at once get one invoice.
    const { count } = await tx.job.updateMany({ where: { id: jobId, invoicedAt: null }, data: { invoicedAt: new Date() } });
    if (!count) throw unprocessable('This job has already been invoiced');
    return insertInvoice(tx, header, items, { discount, vatApplied, vatRate }, final ? { ...final, lines: final.lines.map((l) => ({ ...l, jobId })) } : undefined);
  });
}

/**
 * A DRAFT only (Phase I): once sent, the customer has the invoice, and what they were sent must not change
 * under them — void it and issue another. 422 INVOICE_LOCKED otherwise.
 */
export async function updateInvoice(id, input) {
  const existing = await findInvoice(id);
  if (existing.status !== 'DRAFT') {
    throw new AppError(422, 'INVOICE_LOCKED',
      `Invoice ${existing.number} is ${existing.status.toLowerCase()}: only a draft can be edited. Void it and issue a new one.`);
  }

  const { items, discount, vatApplied, ...rest } = input;
  // A stage or closing bill's lines are the quotation's and the stage bills' (Phase L6): its dates, note and terms
  // may change while it is a draft, its money may not — void it and bill again instead.
  if (existing.kind !== 'STANDARD' && (items || discount !== undefined || vatApplied !== undefined)) {
    throw new AppError(422, 'INVOICE_LINES_LOCKED',
      `The lines of ${existing.kind.toLowerCase()} invoice ${existing.number} come from the quotation and its stage bills. `
      + 'Edit the due date, note or terms; to change the money, void it and invoice the job again.');
  }
  if (!items && discount === undefined && vatApplied === undefined) {
    return getInvoice((await prisma.invoice.update({ where: { id }, data: rest })).id);
  }

  // A changed discount or VAT choice re-prices the stored lines, so the totals always come from documentTotals.
  const lines = items ?? existing.items.map((i) => ({ description: i.description, unit: i.unit, qty: i.qty, rate: toRupees(i.rate), jobId: i.jobId ?? undefined }));
  const totals = await buildTotals(lines, {
    discount: discount ?? toRupees(existing.discount),
    vatApplied: vatApplied ?? existing.vatApplied,
  });
  await prisma.$transaction(async (tx) => {
    await tx.invoiceItem.deleteMany({ where: { invoiceId: id } });
    await tx.invoice.update({
      where: { id },
      data: {
        ...rest,
        subtotal: totals.subtotal, discount: totals.discount, vatApplied: totals.vatApplied,
        vatRate: totals.vatRate, vatAmount: totals.vatAmount, total: totals.total,
        items: { create: totals.items },
      },
    });
  });
  return getInvoice(id);
}

export async function sendInvoice(id) {
  const inv = await findInvoice(id);
  assertTransition(INVOICE_TRANSITIONS, inv.status, 'SENT', 'invoice');
  const token = inv.publicToken ?? publicToken();
  const updated = await prisma.$transaction(async (tx) => {
    const row = await tx.invoice.update({
      where: { id }, data: { status: 'SENT', sentAt: new Date(), publicToken: token }, include: INCLUDE,
    });
    await recordEvent('invoice.sent', { model: 'Invoice', recordId: id, before: { status: inv.status }, after: { status: 'SENT' } }, tx);
    return row;
  });

  const vars = {
    customerName: inv.customer.name, number: inv.number, total: formatNpr(inv.total),
    dueDate: inv.dueDate ? local(inv.dueDate, 'D MMM YYYY') : '-',
    link: webUrl(`/invoice/${token}`), appName: env.appName,
  };
  if (inv.customer.email) {
    await notify({
      templateKey: 'invoice_sent', channel: 'email', to: inv.customer.email, vars, locale: inv.customer.preferredLocale,
      related: { model: 'Invoice', id },
      fallbackSubject: 'Invoice {{number}} from {{appName}}',
      fallbackBody: 'Dear {{customerName}},\n\nInvoice {{number}} for {{total}} is due on {{dueDate}}.\n{{link}}',
    });
  }
  await notify({
    templateKey: 'invoice_sent', channel: 'sms', to: inv.customer.phone, vars, locale: inv.customer.preferredLocale,
    related: { model: 'Invoice', id },
    fallbackBody: 'Invoice {{number}}: {{total}}, due {{dueDate}}. {{link}} - {{appName}}',
  });
  return getInvoice(updated.id);
}

export async function voidInvoice(id, reason) {
  const inv = await findInvoice(id);
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
  const inv = await findInvoice(invoiceId);
  if (inv.status === 'VOID') throw unprocessable('Cannot take payment against a void invoice');
  if (inv.status === 'DRAFT') throw unprocessable('Send the invoice before recording a payment');

  const amount = toPaisa(input.amount);
  const balance = outstanding(inv.total, inv.paidAmount);
  if (amount > balance) {
    throw badRequest(`Payment exceeds the outstanding balance of ${formatNpr(balance)}`);
  }

  const paidAfter = inv.paidAmount + amount;
  const payment = await prisma.$transaction(async (tx) => {
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
  if (inv.kind === 'ADVANCE' && deriveStatus(inv, paidAfter) === 'PAID') await advancePaid(inv);
  return payment;
}

/** The advance is in (L-D3): the job it held back can be scheduled — the dispatchers are told. */
async function advancePaid(inv) {
  const job = await prisma.job.findFirst({ where: { advanceInvoiceId: inv.id, deletedAt: null }, select: { id: true, number: true, title: true } });
  if (!job) return;
  await notifyRoles(['DISPATCHER'], {
    type: 'advance_paid',
    title: `Advance paid — ${job.number} is ready to schedule`,
    body: `${inv.customer.name} · ${formatNpr(inv.total)} · ${job.title}`,
    link: adminJobPath(job.id),
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
  const inv = await findInvoice(invoiceId);

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
  const received = kathmanduDayRange(query.from, query.to);
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
  const [items, total, byMethod] = await Promise.all([
    prisma.payment.findMany({
      where, orderBy, skip, take,
      include: { invoice: { select: { id: true, number: true, status: true, customer: { select: { id: true, name: true } } } } },
    }),
    prisma.payment.count({ where }),
    // The footer: money received under these filters — a voided payment was never received.
    prisma.payment.groupBy({ by: ['method'], where: { ...where, voidedAt: null }, _sum: { amount: true }, _count: { _all: true } }),
  ]);
  const totals = {
    total: sum(byMethod.map((m) => m._sum.amount)),
    count: sum(byMethod.map((m) => m._count._all)),
    byMethod: Object.fromEntries(byMethod.map((m) => [m.method, m._sum.amount ?? 0])),
  };
  return { items, meta: { ...meta({ page, limit, total }), totals } };
}

export async function getByPublicToken(token) {
  const inv = await prisma.invoice.findFirst({
    where: { publicToken: token, deletedAt: null },
    include: {
      customer: { select: { name: true, phone: true, panVatNo: true } },
      items: { orderBy: { sortOrder: 'asc' } },
      // Voided payments stay visible to the customer, marked, so the history never changes silently.
      payments: { select: { amount: true, method: true, receivedAt: true, voidedAt: true }, orderBy: { receivedAt: 'asc' } },
      // "Advance — 50 % on acceptance" (Phase L6).
      paymentStage: { select: { label: true, basisPoints: true, trigger: true } },
    },
  });
  if (!inv) throw notFound('Invoice');
  // The same balance the office sees (Phase I), so the customer's page never works it out itself.
  return { ...inv, balance: present(inv).balance };
}

/** Marks past-due invoices OVERDUE and nudges the customer. Run daily by cron. */
export async function sweepOverdue() {
  const now = new Date();
  const due = await prisma.invoice.findMany({
    where: { deletedAt: null, status: { in: ['SENT', 'PARTIAL'] }, dueDate: { lt: now } },
    include: { customer: { select: { name: true, phone: true, email: true, preferredLocale: true } } },
    take: 500,
  });
  for (const inv of due) {
    await prisma.invoice.update({ where: { id: inv.id }, data: { status: 'OVERDUE' } });
    const days = Math.floor((now - new Date(inv.dueDate)) / 86400000);
    if ([1, 7, 15].includes(days) || days % 30 === 0) {
      await notify({
        templateKey: 'invoice_overdue', channel: 'sms', to: inv.customer.phone, locale: inv.customer.preferredLocale,
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
      type: 'invoices_overdue', title: `${due.length} invoice(s) went overdue`, link: '/admin/invoices?overdueOnly=true',
    });
  }
  return { marked: due.length };
}

/**
 * Expenses — a registry resource since Phase I (mounted by mountResource: no toggle, no reorder — an expense
 * is neither switched off nor ordered). `approvedBy` is the user who records it, never the client's say.
 * Rows carry `approver { id, name }`, `job { id, number }` and `bill` (the photo of the bill, as media).
 */
const EXPENSE_SEARCH = ['category', 'vendor', 'note'];
/** Where a bill photo lands, apart from the website's library (an accountant holds no media:write). */
export const EXPENSE_BILLS_FOLDER = 'Expense bills';

const expenseCrud = makeCrud({
  model: 'expense', label: 'Expense', searchFields: EXPENSE_SEARCH, sortable: false,
  defaultSort: '-spentAt', moneyFields: ['amount'],
  include: { job: { select: { id: true, number: true } } },
  filter: (q) => {
    const spent = kathmanduDayRange(q.from, q.to);
    return {
      ...(q.category ? { category: q.category } : {}),
      ...(q.jobId ? { jobId: q.jobId } : {}),
      ...(spent ? { spentAt: spent } : {}),
    };
  },
});

async function decorateExpenses(rows) {
  const [users, media] = await Promise.all([
    prisma.user.findMany({ where: { id: { in: [...new Set(rows.map((r) => r.approvedBy).filter(Boolean))] } }, select: { id: true, name: true } }),
    resolveMediaMap(rows.map((r) => r.billMediaId)),
  ]);
  const names = new Map(users.map((u) => [u.id, u]));
  return rows.map((r) => ({ ...r, approver: names.get(r.approvedBy) ?? null, bill: media[r.billMediaId] ?? null }));
}

export const expenses = {
  ...expenseCrud,
  async list(query = {}, ctx) {
    const { items, meta: m } = await expenseCrud.list(query, ctx);
    // The list's footer: what the filtered expenses come to (the trash view counts nothing).
    const spent = kathmanduDayRange(query.from, query.to);
    const q = query.q?.trim();
    const where = {
      deletedAt: null,
      ...(query.category ? { category: query.category } : {}),
      ...(query.jobId ? { jobId: query.jobId } : {}),
      ...(spent ? { spentAt: spent } : {}),
      ...(q ? { OR: searchOr(q, EXPENSE_SEARCH) } : {}),
    };
    const agg = query.deleted ? null : await prisma.expense.aggregate({ where, _sum: { amount: true } });
    return { items: await decorateExpenses(items), meta: { ...m, totals: { total: agg?._sum.amount ?? 0 } } };
  },
  async get(id, ctx) {
    return (await decorateExpenses([await expenseCrud.get(id, ctx)]))[0];
  },
  async create(data, ctx = {}) {
    const row = await expenseCrud.create({ ...data, approvedBy: ctx.userId ?? null }, ctx);
    return expenses.get(row.id);
  },
  async update(id, data, ctx) {
    await expenseCrud.update(id, data, ctx);
    return expenses.get(id);
  },
  /**
   * POST /admin/expenses/bill — the photo of a bill, stored in the "Expense bills" folder, for the form's
   * billMediaId. It is expenses:write, not media:write: the accountant attaches a bill without being able to
   * change the website's pictures.
   */
  async uploadBill(files, ctx = {}) {
    if (!files?.length) throw badRequest('Choose the photo of the bill');
    const folder = await prisma.mediaFolder.findFirst({ where: { name: EXPENSE_BILLS_FOLDER, parentId: null } })
      ?? await prisma.mediaFolder.create({ data: { name: EXPENSE_BILLS_FOLDER } });
    const [media] = await uploadFiles(files.slice(0, 1), { folderId: folder.id, uploadedBy: ctx.userId, alt: 'Expense bill' });
    return media;
  },

  /** The categories already used, for the form's suggestions. */
  async categories() {
    const rows = await prisma.expense.findMany({ where: { deletedAt: null }, distinct: ['category'], select: { category: true }, orderBy: { category: 'asc' } });
    return rows.map((r) => r.category);
  },
};
