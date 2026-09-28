import { describe, it, expect } from 'vitest';
import {
  toPaisa, toRupees, lineAmount, documentTotals, formatNpr, sum,
  allocate, recipeCost, sellRate, margin, boqTotals, paymentSchedule, finalBillTotals, rs, proRata,
  discountForPct, discountForTarget, amountInWords,
} from '../src/utils/money.js';

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

/** A tiny deterministic PRNG, so the property tests are the same on every run. */
function seeded(seed) {
  let x = seed >>> 0;
  return () => { x = (x * 1664525 + 1013904223) >>> 0; return x / 2 ** 32; };
}

describe('money — Phase L2 building blocks', () => {
  it('allocate splits by largest remainder, always summing to the total', () => {
    expect(allocate(100, [1, 1, 1])).toEqual([34, 33, 33]);
    expect(allocate(1000, [5000, 4000, 1000])).toEqual([500, 400, 100]);
    expect(allocate(7, [1, 1])).toEqual([4, 3]); // a tie goes to the earlier part
    expect(allocate(0, [3, 7])).toEqual([0, 0]);
    expect(() => allocate(10, [0, 0])).toThrow();
    const rnd = seeded(42);
    for (let i = 0; i < 500; i += 1) {
      const total = Math.floor(rnd() * 10_000_000);
      const weights = Array.from({ length: 1 + Math.floor(rnd() * 6) }, () => 1 + Math.floor(rnd() * 9000));
      const parts = allocate(total, weights);
      expect(sum(parts)).toBe(total);
      expect(parts.every(Number.isInteger)).toBe(true);
    }
  });

  it('recipeCost prices a batch, per unit, and its buckets add up (the plaster hand calculation)', () => {
    // Internal plaster 12 mm, 1:4, per 100 sq.ft (recipeQty 100):
    //   cement 0.9 bag  +2% wastage × Rs 850   = 0.9 × 85000 × 102/100 = 78030.00
    //   sand   5.5 cu.ft +5% × Rs 95            = 5.5 × 9500 × 105/100  = 54862.5 → 54863
    //   mason  1.2 day × Rs 1,500 = 180000 · helper 1.2 day × Rs 1,000 = 120000
    //   other  scaffolding & water 1 × Rs 150  = 15000
    // per sq.ft: material 132893/100 = 1328.93 → 1329 · labour 3000 · other 150 → direct 4479
    // overhead 10% = 447.9 → 448 → unit cost 4927 paisa (Rs 49.27)
    const cost = recipeCost([
      { kind: 'MATERIAL', qty: 0.9, wastagePct: 2, price: 85000 },
      { kind: 'MATERIAL', qty: 5.5, wastagePct: 5, price: 9500 },
      { kind: 'LABOUR', qty: 1.2, price: 150000 },
      { kind: 'LABOUR', qty: 1.2, price: 100000 },
      { kind: 'OTHER', qty: 1, price: 15000 },
    ], { recipeQty: 100, overheadPct: 10 });
    expect(cost).toMatchObject({ material: 1329, labour: 3000, equipment: 0, other: 150, direct: 4479, overhead: 448, unitCost: 4927, complete: true });
    expect(cost.lines.map((l) => l.lineCost)).toEqual([78030, 54863, 180000, 120000, 15000]);
    expect(cost.material + cost.labour + cost.equipment + cost.other).toBe(cost.direct);
  });

  it('recipeCost says when a price is unknown instead of pricing it at zero', () => {
    const cost = recipeCost([{ kind: 'MATERIAL', qty: 1, price: null }, { kind: 'LABOUR', qty: 1, price: 100000 }], { recipeQty: 1 });
    expect(cost.complete).toBe(false);
    expect(cost.labour).toBe(100000);
    expect(recipeCost([], {}).complete).toBe(false);
  });

  it('sellRate adds profit, rounds UP to the step, and never eats margin', () => {
    // 4927 × 115% = 5666.05 → 5666 → up to the next Rs 1 → 5700 (Rs 57.00)
    expect(sellRate(4927, { profitPct: 15, roundTo: 100 })).toBe(5700);
    expect(sellRate(4927, { profitPct: 15, roundTo: 0 })).toBe(5666);
    expect(sellRate(5600, { profitPct: 0, roundTo: 100 })).toBe(5600);
    expect(sellRate(null, { profitPct: 15 })).toBeNull();
  });

  it('margin is on the selling price, and unknown without a cost', () => {
    expect(margin(5700, 4927)).toEqual({ amount: 773, pct: 13.56 });
    expect(margin(5700, null)).toBeNull();
    expect(margin(0, 100)).toEqual({ amount: -100, pct: null });
  });

  it('boqTotals leaves sections, notes and optional rows out of the money, and subtotals each section', () => {
    const rows = [
      { rowType: 'SECTION', title: 'A. Waterproofing' },
      { rowType: 'ITEM', qty: 100, rate: 27500 },
      { rowType: 'NOTE', title: 'Surface to be dry' },
      { rowType: 'ITEM', qty: 2, rate: 5000, isOptional: true },
      { rowType: 'SECTION', title: 'B. Finishing' },
      { rowType: 'ITEM', qty: 10.5, rate: 4500 },
    ];
    const t = boqTotals(rows, { discount: 0, vatApplied: true, vatRate: 13 });
    expect(t.subtotal).toBe(2750000 + 47250);
    expect(t.sections.map((x) => x.subtotal)).toEqual([2750000, 47250]);
    expect(t.optionalTotal).toBe(10000);
    expect(t.rowAmounts).toEqual([null, 2750000, null, 10000, null, 47250]);
    expect(t.total).toBe(documentTotals([{ qty: 100, rate: 27500 }, { qty: 10.5, rate: 4500 }], { vatRate: 13 }).total);
  });

  it('rs rounds half away from zero; proRata scales a whole', () => {
    expect(rs(2.5)).toBe(3);
    expect(rs(-2.5)).toBe(-3);
    expect(rs(-2.4)).toBe(-2);
    expect(proRata(10000, 1, 3)).toBe(3333);
    expect(proRata(10000, 0, 0)).toBe(0);
  });

  it('property: a payment schedule sums to the quotation total, and advance + running + final equal the contract', () => {
    const rnd = seeded(2026);
    for (let i = 0; i < 1000; i += 1) {
      const lines = Array.from({ length: 1 + Math.floor(rnd() * 8) }, () => ({
        qty: Math.round(rnd() * 50000) / 100, rate: Math.floor(rnd() * 500000),
      }));
      const opts = { discount: Math.floor(rnd() * 100000), vatApplied: rnd() > 0.2, vatRate: 13 };
      const contract = documentTotals(lines, opts);
      const cuts = [1 + Math.floor(rnd() * 8000)];
      cuts.push(1 + Math.floor(rnd() * (9999 - cuts[0])));
      const stages = [{ basisPoints: cuts[0] }, { basisPoints: cuts[1] }, { basisPoints: 10000 - cuts[0] - cuts[1] }];
      const schedule = paymentSchedule(contract, stages);
      expect(sum(schedule.map((st) => st.total))).toBe(contract.total);
      expect(sum(schedule.map((st) => st.taxable))).toBe(contract.subtotal - contract.discount);
      expect(sum(schedule.map((st) => st.vat))).toBe(contract.vatAmount);
      expect(schedule.every((st) => st.vat >= 0 && st.taxable >= 0)).toBe(true);

      // The first two stages were billed; the final bill is the contract less them.
      const final = finalBillTotals(lines, schedule.slice(0, 2), opts);
      expect(final.due.total + schedule[0].total + schedule[1].total).toBe(contract.total);
      expect(final.due.vat + schedule[0].vat + schedule[1].vat).toBe(contract.vatAmount);
    }
  });
});

