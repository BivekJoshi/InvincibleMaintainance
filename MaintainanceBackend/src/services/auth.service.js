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
import { webUrl } from '../utils/links.js';

const MAX_FAILED = 5;
const LOCK_MINUTES = 15;

export const hashPassword = (plain) => argon2.hash(plain, { type: argon2.argon2id });
export const verifyPassword = (hash, plain) => argon2.verify(hash, plain);

function signAccessToken(user) {
  return jwt.sign({ sub: user.id, role: user.role }, env.jwtSecret, { expiresIn: env.accessTokenTtl });
}

/**
 * When a refresh token lapses under the client's current lifetimes: `idleDays` after it was
 * issued or `maxDays` after sign-in, whichever comes first. Refreshing keeps an active session
 * going, but never past its cap.
 *
 * @param {{ client: string, signedInAt: Date, issuedAt: Date }} token
 */
function lapsesAt({ client, signedInAt, issuedAt }) {
  const { idleDays, maxDays } = env.sessions[client];
  return new Date(Math.min(addDays(issuedAt, idleDays), addDays(signedInAt, maxDays)));
}

/**
 * Issues a session's next refresh token.
 *
 * @param {{ userId: string, client: string, signedInAt?: Date, ip?: string, userAgent?: string }} session
 * @returns {Promise<{ refreshToken: string, refreshTokenExpiresAt: Date }>}
 */
async function issueRefreshToken({ userId, client, signedInAt = new Date(), ip, userAgent }) {
  const expiresAt = lapsesAt({ client, signedInAt, issuedAt: new Date() });
  const raw = crypto.randomBytes(48).toString('base64url');
  await prisma.refreshToken.create({
    data: {
      userId,
      tokenHash: hashToken(raw),
      client,
      signedInAt,
      expiresAt,
      ip: ip ?? null,
      userAgent: userAgent?.slice(0, 400) ?? null,
    },
  });
  return { refreshToken: raw, refreshTokenExpiresAt: expiresAt };
}

const publicUser = (u) => ({
  id: u.id, name: u.name, email: u.email, phone: u.phone, role: u.role,
  avatarId: u.avatarId, lastLoginAt: u.lastLoginAt,
});

export async function login({ email, password, client = 'WEB', ip, userAgent }) {
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
    await recordEvent('auth.login', { model: 'User', recordId: user.id, actorId: user.id, meta: { client } }, tx);
  });

  return {
    user: publicUser(user),
    accessToken: signAccessToken(user),
    ...(await issueRefreshToken({ userId: user.id, client, ip, userAgent })),
  };
}

/**
 * Rotates the refresh token: the presented one is revoked and the session's next one issued,
 * keeping its client and sign-in time. A session past its idle or absolute limit is refused —
 * the limits as they are now, so shortening them in .env also ends sessions issued before.
 */
export async function refresh({ token, ip, userAgent }) {
  if (!token) throw unauthorized('No refresh token supplied');
  const row = await prisma.refreshToken.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { user: true },
  });
  const now = new Date();
  const lapsed = !row || row.revokedAt || row.expiresAt < now
    || lapsesAt({ client: row.client, signedInAt: row.signedInAt, issuedAt: row.createdAt }) < now;
  if (lapsed) throw unauthorized('Session expired. Please sign in again.');
  if (!row.user.isActive || row.user.deletedAt) throw forbidden('This account is disabled');

  await prisma.refreshToken.update({ where: { id: row.id }, data: { revokedAt: new Date() } });
  return {
    user: publicUser(row.user),
    accessToken: signAccessToken(row.user),
    ...(await issueRefreshToken({ userId: row.userId, client: row.client, signedInAt: row.signedInAt, ip, userAgent })),
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

/** Ends every session of a user; returns how many were live. Pass a transaction client to join one. */
export async function logoutAll(userId, tx = prisma) {
  const { count } = await tx.refreshToken.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: new Date() } });
  return count;
}

const RESET_MINUTES = 60;
const INVITE_HOURS = 72;

/**
 * Creates a single-use password link and emails it. The raw token exists only in the
 * email: the database keeps its hash, and the MessageLog keeps the message with the
 * token redacted — so nobody, an admin included, can read a working link back.
 *
 * `invite` is a new account's first password (72 hours); otherwise a reset (1 hour).
 * `by: 'admin'` marks a link an admin sent; the actor is that admin.
 *
 * @param {{ id: string, name: string, email: string }} user
 * @param {{ invite?: boolean, by?: 'admin' }} [opts]
 */
export async function issuePasswordLink(user, { invite = false, by } = {}) {
  const raw = crypto.randomBytes(32).toString('base64url');
  const minutes = invite ? INVITE_HOURS * 60 : RESET_MINUTES;
  await prisma.$transaction(async (tx) => {
    await tx.passwordReset.create({
      data: { userId: user.id, tokenHash: hashToken(raw), expiresAt: new Date(Date.now() + minutes * 60000) },
    });
    const meta = { ...(by ? { by } : {}), ...(invite ? { purpose: 'invite' } : {}) };
    await recordEvent('auth.password_reset_requested', { model: 'User', recordId: user.id, meta }, tx);
  });
  const link = webUrl(`/reset-password?token=${raw}`);
  await notify({
    templateKey: invite ? 'account_invite' : 'password_reset',
    channel: 'email',
    to: user.email,
    vars: { name: user.name, link, appName: env.appName, hours: invite ? INVITE_HOURS : 1 },
    related: { model: 'User', id: user.id },
    secrets: [raw],
    fallbackSubject: invite ? `Your ${env.appName} account` : `Reset your ${env.appName} password`,
    fallbackBody: invite
      ? 'Hi {{name}},\n\nAn account has been created for you on {{appName}}. Choose your password using this link '
        + '(valid for {{hours}} hours):\n{{link}}\n\nIf you were not expecting this, ignore this email.'
      : 'Hi {{name}},\n\nReset your password using this link (valid for 1 hour):\n{{link}}\n\n'
        + 'If you did not request this, ignore this email.',
  });
}

export async function forgotPassword(email) {
  const user = await prisma.user.findFirst({ where: { email: email.toLowerCase(), deletedAt: null, isActive: true } });
  // Always report success — never reveal whether the address exists.
  if (!user) return;
  await issuePasswordLink(user);
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
