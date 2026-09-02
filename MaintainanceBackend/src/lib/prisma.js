import { PrismaClient } from '@prisma/client';
import { AsyncLocalStorage } from 'node:async_hooks';
import { env } from '../config/env.js';
import { logger } from './logger.js';

/** Models excluded from automatic audit logging — high-volume or self-describing. */
const AUDIT_SKIP = new Set([
  'AuditLog', 'RefreshToken', 'PasswordReset', 'MessageLog', 'Notification',
  'JobStatusEvent', 'LeadActivity', 'Counter', 'Translation',
]);

const AUDITED_ACTIONS = new Set(['create', 'update', 'delete', 'updateMany', 'deleteMany']);
const SECRET_FIELDS = ['passwordHash', 'password', 'tokenHash', 'publicToken'];

/**
 * Request-scoped actor, set by the authenticate middleware. Writes from crons and
 * queue workers have no store and are audited with a null actor.
 */
export const requestContext = new AsyncLocalStorage();

export const currentActor = () => requestContext.getStore()?.actor ?? null;

function sanitize(data) {
  if (!data || typeof data !== 'object') return null;
  const out = {};
  for (const [k, v] of Object.entries(data)) {
    if (SECRET_FIELDS.includes(k)) out[k] = '[redacted]';
    else if (v instanceof Date) out[k] = v.toISOString();
    else if (v !== null && typeof v === 'object') continue; // skip nested writes
    else out[k] = v;
  }
  return Object.keys(out).length ? out : null;
}

// Base client used for audit writes, so the extension can never recurse into itself.
const base = new PrismaClient({ log: env.isProd ? ['warn', 'error'] : ['warn', 'error'] });

export const prisma = base.$extends({
  query: {
    $allModels: {
      async $allOperations({ model, operation, args, query }) {
        const result = await query(args);
        if (!model || AUDIT_SKIP.has(model) || !AUDITED_ACTIONS.has(operation)) return result;

        const store = requestContext.getStore();
        try {
          await base.auditLog.create({
            data: {
              actorId: store?.actor?.id ?? null,
              action: operation.replace('Many', ''),
              model,
              recordId: result?.id ?? args?.where?.id ?? null,
              changes: operation.startsWith('delete') ? null : sanitize(args?.data),
              ip: store?.ip ?? null,
            },
          });
        } catch (err) {
          logger.warn({ err: err.message, model, operation }, 'audit log write failed');
        }
        return result;
      },
    },
  },
});

export async function disconnectPrisma() {
  await base.$disconnect();
}
