import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { cwd } from 'node:process';
import { describe, it, expect } from 'vitest';
import * as spa from '@/helpers/nepaliDate';
// The API's own conversion. Outside `src/`, so `@/` cannot reach it (tests run from MaintainanceFrontend/).
import * as api from '../../../MaintainanceBackend/src/utils/nepaliDate.js';

const DAY = 86_400_000;

/**
 * `helpers/nepaliDate.js` is a copy of the API's `utils/nepaliDate.js` — the SPA shows BS beside AD on invoices and
 * reports and never converts a date any other way. The copy is byte for byte, so a change on either side fails here
 * until the other follows.
 */
describe('the BS helpers mirror the API', () => {
  it('is the same file, byte for byte', () => {
    const read = (path) => readFileSync(resolve(cwd(), path), 'utf8');
    expect(read('src/helpers/nepaliDate.js')).toBe(read('../MaintainanceBackend/src/utils/nepaliDate.js'));
  });

  it('exports the same functions and tables', () => {
    expect(Object.keys(spa).sort()).toEqual(Object.keys(api).sort());
    expect(spa.BS_MONTH_NAMES).toEqual(api.BS_MONTH_NAMES);
    expect(spa.BS_MONTH_NAMES_NE).toEqual(api.BS_MONTH_NAMES_NE);
  });

  it('agrees with the API — adToBs, formatBs (short and long, en and ne) and the fiscal year — every day of 2025–2027 and every 5th day 2000–2034', () => {
    const days = [];
    for (let t = Date.UTC(2025, 0, 1); t <= Date.UTC(2027, 11, 31); t += DAY) days.push(new Date(t));
    for (let t = Date.UTC(2000, 0, 1); t <= Date.UTC(2034, 11, 31); t += 5 * DAY) days.push(new Date(t));
    // One comparison of the whole run, not one per day: the same answers, in order.
    const run = (m) => days.map((d) => [
      m.adToBs(d), m.formatBs(d), m.formatBs(d, { long: true }), m.formatBs(d, { long: true, locale: 'ne' }),
      m.fiscalYear(d), m.fiscalYearLabel(d),
    ]);
    expect(run(spa)).toEqual(run(api));
    expect(days.length).toBeGreaterThan(3_500);
  });

  it('round-trips bsToAd the same way', () => {
    for (const [y, m, dd] of [[2080, 1, 1], [2082, 4, 1], [2083, 3, 32], [2083, 4, 1], [2083, 12, 30]]) {
      expect(spa.bsToAd(y, m, dd).toISOString()).toBe(api.bsToAd(y, m, dd).toISOString());
    }
  });
});

describe('the Shrawan 1 fiscal-year boundary (hand-checked)', () => {
  it('2083 Shrawan 1 is 17 July 2026: the day before is Ashadh 32 and still FY 2082/83', () => {
    expect(spa.formatBs(new Date('2026-07-16'))).toBe('2083-03-32');
    expect(spa.fiscalYearLabel(new Date('2026-07-16'))).toBe('2082/83');
    expect(spa.formatBs(new Date('2026-07-17'))).toBe('2083-04-01');
    expect(spa.formatBs(new Date('2026-07-17'), { long: true })).toBe('1 Shrawan 2083');
    expect(spa.formatBs(new Date('2026-07-17'), { long: true, locale: 'ne' })).toBe('1 साउन 2083');
    expect(spa.fiscalYear(new Date('2026-07-17'))).toBe(2083);
    expect(spa.fiscalYearLabel(new Date('2026-07-17'))).toBe('2083/84');
    expect(spa.bsToAd(2083, 4, 1).toISOString().slice(0, 10)).toBe('2026-07-17');
  });

  it('a year earlier the boundary fell on 16 July 2025 (2082 Shrawan 1)', () => {
    expect(spa.formatBs(new Date('2025-07-15'))).toBe('2082-03-31');
    expect(spa.fiscalYearLabel(new Date('2025-07-15'))).toBe('2081/82');
    expect(spa.formatBs(new Date('2025-07-16'))).toBe('2082-04-01');
    expect(spa.fiscalYearLabel(new Date('2025-07-16'))).toBe('2082/83');
  });
});
