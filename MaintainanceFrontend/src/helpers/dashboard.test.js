import { describe, expect, it } from 'vitest';
import {
  attentionItems, dayParts, greetingFor, groupCards, ktmHour, lastDays, niceScale, percentChange, runningRevenue, shiftDay,
  slaState, timeWindow,
} from '@/helpers/dashboard';

describe('Kathmandu calendar days', () => {
  it('shifts across a month and a year end', () => {
    expect(shiftDay('2026-12-31', 1)).toBe('2027-01-01');
    expect(shiftDay('2026-03-01', -1)).toBe('2026-02-28');
  });

  it('lists the last n days, oldest first, ending today', () => {
    expect(lastDays(3, '2026-09-01')).toEqual(['2026-08-30', '2026-08-31', '2026-09-01']);
  });

  it('names a day without the browser timezone moving it', () => {
    expect(dayParts('2026-09-17')).toEqual({ weekday: 'Thu', date: '17 Sep' });
  });

  it('reads the hour in Kathmandu (+05:45), not UTC', () => {
    expect(ktmHour(new Date('2026-09-17T18:20:00Z'))).toBe(0);
    expect(ktmHour(new Date('2026-09-17T06:14:00Z'))).toBe(11);
    expect(greetingFor(11)).toBe('Good morning');
    expect(greetingFor(0)).toBe('Working late');
    expect(greetingFor(19)).toBe('Good evening');
  });
});

describe('runningRevenue', () => {
  it('fills quiet days and keeps integer paisa', () => {
    const rows = [
      { key: '2026-09-15', invoiced: 1_000_050, collected: 500_025 },
      { key: '2026-09-17', invoiced: 250_00, collected: 250_00 },
      { key: '2026-08-01', invoiced: 999, collected: 999 }, // outside the window
    ];
    expect(runningRevenue(rows, 4, '2026-09-17')).toEqual([
      { day: '2026-09-14', invoiced: 0, collected: 0 },
      { day: '2026-09-15', invoiced: 1_000_050, collected: 500_025 },
      { day: '2026-09-16', invoiced: 1_000_050, collected: 500_025 },
      { day: '2026-09-17', invoiced: 1_025_050, collected: 525_025 },
    ]);
  });
});

describe('niceScale', () => {
  it('rounds the top up to a clean step', () => {
    expect(niceScale(0)).toEqual({ max: 4, ticks: [0, 1, 2, 3, 4] });
    expect(niceScale(7)).toEqual({ max: 8, ticks: [0, 2, 4, 6, 8] });
    expect(niceScale(9)).toEqual({ max: 10, ticks: [0, 2.5, 5, 7.5, 10] });
    expect(niceScale(1_234_567).max).toBe(2_000_000);
  });
});

describe('percentChange', () => {
  it('has no answer without a base', () => {
    expect(percentChange(5, 0)).toBeNull();
    expect(percentChange(6, 4)).toBe(50);
    expect(percentChange(3, 4)).toBe(-25);
  });
});

describe('attentionItems', () => {
  const defs = {
    slaBreached: { tone: 'danger' },
    stockLow: { tone: 'warn' },
    jobsUnassigned: { tone: 'warn' },
    leadsOpen: {},
    amcRenewals: { tone: 'warn', soon: true },
  };

  it('keeps toned counts above zero, red first, then the biggest', () => {
    const items = attentionItems({ slaBreached: 1, stockLow: 2, jobsUnassigned: 5, leadsOpen: 40, amcRenewals: 3 }, defs);
    expect(items.map((i) => i.name)).toEqual(['slaBreached', 'jobsUnassigned', 'stockLow']);
  });

  it('is empty when nothing waits', () => {
    expect(attentionItems({ slaBreached: 0, leadsOpen: 3 }, defs)).toEqual([]);
    expect(attentionItems(undefined, defs)).toEqual([]);
  });
});

describe('groupCards', () => {
  const groups = [
    { key: 'a', label: 'A', cards: ['x', 'y'] },
    { key: 'b', label: 'B', cards: ['z'] },
  ];

  it('keeps the group order, drops empty groups, and gathers strays last', () => {
    expect(groupCards({ y: 2, x: 0, stray: 5 }, groups)).toEqual([
      { ...groups[0], items: [{ name: 'x', value: 0 }, { name: 'y', value: 2 }] },
      { key: 'other', label: 'Other', items: [{ name: 'stray', value: 5 }] },
    ]);
  });
});

describe('slaState and timeWindow', () => {
  const now = Date.parse('2026-09-17T06:00:00Z');
  it('reads a deadline as the chip does', () => {
    expect(slaState(null, now)).toBe('none');
    expect(slaState('2026-09-17T05:59:00Z', now)).toBe('breached');
    expect(slaState('2026-09-17T06:20:00Z', now)).toBe('at_risk');
    expect(slaState('2026-09-17T07:00:00Z', now)).toBe('ok');
  });

  it('shows a job window in Kathmandu time', () => {
    expect(timeWindow('2026-09-17T03:15:00Z', '2026-09-17T05:15:00Z')).toBe('09:00–11:00');
    expect(timeWindow('2026-09-17T18:15:00Z')).toBe('00:00');
    expect(timeWindow(null)).toBe('—');
  });
});
