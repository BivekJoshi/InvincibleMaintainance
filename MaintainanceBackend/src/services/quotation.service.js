import { prisma } from '../lib/prisma.js';
import { env } from '../config/env.js';
import { notFound, badRequest, unprocessable } from '../utils/AppError.js';
import { parseListQuery, meta, searchOr, dateRange } from '../utils/pagination.js';
import { documentTotals, toPaisa, formatNpr } from '../utils/money.js';
import { nextNumber } from '../utils/numbering.js';
import { publicToken } from '../utils/tokens.js';
import { QUOTATION_TRANSITIONS, assertTransition } from '../shared/stateMachines.js';
import { getSetting } from './settings.service.js';
import { notify, notifyRoles } from './notify.service.js';

const INCLUDE = {
  customer: { select: { id: true, name: true, phone: true, email: true, panVatNo: true } },
  site: { select: { id: true, label: true, address: true, area: true } },
  lead: { select: { id: true, name: true, status: true } },
  items: { orderBy: { sortOrder: 'asc' } },
  createdBy: { select: { id: true, name: true } },
};

/** Converts rupee-denominated request items to paisa and computes document totals. */
async function buildTotals(items, { discount = 0, vatApplied = true }) {
  const vatRate = Number(await getSetting('finance.vatRate', env.business.vatRate));
  const paisaItems = items.map((i, idx) => ({
    ...i,
    qty: Number(i.qty),
    rate: toPaisa(i.rate),
    sortOrder: i.sortOrder ?? idx,
  }));
  const totals = documentTotals(paisaItems, { discount: toPaisa(discount), vatApplied, vatRate });
  return { ...totals, items: totals.lines };
}

export async function listQuotations(query) {
  const { page, limit, skip, take, orderBy, q } = parseListQuery(query);
  const created = dateRange(query.from, query.to);
  const where = {
    deletedAt: null,
    ...(query.status ? { status: query.status } : {}),
    ...(query.customerId ? { customerId: query.customerId } : {}),
    ...(created ? { createdAt: created } : {}),
    ...(q ? { OR: [{ number: { contains: q, mode: 'insensitive' } }, { customer: { name: { contains: q, mode: 'insensitive' } } }] } : {}),
  };
  const [items, total] = await Promise.all([
    prisma.quotation.findMany({ where, orderBy, skip, take, include: INCLUDE }),
    prisma.quotation.count({ where }),
  ]);
  return { items, meta: meta({ page, limit, total }) };
}

export async function getQuotation(id) {
  const q = await prisma.quotation.findFirst({
    where: { id, deletedAt: null },
    include: { ...INCLUDE, revisions: { select: { id: true, number: true, version: true, status: true } } },
  });
  if (!q) throw notFound('Quotation');
  return q;
}

export async function createQuotation(input, userId) {
  const { items, discount = 0, vatApplied = true, ...rest } = input;
  const totals = await buildTotals(items, { discount, vatApplied });

  return prisma.$transaction(async (tx) => {
    const number = await nextNumber(tx, 'QT');
    return tx.quotation.create({
      data: {
        ...rest,
        number,
        createdById: userId ?? null,
        subtotal: totals.subtotal,
        discount: totals.discount,
        vatApplied: totals.vatApplied,
        vatRate: totals.vatRate,
        vatAmount: totals.vatAmount,
        total: totals.total,
        items: { create: totals.items },
      },
      include: INCLUDE,
    });
  });
}

