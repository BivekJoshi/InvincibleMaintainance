/** URL slug that preserves Devanagari as-is and transliterates nothing. */
export function slugify(input) {
  return String(input)
    .normalize('NFKC')
    .toLowerCase()
    .trim()
    .replace(/['"’]/g, '')
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120);
}

/**
 * Produces a slug unique within a model, appending -2, -3 ... on collision.
 * @param {import('@prisma/client').PrismaClient} db
 */
export async function uniqueSlug(db, model, value, { ignoreId } = {}) {
  const base = slugify(value) || 'item';
  let candidate = base;
  for (let n = 2; n < 200; n += 1) {
    const existing = await db[model].findFirst({
      where: { slug: candidate, ...(ignoreId ? { id: { not: ignoreId } } : {}) },
      select: { id: true },
    });
    if (!existing) return candidate;
    candidate = `${base}-${n}`;
  }
  return `${base}-${Date.now()}`;
}
