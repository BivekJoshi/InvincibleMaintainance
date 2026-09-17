import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { AppError, badRequest, notFound } from '../utils/AppError.js';
import { MAX_NOTES, MAX_SHORTCUTS } from '../shared/schemas/me.js';

/** The caller's own admin-shell shortcuts and notes. Someone else's row is not found. */

const shortcutSelect = {
  id: true, label: true, to: true, icon: true, sortOrder: true, createdAt: true, updatedAt: true,
};
const noteSelect = {
  id: true, body: true, color: true, isPinned: true, createdAt: true, updatedAt: true,
};

const limitReached = (what, max) => new AppError(409, 'LIMIT_REACHED', `You can keep at most ${max} ${what}`, { max });
const duplicateShortcut = () => new AppError(409, 'DUPLICATE', 'You already have a shortcut to this page', ['to']);

// ── shortcuts

export async function listShortcuts(userId) {
  const items = await prisma.userShortcut.findMany({
    where: { userId },
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    select: shortcutSelect,
  });
  return { items, meta: { total: items.length, max: MAX_SHORTCUTS } };
}

/** Appends a shortcut to the end of the caller's bar. */
export async function createShortcut(userId, { label, to, icon }) {
  try {
    return await prisma.$transaction(async (tx) => {
      // Serialises concurrent adds for one user, so the limit cannot be raced past.
      await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${userId} FOR UPDATE`;
      const [count, last, same] = await Promise.all([
        tx.userShortcut.count({ where: { userId } }),
        tx.userShortcut.aggregate({ where: { userId }, _max: { sortOrder: true } }),
        tx.userShortcut.findUnique({ where: { userId_to: { userId, to } }, select: { id: true } }),
      ]);
      if (same) throw duplicateShortcut();
      if (count >= MAX_SHORTCUTS) throw limitReached('shortcuts', MAX_SHORTCUTS);
      const sortOrder = last._max.sortOrder == null ? 0 : last._max.sortOrder + 1;
      return tx.userShortcut.create({
        data: { userId, label, to, icon: icon ?? null, sortOrder },
        select: shortcutSelect,
      });
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') throw duplicateShortcut();
    throw err;
  }
}

export async function updateShortcut(userId, id, { label, icon }) {
  const { count } = await prisma.userShortcut.updateMany({ where: { id, userId }, data: { label, icon } });
  if (!count) throw notFound('Shortcut');
  return prisma.userShortcut.findUnique({ where: { id }, select: shortcutSelect });
}

/** Re-orders the caller's bar; `ids` must be exactly their shortcuts, each once. */
export async function reorderShortcuts(userId, ids) {
  await prisma.$transaction(async (tx) => {
    const own = await tx.userShortcut.findMany({ where: { userId }, select: { id: true } });
    const ownIds = new Set(own.map((s) => s.id));
    const given = new Set(ids);
    if (given.size !== ids.length || given.size !== ownIds.size || ids.some((x) => !ownIds.has(x))) {
      throw badRequest('ids must list each of your shortcuts exactly once');
    }
    for (const [sortOrder, id] of ids.entries()) {
      await tx.userShortcut.update({ where: { id }, data: { sortOrder } });
    }
  });
}

export async function deleteShortcut(userId, id) {
  const { count } = await prisma.userShortcut.deleteMany({ where: { id, userId } });
  if (!count) throw notFound('Shortcut');
}

// ── notes

const liveNote = (userId, extra = {}) => ({ userId, deletedAt: null, ...extra });

/** The caller's notes, pinned first, then the most recently edited. */
export async function listNotes(userId) {
  const items = await prisma.userNote.findMany({
    where: liveNote(userId),
    orderBy: [{ isPinned: 'desc' }, { updatedAt: 'desc' }],
    select: noteSelect,
  });
  return { items, meta: { total: items.length, max: MAX_NOTES } };
}

export async function createNote(userId, { body, color, isPinned }) {
  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${userId} FOR UPDATE`;
    const count = await tx.userNote.count({ where: liveNote(userId) });
    if (count >= MAX_NOTES) throw limitReached('notes', MAX_NOTES);
    return tx.userNote.create({
      data: { userId, body, color, isPinned: isPinned ?? false },
      select: noteSelect,
    });
  });
}

export async function updateNote(userId, id, { body, color, isPinned }) {
  const { count } = await prisma.userNote.updateMany({ where: liveNote(userId, { id }), data: { body, color, isPinned } });
  if (!count) throw notFound('Note');
  return prisma.userNote.findUnique({ where: { id }, select: noteSelect });
}

/** Soft delete: the note disappears from the list but the row stays. */
export async function deleteNote(userId, id) {
  const { count } = await prisma.userNote.updateMany({ where: liveNote(userId, { id }), data: { deletedAt: new Date() } });
  if (!count) throw notFound('Note');
}
