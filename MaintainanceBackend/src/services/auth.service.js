import argon2 from 'argon2';
import jwt from 'jsonwebtoken';
import crypto from 'node:crypto';
import { env } from '../config/env.js';
import { prisma } from '../lib/prisma.js';
import { unauthorized, notFound, badRequest, forbidden } from '../utils/AppError.js';
import { hashToken } from '../utils/tokens.js';
import { addDays } from '../utils/dates.js';
import { notify } from './notify.service.js';
import { recordAudit } from './audit.service.js';

const MAX_FAILED = 5;
const LOCK_MINUTES = 15;

export const hashPassword = (plain) => argon2.hash(plain, { type: argon2.argon2id });
export const verifyPassword = (hash, plain) => argon2.verify(hash, plain);

function signAccessToken(user) {
  return jwt.sign({ sub: user.id, role: user.role }, env.jwtSecret, { expiresIn: env.accessTokenTtl });
}

async function issueRefreshToken(userId, { ip, userAgent }) {
  const raw = crypto.randomBytes(48).toString('base64url');
  await prisma.refreshToken.create({
    data: {
      userId,
      tokenHash: hashToken(raw),
      expiresAt: addDays(new Date(), env.refreshTokenTtlDays),
      ip: ip ?? null,
      userAgent: userAgent?.slice(0, 400) ?? null,
    },
  });
  return raw;
}

const publicUser = (u) => ({
  id: u.id, name: u.name, email: u.email, phone: u.phone, role: u.role,
  avatarId: u.avatarId, lastLoginAt: u.lastLoginAt,
});

export async function login({ email, password, ip, userAgent }) {
  const user = await prisma.user.findFirst({ where: { email: email.toLowerCase(), deletedAt: null } });
  // Uniform failure message so the endpoint cannot enumerate accounts.
  const reject = () => { throw unauthorized('Email or password is incorrect'); };

  if (!user) {
    await argon2.hash('timing-equalizer').catch(() => {});
    return reject();
  }
  if (user.lockedUntil && user.lockedUntil > new Date()) {
    throw forbidden(`Too many failed attempts. Try again after ${user.lockedUntil.toISOString()}`);
  }
  if (!user.isActive) throw forbidden('This account is disabled');

  const okPassword = await verifyPassword(user.passwordHash, password).catch(() => false);
  if (!okPassword) {
    const failed = user.failedLogins + 1;
    await prisma.user.update({
      where: { id: user.id },
      data: {
        failedLogins: failed,
        lockedUntil: failed >= MAX_FAILED ? new Date(Date.now() + LOCK_MINUTES * 60000) : null,
      },
    });
    return reject();
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { failedLogins: 0, lockedUntil: null, lastLoginAt: new Date() },
  });
  await recordAudit({ actorId: user.id, action: 'login', model: 'User', recordId: user.id, ip });

  return {
    user: publicUser(user),
    accessToken: signAccessToken(user),
    refreshToken: await issueRefreshToken(user.id, { ip, userAgent }),
  };
}

/** Rotates the refresh token: the presented one is revoked and a new one issued. */
export async function refresh({ token, ip, userAgent }) {
  if (!token) throw unauthorized('No refresh token supplied');
  const row = await prisma.refreshToken.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { user: true },
  });
  if (!row || row.revokedAt || row.expiresAt < new Date()) throw unauthorized('Session expired. Please sign in again.');
  if (!row.user.isActive || row.user.deletedAt) throw forbidden('This account is disabled');

  await prisma.refreshToken.update({ where: { id: row.id }, data: { revokedAt: new Date() } });
  return {
    user: publicUser(row.user),
    accessToken: signAccessToken(row.user),
    refreshToken: await issueRefreshToken(row.userId, { ip, userAgent }),
  };
}

export async function logout(token) {
  if (!token) return;
  await prisma.refreshToken.updateMany({
    where: { tokenHash: hashToken(token), revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

export async function logoutAll(userId) {
  await prisma.refreshToken.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: new Date() } });
}

export async function forgotPassword(email) {
  const user = await prisma.user.findFirst({ where: { email: email.toLowerCase(), deletedAt: null, isActive: true } });
  // Always report success — never reveal whether the address exists.
  if (!user) return;

  const raw = crypto.randomBytes(32).toString('base64url');
  await prisma.passwordReset.create({
    data: { userId: user.id, tokenHash: hashToken(raw), expiresAt: new Date(Date.now() + 60 * 60000) },
  });
  await notify({
    templateKey: 'password_reset',
    channel: 'email',
    to: user.email,
    vars: { name: user.name, link: `${env.appUrl}/reset-password?token=${raw}`, appName: env.appName },
    fallbackSubject: `Reset your ${env.appName} password`,
    fallbackBody:
      `Hi {{name}},\n\nReset your password using this link (valid for 1 hour):\n{{link}}\n\n` +
      `If you did not request this, ignore this email.`,
  });
}

export async function resetPassword({ token, password }) {
  const row = await prisma.passwordReset.findUnique({ where: { tokenHash: hashToken(token) } });
  if (!row || row.usedAt || row.expiresAt < new Date()) throw badRequest('This reset link is invalid or has expired');

  await prisma.$transaction([
    prisma.user.update({
      where: { id: row.userId },
      data: { passwordHash: await hashPassword(password), failedLogins: 0, lockedUntil: null },
    }),
    prisma.passwordReset.update({ where: { id: row.id }, data: { usedAt: new Date() } }),
    prisma.refreshToken.updateMany({ where: { userId: row.userId, revokedAt: null }, data: { revokedAt: new Date() } }),
  ]);
}

export async function changePassword(userId, { currentPassword, password }) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw notFound('User');
  const ok = await verifyPassword(user.passwordHash, currentPassword).catch(() => false);
  if (!ok) throw badRequest('Your current password is incorrect');
  await prisma.user.update({ where: { id: userId }, data: { passwordHash: await hashPassword(password) } });
  await logoutAll(userId);
}

export async function me(userId) {
  const user = await prisma.user.findFirst({
    where: { id: userId, deletedAt: null },
    include: { technician: { select: { id: true, skills: true, employeeCode: true } } },
  });
  if (!user) throw notFound('User');
  return { ...publicUser(user), technicianId: user.technician?.id ?? null };
}
