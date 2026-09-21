import { describe, it, expect } from 'vitest';
import { canDrop, cardsForColumn, leadsInScope, needsReason, nextStatuses, responseResult, slaProgress, funnelSummary, leadAgeDays, isGoingCold } from '@/helpers/leadBoard';
import { runwayLanes, runwayPoint } from '@/helpers/leadBoard';

describe('board drops', () => {
  it.each([
    ['NEW', 'CONTACTED', true],
    ['NEW', 'LOST', true],
    ['NEW', 'QUOTED', false],
    ['NEW', 'WON', false],
    ['CONTACTED', 'INSPECTION_SCHEDULED', true],
    ['CONTACTED', 'WON', true],
    ['CONTACTED', 'NEW', false],
    ['INSPECTION_SCHEDULED', 'CONTACTED', false],
    ['QUOTED', 'WON', true],
    ['QUOTED', 'INSPECTION_SCHEDULED', false],
    ['WON', 'LOST', false],
    ['WON', 'CONTACTED', false],
    ['LOST', 'CONTACTED', true],
    ['LOST', 'NEW', false],
    ['NEW', 'NEW', false],
    [undefined, 'NEW', false],
  ])('%s → %s is %s', (from, to, allowed) => {
    expect(canDrop(from, to)).toBe(allowed);
  });

  it('a won lead goes nowhere, and only LOST asks why', () => {
    expect(nextStatuses('WON')).toEqual([]);
    expect(nextStatuses('BOGUS')).toEqual([]);
    expect(needsReason('LOST')).toBe(true);
    expect(needsReason('WON')).toBe(false);
  });

  it('shows a card in the column it is moving to until the move settles', () => {
    const leads = [{ id: 'a', status: 'NEW' }, { id: 'b', status: 'NEW' }];
    expect(cardsForColumn(leads, { a: 'CONTACTED' }, 'NEW').map((l) => l.id)).toEqual(['b']);
    expect(cardsForColumn(leads, { a: 'CONTACTED' }, 'CONTACTED').map((l) => l.id)).toEqual(['a']);
    expect(cardsForColumn(leads, {}, 'NEW')).toHaveLength(2);
  });
});

describe('response result', () => {
  const createdAt = '2026-09-16T04:00:00.000Z';
  it('says how long the first response took, and whether it kept the promise', () => {
    expect(responseResult({ state: 'met', respondedAt: '2026-09-16T04:34:00.000Z' }, createdAt))
      .toBe('Responded in 34 min — within the promise');
    expect(responseResult({ state: 'breached', respondedAt: '2026-09-16T06:05:00.000Z' }, createdAt))
      .toBe('Responded in 2 h 5 min — after the deadline');
    expect(responseResult({ state: 'ok' }, createdAt)).toBeNull();
  });
});

describe('column links', () => {
  it('open the table on the same leads', async () => {
    const { columnTableHref } = await import('@/helpers/leadBoard');
    expect(columnTableHref({ assignedToId: 'me' }, 'NEW')).toBe('/admin/leads?view=mine&status=NEW');
    expect(columnTableHref({}, 'WON')).toBe('/admin/leads?view=all&status=WON');
    expect(columnTableHref({ assignedToId: 'none', source: 'booking', q: '' }, 'LOST'))
      .toBe('/admin/leads?source=booking&view=all&assignedToId=none&status=LOST');
  });
});

describe('SLA board scope', () => {
  const leads = [
    { id: 'a', assignedToId: 'u1' },
    { id: 'b', assignedTo: { id: 'u2' } },
    { id: 'c', assignedToId: null },
  ];
  it('keeps everyone, only mine, or only the leads nobody owns', () => {
    expect(leadsInScope(leads, 'all', 'u1')).toHaveLength(3);
    expect(leadsInScope(leads, 'mine', 'u1').map((l) => l.id)).toEqual(['a']);
    expect(leadsInScope(leads, 'mine', 'u2').map((l) => l.id)).toEqual(['b']);
    expect(leadsInScope(leads, 'unassigned', 'u1').map((l) => l.id)).toEqual(['c']);
  });
});

