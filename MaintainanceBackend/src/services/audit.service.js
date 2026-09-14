import { prisma, auditAttribution } from '../lib/prisma.js';
import { snapshot } from '../lib/auditDiff.js';
import { AUDIT_EVENTS } from '../shared/enums.js';
import { parseListQuery, meta, dateRange } from '../utils/pagination.js';

const EVENT_NAMES = new Set(Object.values(AUDIT_EVENTS));

/** @param {import('../shared/schemas/audit.js').auditLogQuery} query  validated */
export async function listAuditLogs(query) {
  const { page, limit, skip, take, orderBy, q } = parseListQuery(query);
  const created = dateRange(query.from, query.to);
  const where = {
    ...(query.event ? { event: query.event } : {}),
    ...(query.actorType ? { actorType: query.actorType } : {}),
    ...(query.requestId ? { requestId: query.requestId } : {}),
    ...(query.model ? { model: query.model } : {}),
    ...(query.recordId ? { recordId: query.recordId } : {}),
    ...(query.actorId ? { actorId: query.actorId } : {}),
    ...(query.action ? { action: query.action } : {}),
    ...(created ? { createdAt: created } : {}),
    ...(q ? {
      OR: [
        { event: { contains: q, mode: 'insensitive' } },
        { model: { contains: q, mode: 'insensitive' } },
        { action: { contains: q, mode: 'insensitive' } },
        { recordId: q },
        { requestId: q },
      ],
    } : {}),
  };
  const [items, total] = await Promise.all([
    prisma.auditLog.findMany({
      where, orderBy, skip, take,
      include: { actor: { select: { id: true, name: true, role: true } } },
    }),
    prisma.auditLog.count({ where }),
  ]);
  return { items, meta: meta({ page, limit, total }) };
}

/**
 * Records a named business moment. The automatic model rows say *what* changed;
 * this says *what happened* — "the customer approved", "the account locked".
 *
 * Pass the transaction client of the change it describes, so the event commits
 * and rolls back with it. Actor, request id, ip and user agent come from the
 * request context; `actorId` overrides the actor where the context cannot know
 * it yet (a login).
 *
 * `meta` lands in the `changes` column: extra detail that is neither a before
 * nor an after (export filters, merged ids).
 *
 * @param {string} event  one of AUDIT_EVENTS
 * @param {{ model: string, recordId?: string|null, before?: object|null, after?: object|null,
 *           meta?: object|null, actorId?: string|null }} detail
 * @param {import('@prisma/client').Prisma.TransactionClient} [tx]
 */
export async function recordEvent(event, { model, recordId = null, before, after, meta: extra, actorId } = {}, tx = prisma) {
  if (!EVENT_NAMES.has(event)) throw new Error(`Unknown audit event "${event}"`);
  const who = auditAttribution();
  if (actorId !== undefined) {
    who.actorId = actorId;
    if (actorId) who.actorType = 'user';
  }
  const b = snapshot(model, before);
  const a = snapshot(model, after);
  const m = snapshot(null, extra);
  return tx.auditLog.create({
    data: {
      ...who,
      event,
      action: event.slice(event.indexOf('.') + 1),
      model,
      recordId,
      ...(b ? { before: b } : {}),
      ...(a ? { after: a } : {}),
      ...(m && Object.keys(m).length ? { changes: m } : {}),
    },
  });
}
