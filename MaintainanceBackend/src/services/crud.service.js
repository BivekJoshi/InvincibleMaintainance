import { prisma } from '../lib/prisma.js';
import { notFound } from '../utils/AppError.js';
import { parseListQuery, meta, searchOr } from '../utils/pagination.js';
import { uniqueSlug } from '../utils/slug.js';
import { invalidatePublic } from './cache.service.js';
import { toPaisa } from '../utils/money.js';

/**
 * Builds a standard CRUD service for a Prisma model.
 *
 * @param {object} opts
 * @param {string} opts.model            Prisma model name, e.g. 'service'
 * @param {string} [opts.label]          Human label used in error messages
 * @param {string[]} [opts.searchFields] Fields included in ?q search
 * @param {boolean} [opts.softDelete]    Model has a deletedAt column
 * @param {boolean} [opts.sortable]      Model has a sortOrder column
 * @param {boolean} [opts.slugFrom]      Field to derive a unique slug from
 * @param {string[]} [opts.moneyFields]  Fields submitted in rupees, stored as paisa
 * @param {object} [opts.include]        Default Prisma include
 * @param {string} [opts.defaultSort]
 * @param {(query:object)=>object} [opts.filter]  Extra where clause from query params
 */
export function makeCrud(opts) {
  const {
    model,
    label = model,
    searchFields = [],
    softDelete = true,
    sortable = true,
    slugFrom = null,
    moneyFields = [],
    include,
    defaultSort = sortable ? 'sortOrder' : '-createdAt',
    filter,
  } = opts;

  const db = () => prisma[model];

  const toStorage = (data) => {
    const out = { ...data };
    for (const f of moneyFields) {
      if (out[f] !== undefined && out[f] !== null) out[f] = toPaisa(out[f]);
    }
    return out;
  };

  const baseWhere = (query = {}) => ({
    ...(softDelete && !query.includeDeleted ? { deletedAt: null } : {}),
    ...(query.includeInactive ? {} : query.onlyActive ? { isActive: true } : {}),
    ...(filter ? filter(query) : {}),
  });

  return {
    model,

    async list(query = {}) {
      const { page, limit, skip, take, orderBy, q } = parseListQuery(query, { defaultSort });
      const where = {
        ...baseWhere(query),
        ...(q && searchFields.length ? { OR: searchOr(q, searchFields) } : {}),
      };
      const [items, total] = await Promise.all([
        db().findMany({ where, orderBy, skip, take, ...(include ? { include } : {}) }),
        db().count({ where }),
      ]);
      return { items, meta: meta({ page, limit, total }) };
    },

    async get(id) {
      const row = await db().findFirst({
        where: { id, ...(softDelete ? { deletedAt: null } : {}) },
        ...(include ? { include } : {}),
      });
      if (!row) throw notFound(label);
      return row;
    },

    async getBySlug(slug) {
      const row = await db().findFirst({
        where: { slug, isActive: true, ...(softDelete ? { deletedAt: null } : {}) },
        ...(include ? { include } : {}),
      });
      if (!row) throw notFound(label);
      return row;
    },

    async create(data) {
      const payload = toStorage(data);
      if (slugFrom) payload.slug = await uniqueSlug(prisma, model, payload.slug || payload[slugFrom]);
      const row = await db().create({ data: payload, ...(include ? { include } : {}) });
      await invalidatePublic();
      return row;
    },

    async update(id, data) {
      await this.get(id);
      const payload = toStorage(data);
      if (slugFrom && (payload.slug || payload[slugFrom])) {
        payload.slug = await uniqueSlug(prisma, model, payload.slug || payload[slugFrom], { ignoreId: id });
      }
      const row = await db().update({ where: { id }, data: payload, ...(include ? { include } : {}) });
      await invalidatePublic();
      return row;
    },

    async remove(id, { hard = false } = {}) {
      await this.get(id);
      if (softDelete && !hard) {
        await db().update({ where: { id }, data: { deletedAt: new Date() } });
      } else {
        await db().delete({ where: { id } });
      }
      await invalidatePublic();
    },

    async restore(id) {
      const row = await db().findUnique({ where: { id } });
      if (!row) throw notFound(label);
      await db().update({ where: { id }, data: { deletedAt: null } });
      await invalidatePublic();
      return db().findUnique({ where: { id } });
    },

    async toggle(id) {
      const row = await this.get(id);
      const updated = await db().update({ where: { id }, data: { isActive: !row.isActive } });
      await invalidatePublic();
      return updated;
    },

    /** Bulk reorder in one transaction so the list never renders half-sorted. */
    async reorder(items) {
      if (!sortable) return;
      await prisma.$transaction(
        items.map((i) => db().update({ where: { id: i.id }, data: { sortOrder: i.sortOrder } })),
      );
      await invalidatePublic();
    },

    /** Published rows for the public site, already ordered. */
    async published(where = {}, take) {
      return db().findMany({
        where: { isActive: true, ...(softDelete ? { deletedAt: null } : {}), ...where },
        orderBy: sortable ? [{ sortOrder: 'asc' }, { createdAt: 'desc' }] : { createdAt: 'desc' },
        ...(take ? { take } : {}),
        ...(include ? { include } : {}),
      });
    },
  };
}
