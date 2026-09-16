import { describe, it, expect } from 'vitest';
import { LEAD_PRESETS, activePreset, applyPreset, leadQueryFor, weekStart } from '@/config/admin/leadViews';

const preset = (key) => LEAD_PRESETS.find((p) => p.key === key);

describe('lead views', () => {
  it('opens on My leads (D6)', () => {
    expect(leadQueryFor({ page: 1 })).toEqual({ page: 1, assignedToId: 'me' });
    expect(leadQueryFor({ view: 'mine', status: 'NEW' })).toEqual({ status: 'NEW', assignedToId: 'me' });
  });

  it('All leads asks for everyone', () => {
    expect(leadQueryFor({ view: 'all', status: 'NEW' })).toEqual({ status: 'NEW' });
  });

  it('an owner picked in the filter wins over the view', () => {
    expect(leadQueryFor({ view: 'mine', assignedToId: 'u1' })).toEqual({ assignedToId: 'u1' });
    expect(leadQueryFor({ assignedToId: 'none' })).toEqual({ assignedToId: 'none' });
  });
});

describe('presets', () => {
  // Wednesday 16 Sep 2026, 20:00 in Kathmandu (14:15 UTC).
  const now = new Date('2026-09-16T14:15:00Z');

  it('the Kathmandu week starts on Sunday, by Kathmandu’s calendar', () => {
    expect(weekStart(now)).toBe('2026-09-13');
    // 23:00 UTC Saturday is already Sunday 04:45 in Kathmandu — a new week.
    expect(weekStart(new Date('2026-09-19T23:00:00Z'))).toBe('2026-09-20');
  });

  it('"Bookings this week" is every booking since Sunday, for everyone', () => {
    expect(applyPreset({ page: 3, status: 'NEW', q: 'ram', limit: 50 }, preset('bookings-week'), now)).toEqual({
      page: 1, limit: 50, q: undefined, view: 'all', source: 'booking', from: '2026-09-13', to: '2026-09-16',
      slaRisk: undefined, assignedToId: undefined, status: undefined, priority: undefined, serviceId: undefined,
      requestedVisit: undefined,
    });
  });

  it('"Breached" and "Unassigned" replace the other filters', () => {
    const breached = applyPreset({ assignedToId: 'u1', source: 'call' }, preset('breached'), now);
    expect(breached).toMatchObject({ view: 'all', slaRisk: 'breached', assignedToId: undefined, source: undefined });
    const unassigned = applyPreset({ slaRisk: 'breached' }, preset('unassigned'), now);
    expect(unassigned).toMatchObject({ view: 'all', assignedToId: 'none', slaRisk: undefined });
  });

  it('knows which preset the URL is showing', () => {
    expect(activePreset({ view: 'all', slaRisk: 'breached', limit: 20 }, now)).toBe('breached');
    expect(activePreset({ view: 'all', slaRisk: 'breached', status: 'NEW' }, now)).toBeNull();
    expect(activePreset({ view: 'all', assignedToId: 'none' }, now)).toBe('unassigned');
    expect(activePreset({ view: 'all', source: 'booking', from: '2026-09-13', to: '2026-09-16' }, now)).toBe('bookings-week');
    expect(activePreset({}, now)).toBeNull();
  });
});
