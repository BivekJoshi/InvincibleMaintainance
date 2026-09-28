import { prisma } from '../lib/prisma.js';
import { AppError, notFound, unprocessable } from '../utils/AppError.js';
import { parseListQuery, meta, searchOr } from '../utils/pagination.js';
import { nextNumber } from '../utils/numbering.js';
import { packs, shortfall, sumQty } from '../utils/quantity.js';
import { PURCHASE_LIST_TRANSITIONS, assertTransition } from '../shared/stateMachines.js';
import { recordEvent } from './audit.service.js';
import { stockBalances } from './material.service.js';

/**
 * Purchase lists (Phase L7): what to buy, usually for a job — raised from its shortfall — ordered from a supplier
 * and received, which writes a PURCHASE stock movement per item with the supplier (StockMovement.supplierId) and
 * the list's number, so stock rises. DRAFT → ORDERED → RECEIVED, or CANCELLED before it arrives
 * (`PURCHASE_LIST_TRANSITIONS`). A registry resource with its own actions; only a DRAFT is edited or deleted.
 */

const INCLUDE = {
  job: { select: { id: true, number: true, title: true } },
  supplier: { select: { id: true, name: true, phone: true } },
  items: {
    orderBy: { sortOrder: 'asc' },
    include: { material: { select: { id: true, code: true, name: true, unit: true, packSize: true, packLabel: true } } },
  },
};

const present = (row) => ({ ...row, itemCount: row.items?.length ?? 0 });

async function find(id, { deleted = false } = {}) {
  const row = await prisma.purchaseList.findFirst({ where: { id, ...(deleted ? {} : { deletedAt: null }) }, include: INCLUDE });
  if (!row) throw notFound('Purchase list');
  return row;
}

const itemRows = (items) => items.map((i, index) => ({
  materialId: i.materialId, qty: i.qty, packs: i.packs ?? null, note: i.note ?? null, sortOrder: index,
}));

async function assertMaterials(items) {
  const ids = [...new Set(items.map((i) => i.materialId))];
  const found = await prisma.material.count({ where: { id: { in: ids }, deletedAt: null } });
  if (found !== ids.length) throw unprocessable('A material on the list does not exist');
}

/** Moves the list, guarded on the status just read, with its event — a double tap moves it once. */
async function move(tx, row, to, data, event, meta2) {
  assertTransition(PURCHASE_LIST_TRANSITIONS, row.status, to, 'purchase list');
  if (row.status === to) throw new AppError(422, 'INVALID_TRANSITION', `Purchase list ${row.number} is already ${to.toLowerCase()}`);
  const { count } = await tx.purchaseList.updateMany({ where: { id: row.id, status: row.status }, data: { ...data, status: to } });
  if (!count) throw new AppError(422, 'INVALID_TRANSITION', `Purchase list ${row.number} changed a moment ago`);
  await recordEvent(event, { model: 'PurchaseList', recordId: row.id, before: { status: row.status }, after: { status: to }, meta: meta2 }, tx);
}

export const purchaseLists = {
  model: 'purchaseList',

  async list(query = {}) {
    const { page, limit, skip, take, orderBy, q } = parseListQuery(query, { defaultSort: '-createdAt' });
    const where = {
      ...(query.deleted === true || query.deleted === 'true' ? { deletedAt: { not: null } } : { deletedAt: null }),
      ...(query.status ? { status: query.status } : {}),
      ...(query.jobId ? { jobId: query.jobId } : {}),
      ...(query.supplierId ? { supplierId: query.supplierId } : {}),
      ...(q ? {
        OR: [...searchOr(q, ['number', 'note']), { job: { number: { contains: q, mode: 'insensitive' } } }, { supplier: { name: { contains: q, mode: 'insensitive' } } }],
      } : {}),
    };
    const [items, total] = await Promise.all([
      prisma.purchaseList.findMany({ where, orderBy, skip, take, include: INCLUDE }),
      prisma.purchaseList.count({ where }),
    ]);
    return { items: items.map(present), meta: meta({ page, limit, total }) };
  },

  async get(id) {
    return present(await find(id));
  },

  async create(data, ctx = {}) {
    const { items, ...rest } = data;
    await assertMaterials(items);
    const row = await prisma.$transaction(async (tx) => tx.purchaseList.create({
      data: { ...rest, number: await nextNumber(tx, 'PL'), createdById: ctx.userId ?? null, items: { create: itemRows(items) } },
      include: INCLUDE,
    }));
    return present(row);
  },

  /** A DRAFT only; sent items replace the list's. */
  async update(id, data) {
    const row = await find(id);
    if (row.status !== 'DRAFT') throw unprocessable(`Purchase list ${row.number} is ${row.status.toLowerCase()}: only a draft is edited`);
    const { items, ...rest } = data;
    if (items) await assertMaterials(items);
    await prisma.$transaction(async (tx) => {
      if (items) await tx.purchaseListItem.deleteMany({ where: { listId: id } });
      await tx.purchaseList.update({ where: { id }, data: { ...rest, ...(items ? { items: { create: itemRows(items) } } : {}) } });
    });
    return this.get(id);
  },

  /** Soft; a DRAFT only — a list that was ordered is on record (cancel it instead). */
  async remove(id) {
    const row = await find(id);
    if (row.status !== 'DRAFT') throw unprocessable('Only a draft purchase list is deleted — cancel an ordered one');
    await prisma.$transaction(async (tx) => {
      await tx.purchaseList.update({ where: { id }, data: { deletedAt: new Date() } });
      await recordEvent('cms.deleted', { model: 'PurchaseList', recordId: id }, tx);
    });
  },

  async restore(id) {
    const row = await find(id, { deleted: true });
    await prisma.$transaction(async (tx) => {
      await tx.purchaseList.update({ where: { id }, data: { deletedAt: null } });
      await recordEvent('cms.restored', { model: 'PurchaseList', recordId: id, before: { deletedAt: row.deletedAt }, after: { deletedAt: null } }, tx);
    });
    return this.get(id);
  },
};

