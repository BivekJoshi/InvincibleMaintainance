import { prisma } from '../lib/prisma.js';
import { env } from '../config/env.js';
import { notFound, badRequest, unprocessable } from '../utils/AppError.js';
import { parseListQuery, meta, dateRange } from '../utils/pagination.js';
import { documentTotals, toPaisa, formatNpr } from '../utils/money.js';
import { nextNumber } from '../utils/numbering.js';
import { publicToken } from '../utils/tokens.js';
import { QUOTATION_TRANSITIONS, assertTransition } from '../shared/stateMachines.js';
import { getSetting } from './settings.service.js';
import { notify, notifyRoles } from './notify.service.js';
import { transitionLead } from './lead.service.js';

const INCLUDE = {
  customer: { select: { id: true, name: true, phone: true, email: true, panVatNo: true } },
  site: { select: { id: true, label: true, address: true, area: true } },
  lead: { select: { id: true, name: true, status: true } },
  items: { orderBy: { sortOrder: 'asc' } },
  createdBy: { select: { id: true, name: true } },
};

const EXPIRED_MESSAGE = 'This quotation has expired. Please contact us for a fresh quote.';

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

/**
 * The one expiry rule, shared by the customer's GET, the customer's decision and
 * the quotation:expire sweep, so the three can never disagree.
 */
const isExpired = (q, now = new Date()) => q.status === 'SENT' && q.validUntil != null && q.validUntil < now;

/** SENT → EXPIRED, guarded so a decision landing at the same moment is never overwritten. */
async function markExpired(id) {
  assertTransition(QUOTATION_TRANSITIONS, 'SENT', 'EXPIRED', 'quotation');
  await prisma.quotation.updateMany({ where: { id, status: 'SENT' }, data: { status: 'EXPIRED' } });
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

/**
 * @param {object} input  rupee-denominated, as the API receives it
 * @param {string} [userId]
 * @param {import('@prisma/client').Prisma.TransactionClient} [client]  the caller's transaction
 *   (lead convert); without one the quotation gets a transaction of its own
 */
export async function createQuotation(input, userId, client = prisma) {
  const { items, discount = 0, vatApplied = true, ...rest } = input;
  const totals = await buildTotals(items, { discount, vatApplied });

  const run = async (tx) => {
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
  };
  return client === prisma ? prisma.$transaction(run) : run(client);
}

export async function updateQuotation(id, input) {
  const existing = await getQuotation(id);
  // The customer approves the figures they were sent, so only a draft changes in place.
  if (existing.status !== 'DRAFT') {
    throw unprocessable(`A ${existing.status.toLowerCase()} quotation cannot be edited. Create a revision to change it.`);
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
  if (isExpired(q)) {
    await markExpired(q.id);
    q.status = 'EXPIRED';
  }
  return q;
}

/**
 * The customer said yes, so the lead is won — through the state machine, one
 * timeline entry per step. The lead never fails the customer's approval:
 * - NEW passes through CONTACTED first (the customer was plainly contacted);
 * - a lead already WON is left as it is;
 * - a LOST lead keeps its status, and a note tells sales the customer came back.
 */
async function winLeadOnApproval(tx, q) {
  const lead = await tx.lead.findFirst({ where: { id: q.leadId, deletedAt: null }, select: { id: true, status: true } });
  if (!lead || lead.status === 'WON') return;

  const note = `Customer approved quotation ${q.number}`;
  if (lead.status === 'LOST') {
    await tx.leadActivity.create({
      data: { leadId: lead.id, type: 'note', summary: `${note} while this lead is LOST — review and reopen it` },
    });
    return;
  }
  if (lead.status === 'NEW') await transitionLead(tx, lead.id, 'CONTACTED', { note });
  await transitionLead(tx, lead.id, 'WON', { note });
}

export async function decideByToken(token, { decision, note }, ip) {
  const q = await prisma.quotation.findFirst({ where: { publicToken: token, deletedAt: null }, include: { customer: true } });
  if (!q) throw notFound('Quotation');
  // Expiry is decided here as well, not only when the link is opened: a customer
  // tapping an old SMS must not approve a price that has lapsed.
  if (isExpired(q)) {
    await markExpired(q.id);
    throw unprocessable(EXPIRED_MESSAGE);
  }
  if (q.status !== 'SENT') {
    throw unprocessable(q.status === 'EXPIRED' ? EXPIRED_MESSAGE : 'This quotation has already been responded to.');
  }
  const status = decision === 'approve' ? 'APPROVED' : 'REJECTED';
  assertTransition(QUOTATION_TRANSITIONS, q.status, status, 'quotation');

  const updated = await prisma.$transaction(async (tx) => {
    // Guarded on SENT: a double tap, or the expiry sweep landing at the same
    // moment, claims nothing and answers as already responded to.
    const claimed = await tx.quotation.updateMany({
      where: { id: q.id, status: 'SENT' },
      data: { status, decidedAt: new Date(), decidedIp: ip ?? null, decisionNote: note ?? null },
    });
    if (claimed.count === 0) throw unprocessable('This quotation has already been responded to.');
    if (q.leadId && status === 'APPROVED') await winLeadOnApproval(tx, q);
    return tx.quotation.findUnique({ where: { id: q.id } });
  });

  await notifyRoles(['ADMIN', 'SALES'], {
    type: `quotation_${decision}d`,
    title: `Quotation ${q.number} ${status.toLowerCase()}`,
    body: `${q.customer.name} · ${formatNpr(q.total)}${note ? ` · ${note}` : ''}`,
    link: `/quotations/${q.id}`,
  });
  return updated;
}

/**
 * The quotation:expire task: every SENT quotation past its validUntil becomes
 * EXPIRED in one guarded updateMany.
 * @returns {Promise<{ expired: number }>}
 */
export async function expireQuotations(now = new Date()) {
  assertTransition(QUOTATION_TRANSITIONS, 'SENT', 'EXPIRED', 'quotation');
  const { count } = await prisma.quotation.updateMany({
    where: { deletedAt: null, status: 'SENT', validUntil: { lt: now } },
    data: { status: 'EXPIRED' },
  });
  return { expired: count };
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
