import { prisma } from '../lib/prisma.js';
import { env } from '../config/env.js';
import { AppError } from '../utils/AppError.js';
import { boqTotals, discountForPct, discountForTarget, lineAmount, margin, sum, toPaisa } from '../utils/money.js';
import { effectiveQty, measurementQty, packs, shortfall, sumQty, takeOff } from '../utils/quantity.js';
import { getSetting } from './settings.service.js';
import { stockBalances } from './material.service.js';
import { recipeSnapshots } from './rateLibrary.service.js';

/**
 * A quotation's bill of quantities (Phase L3): one ordered list of ITEM / SECTION / NOTE rows, the way an
 * estimator's sheet reads. Quantities go through utils/quantity.js, money through utils/money.js.
 *
 * - An ITEM's quantity is its measurement sheet's (or the one typed), plus wastage. It must come out > 0
 *   (422 NEGATIVE_LINE) — negative lines belong to variations (Phase L7).
 * - A row priced from the rate library freezes the item's recipe and unit cost when it is first saved
 *   (L-D1); a row sent back with its id keeps them. The client never sends a cost — any it sends is ignored.
 * - Numbering (A, A.1…) and section subtotals are computed on every read, never stored.
 */

const isItem = (row) => (row.rowType ?? 'ITEM') === 'ITEM';

/** A, B … Z, AA, AB … — a section's letter by its position. */
function letter(n) {
  let out = '';
  for (let x = n + 1; x > 0; x = Math.floor((x - 1) / 26)) out = String.fromCharCode(65 + ((x - 1) % 26)) + out;
  return out;
}

/**
 * Each row's number: a section its letter, an item "A.1" under a section (1, 2 … before any), a note none.
 * @param {{ rowType?: string }[]} rows
 * @returns {(string|null)[]}
 */
export function boqNumbers(rows) {
  let section = -1;
  let item = 0;
  return rows.map((row) => {
    if (row.rowType === 'SECTION') {
      section += 1;
      item = 0;
      return letter(section);
    }
    if (row.rowType === 'NOTE') return null;
    item += 1;
    return section < 0 ? String(item) : `${letter(section)}.${item}`;
  });
}

const refuseNegative = (index, description) => new AppError(422, 'NEGATIVE_LINE',
  `Row ${index + 1} ("${description}") has no positive quantity. A quotation line must be more than zero — `
  + 'check its measurements for a deduction larger than the area.');

/**
 * Request rows (rupees, as the quotation endpoints take them) → rows ready to store (paisa), with their
 * quantities worked out and their recipe and cost frozen.
 * @param {object[]} items
 * @param {{ existing?: object[] }} [opts]  the draft's stored rows: a row sent with one of their ids and the
 *   same rate-card item and material keeps its frozen recipe and cost
 */
export async function buildLines(items = [], { existing = [] } = {}) {
  const stored = new Map(existing.map((row) => [row.id, row]));
  const keeps = (input) => {
    const old = input.id ? stored.get(input.id) : null;
    return old && isItem(old) && (old.rateCardItemId ?? null) === (input.rateCardItemId ?? null)
      && (old.materialId ?? null) === (input.materialId ?? null) ? old : null;
  };
  const fresh = items.filter((i) => isItem(i) && !keeps(i));
  const [snapshots, materials] = await Promise.all([
    recipeSnapshots([...new Set(fresh.map((i) => i.rateCardItemId).filter(Boolean))]),
    prisma.material.findMany({
      where: { id: { in: [...new Set(fresh.filter((i) => i.kind === 'MATERIAL').map((i) => i.materialId).filter(Boolean))] } },
      select: { id: true, purchaseRate: true },
    }),
  ]);
  const purchaseRate = new Map(materials.map((m) => [m.id, m.purchaseRate > 0 ? m.purchaseRate : null]));

  return items.map((input, index) => {
    const rowType = input.rowType ?? 'ITEM';
    if (rowType !== 'ITEM') {
      return {
        rowType, description: input.description, spec: input.spec ?? null, qty: 0, rate: 0, amount: 0, wastagePct: 0,
        isOptional: false, isProvisional: false, sortOrder: index,
      };
    }
    const measurements = input.measurements?.length ? input.measurements : null;
    const netQty = measurements ? measurementQty(measurements) : effectiveQty(input.qty, 0);
    const qty = effectiveQty(netQty, input.wastagePct);
    if (!(qty > 0)) throw refuseNegative(index, input.description);

    const kept = keeps(input);
    const snap = input.rateCardItemId ? snapshots.get(input.rateCardItemId) : null;
    let recipe = null;
    let unitCost = null;
    if (kept) ({ recipe, unitCost } = kept);
    else if (snap) ({ snapshot: recipe, unitCost } = snap);
    else if (input.kind === 'MATERIAL' && input.materialId) unitCost = purchaseRate.get(input.materialId) ?? null;

    return {
      rowType,
      rateCardItemId: input.rateCardItemId ?? null,
      materialId: input.materialId ?? null,
      kind: input.kind ?? (input.rateCardItemId ? 'SERVICE' : 'OTHER'),
      description: input.description,
      spec: input.spec ?? null,
      unit: input.unit ?? null,
      // A JSON column takes `undefined` for "none"; Prisma refuses a bare null there.
      measurements: measurements ?? undefined,
      netQty,
      wastagePct: Number(input.wastagePct ?? 0),
      qty,
      rate: toPaisa(input.rate ?? 0),
      amount: 0,
      isOptional: Boolean(input.isOptional),
      isProvisional: Boolean(input.isProvisional),
      recipe: recipe ?? undefined,
      unitCost: unitCost ?? null,
      costAmount: unitCost == null ? null : lineAmount(qty, unitCost),
      sortOrder: index,
    };
  });
}