/** POST /admin/purchase-lists/:id/order — DRAFT → ORDERED. */
export async function orderList(id) {
  const row = await find(id);
  await prisma.$transaction((tx) => move(tx, row, 'ORDERED', { orderedAt: new Date() }, 'purchase_list.ordered', { items: row.items.length }));
  return purchaseLists.get(id);
}

/**
 * POST /admin/purchase-lists/:id/receive — ORDERED → RECEIVED, in one transaction with a PURCHASE stock movement
 * per item received (the item's quantity unless the body says what came), at the material's purchase rate, with
 * the supplier and the list's number. A replay finds it RECEIVED and moves nothing.
 */
export async function receiveList(id, { items = [], note } = {}, userId) {
  const row = await find(id);
  const received = new Map(items.map((i) => [i.itemId, i.receivedQty]));
  const strangers = items.filter((i) => !row.items.some((it) => it.id === i.itemId)).map((i) => i.itemId);
  if (strangers.length) throw unprocessable('An item received is not on this list', strangers);
  await prisma.$transaction(async (tx) => {
    await move(tx, row, 'RECEIVED', { receivedAt: new Date(), ...(note ? { note } : {}) }, 'purchase_list.received', { items: row.items.length });
    for (const item of row.items) {
      const qty = received.has(item.id) ? received.get(item.id) : item.qty;
      await tx.purchaseListItem.update({ where: { id: item.id }, data: { receivedQty: qty } });
      if (!(qty > 0)) continue;
      const material = await tx.material.findUnique({ where: { id: item.materialId }, select: { purchaseRate: true } });
      await tx.stockMovement.create({
        data: {
          materialId: item.materialId, type: 'PURCHASE', qty, rate: material?.purchaseRate ?? null,
          supplierId: row.supplierId ?? null, jobId: row.jobId ?? null, reference: row.number,
          note: `Received on purchase list ${row.number}`, actorId: userId ?? null,
        },
      });
    }
  });
  return purchaseLists.get(id);
}

/** POST /admin/purchase-lists/:id/cancel — DRAFT or ORDERED → CANCELLED, with the reason. */
export async function cancelList(id, { reason }) {
  const row = await find(id);
  await prisma.$transaction((tx) => move(tx, row, 'CANCELLED', { cancelReason: reason }, 'purchase_list.cancelled', { reason }));
  return purchaseLists.get(id);
}

/**
 * POST /admin/jobs/:id/purchase-lists/from-shortfall — a DRAFT list for the job: each planned material's
 * shortfall (planned − issued to the job − on hand), bought in whole packs where the material comes in packs.
 * The supplier is the materials' own when they share one. 422 NO_SHORTFALL when nothing is short.
 */
export async function listFromShortfall(jobId, userId) {
  const job = await prisma.job.findFirst({
    where: { id: jobId, deletedAt: null },
    select: { id: true, number: true, requirements: { where: { kind: 'MATERIAL' } }, materials: { select: { materialId: true, qty: true } } },
  });
  if (!job) throw notFound('Job');
  const need = new Map();
  for (const r of job.requirements) if (r.materialId) need.set(r.materialId, [...(need.get(r.materialId) ?? []), r.qty]);
  const issued = new Map();
  for (const m of job.materials) issued.set(m.materialId, [...(issued.get(m.materialId) ?? []), m.qty]);
  const ids = [...need.keys()];
  const [materials, onHand] = await Promise.all([
    prisma.material.findMany({ where: { id: { in: ids } }, select: { id: true, packSize: true, supplierId: true } }),
    ids.length ? stockBalances(ids) : {},
  ]);
  const items = [];
  for (const m of materials) {
    const stillNeeded = shortfall(sumQty(need.get(m.id)), sumQty(issued.get(m.id) ?? []));
    const short = shortfall(stillNeeded, onHand[m.id] ?? 0);
    if (!(short > 0)) continue;
    const n = packs(short, m.packSize);
    items.push({ materialId: m.id, qty: n ? sumQty([n * m.packSize]) : short, packs: n, note: `Short by ${short}` });
  }
  if (!items.length) throw new AppError(422, 'NO_SHORTFALL', `Job ${job.number} is not short of any planned material`);
  const suppliers = [...new Set(materials.filter((m) => items.some((i) => i.materialId === m.id)).map((m) => m.supplierId))];
  return purchaseLists.create({
    jobId, supplierId: suppliers.length === 1 ? suppliers[0] : null, note: `Shortfall for job ${job.number}`, items,
  }, { userId });
}
