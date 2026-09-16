import { prisma } from '../lib/prisma.js';
import { env } from '../config/env.js';
import { AppError, notFound, badRequest, conflict, unprocessable } from '../utils/AppError.js';
import { parseListQuery, meta, dateRange } from '../utils/pagination.js';
import { documentTotals, toPaisa, formatNpr } from '../utils/money.js';
import { nextNumber } from '../utils/numbering.js';
import { publicToken } from '../utils/tokens.js';
import { QUOTATION_TRANSITIONS, assertTransition } from '../shared/stateMachines.js';
import { QUOTATION_DECISIONS, QUOTATION_STAGES, ROLES } from '../shared/enums.js';
import { can } from '../shared/permissions.js';
import { getSetting } from './settings.service.js';
import { notify, notifyUsers, userIdsWithRoles } from './notify.service.js';
import { transitionLead } from './lead.service.js';
import { recordEvent } from './audit.service.js';
import { createJob } from './job.service.js';
import { adminJobPath, adminQuotationPath, webUrl } from '../utils/links.js';

const INCLUDE = {
  customer: { select: { id: true, name: true, phone: true, email: true, panVatNo: true, preferredLocale: true } },
  site: { select: { id: true, label: true, address: true, area: true } },
  lead: { select: { id: true, name: true, status: true, assignedToId: true } },
  items: { orderBy: { sortOrder: 'asc' } },
  createdBy: { select: { id: true, name: true } },
  submittedBy: { select: { id: true, name: true } },
  approvedBy: { select: { id: true, name: true } },
};

/** The roles that may approve a quotation — derived from the capability map, never listed twice. */
export const APPROVER_ROLES = ROLES.filter((role) => can(role, 'quotations:approve'));

const EXPIRED_MESSAGE = 'This quotation has expired. Please contact us for a fresh quote.';
const ANSWERED_MESSAGE = 'We already have your response to this quotation. Please call us if you would like to change it.';
const REPLACED_MESSAGE = 'This quotation has been replaced by a newer version. Please open the latest link we sent you.';
const NOT_OPEN_MESSAGE = 'This quotation is not open for a response.';

const closed = (code, message) => new AppError(422, code, message);

/** Why a quotation that is not SENT cannot take the customer's answer. */
function closedError(status) {
  if (status === 'EXPIRED') return closed('QUOTATION_EXPIRED', EXPIRED_MESSAGE);
  if (status === 'SUPERSEDED') return closed('QUOTATION_REPLACED', REPLACED_MESSAGE);
  if (['APPROVED', 'CONVERTED', 'CHANGES_REQUESTED', 'REJECTED'].includes(status)) return closed('QUOTATION_ANSWERED', ANSWERED_MESSAGE);
  return closed('QUOTATION_NOT_OPEN', NOT_OPEN_MESSAGE);
}

/** "NPR 12,345.00" — how staff timelines state an amount. */
const npr = (paisa) => `NPR ${formatNpr(paisa, { withSymbol: false })}`;
const label = (q) => `${q.number} v${q.version}`;

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

/**
 * SENT → EXPIRED, guarded so a decision landing at the same moment is never overwritten.
 * @returns {Promise<number>} 1 if this call expired it, 0 if something else got there first
 */
async function markExpired(id) {
  assertTransition(QUOTATION_TRANSITIONS, 'SENT', 'EXPIRED', 'quotation');
  return prisma.$transaction(async (tx) => {
    const { count } = await tx.quotation.updateMany({ where: { id, status: 'SENT' }, data: { status: 'EXPIRED' } });
    if (count) {
      await recordEvent('quotation.expired', { model: 'Quotation', recordId: id, before: { status: 'SENT' }, after: { status: 'EXPIRED' } }, tx);
    }
    return count;
  });
}

/**
 * assertTransition, except that staying put is refused too: canTransition lets
 * X → X through as a no-op, but submitting a submitted quotation or revising a
 * superseded one is a mistake the caller must hear about.
 */
