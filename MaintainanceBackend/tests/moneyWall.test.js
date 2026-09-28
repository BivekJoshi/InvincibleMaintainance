import { describe, it, expect } from 'vitest';
import { COST_KEYS, fieldSafe, isMoneyKey, seesCosts, stripCosts } from '../src/utils/moneyWall.js';

describe('moneyWall', () => {
  it('names money by its words, not by accident', () => {
    for (const k of ['rate', 'hourlyRate', 'total', 'subtotal', 'vatAmount', 'costAmount', 'unitCost', 'paidAmount', 'dayWage', 'estimateMin', 'priceFrom', 'discount', 'marginPct']) {
      expect(isMoneyKey(k), k).toBe(true);
    }
    for (const k of ['rateCardItemId', 'customerRating', 'priceUnit', 'qty', 'unit', 'estimatedDays', 'createdAt', 'notes']) {
      expect(isMoneyKey(k), k).toBe(false);
    }
  });

  it('strips at every depth and keeps everything else, dates included', () => {
    const at = new Date('2026-09-26T04:15:00Z');
    const out = fieldSafe({
      id: 'j1', startedAt: at, quotation: { id: 'q1', number: 'QT-1', total: 1000 },
      assignments: [{ technician: { id: 't1', hourlyRate: 45000, user: { name: 'हरि' } } }],
      materials: [{ qty: 2, rate: 9900, material: { id: 'm1', unit: 'kg' } }],
      tags: ['a', 'b'], note: null,
    });
    expect(out).toEqual({
      id: 'j1', startedAt: at, quotation: { id: 'q1', number: 'QT-1' },
      assignments: [{ technician: { id: 't1', user: { name: 'हरि' } } }],
      materials: [{ qty: 2, material: { id: 'm1', unit: 'kg' } }],
      tags: ['a', 'b'], note: null,
    });
    expect(out.startedAt).toBeInstanceOf(Date);
  });
});

describe('the staff cost wall (L-D4)', () => {
  const item = {
    code: 'PLASTER-INT', rate: 5700, derivedRate: 5800, unitCost: 4927, overheadPct: 10, profitPct: 15,
    costBreakdown: { material: 1329, unitCost: 4927 }, margin: { amount: 773, pct: 13.56 },
    components: [{ kind: 'MATERIAL', qty: 0.9, lineCost: 78030, material: { name: 'Cement', purchaseRate: 85000 } },
      { kind: 'LABOUR', qty: 1.2, trade: { name: 'Mason', dayWage: 150000 } }, { kind: 'OTHER', qty: 1, cost: 15000 }],
  };

  it('only MANAGER and ADMIN see costs', () => {
    expect(['ADMIN', 'MANAGER'].filter((role) => seesCosts({ role }))).toEqual(['ADMIN', 'MANAGER']);
    for (const role of ['SALES', 'ACCOUNTANT', 'DISPATCHER', 'EDITOR', 'TECHNICIAN', 'SURVEYOR']) expect(seesCosts({ role }), role).toBe(false);
    expect(seesCosts(undefined)).toBe(false);
  });

  it('SALES keeps selling rates and quantities, and loses every cost', () => {
    expect(stripCosts(item, { role: 'SALES' })).toEqual({
      code: 'PLASTER-INT', rate: 5700, derivedRate: 5800,
      components: [{ kind: 'MATERIAL', qty: 0.9, material: { name: 'Cement' } }, { kind: 'LABOUR', qty: 1.2, trade: { name: 'Mason' } }, { kind: 'OTHER', qty: 1 }],
    });
  });

  it('a manager gets it all, untouched', () => {
    expect(stripCosts(item, { role: 'MANAGER' })).toBe(item);
  });

  it('every cost key is also money on the field wall', () => {
    expect(COST_KEYS.filter((k) => !isMoneyKey(k))).toEqual([]);
  });
});
