/**
 * Parses ?page&limit&sort&q into Prisma-ready arguments.
 * sort accepts "field" or "-field" for descending.
 */
export function parseListQuery(query = {}, { defaultSort = '-createdAt', maxLimit = 100 } = {}) {
  const page = Math.max(1, Number(query.page) || 1);
  const limit = Math.min(maxLimit, Math.max(1, Number(query.limit) || 20));
  const raw = String(query.sort || defaultSort);
  const desc = raw.startsWith('-');
  const field = desc ? raw.slice(1) : raw;
  return {
    page,
    limit,
    skip: (page - 1) * limit,
    take: limit,
    orderBy: { [field]: desc ? 'desc' : 'asc' },
    q: query.q ? String(query.q).trim() : '',
  };
}

export function meta({ page, limit, total }) {
  return { page, limit, total, pages: Math.max(1, Math.ceil(total / limit)) };
}

/** Case-insensitive contains filter across several fields. */
export function searchOr(q, fields) {
  if (!q) return undefined;
  return fields.map((f) => ({ [f]: { contains: q, mode: 'insensitive' } }));
}

/** Inclusive date-range filter for a field, from ?from & ?to. */
export function dateRange(from, to) {
  if (!from && !to) return undefined;
  const range = {};
  if (from) range.gte = new Date(from);
  if (to) {
    const end = new Date(to);
    end.setHours(23, 59, 59, 999);
    range.lte = end;
  }
  return range;
}
