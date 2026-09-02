import { prisma } from '../lib/prisma.js';
import { parseListQuery, meta, dateRange } from '../utils/pagination.js';

export async function listAuditLogs(query) {
  const { page, limit, skip, take, orderBy } = parseListQuery(query);
  const where = {
    ...(query.model ? { model: query.model } : {}),
    ...(query.recordId ? { recordId: query.recordId } : {}),
    ...(query.actorId ? { actorId: query.actorId } : {}),
    ...(query.action ? { action: query.action } : {}),
    ...(dateRange(query.from, query.to) ? { createdAt: dateRange(query.from, query.to) } : {}),
  };
  const [items, total] = await Promise.all([
    prisma.auditLog.findMany({
      where, orderBy, skip, take,
      include: { actor: { select: { id: true, name: true, email: true, role: true } } },
    }),
    prisma.auditLog.count({ where }),
  ]);
  return { items, meta: meta({ page, limit, total }) };
}

/** Explicit audit entry for things Prisma middleware cannot see (exports, logins). */
export async function recordAudit({ actorId, action, model, recordId, changes, ip }) {
  return prisma.auditLog.create({
    data: { actorId: actorId ?? null, action, model, recordId: recordId ?? null, changes: changes ?? null, ip: ip ?? null },
  });
}
