import { describe, it, expect } from 'vitest';
import { effectiveQty, measurementQty, packs, takeOff } from '../src/utils/quantity.js';

describe('quantity — measurements, wastage, packs, take-off (no money here)', () => {
  it('a measurement sheet: nos × L × B × H, missing dimensions ignored, deductions subtract', () => {
    // Bedroom walls: 2 × 12 × 9 + 2 × 10 × 9 = 396 sq.ft, less a door 3 × 7 and a window 2 × (4 × 4)
    const rows = [
      { area: 'Bedroom', description: 'Long walls', nos: 2, l: 12, h: 9 },
      { area: 'Bedroom', description: 'Short walls', nos: 2, l: 10, h: 9 },
      { area: 'Bedroom', description: 'Door', l: 3, h: 7, deduct: true },
      { area: 'Bedroom', description: 'Windows', nos: 2, l: 4, h: 4, deduct: true },
    ];
    expect(measurementQty(rows)).toBe(396 - 21 - 32);
    expect(measurementQty([{ description: 'Nothing measured' }])).toBe(0);
    expect(measurementQty([{ l: 0.1, b: 0.2 }, { l: 0.1, b: 0.1 }])).toBe(0.03);
  });

  it('effectiveQty adds wastage and rounds to 3 dp once', () => {
    expect(effectiveQty(15, 10)).toBe(16.5);
    expect(effectiveQty(0.3333, 0)).toBe(0.333);
    expect(effectiveQty(null, 5)).toBe(0);
  });

  it('packs round up to whole packs, and an exact multiple is not rounded past', () => {
    expect(packs(101, 50)).toBe(3);
    expect(packs(0.3, 0.1)).toBe(3);
    expect(packs(100, 50)).toBe(2);
    expect(packs(5, null)).toBeNull();
  });

  it('takeOff scales a recipe to a quantity, with wastage', () => {
    const recipe = {
      recipeQty: 100,
      components: [
        { kind: 'MATERIAL', materialId: 'cem', unit: 'bag', qty: 0.9, wastagePct: 2 },
        { kind: 'LABOUR', tradeId: 'mason', unit: 'day', qty: 1.2 },
      ],
    };
    expect(takeOff(recipe, 250)).toEqual([
      { kind: 'MATERIAL', materialId: 'cem', tradeId: null, description: null, unit: 'bag', qty: 2.295 },
      { kind: 'LABOUR', materialId: null, tradeId: 'mason', description: null, unit: 'day', qty: 3 },
    ]);
  });
});
