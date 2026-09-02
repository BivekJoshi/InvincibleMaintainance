import rateLimit from 'express-rate-limit';
import { env } from '../config/env.js';

const handler = (_req, res) =>
  res.status(429).json({ error: { code: 'RATE_LIMITED', message: 'Too many requests. Please slow down.' } });

const base = { standardHeaders: true, legacyHeaders: false, handler };

export const globalLimiter = rateLimit({ ...base, windowMs: 60_000, limit: 300 });

export const authLimiter = rateLimit({
  ...base,
  windowMs: 15 * 60_000,
  limit: 20,
  skipSuccessfulRequests: true,
});

/** Public lead submission — the endpoint spam bots will find first. */
export const leadLimiter = rateLimit({
  ...base,
  windowMs: 60 * 60_000,
  limit: env.leadRateLimitPerHour,
  handler: (_req, res) =>
    res.status(429).json({
      error: { code: 'RATE_LIMITED', message: 'You have submitted several requests already. Please call us instead.' },
    }),
});

export const uploadLimiter = rateLimit({ ...base, windowMs: 60_000, limit: 60 });
