import { describe, it, expect } from 'vitest';
import { canDrop, cardsForColumn, needsReason, nextStatuses, responseResult } from '@/helpers/leadBoard';

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
