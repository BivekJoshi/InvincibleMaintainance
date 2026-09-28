import { can } from '../shared/permissions.js';

/**
 * The money wall, two layers.
 *
 * **The field wall (decision D1).** Field staff report work — quantities, photos, time — and never
 * see what it sells for, what it costs, or what a colleague is paid.
 *
 * `fieldSafe` drops every money-bearing key, at any depth, from a `/tech` response. It runs on the
 * whole field router (`routes/tech.routes.js`), so an include added later cannot leak a price by
 * accident; `tests/api/06-tech.test.js` scans every field response to prove it.
 */

/** A key is money when one of its camelCase words is one of these. */
const MONEY_WORDS = new Set([
  'rate', 'rates', 'amount', 'amounts', 'total', 'totals', 'subtotal', 'discount', 'margin', 'balance',
  'cost', 'costs', 'price', 'prices', 'wage', 'wages', 'paid', 'vat', 'estimate', 'overhead', 'profit',
]);

/** Named like money, but not money: the unit a service is sold in ("sq.ft"). */
const NOT_MONEY = new Set(['priceUnit']);

/** `hourlyRate`, `total`, `costAmount` are money; `rateCardItemId` (a link) and `customerRating` are not. */
export function isMoneyKey(key) {
  if (NOT_MONEY.has(key) || key.endsWith('Id')) return false;
  return key.split(/(?=[A-Z])/).some((word) => MONEY_WORDS.has(word.toLowerCase()));
}

/** A deep copy of `value` without money keys. Dates and primitives pass through. */
export function fieldSafe(value) {
  if (Array.isArray(value)) return value.map(fieldSafe);
  if (value === null || typeof value !== 'object' || value instanceof Date) return value;
  return Object.fromEntries(
    Object.entries(value).filter(([key]) => !isMoneyKey(key)).map(([key, v]) => [key, fieldSafe(v)]),
  );
}

/**
 * **The staff cost wall (L-D4, Phase L2).** Office staff see selling rates; only `costs:read` (MANAGER,
 * and ADMIN through '*') sees what work COSTS the company and the margin on it. These keys carry that,
 * wherever they appear — narrower than the field rule, because `rate` and `total` stay.
 */
export const COST_KEYS = Object.freeze([
  'cost', 'unitCost', 'lineCost', 'costAmount', 'costTotal', 'costBreakdown', 'costComplete',
  'margin', 'marginPct', 'overheadPct', 'profitPct', 'purchaseRate', 'dayWage',
]);
const COST_KEY_SET = new Set(COST_KEYS);

/** Whether a caller (`{ role }`, as mountResource passes it) sees cost and margin. */
export const seesCosts = (ctx) => Boolean(ctx?.role && can(ctx.role, 'costs:read'));

function withoutCosts(value) {
  if (Array.isArray(value)) return value.map(withoutCosts);
  if (value === null || typeof value !== 'object' || value instanceof Date) return value;
  return Object.fromEntries(
    Object.entries(value).filter(([key]) => !COST_KEY_SET.has(key)).map(([key, v]) => [key, withoutCosts(v)]),
  );
}

/** `value` as the caller may see it: unchanged for costs:read, otherwise a deep copy without COST_KEYS. */
export const stripCosts = (value, ctx) => (seesCosts(ctx) ? value : withoutCosts(value));