describe('slaProgress', () => {
  const lead = { createdAt: '2026-09-18T04:00:00.000Z', sla: { dueAt: '2026-09-18T06:00:00.000Z' } };
  it('measures the window used, and the minutes past the deadline', () => {
    expect(slaProgress(lead, Date.parse('2026-09-18T05:30:00.000Z'))).toEqual({ ratio: 0.75, overdueMinutes: 0 });
    expect(slaProgress(lead, Date.parse('2026-09-18T06:45:00.000Z'))).toEqual({ ratio: 1, overdueMinutes: 45 });
  });
  it('has nothing to say without a deadline', () => {
    expect(slaProgress({ createdAt: lead.createdAt, sla: {} })).toBeNull();
  });
});

describe('the pipeline summary', () => {
  it('adds up the columns, the open ones, the shares and the win rate', () => {
    const summary = funnelSummary({ NEW: 4, CONTACTED: 2, INSPECTION_SCHEDULED: 1, QUOTED: 1, WON: 3, LOST: 1 });
    expect(summary).toMatchObject({ total: 12, open: 8, winRate: 75 });
    expect(summary.shares.NEW).toBe(33);
    expect(funnelSummary({ NEW: 2 }).winRate).toBeNull();
    expect(funnelSummary({}).total).toBe(0);
  });

  it('flags an open lead a week old as going cold, never a closed one', () => {
    const now = Date.parse('2026-09-18T00:00:00.000Z');
    const old = { status: 'CONTACTED', createdAt: '2026-09-10T00:00:00.000Z' };
    expect(leadAgeDays(old, now)).toBe(8);
    expect(isGoingCold(old, now)).toBe(true);
    expect(isGoingCold({ ...old, status: 'WON' }, now)).toBe(false);
    expect(isGoingCold({ ...old, createdAt: '2026-09-15T00:00:00.000Z' }, now)).toBe(false);
  });
});

describe('the response runway', () => {
  const t0 = Date.parse('2026-09-19T06:00:00.000Z');
  const lead = { createdAt: new Date(t0).toISOString(), sla: { dueAt: new Date(t0 + 120 * 60000).toISOString() } };
  const at = (minutes) => runwayPoint(lead, t0 + minutes * 60000);

  it('spends the promise on the first 80% of the track, the last 30 minutes as a warning', () => {
    expect(at(0)).toEqual({ x: 0, zone: 'ok', minutesLeft: 120, pinned: false });
    expect(at(60).x).toBeCloseTo(0.4);
    expect(at(89).zone).toBe('ok');
    expect(at(90).zone).toBe('warn');
    expect(at(120)).toMatchObject({ x: 0.8, zone: 'warn', minutesLeft: 0 });
  });

  it('draws the first hour past the deadline, then pins the lead to the end', () => {
    expect(at(150)).toMatchObject({ zone: 'breach', minutesLeft: -30, pinned: false });
    expect(at(150).x).toBeCloseTo(0.9);
    expect(at(600)).toMatchObject({ x: 1, zone: 'breach', minutesLeft: -480, pinned: true });
  });

  it('has no point without a deadline, and never a negative one for a clock skewed ahead', () => {
    expect(runwayPoint({ createdAt: lead.createdAt, sla: {} }, t0)).toBeNull();
    expect(at(-5).x).toBe(0);
  });

  it('stacks neighbours into lanes and reuses a lane once it is clear', () => {
    const lanes = runwayLanes([{ id: 'c', x: 0.5 }, { id: 'a', x: 0.1 }, { id: 'b', x: 0.11 }, { id: 'd', x: 0.12 }]);
    expect(lanes.map((p) => [p.id, p.lane])).toEqual([['a', 0], ['b', 1], ['d', 2], ['c', 0]]);
  });

  it('shares the lane that frees first once every lane is taken', () => {
    const lanes = runwayLanes([0.1, 0.101, 0.102].map((x) => ({ x })), 0.035, 2);
    expect(lanes.map((p) => p.lane)).toEqual([0, 1, 0]);
  });
});
