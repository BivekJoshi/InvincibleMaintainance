import crypto from 'node:crypto';
import { prisma } from '../lib/prisma.js';
import { notFound, badRequest, AppError } from '../utils/AppError.js';
import { parseListQuery, meta, searchOr } from '../utils/pagination.js';
import { FIELD_ROLES } from '../shared/enums.js';
import { hashPassword, issuePasswordLink, logoutAll } from './auth.service.js';
import { recordEvent } from './audit.service.js';

/**
 * Staff accounts. Admins manage who can sign in and as what — never a password: a new
 * account gets an email to choose one, and a forgotten one gets the normal reset link.
 */

const SELECT = {
  id: true, name: true, email: true, phone: true, role: true, isActive: true,
  lastLoginAt: true, failedLogins: true, lockedUntil: true, createdAt: true,
  technician: { select: { id: true, employeeCode: true, deletedAt: true } },
};

/** A user as the admin screens see it: a lock that has run out is no lock. */
function toUser(row, now = new Date()) {
  const { technician, lockedUntil, ...rest } = row;
  const locked = Boolean(lockedUntil && lockedUntil > now);
  const profile = technician && !technician.deletedAt ? { id: technician.id, employeeCode: technician.employeeCode } : null;
  return {
    ...rest,
    lockedUntil: locked ? lockedUntil : null,
    isLocked: locked,
    technicianId: profile?.id ?? null,
    technician: profile,
  };
}

/** @param {object} query  validated by `userListQuery` */
export async function listUsers(query) {
  const { page, limit, skip, take, orderBy, q } = parseListQuery(query, { defaultSort: 'name' });
  const where = {
    deletedAt: null,
    ...(query.role ? { role: query.role } : {}),
    ...(query.isActive ? { isActive: query.isActive === 'true' } : {}),
    ...(q ? { OR: searchOr(q, ['name', 'email', 'phone']) } : {}),
  };
  const [items, total] = await Promise.all([
    prisma.user.findMany({ where, orderBy: [orderBy, { id: 'asc' }], skip, take, select: SELECT }),
    prisma.user.count({ where }),
  ]);
  const now = new Date();
  return { items: items.map((u) => toUser(u, now)), meta: meta({ page, limit, total }) };
}

async function findUser(id, select = SELECT) {
  const user = await prisma.user.findFirst({ where: { id, deletedAt: null }, select });
  if (!user) throw notFound('User');
  return user;
}

export const getUser = async (id) => toUser(await findUser(id));

/**
 * A technician or surveyor works off a Technician profile (dispatch, the field app). One is
 * created with the account, or brought back if the person had one before. Its skills,
 * areas and rate are set on the technician screen.
 */
async function ensureTechnician(tx, userId) {
  await tx.technician.upsert({ where: { userId }, create: { userId }, update: { deletedAt: null } });
}

/**
 * Without a password (the admin screen) the account gets an unusable one and an email to
 * choose a real one; `invited` says so. Scripts and tests may still pass a password.
 */
export async function createUser(input) {
  const { password, ...rest } = input;
  const invited = !password;
  const passwordHash = await hashPassword(password ?? crypto.randomBytes(48).toString('base64url'));
  const user = await prisma.$transaction(async (tx) => {
    const row = await tx.user.create({
      data: { ...rest, email: rest.email.toLowerCase(), passwordHash },
      select: { id: true },
    });
    if (FIELD_ROLES.includes(rest.role)) await ensureTechnician(tx, row.id);
    const created = await tx.user.findUnique({ where: { id: row.id }, select: SELECT });
    await recordEvent('user.created', {
      model: 'User', recordId: created.id,
      after: { name: created.name, email: created.email, role: created.role, isActive: created.isActive },
      meta: invited ? { invited: true } : null,
    }, tx);
    return created;
  });
  if (invited) await issuePasswordLink(user, { invite: true, by: 'admin' });
  return { ...toUser(user), invited };
}

/**
 * An admin may not take away their own access: disabling themselves or leaving the ADMIN
 * role would lock the account out of this very screen.
 */
function assertNotSelfDemotion(current, input, actorId) {
  if (current.id !== actorId) return;
  if (input.isActive === false) throw badRequest('You cannot disable your own account');
  if (input.role && input.role !== current.role) throw badRequest('You cannot change your own role');
}