describe('money — discount helpers (Phase L3)', () => {
  it('a percentage discount is rounded once and never above the subtotal', () => {
    expect(discountForPct(1000000, 5)).toBe(50000);
    expect(discountForPct(333333, 10)).toBe(33333);
    expect(discountForPct(1000, 150)).toBe(1000);
    expect(discountForPct(1000, -5)).toBe(0);
  });

  it('a target total (VAT included) gives the discount that lands on it to the paisa', () => {
    // Rs 10,000 + 13% VAT = Rs 11,300; the customer wants "Rs 11,000 flat".
    const discount = discountForTarget(1000000, 1100000, { vatApplied: true, vatRate: 13 });
    expect(discount).toBe(26549);
    expect(documentTotals([{ qty: 1, rate: 1000000 }], { discount, vatRate: 13 }).total).toBe(1100000);
    expect(discountForTarget(1000000, 900000, { vatApplied: false })).toBe(100000);
    expect(discountForTarget(1000000, 2000000, { vatApplied: true, vatRate: 13 })).toBe(0); // above the price: none
  });

  it('property: a reachable target is hit exactly, an unreachable one is not exceeded', () => {
    const rnd = seeded(7);
    for (let i = 0; i < 500; i += 1) {
      const subtotal = 1 + Math.floor(rnd() * 50_000_000);
      const target = Math.floor(rnd() * subtotal * 1.13);
      const discount = discountForTarget(subtotal, target, { vatApplied: true, vatRate: 13 });
      const total = documentTotals([{ qty: 1, rate: subtotal }], { discount, vatRate: 13 }).total;
      expect(total).toBeLessThanOrEqual(target);
      expect(target - total).toBeLessThanOrEqual(1);
    }
  });
});

