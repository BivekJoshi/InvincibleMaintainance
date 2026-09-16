import { prisma } from '../lib/prisma.js';
import { notFound } from '../utils/AppError.js';
import { meta, parseListQuery } from '../utils/pagination.js';

/**
 * A record's own history, for staff who may read the record but not the whole audit
 * log (GET /admin/audit-logs is ADMIN's).
 *
 * Each scope says which AuditLog rows belong to a record: its own model rows and
 * events, and the rows of child records that are part of it (a lead's notes, a
 * customer's sites). A child row is found by the parent id in its before/after
 * snapshot, so a child that moved (a merged lead's notes) shows on both sides.
 *
 * Phase G adds a scope per detail page; the route and the component stay the same.
 */
const byParent = (model, field, id) => [
  { model, after: { path: [field], equals: id } },
  { model, before: { path: [field], equals: id } },
];

export const HISTORY_SCOPES = {
  Lead: {
    load: (id) => prisma.lead.findUnique({ where: { id }, select: { id: true, deletedAt: true } }),
    where: (id) => [{ model: 'Lead', recordId: id }, ...byParent('LeadNote', 'leadId', id)],
  },
  Customer: {
    load: (id) => prisma.customer.findUnique({ where: { id }, select: { id: true, deletedAt: true } }),
    where: (id) => [{ model: 'Customer', recordId: id }, ...byParent('CustomerSite', 'customerId', id)],
  },
};

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
 * @param {keyof typeof HISTORY_SCOPES} model
 * @param {string} id
 * @param {{ page?: number, limit?: number }} query
 */
export async function recordHistory(model, id, query = {}) {
  const scope = HISTORY_SCOPES[model];
  if (!scope) throw new Error(`No history scope for ${model}`);
  // A deleted record's history stays readable: it is the record of why it went.
  if (!(await scope.load(id))) throw notFound(model);

  const { page, limit, skip, take } = parseListQuery(query);
  const where = { OR: scope.where(id) };
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
