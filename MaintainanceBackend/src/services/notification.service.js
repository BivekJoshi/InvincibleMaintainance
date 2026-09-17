import { prisma } from '../lib/prisma.js';
import { notFound } from '../utils/AppError.js';

/** The caller's in-app notifications, newest first (the latest 100), and how many are unread. */
export async function listNotifications(userId, { unreadOnly = false } = {}) {
  const [items, unread] = await Promise.all([
    prisma.notification.findMany({
      where: { userId, ...(unreadOnly ? { readAt: null } : {}) },
      orderBy: { createdAt: 'desc' },
      take: 100,
    }),
    prisma.notification.count({ where: { userId, readAt: null } }),
  ]);
  return { items, unread };
}

/** Marks one of the caller's notifications read; someone else's is not found. */
export async function markRead(userId, id) {
  const { count } = await prisma.notification.updateMany({ where: { id, userId }, data: { readAt: new Date() } });
  if (!count) throw notFound('Notification');
}

export async function markAllRead(userId) {
  await prisma.notification.updateMany({ where: { userId, readAt: null }, data: { readAt: new Date() } });
}