describe('money — the amount in words (Phase L4, lakh and crore)', () => {
  it('English, in the Nepali/Indian grouping', () => {
    expect(amountInWords(1234567890, 'en')).toBe('Rupees One Crore Twenty-Three Lakh Forty-Five Thousand Six Hundred Seventy-Eight and Ninety Paisa Only');
    expect(amountInWords(282387000, 'en')).toBe('Rupees Twenty-Eight Lakh Twenty-Three Thousand Eight Hundred Seventy Only');
    expect(amountInWords(100, 'en')).toBe('Rupees One Only');
    expect(amountInWords(5, 'en')).toBe('Rupees Zero and Five Paisa Only');
    expect(amountInWords(0, 'en')).toBe('Rupees Zero Only');
    expect(amountInWords(150000000000, 'en')).toBe('Rupees One Hundred Fifty Crore Only');
  });

  it('Nepali, with its own word for every number to ninety-nine', () => {
    expect(amountInWords(1234567890, 'ne')).toBe('रुपैयाँ एक करोड तेइस लाख पैँतालीस हजार छ सय अठहत्तर र नब्बे पैसा मात्र');
    expect(amountInWords(282387000, 'ne')).toBe('रुपैयाँ अट्ठाइस लाख तेइस हजार आठ सय सत्तरी मात्र');
    expect(amountInWords(9900, 'ne')).toBe('रुपैयाँ उनान्सय मात्र');
    expect(amountInWords(0, 'ne')).toBe('रुपैयाँ शून्य मात्र');
  });
});

describe('outstanding and rupeesText (Phase I)', () => {
  it('what is owed never goes below zero', async () => {
    const { outstanding } = await import('../src/utils/money.js');
    expect(outstanding(1_000_000, 250_050)).toBe(749_950);
    expect(outstanding(1_000_000, 1_000_000)).toBe(0);
    expect(outstanding(1_000_000, 1_000_001)).toBe(0);
    expect(outstanding(null, undefined)).toBe(0);
  });

  it('paisa as plain rupees for a CSV cell — exact, signed, two decimals', async () => {
    const { rupeesText } = await import('../src/utils/money.js');
    expect(rupeesText(123456)).toBe('1234.56');
    expect(rupeesText(5)).toBe('0.05');
    expect(rupeesText(-5)).toBe('-0.05');
    expect(rupeesText(0)).toBe('0.00');
    expect(rupeesText(1_234_567_890)).toBe('12345678.90');
    expect(rupeesText(null)).toBe('0.00');
  });
});

