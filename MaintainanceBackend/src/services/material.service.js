import { prisma } from '../lib/prisma.js';
import { notFound, badRequest } from '../utils/AppError.js';
import { makeCrud } from './crud.service.js';
import { toPaisa } from '../utils/money.js';
import { notifyRoles } from './notify.service.js';

export const suppliers = makeCrud({ model: 'supplier', label: 'Supplier', searchFields: ['name', 'phone', 'email'], sortable: false, defaultSort: 'name' });
export const materialCategories = makeCrud({ model: 'materialCategory', label: 'Material category', searchFields: ['name'] });
export const materials = makeCrud({
  model: 'material', label: 'Material', searchFields: ['name', 'code'],
  moneyFields: ['purchaseRate', 'sellRate'],
  include: { category: { select: { id: true, name: true } }, supplier: { select: { id: true, name: true } } },
  filter: (q) => ({ ...(q.categoryId ? { categoryId: q.categoryId } : {}), ...(q.supplierId ? { supplierId: q.supplierId } : {}) }),
});

/**
 * Stock is always DERIVED from movements — never a mutable column that can drift.
 * @returns {Promise<Record<string, number>>} materialId -> balance
 */
export async function stockBalances(materialIds) {
  const grouped = await prisma.stockMovement.groupBy({
    by: ['materialId'],
    _sum: { qty: true },
    ...(materialIds?.length ? { where: { materialId: { in: materialIds } } } : {}),
  });
  return Object.fromEntries(grouped.map((g) => [g.materialId, Number(g._sum.qty ?? 0)]));
}

export async function stockReport(query = {}) {
  const rows = await prisma.material.findMany({
    where: { deletedAt: null, ...(query.categoryId ? { categoryId: query.categoryId } : {}), ...(query.includeInactive ? {} : { isActive: true }) },
    include: { category: { select: { id: true, name: true } } },
    orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
  });
  const balances = await stockBalances(rows.map((r) => r.id));
  return rows.map((r) => {
    const balance = balances[r.id] ?? 0;
    return {
      ...r,
      balance,
      stockValue: Math.round(balance * r.purchaseRate),
      isLow: r.reorderLevel > 0 && balance <= r.reorderLevel,
    };
  });
}

export async function lowStock() {
  return (await stockReport()).filter((r) => r.isLow);
}

export async function listMovements(query = {}) {
  const where = {
    ...(query.materialId ? { materialId: query.materialId } : {}),
    ...(query.jobId ? { jobId: query.jobId } : {}),
    ...(query.type ? { type: query.type } : {}),
  };
  return prisma.stockMovement.findMany({
    where,
    include: { material: { select: { id: true, code: true, name: true, unit: true } } },
    orderBy: { createdAt: 'desc' },
    take: Number(query.limit) || 200,
  });
}

/** Signs the quantity according to movement type so the balance sum is always correct. */
function signedQty(type, qty) {
  const magnitude = Math.abs(Number(qty));
  switch (type) {
    case 'PURCHASE':
    case 'RETURN':
      return magnitude;
    case 'ISSUE_TO_JOB':
    case 'WASTAGE':
      return -magnitude;
    case 'ADJUSTMENT':
      return Number(qty); // caller supplies the sign deliberately
    default:
      throw badRequest(`Unknown stock movement type: ${type}`);
  }
}

export async function createMovement(input, actorId) {
  const material = await prisma.material.findFirst({ where: { id: input.materialId, deletedAt: null } });
  if (!material) throw notFound('Material');

  const qty = signedQty(input.type, input.qty);
  const movement = await prisma.stockMovement.create({
    data: {
      materialId: input.materialId,
      type: input.type,
      qty,
      rate: input.rate != null ? toPaisa(input.rate) : null,
      jobId: input.jobId ?? null,
      reference: input.reference ?? null,
      note: input.note ?? null,
      actorId: actorId ?? null,
    },
  });
  await checkReorder(material);
  return movement;
}

async function checkReorder(material) {
  if (!material.reorderLevel) return;
  const balances = await stockBalances([material.id]);
  const balance = balances[material.id] ?? 0;
  if (balance <= material.reorderLevel) {
    await notifyRoles(['ADMIN', 'DISPATCHER'], {
      type: 'stock_low',
      title: `Low stock — ${material.name}`,
      body: `${balance} ${material.unit} left (reorder at ${material.reorderLevel})`,
      link: `/admin/materials/${material.id}`,
    });
  }
}

/**
 * Issues material to a job: writes the JobMaterial line and the matching stock
 * movement in one transaction so stock and job cost can never disagree.
 */
export async function issueToJob({ jobId, materialId, qty, rate, isBillable = true, actorId }) {
  const material = await prisma.material.findFirst({ where: { id: materialId, deletedAt: null } });
  if (!material) throw notFound('Material');

  const appliedRate = rate != null ? toPaisa(rate) : material.sellRate;
  const magnitude = Math.abs(Number(qty));

  return prisma.$transaction(async (tx) => {
    const line = await tx.jobMaterial.create({
      data: { jobId, materialId, qty: magnitude, rate: appliedRate, isBillable },
      include: { material: { select: { id: true, code: true, name: true, unit: true } } },
    });
    await tx.stockMovement.create({
      data: {
        materialId, type: 'ISSUE_TO_JOB', qty: -magnitude, rate: appliedRate,
        jobId, reference: `Job ${jobId}`, actorId: actorId ?? null,
      },
    });
    return line;
  }).then(async (line) => {
    await checkReorder(material);
    return line;
  });
}