function assertMove(from, to) {
  if (from === to) {
    throw new AppError(422, 'INVALID_TRANSITION', `This quotation is already ${from.toLowerCase().replace('_', ' ')}.`);
  }
  assertTransition(QUOTATION_TRANSITIONS, from, to, 'quotation');
}

/**
 * Moves a quotation one step, guarded on the status just read: two people pressing
 * the same button resolve to one move and one conflict, never two moves.
 */
async function moveStatus(tx, q, to, data = {}) {
  assertMove(q.status, to);
  const { count } = await tx.quotation.updateMany({ where: { id: q.id, status: q.status }, data: { ...data, status: to } });
  if (!count) throw conflict('This quotation changed a moment ago. Reload and try again.');
}

async function findQuotation(id, include = {}) {
  const q = await prisma.quotation.findFirst({ where: { id, deletedAt: null }, include: { ...INCLUDE, ...include } });
  if (!q) throw notFound('Quotation');
  return q;
}

/**
 * Every version of the quotation `q` belongs to, oldest first. A version is revised
 * at most once (the parent becomes SUPERSEDED), so the chain is a line.
 */
async function versionChain(q) {
  const pick = { id: true, number: true, version: true, status: true, total: true, parentId: true, supersededById: true, createdAt: true };
  const chain = [q];
  for (let cur = q, i = 0; cur.parentId && i < 50; i += 1) {
    cur = await prisma.quotation.findUnique({ where: { id: cur.parentId }, select: pick });
    if (!cur) break;
    chain.unshift(cur);
  }
  for (let cur = q, i = 0; cur.supersededById && i < 50; i += 1) {
    cur = await prisma.quotation.findUnique({ where: { id: cur.supersededById }, select: pick });
    if (!cur) break;
    chain.push(cur);
  }
  return chain.map(({ id, number, version, status, total, createdAt }) => ({ id, number, version, status, total, createdAt }));
}

export async function listQuotations(query) {
  const { page, limit, skip, take, orderBy, q } = parseListQuery(query);
  const created = dateRange(query.from, query.to);
  const stage = query.stage ? QUOTATION_STAGES[query.stage] : null;
  let status;
  if (stage && query.status) status = stage.includes(query.status) ? query.status : { in: [] };
  else if (stage) status = { in: stage };
  else if (query.status) status = query.status;
  const where = {
    deletedAt: null,
    ...(status ? { status } : {}),
    ...(query.customerId ? { customerId: query.customerId } : {}),
    ...(query.leadId ? { leadId: query.leadId } : {}),
    ...(created ? { createdAt: created } : {}),
    ...(q ? { OR: [{ number: { contains: q, mode: 'insensitive' } }, { customer: { name: { contains: q, mode: 'insensitive' } } }] } : {}),
  };
  const [items, total] = await Promise.all([
    prisma.quotation.findMany({ where, orderBy, skip, take, include: INCLUDE }),
    prisma.quotation.count({ where }),
  ]);
  return { items, meta: meta({ page, limit, total }) };
}

