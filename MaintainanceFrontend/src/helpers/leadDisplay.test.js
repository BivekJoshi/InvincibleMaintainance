import { describe, it, expect } from 'vitest';
import { describeEstimate, mergePreview } from '@/helpers/leadDisplay';

describe('website estimate', () => {
  it('reads as sentences, money from paisa', () => {
    expect(describeEstimate({
      serviceId: 's1', name: 'Seepage treatment', qty: 120, unit: 'sq.ft',
      rateMin: 22000, rateMax: 30000, min: 2640000, max: 3600000, display: {}, disclaimer: 'indicative',
    })).toEqual([
      ['For', 'Seepage treatment'],
      ['Size', '120 sq.ft'],
      ['Rate', 'Rs. 220.00 – Rs. 300.00 per sq.ft'],
      ['Shown', 'Rs. 26,400.00 – Rs. 36,000.00'],
    ]);
    expect(describeEstimate({ name: 'Fixed', qty: 1, rateMin: 150050, rateMax: 150050, min: 150050, max: 150050 }))
      .toEqual([['For', 'Fixed'], ['Size', '1'], ['Rate', 'Rs. 1,500.50'], ['Shown', 'Rs. 1,500.50']]);
  });

  it('is empty without a payload', () => {
    expect(describeEstimate(null)).toEqual([]);
    expect(describeEstimate('nope')).toEqual([]);
  });
});

describe('merge preview', () => {
  it('sums what moves', () => {
    expect(mergePreview([
      { _count: { notes: 1, activities: 3, quotations: 0, jobs: 1 } },
      { _count: { notes: 0, activities: 1, quotations: 1, jobs: 0 } },
    ])).toBe('1 note, 4 timeline entries, 1 quotation, 1 job');
    expect(mergePreview([{ _count: { notes: 0, activities: 1, quotations: 0, jobs: 0 } }])).toBe('1 timeline entry');
    expect(mergePreview([{ _count: {} }])).toBeNull();
  });
});
