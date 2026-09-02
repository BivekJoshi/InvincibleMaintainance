import { describe, it, expect } from 'vitest';
import { toPaisa, toRupees, lineAmount, documentTotals, formatNpr, sum } from '../src/utils/money.js';

describe('money — integer paisa arithmetic', () => {
  it('converts rupees to paisa without float drift', () => {
    expect(toPaisa(220)).toBe(22000);
    expect(toPaisa(0.1)).toBe(10);
    expect(toPaisa(1234.56)).toBe(123456);
    // 0.1 + 0.2 territory — the reason money is never a float here
    expect(toPaisa(19.99)).toBe(1999);
    expect(Number.isInteger(toPaisa(47642.17))).toBe(true);
  });

  it('round-trips', () => {
    expect(toRupees(toPaisa(97642.17))).toBeCloseTo(97642.17, 2);
  });

  it('computes fractional-quantity line amounts as integers', () => {
    const amount = lineAmount(210.5, toPaisa(220));
    expect(amount).toBe(4631000);
    expect(Number.isInteger(amount)).toBe(true);
  });

  it('applies VAT once at document level, not per line', () => {
    const items = [
      { qty: 210.5, rate: toPaisa(220) },
      { qty: 210.5, rate: toPaisa(95) },
      { qty: 210.5, rate: toPaisa(45) },
    ];
    const t = documentTotals(items, { discount: toPaisa(1500), vatRate: 13 });
    expect(t.subtotal).toBe(7578000);
    expect(t.discount).toBe(150000);
    expect(t.vatAmount).toBe(965640);
    expect(t.total).toBe(8393640);
    expect(formatNpr(t.total)).toBe('Rs. 83,936.40');
    // every component is an integer number of paisa
    for (const v of [t.subtotal, t.discount, t.vatAmount, t.total]) expect(Number.isInteger(v)).toBe(true);
  });

  it('never lets a discount exceed the subtotal', () => {
    const t = documentTotals([{ qty: 1, rate: toPaisa(100) }], { discount: toPaisa(500) });
    expect(t.discount).toBe(10000);
    expect(t.total).toBe(0);
  });

  it('skips VAT when not applied', () => {
    const t = documentTotals([{ qty: 2, rate: toPaisa(1000) }], { vatApplied: false });
    expect(t.vatAmount).toBe(0);
    expect(t.total).toBe(200000);
  });

  it('sums line amounts back to the subtotal exactly', () => {
    const items = Array.from({ length: 37 }, (_, i) => ({ qty: 1 + i / 3, rate: toPaisa(99.99) }));
    const t = documentTotals(items, { vatApplied: false });
    expect(sum(t.lines.map((l) => l.amount))).toBe(t.subtotal);
  });
});
