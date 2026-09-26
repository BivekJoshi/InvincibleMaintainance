import { prisma } from '../lib/prisma.js';
import { AppError, badRequest } from '../utils/AppError.js';
import { margin, recipeCost, sellRate, toPaisa } from '../utils/money.js';
import { stripCosts } from '../utils/moneyWall.js';
import { AUDIT_EVENTS } from '../shared/enums.js';
import { getSetting } from './settings.service.js';
import { recordEvent } from './audit.service.js';
import { makeCrud } from './crud.service.js';

/**
 * The rate library (Phase L2, L-D1): a selling rate per unit of work, and the recipe behind it — what one
 * unit needs in materials (with wastage), labour man-days by trade, equipment and other costs.
 *
 * - A DERIVED item's rate is `sellRate(recipeCost(...))` at today's prices, set when the item is saved or
 *   repriced. A MANUAL item keeps its typed rate; its recipe, if any, only costs it for the margin.
 * - A change to a material's purchase rate or a trade's wage never moves a rate: the item reads
 *   `outOfDate` (its derived rate today differs from its rate) until someone reprices it — preview, then
 *   apply. A public price never moves silently.
 * - Cost, margin, recipe cost and wages leave the server only for `costs:read` (`stripCosts`).
 */

const INCLUDE = {
  components: {
    orderBy: { sortOrder: 'asc' },
    include: {
      material: { select: { id: true, code: true, name: true, unit: true, packSize: true, packLabel: true, purchaseRate: true } },
      trade: { select: { id: true, code: true, name: true, dayWage: true } },
    },
  },
};

const base = makeCrud({
  model: 'rateCardItem', label: 'Rate card item', searchFields: ['name', 'code', 'category'], include: INCLUDE,
});

/** The settings a recipe falls back on when the item names none. */
async function recipeDefaults() {
  const [overheadPct, profitPct, roundTo] = await Promise.all([
    getSetting('quotation.defaultOverheadPct', 10),
    getSetting('quotation.defaultProfitPct', 10),
    getSetting('quotation.sellRateRoundTo', 100),
  ]);
  return { overheadPct: Number(overheadPct), profitPct: Number(profitPct), roundTo: Number(roundTo) };
}

/** Today's price of one recipe line (paisa per unit); null when unknown — never zero by accident. */
function priceOf(c) {
  if (c.kind === 'MATERIAL') return c.material?.purchaseRate > 0 ? c.material.purchaseRate : null;
  if (c.kind === 'LABOUR') return c.trade?.dayWage > 0 ? c.trade.dayWage : null;
  return c.cost ?? null;
}

/**
 * A recipe at today's prices: its cost and its derived rate (null unless every price is known).
 * @param {{ recipeQty: number, overheadPct?: number|null, profitPct?: number|null, roundTo?: number|null,
 *   components: object[] }} recipe  components with `material` / `trade` loaded
 */
function derive(recipe, defaults) {
  const params = {
    overheadPct: recipe.overheadPct ?? defaults.overheadPct,
    profitPct: recipe.profitPct ?? defaults.profitPct,
    roundTo: recipe.roundTo ?? defaults.roundTo,
  };
  if (!recipe.components?.length) return { cost: null, derivedRate: null };
  const cost = recipeCost(
    recipe.components.map((c) => ({ kind: c.kind, qty: c.qty, wastagePct: c.wastagePct, price: priceOf(c) })),
    { recipeQty: recipe.recipeQty, overheadPct: params.overheadPct },
  );
  return { cost, derivedRate: cost.complete ? sellRate(cost.unitCost, params) : null };
}

const breakdownOf = ({ material, labour, equipment, other, direct, overhead, unitCost, complete }) => (
  { material, labour, equipment, other, direct, overhead, unitCost, complete });

/** An item as its caller may see it: today's cost and derived rate, and whether it is out of date. */
function present(item, defaults, ctx) {
  const { cost, derivedRate } = derive(item, defaults);
  return stripCosts({
    ...item,
    components: item.components.map((c, i) => ({ ...c, lineCost: cost?.lines[i]?.lineCost ?? null })),
    derivedRate,
    outOfDate: item.rateMode === 'DERIVED' && derivedRate != null && derivedRate !== item.rate,
    costBreakdown: cost ? breakdownOf(cost) : null,
    margin: cost?.complete ? margin(item.rate, cost.unitCost) : null,
  }, ctx);
}

/**
 * A recipe as typed (rupees, ids) → component rows (paisa, units) with their material or trade loaded,
 * so it can be priced before it is saved. An unknown or deleted material or trade is 422.
 */
