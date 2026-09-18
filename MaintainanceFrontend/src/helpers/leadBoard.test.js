import { describe, it, expect } from 'vitest';
import { canDrop, cardsForColumn, leadsInScope, needsReason, nextStatuses, responseResult, slaProgress, funnelSummary, leadAgeDays, isGoingCold } from '@/helpers/leadBoard';

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