export async function updateUser(id, input, actorId) {
  const current = await findUser(id);
  assertNotSelfDemotion(current, input, actorId);

  const user = await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id },
      data: { ...input, ...(input.email ? { email: input.email.toLowerCase() } : {}) },
      select: { id: true },
    });
    if (input.role && FIELD_ROLES.includes(input.role)) await ensureTechnician(tx, id);
    const updated = await tx.user.findUnique({ where: { id }, select: SELECT });
    if (input.role && input.role !== current.role) {
      await recordEvent('user.role_changed', { model: 'User', recordId: id, before: { role: current.role }, after: { role: updated.role } }, tx);
    }
    if (current.isActive && updated.isActive === false) await disable(tx, id);
    return updated;
  });
  return toUser(user);
}

/** A disabled account is signed out everywhere; its access token already stops at the next request. */
async function disable(tx, id, meta) {
  const sessions = await logoutAll(id, tx);
  await recordEvent('user.disabled', {
    model: 'User', recordId: id, before: { isActive: true }, after: { isActive: false },
    meta: { ...meta, ...(sessions ? { sessionsRevoked: sessions } : {}) },
  }, tx);
}

export async function toggleUser(id, actorId) {
  const current = await findUser(id);
  if (current.id === actorId) throw badRequest('You cannot disable your own account');
  const user = await prisma.$transaction(async (tx) => {
    const updated = await tx.user.update({ where: { id }, data: { isActive: !current.isActive }, select: SELECT });
    if (current.isActive) await disable(tx, id);
    return updated;
  });
  return toUser(user);
}

/** Soft delete. The account can no longer sign in, which is what the event records. */
export async function deleteUser(id, actorId) {
  if (id === actorId) throw badRequest('You cannot delete your own account');
  const current = await findUser(id);
  await prisma.$transaction(async (tx) => {
    await tx.user.update({ where: { id }, data: { deletedAt: new Date(), isActive: false } });
    if (current.isActive) await disable(tx, id, { deleted: true });
    else {
      await logoutAll(id, tx);
      await recordEvent('user.disabled', { model: 'User', recordId: id, before: { isActive: false }, after: { isActive: false }, meta: { deleted: true } }, tx);
    }
  });
}

/**
 * Emails the account the normal one-hour reset link. The answer names the address it
 * went to and nothing else — the token is only ever in the email.
 */
export async function sendPasswordReset(id) {
  const user = await findUser(id);
  if (!user.isActive) throw new AppError(422, 'USER_DISABLED', 'This account is disabled. Enable it before sending a reset link.');
  await issuePasswordLink(user, { by: 'admin' });
  return { sent: true, email: user.email };
}

/** Lifts a lock from too many failed sign-ins, and starts the count again. */
export async function unlockUser(id) {
  const current = await findUser(id);
  const user = await prisma.$transaction(async (tx) => {
    const updated = await tx.user.update({ where: { id }, data: { failedLogins: 0, lockedUntil: null }, select: SELECT });
    await recordEvent('auth.unlocked', {
      model: 'User', recordId: id,
      before: { failedLogins: current.failedLogins, lockedUntil: current.lockedUntil },
      after: { failedLogins: 0, lockedUntil: null },
    }, tx);
    return updated;
  });
  return toUser(user);
}

/** The account's live sessions (refresh tokens), newest first — where and when, never the token. */
export async function listSessions(id) {
  await findUser(id, { id: true });
  return prisma.refreshToken.findMany({
    where: { userId: id, revokedAt: null, expiresAt: { gt: new Date() } },
    select: { id: true, createdAt: true, expiresAt: true, ip: true, userAgent: true },
    orderBy: { createdAt: 'desc' },
  });
}

/**
 * Signs the account out everywhere: no session can be refreshed. An access token already
 * issued lives out its 15 minutes unless the account is also disabled.
 */
export async function revokeSessions(id) {
  await findUser(id, { id: true });
  const revoked = await prisma.$transaction(async (tx) => {
    const count = await logoutAll(id, tx);
    await recordEvent('auth.sessions_revoked', { model: 'User', recordId: id, meta: { count } }, tx);
    return count;
  });
  return { revoked };
}
