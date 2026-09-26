import { describe, it, expect } from 'vitest';
import { fieldSafe, isMoneyKey } from '../src/utils/moneyWall.js';

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
