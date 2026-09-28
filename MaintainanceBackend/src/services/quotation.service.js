import { prisma } from '../lib/prisma.js';
import { env } from '../config/env.js';
import { AppError, notFound, badRequest, conflict, unprocessable } from '../utils/AppError.js';
import { parseListQuery, meta, dateRange } from '../utils/pagination.js';
import { amountInWords, lineAmount, margin, paymentSchedule, toPaisa, formatNpr } from '../utils/money.js';
import { formatBs } from '../utils/nepaliDate.js';
import { nextNumber } from '../utils/numbering.js';
import { publicToken } from '../utils/tokens.js';
import { QUOTATION_TRANSITIONS, assertTransition } from '../shared/stateMachines.js';
import { CONTRACT_TYPES, QUOTATION_DECISIONS, QUOTATION_STAGES, ROLES } from '../shared/enums.js';
import { resolveMediaMap } from './media.service.js';
import { can } from '../shared/permissions.js';
import { getSetting } from './settings.service.js';
import { notify, notifyUsers, userIdsWithRoles } from './notify.service.js';
import { bookNextAction, transitionLead } from './lead.service.js';
import { recordEvent } from './audit.service.js';
import {
  advanceFor, announceAdvance, announceVariation, applyVariation, handOff, handOffPlan, variationPlan,
} from './handoff.service.js';
import { adminJobPath, adminLeadMarkLostPath, adminQuotationPath, webUrl } from '../utils/links.js';
import { addDays } from '../utils/dates.js';
import { buildLines, costSummary, decorateBoq, takeoffFor, totalsFor } from './boq.service.js';
import { recipeSnapshots } from './rateLibrary.service.js';