/** The staff view: the quotation, who moved it, and every version of it. */
export async function getQuotation(id) {
  const q = await findQuotation(id, {
    revisions: { select: { id: true, number: true, version: true, status: true } },
    parent: { select: { id: true, number: true, version: true, status: true, decisionNote: true } },
    supersededBy: { select: { id: true, number: true, version: true, status: true } },
  });
  return { ...q, versions: await versionChain(q) };
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
    const quotation = await tx.quotation.create({
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
    await recordEvent('quotation.created', {
      model: 'Quotation',
      recordId: quotation.id,
      after: { number, status: quotation.status, total: quotation.total, customerId: quotation.customerId, leadId: quotation.leadId },
    }, tx);
    return quotation;
  };
  return client === prisma ? prisma.$transaction(run) : run(client);
}

export async function updateQuotation(id, input) {
  const existing = await getQuotation(id);
  // Approval and the customer's answer both refer to the figures as they were, so only a draft changes in place.
  if (existing.status !== 'DRAFT') {
    throw unprocessable(`A ${existing.status.toLowerCase().replace('_', ' ')} quotation cannot be edited. ${
      existing.status === 'PENDING_APPROVAL' || existing.status === 'OFFICE_APPROVED'
        ? 'Ask for it to be sent back (or pull it back) first.'
        : 'Create a revision to change it.'
    }`);
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

// ── internal approval

/**
 * DRAFT → PENDING_APPROVAL, or on to OFFICE_APPROVED in the same transaction when the
 * total is below `quotation.autoApproveBelow` (paisa; 0 = never). That second step is
 * the system's decision, and is recorded as such.
 */
export async function submitQuotation(id, userId) {
  const q = await findQuotation(id, { _count: { select: { items: true } } });
  assertMove(q.status, 'PENDING_APPROVAL');
  if (!q._count.items) throw new AppError(422, 'QUOTATION_INCOMPLETE', 'Add at least one line before submitting.');
  const customer = await prisma.customer.findFirst({ where: { id: q.customerId, deletedAt: null }, select: { id: true } });
  if (!customer) throw new AppError(422, 'QUOTATION_INCOMPLETE', 'This quotation has no active customer.');
  const now = new Date();
  if (!q.validUntil || q.validUntil <= now) {
    throw new AppError(422, 'QUOTATION_INCOMPLETE', 'Set a valid-until date in the future before submitting.');
  }

  const threshold = Math.max(0, Math.round(Number(await getSetting('quotation.autoApproveBelow', 0)) || 0));
  const auto = threshold > 0 && q.total < threshold;

  await prisma.$transaction(async (tx) => {
    await moveStatus(tx, q, 'PENDING_APPROVAL', {
      submittedAt: now, submittedById: userId ?? null,
      approvedById: null, approvedAt: null, approvalNote: null, autoApproved: false,
    });
    await recordEvent('quotation.submitted', {
      model: 'Quotation', recordId: id, before: { status: q.status }, after: { status: 'PENDING_APPROVAL', total: q.total },
    }, tx);
    if (!auto) return;
    await moveStatus(tx, { ...q, status: 'PENDING_APPROVAL' }, 'OFFICE_APPROVED', {
      approvedAt: now, autoApproved: true, approvalNote: `Below the auto-approval limit of ${npr(threshold)}`,
    });
    await recordEvent('quotation.auto_approved', {
      model: 'Quotation', recordId: id, before: { status: 'PENDING_APPROVAL' }, after: { status: 'OFFICE_APPROVED' },
      meta: { total: q.total, threshold }, actorType: 'system',
    }, tx);
  });

  if (!auto) {
    const approvers = (await userIdsWithRoles(APPROVER_ROLES)).filter((uid) => uid !== userId);
    await notifyUsers(approvers.map((uid) => ({ userId: uid, email: true })), {
      type: 'quotation_submitted',
      templateKey: 'quotation_submitted',
      title: `Approve ${label(q)} for ${q.customer.name}`,
      body: `${npr(q.total)} · submitted by ${q.createdBy?.name ?? 'the office'}`,
      link: adminQuotationPath(id),
      related: { model: 'Quotation', id },
    });
  }
  return getQuotation(id);
}

/** PENDING_APPROVAL → OFFICE_APPROVED. The maker never checks their own work while quotation.makerChecker is on. */
export async function approveQuotation(id, { note } = {}, userId) {
  const q = await findQuotation(id);
  assertMove(q.status, 'OFFICE_APPROVED');
  const makerChecker = (await getSetting('quotation.makerChecker', true)) !== false;
  if (makerChecker && q.createdById && q.createdById === userId) {
    throw new AppError(403, 'SELF_APPROVAL', 'You prepared this quotation, so another approver must approve it.');
  }
  await prisma.$transaction(async (tx) => {
    await moveStatus(tx, q, 'OFFICE_APPROVED', {
      approvedById: userId, approvedAt: new Date(), approvalNote: note ?? null, autoApproved: false,
    });
    await recordEvent('quotation.office_approved', {
      model: 'Quotation', recordId: id, before: { status: q.status }, after: { status: 'OFFICE_APPROVED' }, ...(note ? { meta: { note } } : {}),
    }, tx);
  });
  if (q.createdById !== userId) {
    await notifyUsers([{ userId: q.createdById }], {
      type: 'quotation_office_approved',
      title: `${label(q)} is approved — ready to send`,
      body: note ?? `${q.customer.name} · ${npr(q.total)}`,
      link: adminQuotationPath(id),
    });
  }
  return getQuotation(id);
}

/** PENDING_APPROVAL → DRAFT with the approver's reason. */
export async function sendBackQuotation(id, { note }, userId) {
  const q = await findQuotation(id);
  await prisma.$transaction(async (tx) => {
    await moveStatus(tx, q, 'DRAFT', { sentBackReason: note });
    await recordEvent('quotation.sent_back', {
      model: 'Quotation', recordId: id, before: { status: q.status }, after: { status: 'DRAFT' }, meta: { note },
    }, tx);
  });
  if (q.createdById !== userId) {
    await notifyUsers([{ userId: q.createdById }], {
      type: 'quotation_sent_back',
      title: `${label(q)} was sent back`,
      body: note,
      link: adminQuotationPath(id),
    });
  }
  return getQuotation(id);
}

/** OFFICE_APPROVED → DRAFT before it is sent. The approval is void; a resubmission needs a new one. */
export async function pullBackQuotation(id, { note }) {
  const q = await findQuotation(id);
  await prisma.$transaction(async (tx) => {
    await moveStatus(tx, q, 'DRAFT', {
      sentBackReason: note, approvedById: null, approvedAt: null, approvalNote: null, autoApproved: false,
    });
    await recordEvent('quotation.pulled_back', {
      model: 'Quotation', recordId: id, before: { status: q.status }, after: { status: 'DRAFT' }, meta: { note },
    }, tx);
  });
  return getQuotation(id);
}

// ── to the customer

/** OFFICE_APPROVED → SENT, with the customer's link by SMS (and email when on file). */
export async function sendQuotation(id) {
  const q = await findQuotation(id);
  assertMove(q.status, 'SENT');
  if (q.validUntil && q.validUntil < new Date()) {
    throw new AppError(422, 'QUOTATION_EXPIRED', 'Its valid-until date has passed. Pull it back, set a new date and submit it again.');
  }

  const token = q.publicToken ?? publicToken();
  await prisma.$transaction(async (tx) => {
    await moveStatus(tx, q, 'SENT', { sentAt: new Date(), publicToken: token });
    await recordEvent('quotation.sent', { model: 'Quotation', recordId: id, before: { status: q.status }, after: { status: 'SENT' } }, tx);
  });

  const vars = {
    customerName: q.customer.name,
    number: q.number,
    version: q.version,
    total: formatNpr(q.total),
    validUntil: q.validUntil ? q.validUntil.toISOString().slice(0, 10) : 'further notice',
    link: webUrl(`/quotation/${token}`),
    appName: env.appName,
  };
  if (q.customer.email) {
    await notify({
      templateKey: 'quotation_sent', channel: 'email', to: q.customer.email, vars, locale: q.customer.preferredLocale,
      related: { model: 'Quotation', id },
      fallbackSubject: 'Your quotation {{number}} from {{appName}}',
      fallbackBody: 'Dear {{customerName}},\n\nYour quotation {{number}} for {{total}} is ready.\nReview and approve it here:\n{{link}}\n\nValid until {{validUntil}}.',
    });
  }
  await notify({
    templateKey: 'quotation_sent', channel: 'sms', to: q.customer.phone, vars, locale: q.customer.preferredLocale,
    related: { model: 'Quotation', id },
    fallbackBody: 'Quotation {{number}} for {{total}} is ready. View and approve: {{link}} - {{appName}}',
  });

  return getQuotation(id);
}

/**
 * A new DRAFT version (lines copied, the customer's change request carried onto it);
 * the source becomes SUPERSEDED, which closes its link. The new version is approved again.
 */
export async function reviseQuotation(id, userId) {
  const source = await findQuotation(id);
  assertMove(source.status, 'SUPERSEDED');
  const created = await prisma.$transaction(async (tx) => {
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
        requestedChanges: source.status === 'CHANGES_REQUESTED' ? source.decisionNote : null,
        createdById: userId ?? null,
        items: {
          create: source.items.map(({ id: _i, quotationId: _q, ...rest }) => rest),
        },
      },
    });
    await recordEvent('quotation.revised', {
      model: 'Quotation',
      recordId: copy.id,
      after: { number, version: copy.version, status: copy.status, total: copy.total },
      meta: { parentId: source.id, version: copy.version },
    }, tx);
    await moveStatus(tx, source, 'SUPERSEDED', { supersededById: copy.id });
    await recordEvent('quotation.superseded', {
      model: 'Quotation', recordId: source.id, before: { status: source.status }, after: { status: 'SUPERSEDED' },
      meta: { supersededById: copy.id, number: copy.number, version: copy.version },
    }, tx);
    return copy;
  });
  return getQuotation(created.id);
}

