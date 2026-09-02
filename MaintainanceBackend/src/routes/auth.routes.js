import { Router } from 'express';
import { env } from '../config/env.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { validate } from '../middleware/validate.js';
import { authenticate } from '../middleware/authenticate.js';
import { authLimiter } from '../middleware/rateLimit.js';
import { ok } from '../utils/response.js';
import * as auth from '../services/auth.service.js';
import {
  loginSchema, forgotPasswordSchema, resetPasswordSchema, changePasswordSchema,
} from '../shared/schemas/auth.js';

const router = Router();
const COOKIE = 'refresh_token';

const cookieOptions = () => ({
  httpOnly: true,
  sameSite: 'lax',
  secure: env.cookieSecure,
  domain: env.cookieDomain,
  path: '/api/v1/auth',
  maxAge: env.refreshTokenTtlDays * 86400 * 1000,
});

router.post('/login', authLimiter, validate({ body: loginSchema }), asyncHandler(async (req, res) => {
  const { user, accessToken, refreshToken } = await auth.login({
    ...req.body, ip: req.ip, userAgent: req.headers['user-agent'],
  });
  res.cookie(COOKIE, refreshToken, cookieOptions());
  ok(res, { user, accessToken });
}));

router.post('/refresh', asyncHandler(async (req, res) => {
  const { user, accessToken, refreshToken } = await auth.refresh({
    token: req.cookies?.[COOKIE], ip: req.ip, userAgent: req.headers['user-agent'],
  });
  res.cookie(COOKIE, refreshToken, cookieOptions());
  ok(res, { user, accessToken });
}));

router.post('/logout', asyncHandler(async (req, res) => {
  await auth.logout(req.cookies?.[COOKIE]);
  res.clearCookie(COOKIE, { ...cookieOptions(), maxAge: undefined });
  ok(res, { message: 'Signed out' });
}));

router.post('/forgot-password', authLimiter, validate({ body: forgotPasswordSchema }), asyncHandler(async (req, res) => {
  await auth.forgotPassword(req.body.email);
  // Always the same response, so the endpoint cannot enumerate accounts.
  ok(res, { message: 'If that email is registered, a reset link is on its way.' });
}));

router.post('/reset-password', authLimiter, validate({ body: resetPasswordSchema }), asyncHandler(async (req, res) => {
  await auth.resetPassword(req.body);
  ok(res, { message: 'Password updated. Please sign in.' });
}));

router.post('/change-password', authenticate, validate({ body: changePasswordSchema }), asyncHandler(async (req, res) => {
  await auth.changePassword(req.user.id, req.body);
  res.clearCookie(COOKIE, { ...cookieOptions(), maxAge: undefined });
  ok(res, { message: 'Password changed. Please sign in again.' });
}));

router.get('/me', authenticate, asyncHandler(async (req, res) => ok(res, await auth.me(req.user.id))));

export default router;
