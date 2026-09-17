import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { notFound } from '../utils/AppError.js';
import { meta, parseListQuery } from '../utils/pagination.js';

/**
 * A record's own history, for staff who may read the record but not the whole audit
 * log (GET /admin/audit-logs is ADMIN's).
 *
 * Every model has a history: its own rows and events (`model` + `recordId`). A scope in
 * `HISTORY_SCOPES` adds the rows of child records that are part of it (a lead's notes, a
 * job's assignments). A child row is found by the parent id in its before/after snapshot,
 * so a child that moved (a merged lead's notes) shows on both sides. Any record that has
 * Nepali copy (`Translation`, keyed by the Prisma client name) also shows those rows.
 *
 * The route side is `routes/admin/historyRoute.js`; the CRUD factory mounts one for every
 * CMS resource.
 */
const byParent = (model, field, id, paths = ['after', 'before']) => paths.map((column) => (
  { model, [column]: { path: [field], equals: id } }
));

const children = (id, list) => list.flatMap(([model, field]) => byParent(model, field, id));

export const HISTORY_SCOPES = {
  Lead: { where: (id) => children(id, [['LeadNote', 'leadId']]) },
  Customer: { where: (id) => children(id, [['CustomerSite', 'customerId']]) },
  // The approval and customer-response trail of one version; its lines' rows come with it.
  Quotation: { where: (id) => children(id, [['QuotationItem', 'quotationId']]) },
  Job: {
    where: (id) => children(id, [
      ['JobAssignment', 'jobId'], ['JobTask', 'jobId'], ['JobPhoto', 'jobId'], ['TimeLog', 'jobId'], ['JobMaterial', 'jobId'],
    ]),
  },
  // A voided payment's own row changes only its void columns, so its event carries the invoice in `changes`.
  Invoice: {
    where: (id) => [
      ...children(id, [['InvoiceItem', 'invoiceId'], ['Payment', 'invoiceId']]),
      ...byParent('Payment', 'invoiceId', id, ['changes']),
    ],
  },
  Project: { where: (id) => children(id, [['ProjectImage', 'projectId']]) },
};

const MODELS = new Map(Prisma.dmmf.datamodel.models.map((m) => [m.name, m]));
/** 'RateCardItem' → 'rateCardItem', the client delegate and the name Translation rows carry. */
const delegateOf = (model) => model.charAt(0).toLowerCase() + model.slice(1);

/** A record's Nepali copy rows: the live ones by their own id, a removed one by its snapshot. */
async function translationRows(model, id) {
  const name = delegateOf(model);
  const live = await prisma.translation.findMany({ where: { model: name, recordId: id }, select: { id: true } });
  return [
    ...(live.length ? [{ model: 'Translation', recordId: { in: live.map((t) => t.id) } }] : []),
    { model: 'Translation', AND: [{ before: { path: ['model'], equals: name } }, { before: { path: ['recordId'], equals: id } }] },
  ];
}

/**
 * What a reader of a record's history sees of an audit row: no ip or user agent —
 * those are for the audit log — and the actor's name and role.
 */
const toEntry = (row) => ({
  id: row.id,
  event: row.event,
  action: row.action,
  model: row.model,
  recordId: row.recordId,
  actorType: row.actorType,
  actor: row.actor,
  requestId: row.requestId,
  before: row.before,
  after: row.after,
  changes: row.changes,
  createdAt: row.createdAt,
});

/**
 * @param {string} model  a Prisma model name ('Lead', 'Faq', 'RateCardItem')
 * @param {string} id
 * @param {{ page?: number, limit?: number }} query
 */
export async function recordHistory(model, id, query = {}) {
  if (!MODELS.has(model)) throw new Error(`No model ${model}`);
  // A deleted record's history stays readable: it is the record of why it went. A purged
  // one has no row, and answers 404 like an id that never existed.
  const exists = await prisma[delegateOf(model)].findUnique({ where: { id }, select: { id: true } });
  if (!exists) throw notFound(model);

  const { page, limit, skip, take } = parseListQuery(query);
  const where = {
    OR: [
      { model, recordId: id },
      ...(HISTORY_SCOPES[model]?.where(id) ?? []),
      ...(await translationRows(model, id)),
    ],
  };
  const [rows, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      skip,
      take,
      include: { actor: { select: { id: true, name: true, role: true } } },
    }),
    prisma.auditLog.count({ where }),
  ]);
  return { items: rows.map(toEntry), meta: meta({ page, limit, total }) };
}
