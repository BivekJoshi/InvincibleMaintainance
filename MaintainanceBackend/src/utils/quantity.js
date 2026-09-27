/**
 * Quantities, not money (Phase L2): measurement sheets, wastage, packs and take-offs. A quantity is
 * rounded here (3 dp, once) and never as money; `utils/money.js` never rounds a quantity.
 */

const q3 = (n) => Math.round(n * 1000) / 1000;

/**
 * A measurement sheet's quantity — the site engineer's measurement book. Each row is `nos × L × B × H`
 * over the dimensions it has (a wall is nos × L × H; a floor L × B; a count just nos); a `deduct` row (a
 * door, a window) subtracts. A row with no numbers counts 0. Rounded to 3 dp once, at the end.
 * @param {{ area?: string, description?: string, nos?: number, l?: number, b?: number, h?: number, deduct?: boolean }[]} rows
 */
export function measurementQty(rows = []) {
  let total = 0;
  for (const row of rows) {
    const dims = [row.nos, row.l, row.b, row.h].filter((v) => v !== undefined && v !== null && v !== '');
    if (!dims.length) continue;
    const value = dims.reduce((a, v) => a * Number(v), 1);
    total += row.deduct ? -value : value;
  }
  return q3(total);
}

/** A quantity with its wastage allowance, rounded to 3 dp. Quantity rounding happens once, here. */
export const effectiveQty = (qty, wastagePct) => q3(Number(qty || 0) * (1 + Number(wastagePct || 0) / 100));

/** Whole packs to buy (bags, tins, boxes), rounded up; `null` without a pack size. */
export const packs = (qty, packSize) => (packSize > 0 ? Math.ceil(Number(qty) / packSize - 1e-9) : null);

/**
 * What `qty` units of work need, from a recipe written for `recipeQty` units: each component scaled,
 * with its wastage. Quantities only — the take-off of a quotation is the sum of these per material and
 * per trade (Phase L3).
 * @param {{ recipeQty?: number, components: { kind: string, materialId?: string, tradeId?: string,
 *   description?: string, unit?: string, qty: number, wastagePct?: number }[] }} recipe
 * @param {number} qty
 */
export function takeOff(recipe, qty) {
  const scale = Number(qty || 0) / (Number(recipe.recipeQty) > 0 ? Number(recipe.recipeQty) : 1);
  return recipe.components.map((c) => ({
    kind: c.kind,
    materialId: c.materialId ?? null,
    tradeId: c.tradeId ?? null,
    description: c.description ?? null,
    unit: c.unit,
    qty: effectiveQty(Number(c.qty) * scale, c.wastagePct),
  }));
}

/** A sum of quantities, rounded to 3 dp once (a take-off adding up the same material across rows). */
export const sumQty = (values) => q3(values.reduce((a, v) => a + Number(v || 0), 0));

/** What is still to buy: the need less what is in stock, never below zero. */
export const shortfall = (need, onHand) => q3(Math.max(0, Number(need || 0) - Number(onHand || 0)));