async function loadComponents(components = []) {
  const materialIds = [...new Set(components.map((c) => c.materialId).filter(Boolean))];
  const tradeIds = [...new Set(components.map((c) => c.tradeId).filter(Boolean))];
  const [materials, trades] = await Promise.all([
    prisma.material.findMany({ where: { id: { in: materialIds }, deletedAt: null }, select: INCLUDE.components.include.material.select }),
    prisma.trade.findMany({ where: { id: { in: tradeIds }, deletedAt: null }, select: INCLUDE.components.include.trade.select }),
  ]);
  const materialById = new Map(materials.map((m) => [m.id, m]));
  const tradeById = new Map(trades.map((t) => [t.id, t]));
  return components.map((c, sortOrder) => {
    const material = c.kind === 'MATERIAL' ? materialById.get(c.materialId) : null;
    const trade = c.kind === 'LABOUR' ? tradeById.get(c.tradeId) : null;
    if (c.kind === 'MATERIAL' && !material) throw new AppError(422, 'UNKNOWN_MATERIAL', 'A recipe line names a material that does not exist.');
    if (c.kind === 'LABOUR' && !trade) throw new AppError(422, 'UNKNOWN_TRADE', 'A recipe line names a trade that does not exist.');
    const priced = c.kind === 'EQUIPMENT' || c.kind === 'OTHER';
    return {
      kind: c.kind,
      materialId: material?.id ?? null,
      tradeId: trade?.id ?? null,
      description: c.description ?? null,
      unit: material?.unit ?? (trade ? 'day' : 'lump'),
      qty: c.qty,
      wastagePct: c.wastagePct ?? 0,
      cost: priced && c.cost != null ? toPaisa(c.cost) : null,
      sortOrder,
      material,
      trade,
    };
  });
}

/** What makes two recipe lines the same line (paisa, ids, quantities) — order counts. */
const lineSignature = (c) => [c.kind, c.materialId ?? null, c.tradeId ?? null, c.description ?? null,
  Number(c.qty), Number(c.wastagePct ?? 0), c.cost ?? null];
const sameRecipe = (a, b) => JSON.stringify(a.map(lineSignature)) === JSON.stringify(b.map(lineSignature));

/** A component row as stored — without the material or trade it was priced with. */
const withoutRelations = ({ material, trade, ...row }) => row;

/** Rupee inputs → paisa; `roundTo: null` stays null (the setting applies). */
const moneyIn = (data) => ({
  ...data,
  ...(data.rate != null ? { rate: toPaisa(data.rate) } : {}),
  ...(data.roundTo !== undefined ? { roundTo: data.roundTo == null ? null : toPaisa(data.roundTo) } : {}),
});

/**
 * The rate a saved item gets, and the unit cost stored with it: a DERIVED item's is derived from its
 * recipe (every price must be known — 422 RECIPE_INCOMPLETE otherwise); a MANUAL item keeps its rate.
 */
function settle(item, defaults) {
  const { cost, derivedRate } = derive(item, defaults);
  if (item.rateMode === 'DERIVED') {
    if (derivedRate == null) {
      throw new AppError(422, 'RECIPE_INCOMPLETE',
        'A derived rate needs a price for every recipe line — set the missing purchase rates or wages first.');
    }
    return { rate: derivedRate, unitCost: cost.unitCost };
  }
  return { rate: item.rate, unitCost: cost?.complete ? cost.unitCost : null };
}

export const rateLibrary = {
  model: 'rateCardItem',

  async list(query = {}, ctx) {
    const [{ items, meta }, defaults] = await Promise.all([base.list(query), recipeDefaults()]);
    return { items: items.map((item) => present(item, defaults, ctx)), meta };
  },

  async get(id, ctx) {
    const [item, defaults] = await Promise.all([base.get(id), recipeDefaults()]);
    return present(item, defaults, ctx);
  },

  async create(data, ctx) {
    const { components: typed, ...fields } = moneyIn(data);
    const defaults = await recipeDefaults();
    const components = await loadComponents(typed);
    const draft = { rateMode: 'MANUAL', recipeQty: 1, ...fields, components };
    const settled = settle(draft, defaults);
    const item = await prisma.rateCardItem.create({
      data: { ...fields, ...settled, components: { create: components.map(withoutRelations) } },
      include: INCLUDE,
    });
    return present(item, defaults, ctx);
  },

  async update(id, data, ctx) {
    const existing = await base.get(id);
    const { components: typed, ...fields } = moneyIn(data);
    const defaults = await recipeDefaults();
    const components = typed !== undefined ? await loadComponents(typed) : existing.components;
    const merged = { ...existing, ...fields, components };
    if (merged.rateMode === 'DERIVED' && !components.length) throw badRequest('A derived rate needs its recipe');
    // Only a real change to the recipe, how it is priced, or a manual rate sets the rate again. The edit
    // form sends everything on every save, so each is compared with what is stored: renaming an item never
    // reprices it — today's prices reach a rate only through a deliberate reprice.
    const recipeChanged = typed !== undefined && !sameRecipe(existing.components, components);
    const pricingChanged = ['rateMode', 'recipeQty', 'overheadPct', 'profitPct', 'roundTo']
      .some((k) => k in fields && fields[k] !== existing[k]);
    const manualRateChanged = merged.rateMode === 'MANUAL' && fields.rate != null && fields.rate !== existing.rate;
    const settled = recipeChanged || pricingChanged || manualRateChanged ? settle(merged, defaults) : { rate: existing.rate };
    const item = await prisma.$transaction(async (tx) => {
      if (recipeChanged) {
        await tx.rateCardComponent.deleteMany({ where: { rateCardItemId: id } });
        if (components.length) {
          await tx.rateCardComponent.createMany({ data: components.map((c) => ({ ...withoutRelations(c), rateCardItemId: id })) });
        }
      }
      return tx.rateCardItem.update({ where: { id }, data: { ...fields, ...settled }, include: INCLUDE });
    });
    return present(item, defaults, ctx);
  },

  toggle: (id) => base.toggle(id),
  restore: (id) => base.restore(id),
  remove: (id, opts) => base.remove(id, opts),
  reorder: (items) => base.reorder(items),
};