// ── the customer's answer

/** The newest version's link, when a newer version than `q` is with the customer. */
async function replacementFor(q) {
  let cur = q;
  for (let i = 0; cur.supersededById && i < 50; i += 1) {
    cur = await prisma.quotation.findUnique({
      where: { id: cur.supersededById },
      select: { id: true, status: true, publicToken: true, supersededById: true, deletedAt: true },
    });
    if (!cur) return null;
  }
  return cur !== q && cur.status === 'SENT' && cur.publicToken && !cur.deletedAt ? { token: cur.publicToken } : null;
}

/** What a customer may see: an allowlist, never the row. */
async function publicView(q) {
  return {
    number: q.number,
    version: q.version,
    status: q.status,
    validUntil: q.validUntil,
    subtotal: q.subtotal,
    discount: q.discount,
    vatApplied: q.vatApplied,
    vatRate: q.vatRate,
    vatAmount: q.vatAmount,
    total: q.total,
    terms: q.terms,
    sentAt: q.sentAt,
    decidedAt: q.decidedAt,
    decisionNote: q.decisionNote,
    requestedChanges: q.requestedChanges,
    createdAt: q.createdAt,
    customer: { name: q.customer.name },
    site: q.site ? { label: q.site.label, address: q.site.address } : null,
    items: q.items.map((i) => ({
      id: i.id, description: i.description, unit: i.unit, qty: i.qty, rate: i.rate, amount: i.amount, sortOrder: i.sortOrder,
    })),
    replaced: await replacementFor(q),
    actions: q.status === 'SENT' ? [...QUOTATION_DECISIONS] : [],
  };
}

