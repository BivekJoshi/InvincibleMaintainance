/**
 * All money in this system is an integer number of paisa (NPR x 100).
 * Nothing multiplies or divides money outside this module.
 */

export const toPaisa = (rupees) => Math.round(Number(rupees || 0) * 100);
export const toRupees = (paisa) => Number(paisa || 0) / 100;

/** Round half-up to the nearest paisa. */
const r = (n) => Math.round(n + Number.EPSILON);

/** qty may be fractional (e.g. 12.5 sq.ft); rate is paisa per unit. */
export function lineAmount(qty, ratePaisa) {
  return r(Number(qty || 0) * Number(ratePaisa || 0));
}

/**
 * Compute document totals once, at document level, so VAT never accumulates
 * per-line rounding error.
 * @param {{qty:number, rate:number}[]} items
 * @param {{discount?:number, vatApplied?:boolean, vatRate?:number}} opts
 */
export function documentTotals(items, { discount = 0, vatApplied = true, vatRate = 13 } = {}) {
  const lines = items.map((i) => ({ ...i, amount: lineAmount(i.qty, i.rate) }));
  const subtotal = lines.reduce((sum, l) => sum + l.amount, 0);
  const safeDiscount = Math.min(Math.max(0, r(discount)), subtotal);
  const taxable = subtotal - safeDiscount;
  const vatAmount = vatApplied ? r((taxable * vatRate) / 100) : 0;
  return { lines, subtotal, discount: safeDiscount, vatApplied, vatRate, vatAmount, total: taxable + vatAmount };
}

export function formatNpr(paisa, { withSymbol = true } = {}) {
  const value = toRupees(paisa);
  const s = new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);
  return withSymbol ? `Rs. ${s}` : s;
}

/** Sums a list of paisa amounts safely. */
export const sum = (nums) => nums.reduce((a, b) => a + Number(b || 0), 0);
