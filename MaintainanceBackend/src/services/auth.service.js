import argon2 from 'argon2';
import jwt from 'jsonwebtoken';
import crypto from 'node:crypto';
import { env } from '../config/env.js';
import { prisma } from '../lib/prisma.js';
import { unauthorized, notFound, badRequest, forbidden } from '../utils/AppError.js';
import { hashToken } from '../utils/tokens.js';
import { addDays } from '../utils/dates.js';
import { notify } from './notify.service.js';
import { recordEvent } from './audit.service.js';
import { setContext } from '../lib/requestContext.js';

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
    // The typed address is kept: a run of these against one address is what an attack looks like.
    await recordEvent('auth.login_failed', { model: 'User', meta: { email: email.toLowerCase(), reason: 'unknown_email' } });
    return reject();
  }
  if (user.lockedUntil && user.lockedUntil > new Date()) {
    await recordEvent('auth.login_failed', { model: 'User', recordId: user.id, meta: { reason: 'locked' } });
    throw forbidden(`Too many failed attempts. Try again after ${user.lockedUntil.toISOString()}`);
  }
  if (!user.isActive) {
    await recordEvent('auth.login_failed', { model: 'User', recordId: user.id, meta: { reason: 'disabled' } });
    throw forbidden('This account is disabled');
  }

  const okPassword = await verifyPassword(user.passwordHash, password).catch(() => false);
  if (!okPassword) {
    const failed = user.failedLogins + 1;
    const lockedUntil = failed >= MAX_FAILED ? new Date(Date.now() + LOCK_MINUTES * 60000) : null;
    await prisma.$transaction(async (tx) => {
      await tx.user.update({ where: { id: user.id }, data: { failedLogins: failed, lockedUntil } });
      await recordEvent('auth.login_failed', { model: 'User', recordId: user.id, meta: { reason: 'wrong_password', attempt: failed } }, tx);
      if (lockedUntil) {
        await recordEvent('auth.locked', { model: 'User', recordId: user.id, after: { lockedUntil }, meta: { attempts: failed } }, tx);
      }
    });
    return reject();
  }

  // Signed in: the rest of this request, and its audit rows, belong to the user.
  setContext({ userId: user.id, role: user.role, actorType: 'user' });
  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: user.id },
      data: { failedLogins: 0, lockedUntil: null, lastLoginAt: new Date() },
    });
    await recordEvent('auth.login', { model: 'User', recordId: user.id, actorId: user.id }, tx);
  });

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
  const tokenHash = hashToken(token);
  const session = await prisma.refreshToken.findUnique({ where: { tokenHash }, select: { userId: true } });
  await prisma.$transaction(async (tx) => {
    const { count } = await tx.refreshToken.updateMany({ where: { tokenHash, revokedAt: null }, data: { revokedAt: new Date() } });
    if (count && session) {
      await recordEvent('auth.logout', { model: 'User', recordId: session.userId, actorId: session.userId }, tx);
    }
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
  await prisma.$transaction(async (tx) => {
    await tx.passwordReset.create({
      data: { userId: user.id, tokenHash: hashToken(raw), expiresAt: new Date(Date.now() + 60 * 60000) },
    });
    await recordEvent('auth.password_reset_requested', { model: 'User', recordId: user.id }, tx);
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

  const passwordHash = await hashPassword(password);
  await prisma.$transaction(async (tx) => {
    await tx.user.update({ where: { id: row.userId }, data: { passwordHash, failedLogins: 0, lockedUntil: null } });
    await tx.passwordReset.update({ where: { id: row.id }, data: { usedAt: new Date() } });
    await tx.refreshToken.updateMany({ where: { userId: row.userId, revokedAt: null }, data: { revokedAt: new Date() } });
    await recordEvent('auth.password_changed', { model: 'User', recordId: row.userId, meta: { via: 'reset_link' } }, tx);
  });
}

export async function changePassword(userId, { currentPassword, password }) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw notFound('User');
  const ok = await verifyPassword(user.passwordHash, currentPassword).catch(() => false);
  if (!ok) throw badRequest('Your current password is incorrect');
  const passwordHash = await hashPassword(password);
  await prisma.$transaction(async (tx) => {
    await tx.user.update({ where: { id: userId }, data: { passwordHash } });
    await recordEvent('auth.password_changed', { model: 'User', recordId: userId, meta: { via: 'change_password' } }, tx);
  });
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