const PUBLIC_INCLUDE = {
  customer: { select: { name: true } },
  site: { select: { label: true, address: true } },
  items: { orderBy: { sortOrder: 'asc' } },
};

/** Customer-facing view resolved by public token — no auth. */
export async function getByPublicToken(token) {
  const q = await prisma.quotation.findFirst({ where: { publicToken: token, deletedAt: null }, include: PUBLIC_INCLUDE });
  if (!q) throw notFound('Quotation');
  if (isExpired(q)) {
    await markExpired(q.id);
    q.status = 'EXPIRED';
  }
  return publicView(q);
}

/**
 * The quotation, if it can take the customer's answer now. Expiry is decided here as
 * well, not only when the link is opened: a customer tapping an old SMS must not
 * accept a price that has lapsed.
 */
async function openForAnswer(id) {
  const q = await findQuotation(id);
  if (isExpired(q)) {
    await markExpired(q.id);
    throw closedError('EXPIRED');
  }
  if (q.status !== 'SENT') throw closedError(q.status);
  return q;
}

/**
 * SENT → `to`, guarded on SENT and on the validity date: a double tap, a replay or
 * the expiry sweep landing at the same moment claims nothing.
 * @param {{ note?: string, ip?: string|null, userAgent?: string|null }} answer
 */
