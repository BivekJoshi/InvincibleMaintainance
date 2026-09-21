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

/** A customer answering a quotation link: a handful of taps, never hundreds. */
export const decisionLimiter = rateLimit({
  ...base,
  windowMs: 15 * 60_000,
  limit: 20,
  handler: (_req, res) =>
    res.status(429).json({
      error: { code: 'RATE_LIMITED', message: 'Too many attempts. Please wait a few minutes or call us.' },
    }),
});

export const uploadLimiter = rateLimit({ ...base, windowMs: 60_000, limit: 60 });

/** Anonymous photo uploads from the enquiry forms — far tighter than a signed-in upload. */
export const publicUploadLimiter = rateLimit({
  ...base,
  windowMs: 60 * 60_000,
  limit: 20,
  handler: (_req, res) =>
    res.status(429).json({
      error: { code: 'RATE_LIMITED', message: 'Too many photos uploaded from here. Please wait a while or call us.' },
    }),
});
