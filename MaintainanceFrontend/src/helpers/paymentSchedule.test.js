import { describe, expect, it } from 'vitest';
import {
  basisPointsOf, formatShare, matchingPreset, parsePct, presetRows, scheduleBody, scheduleTotal, toStageRows, validScheduleBody,
} from '@/helpers/paymentSchedule';
import { paymentScheduleSchema } from '@/form/schemas/quotation.schema';

const API_STAGES = [
  { id: 'st1', label: 'Advance', basisPoints: 5000, trigger: 'ON_ACCEPT', taxable: 100, vat: 13, total: 113 },
  { id: 'st2', label: 'Running bill', basisPoints: 4000, trigger: 'MILESTONE', taxable: 80, vat: 10, total: 90 },
  { id: 'st3', label: 'On completion', basisPoints: 1000, trigger: 'ON_COMPLETION', taxable: 20, vat: 3, total: 23 },
];

describe('the payment schedule on the client (shares, never money)', () => {
  it('reads a share as typed and turns it into basis points', () => {
    expect(parsePct('40')).toBe(40);
    expect(parsePct(' 12.5 % ')).toBe(12.5);
    expect(parsePct('')).toBeUndefined();
    expect(Number.isNaN(parsePct('forty'))).toBe(true);
    expect(basisPointsOf(33.33)).toBe(3333);
    // 0.1 + 0.2 style float noise does not leak into the basis points.
    expect(basisPointsOf(0.29 * 100)).toBe(2900);
    expect(formatShare(5000)).toBe('50%');
    expect(formatShare(3333)).toBe('33.33%');
    expect(formatShare(null)).toBe('—');
  });

  it('loads the API’s stages as rows with stable keys and no amounts, and sends them back in basis points', () => {
    const rows = toStageRows(API_STAGES);
    expect(rows).toEqual([
      { _key: 'st1', label: 'Advance', pct: 50, trigger: 'ON_ACCEPT' },
      { _key: 'st2', label: 'Running bill', pct: 40, trigger: 'MILESTONE' },
      { _key: 'st3', label: 'On completion', pct: 10, trigger: 'ON_COMPLETION' },
    ]);
    expect(toStageRows(API_STAGES)).toEqual(rows);
    expect(scheduleBody([...rows, { _key: 'x', label: '', pct: '', trigger: 'MILESTONE' }])).toEqual([
      { label: 'Advance', basisPoints: 5000, trigger: 'ON_ACCEPT' },
      { label: 'Running bill', basisPoints: 4000, trigger: 'MILESTONE' },
      { label: 'On completion', basisPoints: 1000, trigger: 'ON_COMPLETION' },
    ]);
  });

  it('adds the shares up in basis points, and knows the presets', () => {
    expect(scheduleTotal(presetRows('40-30-20-10'))).toEqual({ totalBp: 10000, readable: true });
    expect(scheduleTotal([{ label: 'a', pct: '33.33' }, { label: 'b', pct: '33.33' }, { label: 'c', pct: '33.34' }]).totalBp).toBe(10000);
    expect(scheduleTotal([{ label: 'a', pct: 'x' }]).readable).toBe(false);
    expect(presetRows('100-completion')).toEqual([expect.objectContaining({ label: 'On completion', pct: 100, trigger: 'ON_COMPLETION' })]);
    expect(matchingPreset(toStageRows(API_STAGES))).toBe('50-40-10');
    expect(matchingPreset(presetRows('40-30-20-10'))).toBe('40-30-20-10');
    expect(matchingPreset([{ label: 'a', pct: 60, trigger: 'ON_ACCEPT' }, { label: 'b', pct: 40, trigger: 'ON_COMPLETION' }])).toBeNull();
  });

  it('sends the live preview a schedule only when it is whole', () => {
    expect(validScheduleBody(presetRows('50-40-10'))).toHaveLength(3);
    expect(validScheduleBody([{ label: 'Advance', pct: 50, trigger: 'ON_ACCEPT' }])).toBeNull(); // 50 %
    expect(validScheduleBody([{ label: '', pct: 100, trigger: 'ON_COMPLETION' }])).toBeNull(); // unnamed
    expect(validScheduleBody([
      { label: 'A', pct: 50, trigger: 'ON_ACCEPT' }, { label: 'B', pct: 50, trigger: 'ON_ACCEPT' },
    ])).toBeNull(); // two advances
    expect(validScheduleBody([])).toBeNull();
  });

  it('the schema refuses what the API refuses: not 100 %, two advances, a share it cannot read', () => {
    const errors = (rows) => {
      const result = paymentScheduleSchema.safeParse(rows);
      return result.success ? [] : result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`);
    };
    expect(errors([{ label: 'Advance', pct: '50', trigger: 'ON_ACCEPT' }, { label: 'Rest', pct: '40', trigger: 'ON_COMPLETION' }]))
      .toEqual([': The stages add up to 90% — they must make 100%']);
    expect(errors([{ label: 'A', pct: 50, trigger: 'ON_ACCEPT' }, { label: 'B', pct: 50, trigger: 'ON_ACCEPT' }]))
      .toEqual([': Only one stage can be the advance on acceptance']);
    expect(errors([{ label: 'A', pct: 'lots', trigger: 'ON_ACCEPT' }])).toEqual(['0.pct: Enter a number, e.g. 40']);
    expect(errors([{ label: '', pct: 100, trigger: 'ON_COMPLETION' }])).toEqual(['0.label: Name the stage']);
    expect(errors([{ label: 'A', pct: 12.345, trigger: 'ON_COMPLETION' }])).toContain('0.pct: At most two decimals');
    expect(paymentScheduleSchema.parse(presetRows('40-30-20-10')).map((s) => s.basisPoints)).toEqual([4000, 3000, 2000, 1000]);
    // No stages sends nothing: the API keeps the schedule it has.
    expect(paymentScheduleSchema.parse([{ label: '', pct: '' }])).toBeUndefined();
  });
});