/**
 * POST /admin/rate-card/derive — a recipe's cost and derived rate at today's prices, and the margin at the
 * form's `rate` (when sent) and at the derived rate. Nothing is saved; the client computes no money.
 */
export async function deriveRecipe(input) {
  const { components: typed, rate, ...params } = moneyIn(input);
  const [defaults, components] = await Promise.all([recipeDefaults(), loadComponents(typed)]);
  const { cost, derivedRate } = derive({ recipeQty: 1, ...params, components }, defaults);
  const unitCost = cost.complete ? cost.unitCost : null;
  return {
    costBreakdown: breakdownOf(cost),
    derivedRate,
    margin: rate != null ? margin(rate, unitCost) : null,
    derivedMargin: derivedRate != null ? margin(derivedRate, unitCost) : null,
    lines: cost.lines.map((l, index) => ({ index, lineCost: l.lineCost })),
  };
}

/**
 * POST /admin/rate-card/reprice — the DERIVED items (all, or `ids`) whose derived rate today differs from
 * their rate. `apply: false` previews and writes nothing; `apply: true` sets each rate (and its unit cost)
 * and records `rate_card.repriced` per item, in one transaction.
 * @returns {Promise<{ items: { id, code, name, rate, derivedRate, delta }[], applied: number }>}
 */
export async function repriceRates({ ids, apply }) {
  const [items, defaults] = await Promise.all([
    prisma.rateCardItem.findMany({
      where: { deletedAt: null, rateMode: 'DERIVED', ...(ids ? { id: { in: ids } } : {}) },
      include: INCLUDE,
      orderBy: { sortOrder: 'asc' },
    }),
    recipeDefaults(),
  ]);
  const changes = items
    .map((item) => ({ item, ...derive(item, defaults) }))
    .filter((x) => x.derivedRate != null && x.derivedRate !== x.item.rate);
  const preview = changes.map(({ item, derivedRate }) => ({
    id: item.id, code: item.code, name: item.name, rate: item.rate, derivedRate, delta: derivedRate - item.rate,
  }));
  if (!apply) return { items: preview, applied: 0 };
  await prisma.$transaction(async (tx) => {
    for (const { item, derivedRate, cost } of changes) {
      await tx.rateCardItem.update({ where: { id: item.id }, data: { rate: derivedRate, unitCost: cost.unitCost } });
      await recordEvent(AUDIT_EVENTS.RATE_CARD_REPRICED, {
        model: 'RateCardItem', recordId: item.id, before: { rate: item.rate }, after: { rate: derivedRate },
      }, tx);
    }
  });
  return { items: preview, applied: preview.length };
}

// ── trades

const tradeCrud = makeCrud({ model: 'trade', label: 'Trade', searchFields: ['name', 'code'], moneyFields: ['dayWage'] });

/** Trades and their day wages (Phase L2). A wage is cost: it leaves the server only for costs:read. */
export const trades = {
  model: 'trade',
  async list(query, ctx) {
    const { items, meta } = await tradeCrud.list(query);
    return { items: stripCosts(items, ctx), meta };
  },
  get: async (id, ctx) => stripCosts(await tradeCrud.get(id), ctx),
  create: async (data, ctx) => stripCosts(await tradeCrud.create(data), ctx),
  update: async (id, data, ctx) => stripCosts(await tradeCrud.update(id, data), ctx),
  toggle: async (id, ctx) => stripCosts(await tradeCrud.toggle(id), ctx),
  restore: async (id, ctx) => stripCosts(await tradeCrud.restore(id), ctx),
  remove: (id, opts) => tradeCrud.remove(id, opts),
  reorder: (items) => tradeCrud.reorder(items),
};