async function claimAnswer(tx, q, to, { note, ip, userAgent }) {
  assertTransition(QUOTATION_TRANSITIONS, 'SENT', to, 'quotation');
  const now = new Date();
  const { count } = await tx.quotation.updateMany({
    where: { id: q.id, status: 'SENT', OR: [{ validUntil: null }, { validUntil: { gte: now } }] },
    data: {
      status: to,
      decidedAt: now,
      decidedIp: ip ?? null,
      decidedUserAgent: userAgent ? String(userAgent).slice(0, 500) : null,
      decisionNote: note ?? null,
    },
  });
  if (!count) throw closedError('APPROVED');
}

async function leadNote(tx, q, summary) {
  if (!q.leadId) return;
  const lead = await tx.lead.findFirst({ where: { id: q.leadId, deletedAt: null }, select: { id: true } });
  if (lead) await tx.leadActivity.create({ data: { leadId: lead.id, type: 'note', summary: summary.slice(0, 2000) } });
}

/**
 * The customer accepted, so the lead is won — through the state machine, one
 * timeline entry per step. The lead never fails the customer's acceptance:
 * - NEW passes through CONTACTED first (the customer was plainly contacted);
 * - a lead already WON or LOST keeps its status and gets a note instead.
 */
async function winLeadOnAcceptance(tx, q, summary) {
  const lead = await tx.lead.findFirst({ where: { id: q.leadId, deletedAt: null }, select: { id: true, status: true } });
  if (!lead) return;
  if (lead.status === 'WON' || lead.status === 'LOST') {
    const tail = lead.status === 'LOST' ? ' — review and reopen it' : '';
    await tx.leadActivity.create({
      data: { leadId: lead.id, type: 'note', summary: `${summary} while this lead is ${lead.status}${tail}` },
    });
    return;
  }
  if (lead.status === 'NEW') await transitionLead(tx, lead.id, 'CONTACTED', { note: summary });
  await transitionLead(tx, lead.id, 'WON', { note: summary });
}

/** Earlier versions' ids too: a survey points at the version it was first priced into. */
async function lineageIds(q) {
  const ids = [q.id];
  for (let cur = q, i = 0; cur.parentId && i < 50; i += 1) {
    cur = await prisma.quotation.findUnique({ where: { id: cur.parentId }, select: { id: true, parentId: true } });
    if (!cur) break;
    ids.push(cur.id);
  }
  return ids;
}

/**
 * The work order an accepted quotation becomes: unscheduled, unassigned, titled after
 * the service, with that service's checklist when it has a template. No mapping from a
 * service to a job type exists, so it is REPAIR.
 */
async function jobPlanFor(q) {
  const survey = await prisma.siteSurvey.findFirst({
    where: { quotationId: { in: await lineageIds(q) }, deletedAt: null },
    select: { urgency: true, service: { select: { id: true, name: true } } },
  });
  const lead = q.leadId
    ? await prisma.lead.findFirst({ where: { id: q.leadId }, select: { service: { select: { id: true, name: true } } } })
    : null;
  const service = survey?.service ?? lead?.service ?? null;
  const template = service
    ? await prisma.jobTemplate.findFirst({
      where: { serviceId: service.id, isActive: true, deletedAt: null },
      orderBy: { createdAt: 'asc' },
      select: { id: true },
    })
    : null;
  const what = service?.name ?? q.items[0]?.description ?? 'Work';
  return {
    type: 'REPAIR',
    title: `${what} — ${q.number}`.slice(0, 200),
    description: `Accepted by the customer (${label(q)}, ${npr(q.total)}). Schedule and assign.`,
    priority: survey?.urgency ?? 'NORMAL',
    ...(template ? { templateId: template.id } : {}),
  };
}

/** The salesperson and the quotation's author — the people who answer the customer. */
const salesRecipients = (q, email = true) => [
  { userId: q.lead?.assignedToId, email },
  { userId: q.createdById, email },
];

