import { Prisma } from '@prisma/client';

/**
 * The shape of an audit row's before/after: a shallow, redacted snapshot of
 * scalar fields, driven by the Prisma schema so relations and nested writes
 * never leak in.
 */

export const REDACTED = '[redacted]';

/** passwordHash, tokenHash, publicToken, otp*, *secret* — and anything else naming a password or token. */
const SECRET_KEY = /password|token|secret|^otp/i;

/** Bookkeeping columns every write touches; they would make every diff noisy. */
const NOISE = new Set(['updatedAt']);

const FIELDS = new Map(
  Prisma.dmmf.datamodel.models.map((m) => [m.name, new Map(m.fields.map((f) => [f.name, f]))]),
);

export const redactValue = (key, value) => (value != null && SECRET_KEY.test(key) ? REDACTED : value);

function normalise(value) {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'bigint') return value.toString();
  if (Prisma.Decimal.isDecimal?.(value)) return value.toString();
  return value;
}

/**
 * A plain copy of `row` fit for an audit column.
 *
 * `strict` keeps only the model's own scalar and enum columns (what a model
 * write stores). Otherwise keys that are not columns of the model are kept too —
 * a domain event describes things like `technicianIds` or a setting key — but
 * relation fields are still dropped.
 *
 * @param {string|null} model  Prisma model name, e.g. 'Lead'
 * @param {object|null|undefined} row
 * @param {{ strict?: boolean }} [opts]
 * @returns {object|null}
 */
export function snapshot(model, row, { strict = false } = {}) {
  if (!row || typeof row !== 'object') return null;
  const fields = model ? FIELDS.get(model) : undefined;
  const out = {};
  for (const [key, raw] of Object.entries(row)) {
    if (raw === undefined || NOISE.has(key)) continue;
    const field = fields?.get(key);
    if (field?.kind === 'object') continue;
    if (strict && (!field || !['scalar', 'enum'].includes(field.kind))) continue;
    // A non-Json column holding an object is a nested write or an operator ({ increment }), not a value.
    if (field && field.type !== 'Json' && raw !== null && typeof raw === 'object' && !(raw instanceof Date)
      && !Prisma.Decimal.isDecimal?.(raw)) continue;
    out[key] = redactValue(key, normalise(raw));
  }
  return out;
}

const same = (a, b) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

/**
 * Before/after for one model row. A create has no before, a delete no after; an
 * update keeps only the columns whose value changed. A secret that changed shows
 * as `[redacted]` on both sides, so the row still says that it changed.
 *
 * @param {string} model
 * @param {object|null} before
 * @param {object|null} after
 * @returns {{ before: object|null, after: object|null }}
 */
export function auditDiff(model, before, after) {
  const b = snapshot(model, before, { strict: true });
  const a = snapshot(model, after, { strict: true });
  if (!b || !a) return { before: b, after: a };

  const changedBefore = {};
  const changedAfter = {};
  for (const key of new Set([...Object.keys(b), ...Object.keys(a)])) {
    // Compare the raw values: two different hashes both redact to the same string.
    if (same(before?.[key] instanceof Date ? before[key].toISOString() : before?.[key],
      after?.[key] instanceof Date ? after[key].toISOString() : after?.[key])) continue;
    changedBefore[key] = b[key] ?? null;
    changedAfter[key] = a[key] ?? null;
  }
  return Object.keys(changedAfter).length
    ? { before: changedBefore, after: changedAfter }
    : { before: null, after: null };
}
