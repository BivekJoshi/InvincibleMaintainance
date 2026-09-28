import { describe, expect, it } from 'vitest';
import {
  certificateUrl, claimDecisions, claimRateFor, claimService, contractEndsIn, coverLeft, kathmanduDaysBetween,
  matchServices, reminderLock, renewalDefaults,
} from '@/helpers/aftercare';
import {
  AMC_VIEWS, CLAIM_VIEWS, REMINDER_VIEWS, WARRANTY_VIEWS, selectView, viewQuery,
} from '@/config/admin/aftercareViews';
import { ktmDay } from '@/helpers/dispatchBoard';

/** An instant on a Kathmandu day at a Kathmandu time. */
const at = (d, hhmm = '00:00') => new Date(`${d}T${hhmm}:00+05:45`).toISOString();
const NOW = new Date(at('2026-09-28', '10:00'));

describe('aftercare helpers (Phase I)', () => {
  it('counts Kathmandu calendar days, across the UTC date line', () => {
    // 23:30 in Kathmandu is still the 28th there, though it is the 28th 17:45 UTC.
    expect(kathmanduDaysBetween(NOW, at('2026-09-28', '23:30'))).toBe(0);
    expect(kathmanduDaysBetween(NOW, at('2026-09-29', '00:10'))).toBe(1);
    expect(kathmanduDaysBetween(NOW, at('2026-09-20'))).toBe(-8);
  });

  it('words what is left of the cover', () => {
    expect(coverLeft({ endsAt: at('2026-10-10', '23:59') }, NOW)).toEqual({ days: 12, label: '12 days left', soon: true });
    expect(coverLeft({ endsAt: at('2026-09-29') }, NOW)).toMatchObject({ days: 1, label: '1 day left' });
    expect(coverLeft({ endsAt: at('2026-09-28', '23:59') }, NOW)).toMatchObject({ days: 0, label: 'Last day today', soon: true });
    expect(coverLeft({ endsAt: at('2026-09-01') }, NOW)).toMatchObject({ label: 'Ended 01 Sept 2026', soon: false });
    expect(coverLeft({ endsAt: at('2027-03-01') }, NOW).soon).toBe(false);
    expect(coverLeft({}, NOW)).toBeNull();
  });

  it('uses the API’s certificate link, else builds one from the token', () => {
    expect(certificateUrl({ publicUrl: 'https://gharjatan.com.np/warranty/tok', publicToken: 'tok' })).toBe('https://gharjatan.com.np/warranty/tok');
    expect(certificateUrl({ publicToken: 'tok' }, 'http://localhost:5400')).toBe('http://localhost:5400/warranty/tok');
    expect(certificateUrl({})).toBeNull();
  });

  it('offers only the decisions the API allows, and only to warranties:write', () => {
    const write = (c) => c === 'warranties:write';
    const read = () => false;
    expect(claimDecisions({ status: 'open' }, write)).toEqual({ accept: true, reject: true, resolve: true });
    expect(claimDecisions({ status: 'accepted' }, write)).toEqual({ accept: false, reject: false, resolve: true });
    expect(claimDecisions({ status: 'rejected' }, write)).toEqual({ accept: false, reject: false, resolve: false });
    expect(claimDecisions({ status: 'resolved' }, write)).toEqual({ accept: false, reject: false, resolve: false });
    expect(claimDecisions({ status: 'open' }, read)).toEqual({ accept: false, reject: false, resolve: false });
  });

  it('finds the claim rate for the claim’s service, else its job type, else all work', () => {
    const report = {
      totalWarranties: 40, totalClaims: 2, claimRate: 5,
      byType: [{ type: 'REPAIR', warranties: 20, claims: 2, claimRate: 10 }],
      byService: [{ service: 'Waterproofing', warranties: 10, claims: 1, claimRate: 10 }, { service: 'Other', warranties: 30, claims: 1, claimRate: 3.3 }],
    };
    expect(claimRateFor(report, { service: 'Waterproofing', type: 'REPAIR' })).toEqual({ scope: 'service', label: 'Waterproofing', warranties: 10, claims: 1, claimRate: 10 });
    expect(claimRateFor(report, { service: 'Plumbing', type: 'REPAIR' })).toMatchObject({ scope: 'type', label: 'Repair', claimRate: 10 });
    expect(claimRateFor(report, { type: 'INSTALLATION' })).toMatchObject({ scope: 'all', warranties: 40, claims: 2, claimRate: 5 });
    expect(claimRateFor(undefined, {})).toBeNull();
    expect(claimService({ warranty: { job: { service: { name: 'Waterproofing' } } } })).toBe('Waterproofing');
    expect(claimService({ warranty: { job: { service: 'Plumbing' } } })).toBe('Plumbing');
    expect(claimService({ warranty: { job: {} } })).toBeNull();
    // The API sends `service: null` when the job's lead chain names none: the job type speaks for it.
    expect(claimService({ warranty: { job: { service: null } } })).toBeNull();
    expect(claimRateFor(report, { service: null, type: 'REPAIR' })).toMatchObject({ scope: 'type', claimRate: 10 });
  });

  it('renews from the day after the end, for the same length, with the same plan and money in paisa', () => {
    const contract = {
      id: 'a1', number: 'AMC-2083-0001', customer: { id: 'c1' }, site: { id: 's1' }, planName: 'Annual Home Care',
      coveredServices: ['seepage', 'Plumbing'], startDate: at('2026-01-01'), endDate: at('2026-12-31'),
      visitsPerYear: 4, amount: 2_400_050, billingCycle: 'quarterly', status: 'active',
    };
    const next = renewalDefaults(contract);
    expect(next).toEqual({
      customerId: 'c1', siteId: 's1', planName: 'Annual Home Care', coveredServices: ['seepage', 'Plumbing'],
      startDate: at('2027-01-01'), endDate: at('2027-12-31'), visitsPerYear: 4, amount: 2_400_050,
      billingCycle: 'quarterly', notes: 'Renewal of AMC-2083-0001',
    });
    expect(ktmDay(next.startDate)).toBe('2027-01-01');
    // A copy, not the same array.
    expect(next.coveredServices).not.toBe(contract.coveredServices);
    // Six months stays six months (181 days), and no site stays no site.
    const half = renewalDefaults({ ...contract, site: null, siteId: null, startDate: at('2026-04-01'), endDate: at('2026-09-29') });
    expect([ktmDay(half.startDate), ktmDay(half.endDate), half.siteId]).toEqual(['2026-09-30', '2027-03-30', null]);
  });

  it('says ends-in only for an active contract within the window', () => {
    const c = { status: 'active', endDate: at('2026-10-20') };
    expect(contractEndsIn(c, 60, NOW)).toBe('Ends in 22 days');
    expect(contractEndsIn({ ...c, endDate: at('2026-09-28', '20:00') }, 60, NOW)).toBe('Ends today');
    expect(contractEndsIn({ ...c, endDate: at('2027-01-20') }, 60, NOW)).toBeNull();
    expect(contractEndsIn({ ...c, status: 'cancelled' }, 60, NOW)).toBeNull();
  });

  it('matches covered services to the catalogue ignoring case, keeping the rest', () => {
    expect(matchServices(['plumbing', ' Waterproofing ', 'Gutter cleaning', 'PLUMBING'], ['Plumbing', 'Waterproofing']))
      .toEqual(['Plumbing', 'Waterproofing', 'Gutter cleaning']);
    expect(matchServices(undefined, ['Plumbing'])).toEqual([]);
  });

  it('locks a reminder once it went out', () => {
    expect(reminderLock({ status: 'pending' })).toBeNull();
    for (const status of ['sent', 'failed', 'skipped']) expect(reminderLock({ status }), status).toMatch(/record/);
  });
});

