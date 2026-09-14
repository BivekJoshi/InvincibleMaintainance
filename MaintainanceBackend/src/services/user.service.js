import { prisma } from '../lib/prisma.js';
import { notFound, badRequest } from '../utils/AppError.js';
import { parseListQuery, meta, searchOr } from '../utils/pagination.js';
import { hashPassword } from './auth.service.js';
import { recordEvent } from './audit.service.js';

const SAFE = { id: true, name: true, email: true, role: true, isActive: true };

export async function listUsers(query) {
  const { page, limit, skip, take, orderBy, q } = parseListQuery(query);
  const where = { deletedAt: null, ...(q ? { OR: searchOr(q, ['name', 'email', 'phone']) } : {}) };
  const [items, total] = await Promise.all([
    prisma.user.findMany({
      where, orderBy, skip, take,
      select: { id: true, name: true, email: true, phone: true, role: true, isActive: true, lastLoginAt: true, createdAt: true },
    }),
    prisma.user.count({ where }),
  ]);
  return { items, meta: meta({ page, limit, total }) };
}

export async function createUser(input) {
  const { password, ...rest } = input;
  const passwordHash = await hashPassword(password);
  return prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: { ...rest, email: rest.email.toLowerCase(), passwordHash },
      select: SAFE,
    });
    await recordEvent('user.created', {
      model: 'User', recordId: user.id,
      after: { name: user.name, email: user.email, role: user.role, isActive: user.isActive },
    }, tx);
    return user;
  });
}

async function findUser(id) {
  const user = await prisma.user.findFirst({ where: { id, deletedAt: null } });
  if (!user) throw notFound('User');
  return user;
}

export async function updateUser(id, input) {
  const { password, ...rest } = input;
  const current = await findUser(id);
  const passwordHash = password ? await hashPassword(password) : undefined;

  return prisma.$transaction(async (tx) => {
    const user = await tx.user.update({
      where: { id },
      data: {
        ...rest,
        ...(rest.email ? { email: rest.email.toLowerCase() } : {}),
        ...(passwordHash ? { passwordHash } : {}),
      },
      select: SAFE,
    });
    if (rest.role && rest.role !== current.role) {
      await recordEvent('user.role_changed', { model: 'User', recordId: id, before: { role: current.role }, after: { role: user.role } }, tx);
    }
    if (current.isActive && user.isActive === false) {
      await recordEvent('user.disabled', { model: 'User', recordId: id, before: { isActive: true }, after: { isActive: false } }, tx);
    }
    return user;
  });
}

export async function toggleUser(id, actorId) {
  const current = await findUser(id);
  if (current.id === actorId) throw badRequest('You cannot disable your own account');
  return prisma.$transaction(async (tx) => {
    const user = await tx.user.update({
      where: { id }, data: { isActive: !current.isActive },
      select: { id: true, name: true, isActive: true },
    });
    if (current.isActive) {
      await recordEvent('user.disabled', { model: 'User', recordId: id, before: { isActive: true }, after: { isActive: false } }, tx);
    }
    return user;
  });
}

/** Soft delete. The account can no longer sign in, which is what the event records. */
export async function deleteUser(id, actorId) {
  if (id === actorId) throw badRequest('You cannot delete your own account');
  const current = await findUser(id);
  await prisma.$transaction(async (tx) => {
    await tx.user.update({ where: { id }, data: { deletedAt: new Date(), isActive: false } });
    await recordEvent('user.disabled', {
      model: 'User', recordId: id, before: { isActive: current.isActive }, after: { isActive: false }, meta: { deleted: true },
    }, tx);
  });
}
