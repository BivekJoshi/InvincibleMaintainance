import { prisma } from '../lib/prisma.js';
import { forbidden, notFound } from '../utils/AppError.js';
import { can } from '../shared/permissions.js';
import { parseListQuery, meta, searchOr } from '../utils/pagination.js';
import { uniqueSlug } from '../utils/slug.js';
import { invalidatePublic } from './cache.service.js';
import { toPaisa } from '../utils/money.js';
import { recordEvent } from './audit.service.js';

/**
 * Builds a standard CRUD service for a Prisma model.
 *
 * @param {object} opts
 * @param {string} opts.model            Prisma model name, e.g. 'service'
 * @param {string} [opts.label]          Human label used in error messages
 * @param {string[]} [opts.searchFields] Fields included in ?q search
 * @param {boolean} [opts.softDelete]    Model has a deletedAt column
 * @param {boolean} [opts.sortable]      Model has a manual order column
 * @param {string} [opts.orderField]     That column — `sortOrder` unless the model numbers its rows
 *                                      another way (ListItem uses `position`). The reorder body is
 *                                      always `{ id, sortOrder }`; this maps it onto the column.
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
    orderField = 'sortOrder',
    slugFrom = null,
    moneyFields = [],
    include,
    defaultSort = sortable ? orderField : '-createdAt',
    filter,
  } = opts;

  const db = () => prisma[model];
  /** The Prisma model name ('faq' → 'Faq'), which is what audit rows carry. */
  const modelName = model.charAt(0).toUpperCase() + model.slice(1);

  const toStorage = (data) => {
    const out = { ...data };
    for (const f of moneyFields) {
      if (out[f] !== undefined && out[f] !== null) out[f] = toPaisa(out[f]);
    }
    return out;
  };

  /** `deleted` is the trash view (only soft-deleted rows); `includeDeleted` shows both. */
  const deletedWhere = (query) => {
    if (!softDelete) return {};
    if (query.deleted === true || query.deleted === 'true') return { deletedAt: { not: null } };
    return query.includeDeleted ? {} : { deletedAt: null };
  };

  const baseWhere = (query = {}) => ({
    ...deletedWhere(query),
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

    /**
     * Soft delete, which the caller can restore. `hard` removes the row for good and
     * needs cms:purge (ADMIN only); `role` is the caller's.
     */
    async remove(id, { hard = false, role } = {}) {
      if (hard && !can(role, 'cms:purge')) throw forbidden('Permanent delete needs the cms:purge permission');
      // A purge usually comes from the Trash view, so it must find a row that is already soft-deleted;
      // a soft delete still needs a live one.
      const row = hard ? await db().findUnique({ where: { id }, ...(include ? { include } : {}) }) : await this.get(id);
      if (!row) throw notFound(label);
      const purge = hard || !softDelete;
      await prisma.$transaction(async (tx) => {
        if (purge) await tx[model].delete({ where: { id } });
        else await tx[model].update({ where: { id }, data: { deletedAt: new Date() } });
        // A purge keeps what was removed; the row itself is gone.
        await recordEvent(purge ? 'cms.purged' : 'cms.deleted', { model: modelName, recordId: id, ...(purge ? { before: row } : {}) }, tx);
      });
      await invalidatePublic();
    },

    async restore(id) {
      const row = await db().findUnique({ where: { id } });
      if (!row) throw notFound(label);
      await prisma.$transaction(async (tx) => {
        await tx[model].update({ where: { id }, data: { deletedAt: null } });
        await recordEvent('cms.restored', { model: modelName, recordId: id, before: { deletedAt: row.deletedAt }, after: { deletedAt: null } }, tx);
      });
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
        items.map((i) => db().update({ where: { id: i.id }, data: { [orderField]: i.sortOrder } })),
      );
      await invalidatePublic();
    },

    /** Published rows for the public site, already ordered. */
    async published(where = {}, take) {
      return db().findMany({
        where: { isActive: true, ...(softDelete ? { deletedAt: null } : {}), ...where },
        orderBy: sortable ? [{ [orderField]: 'asc' }, { createdAt: 'desc' }] : { createdAt: 'desc' },
        ...(take ? { take } : {}),
        ...(include ? { include } : {}),
      });
    },
  };
}