const INCLUDE = {
  customer: { select: { id: true, name: true, phone: true, email: true, panVatNo: true, preferredLocale: true } },
  // A variation's job (Phase L7).
  job: { select: { id: true, number: true, status: true, title: true } },
  site: { select: { id: true, label: true, address: true, area: true } },
  lead: { select: { id: true, name: true, status: true, assignedToId: true } },
  items: { orderBy: { sortOrder: 'asc' } },
  stages: { orderBy: { sortOrder: 'asc' } },
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

/** End of the Kathmandu day `quotation.validDays` (default 15) from now, as a UTC instant. */
async function defaultValidUntil(now = new Date()) {
  const days = Math.max(1, Math.round(Number(await getSetting('quotation.validDays', 15)) || 15));
  const kathmandu = new Date(now.getTime() + KATHMANDU_OFFSET_MS);
  const endOfDay = Date.UTC(kathmandu.getUTCFullYear(), kathmandu.getUTCMonth(), kathmandu.getUTCDate() + days, 23, 59, 59, 999);
  return new Date(endOfDay - KATHMANDU_OFFSET_MS);
}
const KATHMANDU_OFFSET_MS = (5 * 60 + 45) * 60_000;

/** "NPR 12,345.00" — how staff timelines state an amount. */
const npr = (paisa) => `NPR ${formatNpr(paisa, { withSymbol: false })}`;
const label = (q) => `${q.number} v${q.version}`;

/** The money columns a quotation stores, from `totalsFor`. */
const totalsData = (t) => ({
  subtotal: t.subtotal, discount: t.discount, vatApplied: t.vatApplied, vatRate: t.vatRate, vatAmount: t.vatAmount, total: t.total,
});

/** The cost columns a quotation stores (Phase L4), so a list shows the margin without reading every row. */
const costData = (rows, totals) => {
  const { costTotal, costComplete } = costSummary(rows, totals);
  return { costTotal, costComplete };
};

/** Payment stages as rows to write, in the order given. */
const stageRows = (stages) => stages.map((st, sortOrder) => ({ label: st.label, basisPoints: st.basisPoints, trigger: st.trigger, sortOrder }));

const FALLBACK_SCHEDULE = [
  { label: 'Advance', basisPoints: 5000, trigger: 'ON_ACCEPT' },
  { label: 'Running bill', basisPoints: 4000, trigger: 'MILESTONE' },
  { label: 'On completion', basisPoints: 1000, trigger: 'ON_COMPLETION' },
];

/** What a new quotation starts with (Phase L4): the settings' contract type and schedule, the library's default terms. */
async function contractDefaults() {
  const [contractType, schedule, terms] = await Promise.all([
    getSetting('quotation.defaultContractType', 'LUMP_SUM'),
    getSetting('quotation.defaultPaymentSchedule', FALLBACK_SCHEDULE),
    prisma.quotationTerms.findFirst({ where: { isDefault: true, isActive: true, deletedAt: null }, select: { body: true } }),
  ]);
  const valid = Array.isArray(schedule) && schedule.reduce((a, st) => a + Number(st.basisPoints || 0), 0) === 10000;
  return {
    contractType: CONTRACT_TYPES.includes(contractType) ? contractType : 'LUMP_SUM',
    stages: valid ? schedule : FALLBACK_SCHEDULE,
    terms: terms?.body ?? (await getSetting('finance.quotationTerms', null)),
  };
}

/** The company as a document states it: the letterhead of the print, the customer's page and J2's PDFs. */
async function letterhead() {
  const keys = ['contact.companyName', 'contact.address', 'contact.city', 'contact.phonePrimary', 'contact.phoneSecondary',
    'contact.email', 'finance.panVatNo', 'branding.logoId', 'branding.tagline'];
  const [name, address, city, phone1, phone2, email, panVatNo, logoId, tagline] = await Promise.all(keys.map((k) => getSetting(k, null)));
  const media = logoId ? await resolveMediaMap([logoId]) : {};
  return {
    companyName: name ?? env.appName, address, city, phones: [phone1, phone2].filter(Boolean), email,
    panVatNo: panVatNo || null, logo: logoId ? media[logoId] ?? null : null, tagline,
  };
}

/**
 * What a quotation says as a document (Phase L4): each payment stage with its amount (money.js#paymentSchedule —
 * they sum to the total), the total in words (en and ne), BS dates, the letterhead, and — stripped by the cost
 * wall for anyone without costs:read — its margin.
 */
async function documentFields(q) {
  const stages = q.stages ?? [];
  return {
    paymentStages: stages.length ? paymentSchedule(q, stages).map(({ quotationId: _q, ...st }) => st) : [],
    totalInWords: { en: amountInWords(q.total, 'en'), ne: amountInWords(q.total, 'ne') },
    dates: {
      createdAtBs: q.createdAt ? formatBs(q.createdAt) : null,
      validUntilBs: q.validUntil ? formatBs(q.validUntil) : null,
      sentAtBs: q.sentAt ? formatBs(q.sentAt) : null,
    },
    letterhead: await letterhead(),
    margin: q.costComplete ? margin(q.subtotal - q.discount, q.costTotal) : null,
  };
}

/** The staff shape of a quotation: its BOQ numbered and summarised, and its document fields. */
async function present(q) {
  const decorated = await decorateBoq(q);
  return { ...decorated, ...(await documentFields(q)) };
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
  const count = await prisma.$transaction(async (tx) => {
    const { count: moved } = await tx.quotation.updateMany({ where: { id, status: 'SENT' }, data: { status: 'EXPIRED' } });
    if (moved) {
      await recordEvent('quotation.expired', { model: 'Quotation', recordId: id, before: { status: 'SENT' }, after: { status: 'EXPIRED' } }, tx);
    }
    return moved;
  });
  if (count) {
    const q = await prisma.quotation.findUnique({ where: { id }, include: { customer: true, lead: { select: { assignedToId: true } } } });
    await promptMarkLost(q, `${label(q)} for ${q.customer.name} expired unanswered`);
  }
  return count;
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

export async function findQuotation(id, include = {}) {
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
    ...(query.kind ? { kind: query.kind } : {}),
    ...(query.jobId ? { jobId: query.jobId } : {}),
    ...(created ? { createdAt: created } : {}),
    ...(q ? { OR: [{ number: { contains: q, mode: 'insensitive' } }, { customer: { name: { contains: q, mode: 'insensitive' } } }] } : {}),
  };
  const [items, total] = await Promise.all([
    prisma.quotation.findMany({ where, orderBy, skip, take, include: INCLUDE }),
    prisma.quotation.count({ where }),
  ]);
  // The margin for the approval queue (Phase L4), from the stored cost; the cost wall strips it.
  const withMargin = items.map((row) => ({ ...row, margin: row.costComplete ? margin(row.subtotal - row.discount, row.costTotal) : null }));
  return { items: withMargin, meta: meta({ page, limit, total }) };
}

/**
 * The staff view: the quotation, who moved it, every version of it, the survey it was
 * priced from, the SMS and emails that went to the customer about it, and whether the
 * maker-checker rule is on.
 */
export async function getQuotation(id) {
  const q = await findQuotation(id, {
    revisions: { select: { id: true, number: true, version: true, status: true } },
    parent: { select: { id: true, number: true, version: true, status: true, decisionNote: true } },
    supersededBy: { select: { id: true, number: true, version: true, status: true } },
  });
  const [versions, survey, messages, makerChecker] = await Promise.all([
    versionChain(q),
    prisma.siteSurvey.findFirst({
      where: { quotationId: { in: await lineageIds(q) }, deletedAt: null },
      select: { id: true, number: true, status: true },
    }),
    prisma.messageLog.findMany({
      where: { relatedModel: 'Quotation', relatedId: id, templateKey: { in: CUSTOMER_TEMPLATES } },
      orderBy: { createdAt: 'desc' },
      take: 20,
      select: { id: true, channel: true, templateKey: true, toAddress: true, status: true, error: true, createdAt: true },
    }),
    // So the screen can say "someone else must approve this" without reading settings (MANAGER cannot).
    getSetting('quotation.makerChecker', true).then((v) => v !== false),
  ]);
  return present({ ...q, versions, survey, messages, makerChecker });
}

/** The customer's own messages about a quotation — what the Send panel reports on. */
const CUSTOMER_TEMPLATES = ['quotation_sent', 'quotation_accepted', 'quotation_changes_received'];

/**
 * @param {object} input  rupee-denominated, as the API receives it
 * @param {string} [userId]
 * @param {import('@prisma/client').Prisma.TransactionClient} [client]  the caller's transaction
 *   (lead convert); without one the quotation gets a transaction of its own
 */
/**
 * A variation's customer and site come from its job (Phase L7). The job must still be open; a customer sent
 * that is not the job's is 400. The lead is left out: a variation never moves a lead.
 */
async function variationTarget(jobId, input, client) {
  const job = await client.job.findFirst({ where: { id: jobId, deletedAt: null }, select: { id: true, number: true, status: true, customerId: true, siteId: true } });
  if (!job) throw notFound('Job');
  if (['CANCELLED', 'VERIFIED'].includes(job.status)) {
    throw new AppError(422, 'VARIATION_JOB_CLOSED', `Job ${job.number} is ${job.status.toLowerCase()}: a variation cannot change it now.`);
  }
  if (input.customerId && input.customerId !== job.customerId) throw badRequest('That job belongs to another customer');
  return { kind: 'VARIATION', jobId, customerId: job.customerId, siteId: input.siteId ?? job.siteId, leadId: null };
}

export async function createQuotation(input, userId, client = prisma) {
  const { items = [], discount = 0, vatApplied = true, paymentStages, jobId, ...rest } = input;
  // A variation order (Phase L7): kind VARIATION against a job, numbered VO-, omissions allowed, no schedule.
  const variation = jobId ? await variationTarget(jobId, rest, client) : null;
  if (variation) Object.assign(rest, variation);
  const rows = await buildLines(items, { allowNegative: Boolean(variation) });
  const totals = await totalsFor(rows, { discount: toPaisa(discount), vatApplied });
  const defaults = await contractDefaults();
  if (!rest.contractType) rest.contractType = defaults.contractType;
  if (rest.terms === undefined) rest.terms = defaults.terms;
  // Submitting needs a validity date; a quotation built from a survey or a convert has none of its own.
  if (!rest.validUntil) rest.validUntil = await defaultValidUntil();

  const run = async (tx) => {
    const number = await nextNumber(tx, variation ? 'VO' : 'QT');
    const quotation = await tx.quotation.create({
      data: {
        ...rest,
        number,
        createdById: userId ?? null,
        ...totalsData(totals),
        ...costData(rows, totals),
        items: { create: rows },
        // A variation is billed with the job's running and final bills (L8), never on a schedule of its own.
        stages: { create: variation ? [] : stageRows(paymentStages ?? defaults.stages) },
      },
      include: INCLUDE,
    });
    await recordEvent('quotation.created', {
      model: 'Quotation',
      recordId: quotation.id,
      after: { number, status: quotation.status, total: quotation.total, customerId: quotation.customerId, leadId: quotation.leadId },
    }, tx);
    return present(quotation);
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
  const { items, discount, vatApplied, paymentStages, ...rest } = input;

  // Rows sent back with their ids keep their frozen recipe and cost (buildLines). A discount or VAT change
  // without rows re-totals the stored ones — the totals never go stale. Sent stages replace the schedule.
  const data = { ...rest };
  let rows = null;
  if (items || discount !== undefined || vatApplied !== undefined) {
    rows = items ? await buildLines(items, { existing: existing.items, allowNegative: existing.kind === 'VARIATION' }) : existing.items.map(storedRow);
    const totals = await totalsFor(rows, {
      discount: discount !== undefined ? toPaisa(discount) : existing.discount,
      vatApplied: vatApplied ?? existing.vatApplied,
    });
    Object.assign(data, totalsData(totals), costData(rows, totals));
  }
  return present(await prisma.$transaction(async (tx) => {
    if (rows) {
      await tx.quotationItem.deleteMany({ where: { quotationId: id } });
      data.items = { create: rows };
    }
    if (paymentStages && existing.kind !== 'VARIATION') {
      await tx.quotationPaymentStage.deleteMany({ where: { quotationId: id } });
      data.stages = { create: stageRows(paymentStages) };
    }
    return tx.quotation.update({ where: { id }, data, include: INCLUDE });
  }));
}

/** The contract fields a revision or a copy carries across (Phase L4). */
const contractCopy = (q) => ({
  contractType: q.contractType, estimatedDays: q.estimatedDays, exclusions: q.exclusions,
  showMeasurements: q.showMeasurements, summaryOnly: q.summaryOnly,
});

/** A stored row as a row to write again: its own columns, without its id or its quotation. */
const storedRow = ({ id: _id, quotationId: _q, ...row }) => ({ ...row, measurements: row.measurements ?? undefined, recipe: row.recipe ?? undefined });

/**
 * POST /admin/quotations/preview — the builder's rows through the same code as a save (`buildLines`,
 * `totalsFor`), nothing written. `quotationId` keeps that draft's frozen recipes for rows sent with ids.
 * Cost and margin are in the answer; the cost wall strips them for callers without costs:read.
 */
export async function previewQuotation({ quotationId, kind, items = [], paymentStages, discount = 0, discountPct, targetTotal, vatApplied = true }) {
  const saved = quotationId ? await findQuotation(quotationId) : null;
  const existing = saved?.items ?? [];
  const rows = await buildLines(items, { existing, allowNegative: (saved?.kind ?? kind) === 'VARIATION' });
  const totals = await totalsFor(rows, {
    discount: toPaisa(discount), discountPct, targetTotal: targetTotal != null ? toPaisa(targetTotal) : undefined, vatApplied,
  });
  const numbered = (await decorateBoq({ items: rows, ...totalsData(totals) })).items;
  return {
    items: numbered.map((row, index) => ({
      index, rowType: row.rowType, number: row.number, netQty: row.netQty ?? null, qty: row.qty, amount: row.amount,
      recipe: row.recipe ?? null, unitCost: row.unitCost ?? null, costAmount: row.costAmount ?? null,
    })),
    totals,
    cost: costSummary(rows, totals),
    paymentStages: paymentStages ? paymentSchedule(totals, paymentStages) : [],
    totalInWords: { en: amountInWords(totals.total, 'en'), ne: amountInWords(totals.total, 'ne') },
  };
}

/** GET /admin/quotations/:id/takeoff — materials in buying units with stock, labour days by trade. */
export async function quotationTakeoff(id) {
  const q = await findQuotation(id);
  return takeoffFor(q.items);
}

/**
 * POST /admin/quotations/:id/reprice — a DRAFT's library rows re-priced from the rate library as it is
 * now: the rate and the frozen recipe and cost. `apply: false` previews. Any other status is 422.
 */
export async function repriceQuotation(id, { apply }) {
  const q = await findQuotation(id);
  if (q.status !== 'DRAFT') {
    throw new AppError(422, 'QUOTATION_NOT_DRAFT', 'Only a draft is repriced. Revise it to price a new version.');
  }
  const numbered = (await decorateBoq(q)).items;
  const libraryRows = numbered.filter((row) => row.rowType === 'ITEM' && row.rateCardItemId);
  const library = await recipeSnapshots([...new Set(libraryRows.map((row) => row.rateCardItemId))]);
  const changes = libraryRows
    .map((row) => ({ row, now: library.get(row.rateCardItemId) }))
    .filter(({ row, now }) => now && (now.rate !== row.rate || now.unitCost !== row.unitCost
      || JSON.stringify(now.snapshot?.components ?? null) !== JSON.stringify(row.recipe?.components ?? null)));
  const preview = changes.map(({ row, now }) => ({
    id: row.id, number: row.number, description: row.description,
    rate: row.rate, newRate: now.rate, unitCost: row.unitCost, newUnitCost: now.unitCost,
  }));
  if (!apply || !changes.length) return { rows: preview, applied: 0 };

  const changed = new Map(changes.map(({ row, now }) => [row.id, now]));
  const rows = q.items.map((row) => {
    const now = changed.get(row.id);
    const out = storedRow(row);
    if (!now) return out;
    return {
      ...out, rate: now.rate, recipe: now.snapshot ?? undefined, unitCost: now.unitCost,
      costAmount: now.unitCost == null ? null : lineAmount(row.qty, now.unitCost),
    };
  });
  const totals = await totalsFor(rows, { discount: q.discount, vatApplied: q.vatApplied });
  await prisma.$transaction(async (tx) => {
    await tx.quotationItem.deleteMany({ where: { quotationId: id } });
    await tx.quotation.update({ where: { id }, data: { ...totalsData(totals), ...costData(rows, totals), items: { create: rows } } });
  });
  return { rows: preview, applied: preview.length, quotation: await getQuotation(id) };
}

/**
 * POST /admin/quotations/:id/copy — a new DRAFT (its own number, version 1) with this quotation's rows as
 * they are — recipes and costs frozen as they were — its terms, discount and VAT choice, for the same
 * customer or another. Not a revision: the source is untouched.
 */
export async function copyQuotation(id, { customerId, siteId, leadId } = {}, userId) {
  const source = await findQuotation(id);
  const rows = source.items.map(storedRow);
  const totals = await totalsFor(rows, { discount: source.discount, vatApplied: source.vatApplied });
  const created = await prisma.$transaction(async (tx) => {
    const number = await nextNumber(tx, 'QT');
    const copy = await tx.quotation.create({
      data: {
        number,
        customerId: customerId ?? source.customerId,
        siteId: customerId && customerId !== source.customerId ? (siteId ?? null) : (siteId ?? source.siteId),
        leadId: leadId ?? (customerId && customerId !== source.customerId ? null : source.leadId),
        validUntil: await defaultValidUntil(),
        terms: source.terms,
        internalNote: `Copied from ${label(source)}`,
        createdById: userId ?? null,
        ...contractCopy(source),
        ...totalsData(totals),
        ...costData(rows, totals),
        items: { create: rows },
        stages: { create: stageRows(source.stages) },
      },
    });
    await recordEvent('quotation.created', {
      model: 'Quotation', recordId: copy.id,
      after: { number, status: copy.status, total: copy.total, customerId: copy.customerId, leadId: copy.leadId },
      meta: { copiedFrom: source.id },
    }, tx);
    return copy;
  });
  return getQuotation(created.id);
}

// ── internal approval

/**
 * DRAFT → PENDING_APPROVAL, or on to OFFICE_APPROVED in the same transaction when the
 * total is below `quotation.autoApproveBelow` (paisa; 0 = never). That second step is
 * the system's decision, and is recorded as such.
 */
export async function submitQuotation(id, userId) {
  const q = await findQuotation(id);
  assertMove(q.status, 'PENDING_APPROVAL');
  const priced = await prisma.quotationItem.count({ where: { quotationId: id, rowType: 'ITEM', isOptional: false } });
  if (!priced) throw new AppError(422, 'QUOTATION_INCOMPLETE', 'Add at least one priced line (not optional) before submitting.');
  const customer = await prisma.customer.findFirst({ where: { id: q.customerId, deletedAt: null }, select: { id: true } });
  if (!customer) throw new AppError(422, 'QUOTATION_INCOMPLETE', 'This quotation has no active customer.');
  const now = new Date();
  if (!q.validUntil || q.validUntil <= now) {
    throw new AppError(422, 'QUOTATION_INCOMPLETE', 'Set a valid-until date in the future before submitting.');
  }

  const threshold = Math.max(0, Math.round(Number(await getSetting('quotation.autoApproveBelow', 0)) || 0));
  // A small quotation approves itself — never on a low or unknown margin (Phase L4): a person looks at those.
  // A variation that gives money back (a net omission, Phase L7) is a manager's decision too.
  const auto = threshold > 0 && q.total > 0 && q.total < threshold && !(await marginCheck(q)).low;

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
/**
 * The margin gate (L-D4, Phase L4): low when the margin on the taxable amount is below
 * `quotation.minMarginPct`, or when any totalled row's cost is unknown — an unknown cost is never taken
 * as a healthy margin.
 */
async function marginCheck(q) {
  const minMarginPct = Number(await getSetting('quotation.minMarginPct', 15));
  // A variation that only omits work (Phase L7) earns nothing to guard: no margin gate.
  if (q.subtotal - q.discount <= 0) return { low: false, marginPct: null, minMarginPct, costComplete: q.costComplete };
  const m = q.costComplete ? margin(q.subtotal - q.discount, q.costTotal) : null;
  const low = !q.costComplete || m?.pct == null || m.pct < minMarginPct;
  return { low, marginPct: m?.pct ?? null, minMarginPct, costComplete: q.costComplete };
}

export async function approveQuotation(id, { note, acknowledgeLowMargin = false } = {}, userId) {
  const q = await findQuotation(id);
  assertMove(q.status, 'OFFICE_APPROVED');
  const makerChecker = (await getSetting('quotation.makerChecker', true)) !== false;
  if (makerChecker && q.createdById && q.createdById === userId) {
    throw new AppError(403, 'SELF_APPROVAL', 'You prepared this quotation, so another approver must approve it.');
  }
  const check = await marginCheck(q);
  if (check.low && !acknowledgeLowMargin) {
    const { low: _low, ...details } = check;
    throw new AppError(422, 'LOW_MARGIN', check.costComplete
      ? `The margin is ${check.marginPct}% — below the ${check.minMarginPct}% minimum. Approve only if you mean to.`
      : 'Some rows have no known cost, so the margin is unknown. Approve only if you mean to.', details);
  }
  const meta = {
    ...(note ? { note } : {}),
    ...(check.low ? { lowMargin: { marginPct: check.marginPct, minMarginPct: check.minMarginPct, costComplete: check.costComplete, acknowledged: true } } : {}),
  };
  await prisma.$transaction(async (tx) => {
    await moveStatus(tx, q, 'OFFICE_APPROVED', {
      approvedById: userId, approvedAt: new Date(), approvalNote: note ?? null, autoApproved: false,
    });
    await recordEvent('quotation.office_approved', {
      model: 'Quotation', recordId: id, before: { status: q.status }, after: { status: 'OFFICE_APPROVED' },
      ...(Object.keys(meta).length ? { meta } : {}),
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

/**
 * The customer now has a quotation, so the lead is QUOTED — forward only, through CONTACTED from
 * NEW, never out of WON or LOST (those get a note) — and its owner follows up in
 * `pipeline.quoteUnansweredDays`. A draft never moves the lead (Phase L1).
 */
async function leadQuoted(tx, q, actorId) {
  if (!q.leadId) return;
  const lead = await tx.lead.findFirst({ where: { id: q.leadId, deletedAt: null }, select: { id: true, status: true } });
  if (!lead) return;
  const note = `${label(q)} sent`;
  if (['WON', 'LOST'].includes(lead.status)) {
    await tx.leadActivity.create({ data: { leadId: lead.id, userId: actorId ?? null, type: 'note', summary: note } });
    return;
  }
  if (lead.status === 'NEW') await transitionLead(tx, lead.id, 'CONTACTED', { actorId, note });
  await transitionLead(tx, lead.id, 'QUOTED', { actorId, note });
  const days = Number(await getSetting('pipeline.quoteUnansweredDays', 3));
  await bookNextAction(tx, lead.id, { at: addDays(new Date(), days), type: 'FOLLOW_UP', note: `Follow up on ${label(q)}` });
}

/**
 * After a decline or an expiry: ask the salesperson and the author whether the lead is lost. It is
 * never marked lost automatically — they may revise, or the customer may still say yes.
 */
async function promptMarkLost(q, why, category) {
  if (!q.leadId) return;
  const lead = await prisma.lead.findFirst({ where: { id: q.leadId, deletedAt: null, status: { notIn: ['WON', 'LOST'] } }, select: { id: true } });
  if (!lead) return;
  await notifyUsers(salesRecipients(q, false), {
    type: 'lead_mark_lost',
    title: `${why} — mark the lead lost?`,
    body: `Revise ${label(q)}, or record why the lead was lost.`,
    link: adminLeadMarkLostPath(lead.id, category),
  });
}

/** OFFICE_APPROVED → SENT, with the customer's link by SMS (and email when on file). */
export async function sendQuotation(id, userId) {
  const q = await findQuotation(id);
  assertMove(q.status, 'SENT');
  if (q.validUntil && q.validUntil < new Date()) {
    throw new AppError(422, 'QUOTATION_EXPIRED', 'Its valid-until date has passed. Pull it back, set a new date and submit it again.');
  }

  const token = q.publicToken ?? publicToken();
  await prisma.$transaction(async (tx) => {
    await moveStatus(tx, q, 'SENT', { sentAt: new Date(), publicToken: token });
    await recordEvent('quotation.sent', { model: 'Quotation', recordId: id, before: { status: q.status }, after: { status: 'SENT' } }, tx);
    await leadQuoted(tx, q, userId);
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
    const number = await nextNumber(tx, source.kind === 'VARIATION' ? 'VO' : 'QT');
    const copy = await tx.quotation.create({
      data: {
        number,
        version: source.version + 1,
        parentId: source.id,
        kind: source.kind,
        jobId: source.jobId,
        customerId: source.customerId,
        siteId: source.siteId,
        leadId: source.leadId,
        validUntil: source.validUntil,
        subtotal: source.subtotal, discount: source.discount, vatApplied: source.vatApplied,
        vatRate: source.vatRate, vatAmount: source.vatAmount, total: source.total,
        terms: source.terms, internalNote: source.internalNote,
        requestedChanges: source.status === 'CHANGES_REQUESTED' ? source.decisionNote : null,
        createdById: userId ?? null,
        ...contractCopy(source),
        costTotal: source.costTotal, costComplete: source.costComplete,
        items: {
          // Rows, measurements and frozen recipes as they are (Phase L3).
          create: source.items.map(storedRow),
        },
        // The schedule and the contract carry across (Phase L4).
        stages: { create: stageRows(source.stages) },
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
/**
 * The customer's BOQ: rows and section subtotals — never a cost or a recipe. Measurements come along when the
 * quotation shows them (the annex); a section summary sends the SECTION rows alone.
 */
async function publicBoq(q) {
  const { items, boq } = await decorateBoq(q);
  const shown = q.summaryOnly ? items.filter((i) => i.rowType === 'SECTION') : items;
  return {
    items: shown.map((i) => ({
      id: i.id, rowType: i.rowType, number: i.number, description: i.description, spec: i.spec, unit: i.unit,
      qty: i.qty, rate: i.rate, amount: i.amount, isOptional: i.isOptional, isProvisional: i.isProvisional, sortOrder: i.sortOrder,
      ...(q.showMeasurements && i.measurements ? { measurements: i.measurements } : {}),
    })),
    boq: { sections: boq.sections, optionalTotal: boq.optionalTotal },
  };
}

async function publicView(q) {
  return {
    number: q.number,
    version: q.version,
    // A change to a running job (Phase L7): the page says so.
    kind: q.kind,
    job: q.kind === 'VARIATION' && q.job ? { number: q.job.number } : null,
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
    // An allowlist: never a cost or a recipe (Phases L3, L4).
    ...(await publicBoq(q)),
    contractType: q.contractType,
    estimatedDays: q.estimatedDays,
    exclusions: q.exclusions,
    summaryOnly: q.summaryOnly,
    ...(({ paymentStages, totalInWords, dates, letterhead: head }) => ({
      paymentStages: paymentStages.map(({ label: l, basisPoints, trigger, taxable, vat, total }) => ({ label: l, basisPoints, trigger, taxable, vat, total })),
      totalInWords,
      dates: { createdAtBs: dates.createdAtBs, validUntilBs: dates.validUntilBs },
      letterhead: head,
    }))(await documentFields(q)),
    replaced: await replacementFor(q),
    actions: q.status === 'SENT' ? [...QUOTATION_DECISIONS] : [],
    // Once accepted (Phase L6): the advance to pay, and the link to its invoice.
    advance: q.kind !== 'VARIATION' && ['APPROVED', 'CONVERTED'].includes(q.status) ? await advanceFor(q.id) : null,
  };
}

const PUBLIC_INCLUDE = {
  customer: { select: { name: true } },
  job: { select: { number: true } },
  site: { select: { label: true, address: true } },
  items: { orderBy: { sortOrder: 'asc' } },
  stages: { orderBy: { sortOrder: 'asc' } },
};

/** Customer-facing view resolved by public token — no auth. */
export async function getByPublicToken(token) {
  const q = await prisma.quotation.findFirst({ where: { publicToken: token, deletedAt: null }, include: PUBLIC_INCLUDE });
  if (!q) throw notFound('Quotation');
  // The customer opened it (Phase L4) — the send panel's "Opened 2×". A page view is not a change to audit,
  // so it is one raw statement, outside the audit extension. The column is a timestamp without a zone that
  // holds UTC, and the database session may run in Kathmandu time — NOW() or a bound Date would both land as
  // Kathmandu wall-clock time — so the instant is converted to UTC in the statement.
  await prisma.$executeRaw`UPDATE "Quotation" SET "viewCount" = "viewCount" + 1, "firstViewedAt" = COALESCE("firstViewedAt", NOW() AT TIME ZONE 'UTC') WHERE "id" = ${q.id}`;
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
export async function winLeadOnAcceptance(tx, q, summary) {
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
export async function lineageIds(q) {
  const ids = [q.id];
  for (let cur = q, i = 0; cur.parentId && i < 50; i += 1) {
    cur = await prisma.quotation.findUnique({ where: { id: cur.parentId }, select: { id: true, parentId: true } });
    if (!cur) break;
    ids.push(cur.id);
  }
  return ids;
}

/** The salesperson and the quotation's author — the people who answer the customer. */
const salesRecipients = (q, email = true) => [
  { userId: q.lead?.assignedToId, email },
  { userId: q.createdById, email },
];

/**
 * Customer accepts (D3). One transaction — the hand-off (Phase L6, `handoff.service.js`): SENT → APPROVED, the
 * lead WON, the job with its BOQ lines and requirements, the ADVANCE invoice for the ON_ACCEPT stage, and
 * APPROVED → CONVERTED. Then, once each: the customer (SMS + email in their language, and the advance they are
 * asked for), the salesperson and the author, every dispatcher (linking the job), and the manager who approved
 * it (not when the system did).
 * @param {string} id
 * @param {{ note?: string, ip?: string|null, userAgent?: string|null }} answer
 */
export async function acceptQuotation(id, answer = {}) {
  const q = await openForAnswer(id);
  const variation = q.kind === 'VARIATION';
  // The library, the take-off and the service are read before the transaction opens.
  const plan = variation ? await variationPlan(q) : await handOffPlan(q);
  const summary = `Customer accepted ${label(q)} · ${npr(q.total)}`;

  const { job, advance, added } = await prisma.$transaction(async (tx) => {
    await claimAnswer(tx, q, 'APPROVED', answer);
    await recordEvent('quotation.customer_approved', {
      model: 'Quotation', recordId: q.id, before: { status: 'SENT' }, after: { status: 'APPROVED' },
      ...(answer.note ? { meta: { note: answer.note } } : {}),
    }, tx);
    // A variation joins its job (Phase L7): no new job, no lead, no advance.
    if (variation) return applyVariation(tx, q, plan);
    if (q.leadId) await winLeadOnAcceptance(tx, q, summary);
    return handOff(tx, q, plan);
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

  if (advance) await announceAdvance(advance, q);
  if (variation) {
    await announceVariation(q, job, added);
    await notifyUsers([...salesRecipients(q), ...(q.autoApproved ? [] : [{ userId: q.approvedById }])], {
      type: 'quotation_accepted',
      title: `${q.customer.name} accepted variation ${label(q)}`,
      body: `${npr(q.total)} · ${added} line(s) added to job ${job.number}`,
      link: adminQuotationPath(q.id),
    });
    const row = await prisma.quotation.findUnique({ where: { id: q.id }, include: PUBLIC_INCLUDE });
    return { ...(await publicView(row)), job: { id: job.id, number: job.number } };
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
    body: advance
      ? `${npr(q.total)} · job ${job.number} waits for the advance (${npr(advance.total)}, invoice ${advance.number})`
      : `${npr(q.total)} · job ${job.number} is waiting to be scheduled`,
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
  const { note, category } = answer;
  await prisma.$transaction(async (tx) => {
    await claimAnswer(tx, q, 'REJECTED', answer);
    // Why they said no (Phase L4): a lost-lead category the "Mark lost?" prompt starts from.
    if (category) await tx.quotation.update({ where: { id: q.id }, data: { declineCategory: category } });
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
  await promptMarkLost(q, `${q.customer.name} declined ${label(q)}`, category);

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
export async function decideByToken(token, { decision, note, category }, client = {}) {
  const q = await prisma.quotation.findFirst({ where: { publicToken: token, deletedAt: null }, select: { id: true } });
  if (!q) throw notFound('Quotation');
  return ANSWERS[decision](q.id, {
    note, ip: client.ip ?? null, userAgent: client.userAgent ?? null, ...(decision === 'reject' && category ? { category } : {}),
  });
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
