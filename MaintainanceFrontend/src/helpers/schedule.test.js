import { describe, expect, it } from 'vitest';
import { offerWindow, publishState } from '@/helpers/schedule';

// Kathmandu is UTC+05:45, so its midnight is 18:15 UTC the day before.
const at = (iso) => new Date(iso);

describe('offerWindow', () => {
  // Ends at 23:59 on 16 Sep in Kathmandu — the end of that day as an editor picks it.
  const endsOn16th = '2026-09-16T18:14:00.000Z';

  it('is live until the end moment and ended after it, across Kathmandu midnight', () => {
    expect(offerWindow({ endsAt: endsOn16th }, at('2026-09-16T18:10:00Z'))) // 23:55 on the 16th
      .toEqual({ status: 'live', label: 'Ends today at 23:59' });
    expect(offerWindow({ endsAt: endsOn16th }, at('2026-09-16T18:14:00Z'))) // the end moment itself
      .toMatchObject({ status: 'live' });
    expect(offerWindow({ endsAt: endsOn16th }, at('2026-09-16T18:16:00Z'))) // 00:01 on the 17th
      .toEqual({ status: 'ended', label: 'Ended yesterday' });
  });

  it('counts "today" and "tomorrow" in Kathmandu days, not UTC days', () => {
    const endsOn17th = '2026-09-17T18:14:00.000Z';
    // 23:55 on the 16th in Kathmandu (still the 16th in UTC): the 17th is tomorrow.
    expect(offerWindow({ endsAt: endsOn17th }, at('2026-09-16T18:10:00Z')).label).toBe('Ends tomorrow at 23:59');
    // 00:01 on the 17th in Kathmandu, although UTC still says the 16th: it ends today.
    expect(offerWindow({ endsAt: endsOn17th }, at('2026-09-16T18:16:00Z')).label).toBe('Ends today at 23:59');
    // An offer that ends at 05:00 UTC on the 17th ends at 10:45 on the 17th in Kathmandu.
    expect(offerWindow({ endsAt: '2026-09-17T05:00:00Z' }, at('2026-09-16T12:00:00Z')).label).toBe('Ends tomorrow at 10:45');
  });

  it('is scheduled before the start moment, with the start named by Kathmandu day', () => {
    const startsAtMidnight = '2026-09-16T18:15:00.000Z'; // 00:00 on the 17th
    expect(offerWindow({ startsAt: startsAtMidnight }, at('2026-09-16T18:14:59Z')))
      .toEqual({ status: 'scheduled', label: 'Starts tomorrow at 00:00' });
    expect(offerWindow({ startsAt: startsAtMidnight }, at('2026-09-16T18:15:00Z')))
      .toEqual({ status: 'live', label: 'No end date' });
    expect(offerWindow({ startsAt: '2026-09-20T03:15:00Z' }, at('2026-09-16T12:00:00Z')))
      .toEqual({ status: 'scheduled', label: 'Starts on 20 Sept 2026' });
  });

  it('treats a missing bound as open and a long-gone end as a date', () => {
    expect(offerWindow({}, at('2026-09-16T12:00:00Z'))).toEqual({ status: 'live', label: 'No end date' });
    expect(offerWindow({ startsAt: null, endsAt: '' }, at('2026-09-16T12:00:00Z')).status).toBe('live');
    expect(offerWindow({ endsAt: '2026-09-01T18:14:00Z' }, at('2026-09-16T12:00:00Z')))
      .toEqual({ status: 'ended', label: 'Ended on 01 Sept 2026' });
  });
});

describe('publishState', () => {
  it('is a draft without a publish time', () => {
    expect(publishState(null)).toEqual({ status: 'draft', label: 'Not published' });
    expect(publishState(undefined).status).toBe('draft');
  });

  it('is scheduled before its time and published after, named by Kathmandu day', () => {
    const now = at('2026-09-16T18:10:00Z'); // 23:55 on the 16th
    expect(publishState('2026-09-16T18:20:00Z', now)).toEqual({ status: 'scheduled', label: 'Publishes tomorrow at 00:05' });
    expect(publishState('2026-09-16T03:00:00Z', now)).toEqual({ status: 'published', label: 'Published today' });
    expect(publishState('2026-09-15T18:14:00Z', now)).toEqual({ status: 'published', label: 'Published yesterday' });
  });
});