/**
 * The document totals of stored-shape rows (paisa), writing each row's `amount`. The discount is the one
 * sent (paisa), or the one a "%" or "target total" helper works out on the server.
 * @param {object[]} rows
 * @param {{ discount?: number, discountPct?: number, targetTotal?: number, vatApplied?: boolean, vatRate?: number }} opts
 */
export async function totalsFor(rows, { discount = 0, discountPct, targetTotal, vatApplied = true, vatRate } = {}) {
  const rate = vatRate ?? Number(await getSetting('finance.vatRate', env.business.vatRate));
  let applied = discount;
  if (discountPct != null || targetTotal != null) {
    const { subtotal } = boqTotals(rows, { vatApplied, vatRate: rate });
    applied = discountPct != null ? discountForPct(subtotal, discountPct) : discountForTarget(subtotal, targetTotal, { vatApplied, vatRate: rate });
  }
  const totals = boqTotals(rows, { discount: applied, vatApplied, vatRate: rate });
  rows.forEach((row, i) => { row.amount = totals.rowAmounts[i] ?? 0; });
  const numbers = boqNumbers(rows);
  return {
    subtotal: totals.subtotal, discount: totals.discount, vatApplied: totals.vatApplied, vatRate: totals.vatRate,
    vatAmount: totals.vatAmount, total: totals.total, optionalTotal: totals.optionalTotal,
    sections: totals.sections.map((sec) => ({ ...sec, number: sec.index == null ? null : numbers[sec.index] })),
  };
}

/**
 * What the BOQ costs and its margin on the taxable amount (costs:read only — the cost wall strips it).
 * Complete only when every totalled row has a known cost; an unknown cost is never counted as zero.
 */
export function costSummary(rows, { subtotal, discount }) {
  const totalled = rows.filter((row) => isItem(row) && !row.isOptional);
  const costComplete = totalled.length > 0 && totalled.every((row) => row.unitCost != null);
  const costTotal = sum(totalled.map((row) => row.costAmount ?? 0));
  return { costTotal, costComplete, margin: costComplete ? margin(subtotal - discount, costTotal) : null };
}

/** A stored quotation with its rows numbered and its BOQ summary (sections, optional total, cost). */
export async function decorateBoq(q) {
  if (!q?.items) return q;
  const rows = q.items.map((row) => ({ ...row }));
  const totals = boqTotals(rows, { discount: q.discount, vatApplied: q.vatApplied, vatRate: q.vatRate });
  const numbers = boqNumbers(rows);
  return {
    ...q,
    items: rows.map((row, i) => ({ ...row, number: numbers[i] })),
    boq: {
      sections: totals.sections.map((sec) => ({ ...sec, number: sec.index == null ? null : numbers[sec.index] })),
      optionalTotal: totals.optionalTotal,
      cost: costSummary(rows, { subtotal: q.subtotal, discount: q.discount }),
    },
  };
}

/**
 * The take-off (Phase L3): what the priced rows need — materials in buying units with stock on hand and the
 * shortfall, labour days by trade, and equipment/other — from each row's frozen recipe × its quantity, plus
 * the MATERIAL rows themselves. Optional rows are left out. Cost (from the frozen prices) is costs:read only.
 * @param {object[]} rows  stored quotation rows
 */
