import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { prisma, requestContext } from '../lib/prisma.js';
import { unauthorized, forbidden } from '../utils/AppError.js';
import { asyncHandler } from '../utils/asyncHandler.js';

function bearer(req) {
  const header = req.headers.authorization || '';
  return header.startsWith('Bearer ') ? header.slice(7) : null;
}

export const authenticate = asyncHandler(async (req, _res, next) => {
  const token = bearer(req);
  if (!token) throw unauthorized();

  let payload;
  try {
    payload = jwt.verify(token, env.jwtSecret);
  } catch (err) {
    throw unauthorized(err.name === 'TokenExpiredError' ? 'Access token expired' : 'Invalid access token');
  }

  const user = await prisma.user.findFirst({
    where: { id: payload.sub, deletedAt: null },
    select: { id: true, name: true, email: true, role: true, isActive: true },
  });
  if (!user) throw unauthorized('Account no longer exists');
  if (!user.isActive) throw forbidden('Account is disabled');

  req.user = user;
  requestContext.run({ actor: user, ip: req.ip }, () => next());
});

/** Attaches req.user when a valid token is present, but never rejects. */
export const optionalAuth = asyncHandler(async (req, _res, next) => {
  const token = bearer(req);
  if (!token) return next();
  try {
    const payload = jwt.verify(token, env.jwtSecret);
    const user = await prisma.user.findFirst({
      where: { id: payload.sub, deletedAt: null, isActive: true },
      select: { id: true, name: true, email: true, role: true },
    });
    if (user) {
      req.user = user;
      return requestContext.run({ actor: user, ip: req.ip }, () => next());
    }
  } catch {
    /* ignore — treated as anonymous */
  }
  next();
});