/**
 * Customer accepts (D3). One transaction: SENT → APPROVED → CONVERTED, the lead WON,
 * one DRAFT job. Then, once each: the customer (SMS + email in their language), the
 * salesperson and the author, every dispatcher (linking the job), and the manager who
 * approved it (not when the system did).
 * @param {string} id
 * @param {{ note?: string, ip?: string|null, userAgent?: string|null }} answer
 */
export async function acceptQuotation(id, answer = {}) {
  const q = await openForAnswer(id);
  const plan = await jobPlanFor(q);
  const summary = `Customer accepted ${label(q)} · ${npr(q.total)}`;

  const job = await prisma.$transaction(async (tx) => {
    await claimAnswer(tx, q, 'APPROVED', answer);
    await recordEvent('quotation.customer_approved', {
      model: 'Quotation', recordId: q.id, before: { status: 'SENT' }, after: { status: 'APPROVED' },
      ...(answer.note ? { meta: { note: answer.note } } : {}),
    }, tx);
    if (q.leadId) await winLeadOnAcceptance(tx, q, summary);
    // createJob asserts APPROVED → CONVERTED and marks it, guarded, inside this transaction.
    return createJob({
      ...plan, customerId: q.customerId, siteId: q.siteId, leadId: q.leadId, quotationId: q.id,
    }, undefined, tx);
  }, { timeout: 20_000 });

  const vars = {
    customerName: q.customer.name, number: q.number, version: q.version, total: formatNpr(q.total),
    jobNumber: job.number, appName: env.appName,
  };
  const locale = q.customer.preferredLocale;
  await notify({
    templateKey: 'quotation_accepted', channel: 'sms', to: q.customer.phone, vars, locale,
    related: { model: 'Quotation', id: q.id },
    fallbackBody: 'Thank you {{customerName}}. We have your acceptance of quotation {{number}} ({{total}}). We will call you to schedule the work. - {{appName}}',
  });
  if (q.customer.email) {
    await notify({
      templateKey: 'quotation_accepted', channel: 'email', to: q.customer.email, vars, locale,
      related: { model: 'Quotation', id: q.id },
      fallbackSubject: 'Thank you — quotation {{number}} accepted',
      fallbackBody: 'Dear {{customerName}},\n\nThank you for accepting quotation {{number}} for {{total}}.\nWe will call you shortly to schedule the work.\n\n{{appName}}',
    });
  }

  const dispatchers = await userIdsWithRoles(['DISPATCHER']);
  await notifyUsers([
    ...salesRecipients(q),
    ...(q.autoApproved ? [] : [{ userId: q.approvedById }]),
    ...dispatchers.map((uid) => ({ userId: uid, email: true, link: adminJobPath(job.id) })),
  ], {
    type: 'quotation_accepted',
    templateKey: 'quotation_accepted_staff',
    title: `${q.customer.name} accepted ${label(q)}`,
    body: `${npr(q.total)} · job ${job.number} is waiting to be scheduled`,
    link: adminQuotationPath(q.id),
    vars,
    related: { model: 'Quotation', id: q.id },
  });

  const row = await prisma.quotation.findUnique({ where: { id: q.id }, include: PUBLIC_INCLUDE });
  return { ...(await publicView(row)), job: { id: job.id, number: job.number } };
}

/** Customer asks for changes: SENT → CHANGES_REQUESTED. The lead keeps its status; sales revises. */
export async function requestQuotationChanges(id, answer) {
  const note = answer?.note?.trim();
  if (!note || note.length < 5) throw badRequest('Tell us what you would like changed');
  const q = await openForAnswer(id);
  await prisma.$transaction(async (tx) => {
    await claimAnswer(tx, q, 'CHANGES_REQUESTED', { ...answer, note });
    await recordEvent('quotation.customer_changes_requested', {
      model: 'Quotation', recordId: q.id, before: { status: 'SENT' }, after: { status: 'CHANGES_REQUESTED' }, meta: { note },
    }, tx);
    await leadNote(tx, q, `Customer asked for changes to ${label(q)}: ${note}`);
  });

  const vars = { customerName: q.customer.name, number: q.number, version: q.version, note, appName: env.appName };
  await notifyUsers(salesRecipients(q), {
    type: 'quotation_changes_requested',
    templateKey: 'quotation_changes_requested_staff',
    title: `${q.customer.name} asked for changes to ${label(q)}`,
    body: note,
    link: adminQuotationPath(q.id),
    vars,
    related: { model: 'Quotation', id: q.id },
  });
  await notify({
    templateKey: 'quotation_changes_received', channel: 'sms', to: q.customer.phone, vars,
    locale: q.customer.preferredLocale, related: { model: 'Quotation', id: q.id },
    fallbackBody: 'Thank you {{customerName}}. We have your requested changes to quotation {{number}} and will send a revised quotation soon. - {{appName}}',
  });

  return publicView(await prisma.quotation.findUnique({ where: { id: q.id }, include: PUBLIC_INCLUDE }));
}

