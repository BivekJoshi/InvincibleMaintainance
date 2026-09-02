import { describe, it, expect } from 'vitest';
import { adToBs, bsToAd, formatBs, fiscalYear, fiscalYearLabel } from '../src/utils/nepaliDate.js';

describe('Bikram Sambat conversion', () => {
  it('matches known anchor dates', () => {
    // Nepali New Year 2057 fell on 13 April 2000
    expect(adToBs(new Date('2000-04-13'))).toEqual({ year: 2057, month: 1, day: 1 });
    // 1 January 2024 was Poush 17, 2080
    expect(adToBs(new Date('2024-01-01'))).toEqual({ year: 2080, month: 9, day: 17 });
    expect(formatBs(new Date('2026-09-01'))).toBe('2083-05-16');
  });

  it('round-trips AD -> BS -> AD', () => {
    for (const iso of ['2020-06-15', '2024-01-01', '2025-09-01', '2026-04-14']) {
      const d = new Date(iso);
      const { year, month, day } = adToBs(d);
      expect(bsToAd(year, month, day).toISOString().slice(0, 10)).toBe(iso);
    }
  });

  it('renders long-form month names', () => {
    expect(formatBs(new Date('2026-09-01'), { long: true })).toBe('16 Bhadra 2083');
    expect(formatBs(new Date('2026-09-01'), { long: true, locale: 'ne' })).toBe('16 भदौ 2083');
  });

  it('starts the fiscal year at Shrawan (month 4)', () => {
    // Bhadra (month 5) is inside FY 2083/84
    expect(fiscalYear(new Date('2026-09-01'))).toBe(2083);
    expect(fiscalYearLabel(new Date('2026-09-01'))).toBe('2083/84');
    // Poush (month 9) of BS 2080 still belongs to FY 2080/81
    expect(fiscalYear(new Date('2024-01-01'))).toBe(2080);
    // Shrawan (month 4) opens FY 2082/83
    expect(fiscalYear(bsToAd(2082, 4, 1))).toBe(2082);
    // Chaitra (month 12) is still inside FY 2082/83, since Shrawan already passed
    expect(fiscalYear(bsToAd(2082, 12, 5))).toBe(2082);
    // Baishakh (month 1) and Ashadh (month 3) precede Shrawan, so they close FY 2081/82
    expect(fiscalYear(bsToAd(2082, 1, 1))).toBe(2081);
    expect(fiscalYear(bsToAd(2082, 3, 30))).toBe(2081);
    expect(fiscalYearLabel(bsToAd(2082, 3, 30))).toBe('2081/82');
  });

  it('rejects dates outside the supported table', () => {
    expect(() => adToBs(new Date('1900-01-01'))).toThrow(RangeError);
  });
});
