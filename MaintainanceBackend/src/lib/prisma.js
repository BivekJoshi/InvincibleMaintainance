import { PrismaClient } from '@prisma/client';
import { AsyncLocalStorage } from 'node:async_hooks';
import { logger } from './logger.js';
import { getContext } from './requestContext.js';
import { auditDiff } from './auditDiff.js';

/**
 * Models left out of automatic audit rows: the audit table itself, secrets, and
 * append-only or high-volume tables that are already their own history.
 * Translation is audited — it is editor content.
 */
export const AUDIT_SKIP = new Set([
  'AuditLog', 'RefreshToken', 'PasswordReset', 'MessageLog', 'Notification',
  'JobStatusEvent', 'LeadActivity', 'Counter',
]);

const AUDITED_OPERATIONS = new Set(['create', 'createMany', 'update', 'updateMany', 'upsert', 'delete', 'deleteMany']);

/** Past this many rows a bulk write is still applied, but only the first rows are audited. */
export const BULK_AUDIT_CAP = 500;

const base = new PrismaClient({ log: ['warn', 'error'] });

/**
 * The transaction client of the interactive transaction currently running, set
 * by the $transaction wrapper below. The extension writes its before-read and
 * its audit row through it, so they commit and roll back with the change.
 */
const transactions = new AsyncLocalStorage();

const delegate = (client, model) => client[model.charAt(0).toLowerCase() + model.slice(1)];

/** actor, request and client fields every audit row carries, from the request context. */
export function auditAttribution() {
  const ctx = getContext();
  return {
    actorId: ctx?.userId ?? null,
    // No context at all is a script, a seed or a test talking to the database directly.
    actorType: ctx?.actorType ?? 'system',
    requestId: ctx?.requestId ?? null,
    ip: ctx?.ip ?? null,
    userAgent: ctx?.userAgent ?? null,
  };
}

function modelRow(model, operation, recordId, before, after) {
  const diff = auditDiff(model, before, after);
  return {
    ...auditAttribution(),
    action: operation.replace('Many', ''),
    model,
    recordId: recordId ?? null,
    ...(diff.before ? { before: diff.before } : {}),
    ...(diff.after ? { after: diff.after } : {}),
  };
}

function warnCap(model, operation, matched) {
  logger.warn({ model, operation, matched, cap: BULK_AUDIT_CAP }, 'bulk write exceeds the audit cap; rows past it are not audited');
}

/** Runs one audited write and returns its result, with the audit rows it produced. */
async function auditedWrite({ model, operation, args, query, client }) {
  const db = delegate(client, model);
  const rows = [];
  let result;

  switch (operation) {
    case 'create': {
      result = await query(args);
      const after = args.select && result?.id ? await db.findUnique({ where: { id: result.id } }) : result;
      rows.push(modelRow(model, operation, after?.id, null, after));
      break;
    }
    case 'update':
    case 'upsert':
    case 'delete': {
      const before = await db.findUnique({ where: args.where });
      result = await query(args);
      let after = null;
      if (operation !== 'delete') {
        // A select or include can hide changed columns (users never select passwordHash), so re-read.
        const id = result?.id ?? before?.id;
        after = id && (args.select || args.include) ? await db.findUnique({ where: { id } }) : result;
      }
      rows.push(modelRow(model, operation, after?.id ?? before?.id, before, after));
      break;
    }
    case 'createMany': {
      result = await query(args);
      const data = [args.data].flat();
      for (const item of data.slice(0, BULK_AUDIT_CAP)) rows.push(modelRow(model, operation, item.id, null, item));
      if (data.length > BULK_AUDIT_CAP) warnCap(model, operation, data.length);
      break;
    }
    case 'updateMany':
    case 'deleteMany': {
      // Ids first: the where is often { id: { in: [...] } } or a guard, and one row per record is the point.
      const matched = await db.findMany({ where: args.where, take: BULK_AUDIT_CAP + 1 });
      result = await query(args);
      if (!result?.count) break;
      const targets = matched.slice(0, BULK_AUDIT_CAP);
      const afterById = operation === 'updateMany' && targets.length
        ? new Map((await db.findMany({ where: { id: { in: targets.map((r) => r.id) } } })).map((r) => [r.id, r]))
        : new Map();
      for (const before of targets) {
        rows.push(modelRow(model, operation, before.id, before, operation === 'deleteMany' ? null : afterById.get(before.id) ?? null));
      }
      if (matched.length > BULK_AUDIT_CAP) warnCap(model, operation, result.count);
      break;
    }
    default:
      result = await query(args);
  }
  return { result, rows };
}

const extended = base.$extends({
  query: {
    $allModels: {
      async $allOperations({ model, operation, args, query, __internalParams }) {
        if (!model || AUDIT_SKIP.has(model) || !AUDITED_OPERATIONS.has(operation)) return query(args);

        // Inside an interactive transaction everything goes through its client, so a
        // rollback takes the audit row with it. A plain call made inside a transaction
        // callback is not part of it, and neither is its audit row.
        const inTransaction = __internalParams?.transaction?.kind === 'itx';
        const tx = inTransaction ? transactions.getStore() : undefined;
        const client = tx ?? base;

        const { result, rows } = await auditedWrite({ model, operation, args, query, client });
        if (!rows.length) return result;

        const write = rows.length === 1
          ? client.auditLog.create({ data: rows[0] })
          : client.auditLog.createMany({ data: rows });
        if (tx) {
          await write; // a failed audit write fails the transaction: no change without its record
        } else {
          await write.catch((err) => logger.warn({ err: err.message, model, operation }, 'audit log write failed'));
        }
        return result;
      },
    },
  },
});

/** $transaction(fn) runs fn with its transaction client visible to the audit extension. */
function transactionFor(target) {
  return (arg, options) => (typeof arg === 'function'
    ? target.$transaction((tx) => transactions.run(tx, () => arg(tx)), options)
    : target.$transaction(arg, options));
}

export const prisma = new Proxy(extended, {
  get(target, prop) {
    if (prop === '$transaction') return transactionFor(target);
    const value = target[prop];
    return typeof value === 'function' ? value.bind(target) : value;
  },
});

export async function disconnectPrisma() {
  await base.$disconnect();
}
