import { describe, expect, it } from 'vitest';
import {
  formatQty, isBlankMeasurement, measurementRowValue, measurementTotal, measurementsBody, parseLength,
} from './measurements';

describe('parseLength — feet-inches as typed on site', () => {
  it('reads feet and inches as decimal feet', () => {
    expect(parseLength('12\'6"')).toBe(12.5);
    expect(parseLength('12\'')).toBe(12);
    expect(parseLength('6"')).toBe(0.5);
    expect(parseLength('12\' 6')).toBe(12.5);
    expect(parseLength('12\'-6"')).toBe(12.5);
    expect(parseLength('10 ft 3 in')).toBe(10.25);
    expect(parseLength('12’6”')).toBe(12.5);
  });

  it('reads plain numbers, with grouping', () => {
    expect(parseLength('12.5')).toBe(12.5);
    expect(parseLength('1,200')).toBe(1200);
    expect(parseLength(7)).toBe(7);
  });

  it('says blank is nothing and nonsense is NaN', () => {
    expect(parseLength('')).toBeUndefined();
    expect(parseLength('  ')).toBeUndefined();
    expect(parseLength(null)).toBeUndefined();
    expect(parseLength('twelve')).toBeNaN();
    expect(parseLength('12\'6"7')).toBeNaN();
  });
});

describe('the measurement sheet preview', () => {
  it('multiplies the dimensions a row has, and a deduction subtracts', () => {
    expect(measurementRowValue({ nos: 2, l: '12\'6"', h: '10\'' })).toBe(250);
    expect(measurementRowValue({ l: 10, b: 12 })).toBe(120);
    expect(measurementRowValue({ nos: 3 })).toBe(3);
    expect(measurementRowValue({ nos: 1, l: '3\'', h: '7\'', deduct: true })).toBe(-21);
    expect(measurementRowValue({ area: 'Bedroom' })).toBeNull();
    expect(measurementRowValue({ l: 'long' })).toBeNull();
  });

  it('totals the sheet to 3 dp, as the server rounds', () => {
    const rows = [
      { area: 'बैठक कोठा', description: 'North wall', nos: 1, l: '12\'4"', h: '10\'' },
      { area: 'बैठक कोठा', description: 'Door', nos: 1, l: '3\'', h: '7\'', deduct: true },
      { area: '', description: '' },
    ];
    expect(measurementTotal(rows)).toBe(102.333);
  });

  it('sends lengths as numbers and drops blank rows', () => {
    expect(isBlankMeasurement({ area: ' ', nos: '' })).toBe(true);
    expect(measurementsBody([
      { area: ' Kitchen ', description: 'Floor', nos: '', l: '10\'6"', b: '8\'', h: '', deduct: false },
      { area: '', description: '', nos: '', l: '', b: '', h: '' },
      { description: 'Window', nos: '2', l: '4\'', h: '5\'', deduct: true },
    ])).toEqual([
      { area: 'Kitchen', description: 'Floor', l: 10.5, b: 8 },
      { description: 'Window', nos: 2, l: 4, h: 5, deduct: true },
    ]);
  });

  it('formats a quantity with at most 3 decimals', () => {
    expect(formatQty(102.33333)).toBe('102.333');
    expect(formatQty(1250)).toBe('1,250');
    expect(formatQty('')).toBe('');
  });
});
