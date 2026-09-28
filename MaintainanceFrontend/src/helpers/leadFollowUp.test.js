import { describe, it, expect } from 'vitest';
import {
  daysInStage, formatWhen, isClosedLead, lateBy, nextActionState, qualificationSummary, stageAgeLabel,
} from '@/helpers/leadFollowUp';

// Wednesday 16 Sep 2026, 14:00 in Kathmandu (08:15 UTC).
const NOW = Date.parse('2026-09-16T08:15:00Z');
const H = 3_600_000;

describe('days in stage', () => {
  it('rounds down, and says "today" for a lead that moved today', () => {
    expect(daysInStage({ stageEnteredAt: new Date(NOW - 3 * H).toISOString() }, NOW)).toBe(0);
    expect(daysInStage({ stageEnteredAt: new Date(NOW - 47 * H).toISOString() }, NOW)).toBe(1);
    expect(daysInStage({ stageEnteredAt: new Date(NOW - 4 * 24 * H).toISOString() }, NOW)).toBe(4);
    expect(daysInStage({}, NOW)).toBeNull();
    expect(stageAgeLabel(0)).toBe('In stage today');
    expect(stageAgeLabel(4)).toBe('4d in stage');
  });
});

describe('next action', () => {
  const lead = (at, extra = {}) => ({ status: 'CONTACTED', nextActionAt: at, nextActionType: 'CALL', ...extra });

  it('is overdue once its time has passed', () => {
    const next = nextActionState(lead('2026-09-16T06:10:00Z'), NOW);
    expect(next).toMatchObject({ state: 'overdue', label: 'Call', when: 'Today, 11:55', lateMinutes: 125 });
    expect(lateBy(next.lateMinutes)).toBe('2 h');
    expect(lateBy(20)).toBe('20 min');
    expect(lateBy(3 * 24 * 60 + 5)).toBe('3 d');
  });

  it('is "today" until the end of Kathmandu’s day, then later', () => {
    // 23:30 Kathmandu is 17:45 UTC — still today there.
    expect(nextActionState(lead('2026-09-16T17:45:00Z'), NOW)).toMatchObject({ state: 'today', when: 'Today, 23:30' });
    // 00:15 on the 17th in Kathmandu is 18:30 UTC on the 16th.
    expect(nextActionState(lead('2026-09-16T18:30:00Z'), NOW)).toMatchObject({ state: 'later', when: 'Tomorrow, 00:15' });
    expect(nextActionState(lead('2026-09-21T04:15:00Z', { nextActionType: 'SEND_QUOTE' }), NOW))
      .toMatchObject({ state: 'later', label: 'Send the quotation', when: 'Mon 21 Sept, 10:00' });
  });

  it('is "none" on an open lead with nothing set, and null on a closed one', () => {
    expect(nextActionState({ status: 'NEW', nextActionAt: null }, NOW)).toEqual({ state: 'none' });
    expect(nextActionState(lead('2026-09-16T06:10:00Z', { status: 'LOST' }), NOW)).toBeNull();
    expect(isClosedLead({ status: 'WON' })).toBe(true);
    expect(isClosedLead({ status: 'QUOTED' })).toBe(false);
  });

  it('names a day in another year with its year', () => {
    expect(formatWhen('2027-01-05T04:15:00Z', NOW)).toMatch(/5 Jan 2027, 10:00/);
    expect(formatWhen('nonsense', NOW)).toBe('—');
  });
});

describe('qualification', () => {
  it('lists what is known and what is missing', () => {
    expect(qualificationSummary(null).missing).toEqual(['property type', 'floors', 'building age', 'budget', 'decision maker']);
    const { filled, missing } = qualificationSummary({ propertyType: 'house', floors: 3, buildingAgeYears: 0, decisionMaker: 'owner_abroad' });
    expect(filled.map((f) => [f.label, f.value])).toEqual([
      ['Property', 'House'], ['Floors', '3'], ['Building age', 'New build'], ['Who decides', 'Owner abroad (decides remotely)'],
    ]);
    expect(missing).toEqual(['budget']);
  });

  it('does not ask a plot of land for floors or building age', () => {
    expect(qualificationSummary({ propertyType: 'land', budgetBand: '5l_25l' })).toEqual({
      filled: [{ key: 'propertyType', label: 'Property', value: 'Land' }, { key: 'budgetBand', label: 'Budget', value: 'Rs 5 – 25 lakh' }],
      missing: ['decision maker'],
    });
  });
});