/** Customer declines: SENT → REJECTED. The lead is not marked LOST — sales decides that. */
export async function declineQuotation(id, answer = {}) {
  const q = await openForAnswer(id);
  const { note } = answer;
  await prisma.$transaction(async (tx) => {
    await claimAnswer(tx, q, 'REJECTED', answer);
    await recordEvent('quotation.customer_rejected', {
      model: 'Quotation', recordId: q.id, before: { status: 'SENT' }, after: { status: 'REJECTED' }, ...(note ? { meta: { note } } : {}),
    }, tx);
    await leadNote(tx, q, `Customer declined ${label(q)}${note ? `: ${note}` : ''}`);
  });

  await notifyUsers(salesRecipients(q), {
    type: 'quotation_rejected',
    templateKey: 'quotation_rejected_staff',
    title: `${q.customer.name} declined ${label(q)}`,
    body: note ? `${npr(q.total)} · ${note}` : `${npr(q.total)} · no reason given`,
    link: adminQuotationPath(q.id),
    related: { model: 'Quotation', id: q.id },
  });

  return publicView(await prisma.quotation.findUnique({ where: { id: q.id }, include: PUBLIC_INCLUDE }));
}

const ANSWERS = {
  approve: acceptQuotation,
  request_changes: requestQuotationChanges,
  reject: declineQuotation,
};

/**
 * The public link's decide: resolves the token and hands over to the answer
 * functions above, which a signed-in customer account (Phase K) calls directly.
 * @param {{ ip?: string|null, userAgent?: string|null }} [client]
 */
export async function decideByToken(token, { decision, note }, client = {}) {
  const q = await prisma.quotation.findFirst({ where: { publicToken: token, deletedAt: null }, select: { id: true } });
  if (!q) throw notFound('Quotation');
  return ANSWERS[decision](q.id, { note, ip: client.ip ?? null, userAgent: client.userAgent ?? null });
}

/**
 * The quotation:expire task: every SENT quotation past its validUntil becomes
 * EXPIRED, each through the same guarded markExpired the customer's link uses,
 * so each one gets its own quotation.expired event.
 * @returns {Promise<{ expired: number }>}
 */
export async function expireQuotations(now = new Date()) {
  const due = await prisma.quotation.findMany({
    where: { deletedAt: null, status: 'SENT', validUntil: { lt: now } },
    select: { id: true },
  });
  let expired = 0;
  for (const { id } of due) expired += await markExpired(id);
  return { expired };
}

export async function deleteQuotation(id) {
  const q = await getQuotation(id);
  if (q.status === 'CONVERTED') throw badRequest('A converted quotation cannot be deleted');
  await prisma.quotation.update({ where: { id }, data: { deletedAt: new Date() } });
}

/**
 * APPROVED → CONVERTED once a job has been created from it — guarded, so a customer's
 * acceptance and the convert-to-job endpoint can never both turn one quotation into work.
 */
export async function markConverted(id, tx = prisma) {
  const { count } = await tx.quotation.updateMany({ where: { id, status: 'APPROVED' }, data: { status: 'CONVERTED' } });
  if (!count) throw new AppError(422, 'INVALID_TRANSITION', 'This quotation already has its job.');
  return tx.quotation.findUnique({ where: { id } });
}