export async function updateQuotation(id, input) {
  const existing = await getQuotation(id);
  if (['APPROVED', 'CONVERTED'].includes(existing.status)) {
    throw unprocessable('An approved quotation cannot be edited. Create a revision instead.');
  }
  const { items, discount, vatApplied, ...rest } = input;

  if (!items) {
    return prisma.quotation.update({ where: { id }, data: rest, include: INCLUDE });
  }
  const totals = await buildTotals(items, {
    discount: discount ?? existing.discount / 100,
    vatApplied: vatApplied ?? existing.vatApplied,
  });
  return prisma.$transaction(async (tx) => {
    await tx.quotationItem.deleteMany({ where: { quotationId: id } });
    return tx.quotation.update({
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

/** A sent quotation is never edited in place — revising creates v2 and keeps the history. */
export async function reviseQuotation(id, userId) {
  const source = await getQuotation(id);
  return prisma.$transaction(async (tx) => {
    const number = await nextNumber(tx, 'QT');
    const copy = await tx.quotation.create({
      data: {
        number,
        version: source.version + 1,
        parentId: source.id,
        customerId: source.customerId,
        siteId: source.siteId,
        leadId: source.leadId,
        validUntil: source.validUntil,
        subtotal: source.subtotal, discount: source.discount, vatApplied: source.vatApplied,
        vatRate: source.vatRate, vatAmount: source.vatAmount, total: source.total,
        terms: source.terms, internalNote: source.internalNote,
        createdById: userId ?? null,
        items: {
          create: source.items.map(({ id: _i, quotationId: _q, ...rest }) => rest),
        },
      },
      include: INCLUDE,
    });
    return copy;
  });
}

export async function sendQuotation(id) {
  const q = await getQuotation(id);
  assertTransition(QUOTATION_TRANSITIONS, q.status, 'SENT', 'quotation');

  const token = q.publicToken ?? publicToken();
  const updated = await prisma.quotation.update({
    where: { id },
    data: { status: 'SENT', sentAt: new Date(), publicToken: token },
    include: INCLUDE,
  });

  const webOrigin = env.corsOrigins[0] ?? env.appUrl;
  const vars = {
    customerName: q.customer.name,
    number: q.number,
    total: formatNpr(q.total),
    validUntil: q.validUntil ? q.validUntil.toISOString().slice(0, 10) : 'further notice',
    link: `${webOrigin}/quotation/${token}`,
    appName: env.appName,
  };
  if (q.customer.email) {
    await notify({
      templateKey: 'quotation_sent', channel: 'email', to: q.customer.email, vars,
      related: { model: 'Quotation', id },
      fallbackSubject: 'Your quotation {{number}} from {{appName}}',
      fallbackBody: 'Dear {{customerName}},\n\nYour quotation {{number}} for {{total}} is ready.\nReview and approve it here:\n{{link}}\n\nValid until {{validUntil}}.',
    });
  }
  await notify({
    templateKey: 'quotation_sent', channel: 'sms', to: q.customer.phone, vars,
    related: { model: 'Quotation', id },
    fallbackBody: 'Quotation {{number}} for {{total}} is ready. View and approve: {{link}} - {{appName}}',
  });

  return updated;
}

/** Customer-facing view resolved by public token — no auth. */
export async function getByPublicToken(token) {
  const q = await prisma.quotation.findFirst({
    where: { publicToken: token, deletedAt: null },
    include: {
      customer: { select: { name: true, phone: true } },
      site: { select: { label: true, address: true } },
      items: { orderBy: { sortOrder: 'asc' } },
    },
  });
  if (!q) throw notFound('Quotation');
  if (q.validUntil && q.validUntil < new Date() && q.status === 'SENT') {
    await prisma.quotation.update({ where: { id: q.id }, data: { status: 'EXPIRED' } });
    q.status = 'EXPIRED';
  }
  return q;
}

export async function decideByToken(token, { decision, note }, ip) {
  const q = await prisma.quotation.findFirst({ where: { publicToken: token, deletedAt: null }, include: { customer: true } });
  if (!q) throw notFound('Quotation');
  if (q.status !== 'SENT') {
    throw unprocessable(
      q.status === 'EXPIRED'
        ? 'This quotation has expired. Please contact us for a fresh quote.'
        : 'This quotation has already been responded to.',
    );
  }
  const status = decision === 'approve' ? 'APPROVED' : 'REJECTED';
  const updated = await prisma.quotation.update({
    where: { id: q.id },
    data: { status, decidedAt: new Date(), decidedIp: ip ?? null, decisionNote: note ?? null },
  });

  await notifyRoles(['ADMIN', 'SALES'], {
    type: `quotation_${decision}d`,
    title: `Quotation ${q.number} ${status.toLowerCase()}`,
    body: `${q.customer.name} · ${formatNpr(q.total)}${note ? ` · ${note}` : ''}`,
    link: `/quotations/${q.id}`,
  });
  if (q.leadId && status === 'APPROVED') {
    await prisma.lead.update({ where: { id: q.leadId }, data: { status: 'WON', closedAt: new Date() } }).catch(() => {});
  }
  return updated;
}

export async function deleteQuotation(id) {
  const q = await getQuotation(id);
  if (q.status === 'CONVERTED') throw badRequest('A converted quotation cannot be deleted');
  await prisma.quotation.update({ where: { id }, data: { deletedAt: new Date() } });
}

/** Marks the quotation converted once a job has been created from it. */
export async function markConverted(id, tx = prisma) {
  return tx.quotation.update({ where: { id }, data: { status: 'CONVERTED' } });
}
