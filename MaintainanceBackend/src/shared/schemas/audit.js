import { z } from 'zod';
import { ACTOR_TYPES, AUTH_EVENT_NAMES } from '../enums.js';
import { listQuery } from './common.js';

/** GET /admin/audit-logs. Sorting is by time only — the table is read as a timeline. */
export const auditLogQuery = listQuery.pick({ page: true, limit: true, q: true, from: true, to: true }).extend({
  sort: z.enum(['createdAt', '-createdAt']).optional(),
  /** An event name, or `prefix.*` for all of a prefix. */
  event: z.string().trim().max(80).regex(/^[a-z_]+\.(\*|[a-z_]+)$/, 'An event name, or prefix.*').optional(),
  actorType: z.enum(ACTOR_TYPES).optional(),
  requestId: z.string().trim().max(64).optional(),
  model: z.string().trim().max(60).optional(),
  recordId: z.string().trim().max(64).optional(),
  actorId: z.string().trim().max(64).optional(),
  action: z.string().trim().max(40).optional(),
});

/** GET /admin/login-activity — the `auth.*` events. */
export const loginActivityQuery = listQuery.pick({ page: true, limit: true, q: true, from: true, to: true }).extend({
  sort: z.enum(['createdAt', '-createdAt']).optional(),
  event: z.enum(AUTH_EVENT_NAMES).optional(),
  userId: z.string().trim().max(64).optional(),
  ip: z.string().trim().max(64).optional(),
});

/** GET /admin/login-activity/summary */
export const loginSummaryQuery = listQuery.pick({ page: true, limit: true, q: true }).extend({
  attention: z.enum(['true', 'false']).transform((v) => v === 'true').optional(),
});