describe('stageDocument — a payment stage as an invoice (Phase L6)', () => {
  it('bills the stage exactly: its own VAT, never VAT recomputed on the part', async () => {
    const { documentTotals, paymentSchedule, stageDocument } = await import('../src/utils/money.js');
    // A total where 13 % of each part rounds differently from the split of the whole's VAT.
    let found = null;
    for (let subtotal = 1001; subtotal < 5000 && !found; subtotal += 1) {
      const t = documentTotals([{ qty: 1, rate: subtotal }], { vatRate: 13 });
      const stages = paymentSchedule(t, [{ basisPoints: 3333 }, { basisPoints: 3333 }, { basisPoints: 3334 }]);
      if (stages.some((st) => Math.round((st.taxable * 13) / 100) !== st.vat)) found = { t, stages };
    }
    expect(found).not.toBeNull();
    const docs = found.stages.map((st) => stageDocument(st, { description: 'Stage', vatRate: 13 }));
    docs.forEach((d, i) => {
      expect(d.total).toBe(found.stages[i].total);
      expect(d.vatAmount).toBe(found.stages[i].vat);
      expect(d.lines).toEqual([{ description: 'Stage', unit: 'lump', qty: 1, rate: found.stages[i].taxable, amount: found.stages[i].taxable, sortOrder: 0 }]);
    });
    expect(docs.reduce((a, d) => a + d.total, 0)).toBe(found.t.total);
    expect(docs.reduce((a, d) => a + d.vatAmount, 0)).toBe(found.t.vatAmount);
  });

  it('1,000 random schedules: the stage invoices add up to the quotation to the paisa', async () => {
    const { documentTotals, paymentSchedule, stageDocument } = await import('../src/utils/money.js');
    let seed = 42;
    const rand = (n) => { seed = (seed * 1103515245 + 12345) % 2 ** 31; return seed % n; };
    for (let run = 0; run < 1000; run += 1) {
      const lines = Array.from({ length: 1 + rand(6) }, () => ({ qty: (1 + rand(5000)) / 10, rate: 100 + rand(90_000) }));
      const t = documentTotals(lines, { discount: rand(2) ? rand(50_000) : 0, vatApplied: rand(5) > 0, vatRate: 13 });
      const n = 1 + rand(4);
      const cuts = Array.from({ length: n - 1 }, () => 1 + rand(9998)).sort((a, b) => a - b);
      const bps = [...cuts, 10000].map((c, i) => c - (i ? cuts[i - 1] : 0)).filter((b) => b > 0);
      const docs = paymentSchedule(t, bps.map((basisPoints) => ({ basisPoints })))
        .map((st) => stageDocument(st, { description: 'x', vatApplied: t.vatApplied }));
      expect(docs.reduce((a, d) => a + d.total, 0), `run ${run}`).toBe(t.total);
    }
  });
});

describe('finalBillDocument — the closing bill after stage bills (Phase L6)', () => {
  it('the contract less the advance: VAT reconciles, and advance + final = contract to the paisa', async () => {
    const { documentTotals, finalBillDocument, paymentSchedule, stageDocument } = await import('../src/utils/money.js');
    const lines = [
      { description: 'Crystalline treatment', unit: 'sq.ft', qty: 210.5, rate: 22000 },
      { description: 'Waterproof plaster', unit: 'sq.ft', qty: 210.5, rate: 9500 },
      { description: 'Anti-fungal paint', unit: 'sq.ft', qty: 210.5, rate: 4500 },
    ];
    const contract = documentTotals(lines, { discount: 150_000, vatRate: 13 });
    const [advance] = paymentSchedule(contract, [{ basisPoints: 5000 }, { basisPoints: 4000 }, { basisPoints: 1000 }]);
    const advanceBill = stageDocument(advance, { description: 'Advance' });
    const final = finalBillDocument(lines, [{ description: 'Less: advance', taxable: advance.taxable, vat: advance.vat }], { discount: 150_000, vatRate: 13 });
    expect(advanceBill.total + final.total).toBe(contract.total);
    expect(advanceBill.vatAmount + final.vatAmount).toBe(contract.vatAmount);
    expect(final.total).toBe(final.subtotal - final.discount + final.vatAmount);
    expect(final.lines.at(-1)).toMatchObject({ description: 'Less: advance', qty: 1, rate: -advance.taxable, amount: -advance.taxable });
    expect(final.lines.reduce((a, l) => a + l.amount, 0)).toBe(final.subtotal);
  });

  it('with no earlier bill it is the contract itself', async () => {
    const { documentTotals, finalBillDocument } = await import('../src/utils/money.js');
    const lines = [{ description: 'Lump', qty: 1, rate: 1_234_567 }];
    const a = finalBillDocument(lines, [], { discount: 1000 });
    const b = documentTotals(lines, { discount: 1000 });
    expect([a.subtotal, a.discount, a.vatAmount, a.total]).toEqual([b.subtotal, b.discount, b.vatAmount, b.total]);
  });
});
