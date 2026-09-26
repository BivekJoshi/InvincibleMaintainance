/**
 * The money wall (decision D1). Field staff report work — quantities, photos, time — and never
 * see what it sells for, what it costs, or what a colleague is paid.
 *
 * `fieldSafe` drops every money-bearing key, at any depth, from a `/tech` response. It runs on the
 * whole field router (`routes/tech.routes.js`), so an include added later cannot leak a price by
 * accident; `tests/api/06-tech.test.js` scans every field response to prove it.
 */

/** A key is money when one of its camelCase words is one of these. */
const MONEY_WORDS = new Set([
  'rate', 'rates', 'amount', 'amounts', 'total', 'totals', 'subtotal', 'discount', 'margin', 'balance',
  'cost', 'costs', 'price', 'prices', 'wage', 'wages', 'paid', 'vat', 'estimate',
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