export async function takeoffFor(rows) {
  const numbers = boqNumbers(rows);
  const materials = new Map();
  const labour = new Map();
  const other = new Map();
  const withoutRecipe = [];
  const add = (map, key, base, qty, cost) => {
    const entry = map.get(key) ?? { ...base, qtys: [], costs: [] };
    entry.qtys.push(qty);
    entry.costs.push(cost);
    map.set(key, entry);
  };

  rows.forEach((row, i) => {
    if (!isItem(row) || row.isOptional) return;
    if (row.recipe?.components?.length) {
      takeOff(row.recipe, row.qty).forEach((line, j) => {
        const price = row.recipe.components[j].cost;
        const cost = price == null ? null : lineAmount(line.qty, price);
        if (line.kind === 'MATERIAL') add(materials, line.materialId, { materialId: line.materialId }, line.qty, cost);
        else if (line.kind === 'LABOUR') add(labour, line.tradeId, { tradeId: line.tradeId }, line.qty, cost);
        else add(other, `${line.description}|${line.unit}`, { description: line.description, unit: line.unit }, line.qty, cost);
      });
    } else if (row.kind === 'MATERIAL' && row.materialId) {
      add(materials, row.materialId, { materialId: row.materialId }, row.qty, row.costAmount);
    } else {
      withoutRecipe.push({ id: row.id, number: numbers[i], description: row.description });
    }
  });

  const materialIds = [...materials.keys()];
  const [materialRows, tradeRows, onHand] = await Promise.all([
    prisma.material.findMany({ where: { id: { in: materialIds } }, select: { id: true, code: true, name: true, unit: true, packSize: true, packLabel: true } }),
    prisma.trade.findMany({ where: { id: { in: [...labour.keys()] } }, select: { id: true, code: true, name: true } }),
    materialIds.length ? stockBalances(materialIds) : {},
  ]);
  const materialById = new Map(materialRows.map((m) => [m.id, m]));
  const tradeById = new Map(tradeRows.map((t) => [t.id, t]));
  const costOf = (entry) => (entry.costs.every((c) => c != null) ? sum(entry.costs) : null);

  return {
    materials: [...materials.values()].map((entry) => {
      const m = materialById.get(entry.materialId) ?? {};
      const qty = sumQty(entry.qtys);
      const have = onHand[entry.materialId] ?? 0;
      return {
        materialId: entry.materialId, code: m.code, name: m.name, unit: m.unit, qty,
        packSize: m.packSize ?? null, packLabel: m.packLabel ?? null, packs: packs(qty, m.packSize),
        onHand: have, shortfall: shortfall(qty, have), costAmount: costOf(entry),
      };
    }),
    labour: [...labour.values()].map((entry) => {
      const t = tradeById.get(entry.tradeId) ?? {};
      return { tradeId: entry.tradeId, code: t.code, name: t.name, days: sumQty(entry.qtys), costAmount: costOf(entry) };
    }),
    other: [...other.values()].map((entry) => ({
      description: entry.description, unit: entry.unit, qty: sumQty(entry.qtys), costAmount: costOf(entry),
    })),
    rowsWithoutRecipe: withoutRecipe,
  };
}

/** The one room or area all of a row's measurement rows are in, or null (none named, or several). */
export function singleArea(measurements) {
  const areas = new Set((measurements ?? []).map((m) => m.area?.trim()).filter(Boolean));
  return areas.size === 1 ? [...areas][0] : null;
}

/**
 * Sections for rows that have none — a survey's lines grouped by their rate-card or material category, in
 * the order first seen (`fallback` for a line with neither). With `byArea` (a survey, Phase L5), a line
 * measured in one room goes under that room first, as the surveyor walked the site. Rows that already
 * carry a SECTION are kept.
 * @param {object[]} items  request rows
 * @param {string} [fallback]
 * @param {{ byArea?: boolean }} [opts]
 */
export async function withSections(items, fallback = 'General', { byArea = false } = {}) {
  if (items.some((i) => i.rowType === 'SECTION')) return items;
  const [cards, mats] = await Promise.all([
    prisma.rateCardItem.findMany({ where: { id: { in: items.map((i) => i.rateCardItemId).filter(Boolean) } }, select: { id: true, category: true } }),
    prisma.material.findMany({ where: { id: { in: items.map((i) => i.materialId).filter(Boolean) } }, select: { id: true, category: { select: { name: true } } } }),
  ]);
  const cardCategory = new Map(cards.map((c) => [c.id, c.category]));
  const materialCategory = new Map(mats.map((m) => [m.id, m.category?.name]));
  const groups = new Map();
  for (const item of items) {
    const title = (byArea && singleArea(item.measurements))
      || cardCategory.get(item.rateCardItemId) || materialCategory.get(item.materialId) || fallback;
    if (!groups.has(title)) groups.set(title, []);
    groups.get(title).push(item);
  }
  return [...groups].flatMap(([title, rows]) => [{ rowType: 'SECTION', description: title }, ...rows]);
}