describe('aftercare views', () => {
  it('turns a tab into the API’s query, keeping the other filters', () => {
    expect(viewQuery(WARRANTY_VIEWS, { view: 'active', q: 'सीता', page: 2 }, 'all')).toEqual({ view: 'active', query: { q: 'सीता', page: 2, status: 'ACTIVE' } });
    expect(viewQuery(WARRANTY_VIEWS, { view: 'expiring' }, 'all').query).toEqual({ expiringDays: 30 });
    expect(viewQuery(WARRANTY_VIEWS, { view: 'expiring', days: '7' }, 'all').query).toEqual({ expiringDays: 7 });
    expect(viewQuery(WARRANTY_VIEWS, { view: 'expiring', days: '1000' }, 'all').query).toEqual({ expiringDays: 30 });
    expect(viewQuery(CLAIM_VIEWS, {}, 'all')).toEqual({ view: 'all', query: {} });
    expect(viewQuery(REMINDER_VIEWS, { view: 'nonsense' }, 'pending')).toEqual({ view: 'pending', query: { status: 'pending' } });
  });

  it('reads the renewals notification’s ?renewals=true as the 60-day preset', () => {
    expect(viewQuery(AMC_VIEWS, { renewals: 'true', customerId: 'c1' }, 'active')).toEqual({ view: 'renewals', query: { customerId: 'c1', renewalsDays: 60 } });
    expect(viewQuery(AMC_VIEWS, {}, 'active').query).toEqual({ status: 'active' });
  });

  it('picks a tab on page 1, dropping the last tab’s helpers', () => {
    expect(selectView({ renewals: 'true', q: 'x', page: 3, days: '7' }, 'expired')).toEqual({ q: 'x', page: 1, view: 'expired' });
  });
});
