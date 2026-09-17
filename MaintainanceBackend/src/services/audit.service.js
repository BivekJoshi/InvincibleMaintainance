import { prisma, auditAttribution } from '../lib/prisma.js';
import { snapshot } from '../lib/auditDiff.js';
import { AUDIT_EVENTS } from '../shared/enums.js';
import { parseListQuery, meta, dateRange } from '../utils/pagination.js';

const EVENT_NAMES = new Set(Object.values(AUDIT_EVENTS));

/** `quotation.sent` is that event; `quotation.*` is every event of the prefix. */
const eventWhere = (event) => {
  if (!event) return {};
  return event.endsWith('.*') ? { event: { startsWith: event.slice(0, -1) } } : { event };
};

/** @param {import('../shared/schemas/audit.js').auditLogQuery} query  validated */
export async function listAuditLogs(query) {
  const { page, limit, skip, take, orderBy, q } = parseListQuery(query);
  const created = dateRange(query.from, query.to);
  const where = {
    ...eventWhere(query.event),
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

/** Every model the audit log has rows for, sorted — the audit screen's model filter. */
export async function listAuditModels() {
  const rows = await prisma.auditLog.findMany({ distinct: ['model'], select: { model: true }, orderBy: { model: 'asc' } });
  return rows.map((r) => r.model);
}

// ── login activity

const USER_CARD = { id: true, name: true, email: true, role: true, isActive: true };

/**
 * The sign-in trail (`auth.*` events), each row with the account it concerns. A failed
 * sign-in for an address with no account has no user; `email` is what was typed.
 *
 * @param {object} query  validated by `loginActivityQuery`
 */
export async function listLoginActivity(query) {
  const { page, limit, skip, take, q } = parseListQuery(query);
  const created = dateRange(query.from, query.to);
  let matching = [];
  if (q) {
    matching = (await prisma.user.findMany({
      where: { OR: [{ name: { contains: q, mode: 'insensitive' } }, { email: { contains: q, mode: 'insensitive' } }] },
      select: { id: true },
      take: 200,
    })).map((u) => u.id);
  }
  const where = {
    event: query.event ? query.event : { startsWith: 'auth.' },
    ...(query.userId ? { recordId: query.userId } : {}),
    ...(query.ip ? { ip: query.ip } : {}),
    ...(created ? { createdAt: created } : {}),
    ...(q ? {
      OR: [
        { changes: { path: ['email'], string_contains: q.toLowerCase() } },
        ...(matching.length ? [{ recordId: { in: matching } }] : []),
      ],
    } : {}),
  };
  const [rows, total] = await Promise.all([
    prisma.auditLog.findMany({ where, orderBy: [{ createdAt: query.sort === 'createdAt' ? 'asc' : 'desc' }, { id: 'desc' }], skip, take }),
    prisma.auditLog.count({ where }),
  ]);
  const ids = [...new Set(rows.map((r) => r.recordId).filter(Boolean))];
  const users = new Map((await prisma.user.findMany({ where: { id: { in: ids } }, select: USER_CARD })).map((u) => [u.id, u]));
  const items = rows.map((r) => {
    const user = users.get(r.recordId) ?? null;
    return {
      id: r.id,
      event: r.event,
      createdAt: r.createdAt,
      user,
      email: user?.email ?? r.changes?.email ?? null,
      reason: r.changes?.reason ?? null,
      attempt: r.changes?.attempt ?? null,
      actorType: r.actorType,
      actorId: r.actorId,
      ip: r.ip,
      userAgent: r.userAgent,
      requestId: r.requestId,
      before: r.before,
      after: r.after,
      changes: r.changes,
    };
  });
  return { items, meta: meta({ page, limit, total }) };
}

/**
 * Per account: when it last signed in, how many sign-ins failed in the last 24 hours, and
 * whether it is locked now. `attention` keeps the accounts with either.
 *
 * @param {object} query  validated by `loginSummaryQuery`
 */
export async function loginSummary(query) {
  const { page, limit, skip, take, q } = parseListQuery(query);
  const now = new Date();
  const since = new Date(now.getTime() - 24 * 3600_000);
  const failures = await prisma.auditLog.groupBy({
    by: ['recordId'],
    where: { event: 'auth.login_failed', createdAt: { gte: since }, recordId: { not: null } },
    _count: { _all: true },
  });
  const failed = new Map(failures.map((f) => [f.recordId, f._count._all]));
  const where = {
    deletedAt: null,
    ...(query.attention ? { OR: [{ lockedUntil: { gt: now } }, { id: { in: [...failed.keys()] } }] } : {}),
    ...(q ? { AND: [{ OR: [{ name: { contains: q, mode: 'insensitive' } }, { email: { contains: q, mode: 'insensitive' } }] }] } : {}),
  };
  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where, skip, take,
      orderBy: [{ lockedUntil: { sort: 'desc', nulls: 'last' } }, { name: 'asc' }, { id: 'asc' }],
      select: { ...USER_CARD, lastLoginAt: true, lockedUntil: true },
    }),
    prisma.user.count({ where }),
  ]);
  const items = users.map(({ lastLoginAt, lockedUntil, ...user }) => {
    const locked = Boolean(lockedUntil && lockedUntil > now);
    return {
      user,
      lastLoginAt,
      failures24h: failed.get(user.id) ?? 0,
      lockedUntil: locked ? lockedUntil : null,
      isLocked: locked,
    };
  });
  return { items, meta: meta({ page, limit, total }) };
}

/**
 * Records a named business moment. The automatic model rows say *what* changed;
 * this says *what happened* — "the customer approved", "the account locked".
 *
 * Pass the transaction client of the change it describes, so the event commits
 * and rolls back with it. Actor, request id, ip and user agent come from the
 * request context; `actorId` overrides the actor where the context cannot know
 * it yet (a login), and `actorType: 'system'` marks a decision the system took
 * inside someone's request (an auto-approval) — it clears the actor.
 *
 * `meta` lands in the `changes` column: extra detail that is neither a before
 * nor an after (export filters, merged ids).
 *
 * @param {string} event  one of AUDIT_EVENTS
 * @param {{ model: string, recordId?: string|null, before?: object|null, after?: object|null,
 *           meta?: object|null, actorId?: string|null, actorType?: 'system' }} detail
 * @param {import('@prisma/client').Prisma.TransactionClient} [tx]
 */
export async function recordEvent(event, { model, recordId = null, before, after, meta: extra, actorId, actorType } = {}, tx = prisma) {
  if (!EVENT_NAMES.has(event)) throw new Error(`Unknown audit event "${event}"`);
  const who = auditAttribution();
  if (actorId !== undefined) {
    who.actorId = actorId;
    if (actorId) who.actorType = 'user';
  }
  if (actorType === 'system') {
    who.actorId = null;
    who.actorType = 'system';
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
