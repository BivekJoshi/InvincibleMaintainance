import { describe, expect, it } from 'vitest';
import {
  agendaSummary, bsCell, bsDate, bsMonthNameEn, bsSpanLabel, cornerCell, countByKind, dayHeading, dayNumber, isDay, itemAction,
  itemTime, itemsByDay, itemsInScope, ktmToday, lateLabel, monthDays, monthGrid, monthStart, otherPeriodLabel, parseHidden,
  periodLabel, sameMonth, serializeHidden, shiftAnchor, spanFor, weekStart,
} from '@/helpers/agenda';

const item = (extra) => ({ key: `${extra.kind ?? 'followUp'}:${extra.id ?? 'x'}`, kind: 'followUp', allDay: false, state: 'upcoming', ...extra });

describe('the grid', () => {
  it('a month is six weeks from the Sunday on or before the 1st', () => {
    const days = monthGrid('2026-10-15');
    expect(days).toHaveLength(42);
    expect(days[0]).toBe('2026-09-27');
    expect(days[41]).toBe('2026-11-07');
    expect(spanFor('month', '2026-10-15')).toEqual({ from: '2026-09-27', to: '2026-11-07' });
  });

  it('a week runs Sunday to Saturday, the holiday', () => {
    expect(weekStart('2026-10-10')).toBe('2026-10-04');
    expect(spanFor('week', '2026-10-07')).toEqual({ from: '2026-10-04', to: '2026-10-10' });
  });

  it('a month step lands on the 1st, so the 31st never skips a month', () => {
    expect(shiftAnchor('2026-01-31', 'month', 1)).toBe('2026-02-01');
    expect(shiftAnchor('2026-01-15', 'month', -1)).toBe('2025-12-01');
    expect(shiftAnchor('2026-12-30', 'week', 1)).toBe('2027-01-06');
  });

  it('names the period, AD and BS', () => {
    expect(periodLabel('month', '2026-10-15')).toBe('October 2026');
    expect(periodLabel('week', '2026-10-07')).toBe('4 – 10 Oct 2026');
    expect(periodLabel('week', '2026-10-01')).toBe('27 Sept – 3 Oct 2026');
    expect(periodLabel('week', '2026-12-30')).toBe('27 Dec 2026 – 2 Jan 2027');
    // A BS date is written in Nepali script.
    expect(bsSpanLabel('2026-10-01', '2026-10-31')).toBe('असोज – कात्तिक २०८३');
    // The BS month's name on its 1st, and on the grid's first cell.
    expect(bsCell('2026-10-17')).toEqual({ day: '१', month: 'कात्तिक' });
    expect(bsCell('2026-10-04')).toEqual({ day: '१८', month: null });
    expect(bsCell('2026-10-04', true)).toEqual({ day: '१८', month: 'असोज' });
  });

  it('in the Nepali calendar the grid is the BS month, and its steps are BS months', () => {
    // Ashwin 2083 runs 17 Sept – 16 Oct 2026 (30 days).
    expect(monthStart('2026-10-04', 'bs')).toBe('2026-09-17');
    const days = monthDays('2026-10-04', 'bs');
    expect([days.length, days[0], days[29]]).toEqual([30, '2026-09-17', '2026-10-16']);
    expect(spanFor('month', '2026-10-04', 'bs')).toEqual({ from: '2026-09-13', to: '2026-10-24' });
    expect(sameMonth('2026-09-17', '2026-10-16', 'bs')).toBe(true);
    expect(sameMonth('2026-10-16', '2026-10-17', 'bs')).toBe(false);
    expect(shiftAnchor('2026-10-04', 'month', 1, 'bs')).toBe('2026-10-17');
    expect(shiftAnchor('2026-10-04', 'month', -1, 'bs')).toBe('2026-08-17');
    // Chaitra 2082 → Baishakh 2083, the BS new year.
    expect(shiftAnchor('2026-03-24', 'month', 1, 'bs')).toBe('2026-04-14');
    // A BS month runs to 32 days — still six weeks.
    const longest = Math.max(...Array.from({ length: 24 }, (_, i) => monthDays(shiftAnchor('2026-04-14', 'month', i, 'bs'), 'bs').length));
    expect(longest).toBe(32);
  });

  it('names days and periods in the calendar on screen — a BS date in Nepali script — with the other one beside', () => {
    expect(periodLabel('month', '2026-10-04', 'bs')).toBe('असोज २०८३');
    expect(periodLabel('week', '2026-10-07', 'bs')).toBe('१८ – २४ असोज २०८३');
    expect(periodLabel('week', '2026-10-14', 'bs')).toBe('२५ असोज – १ कात्तिक २०८३');
    expect(otherPeriodLabel('month', '2026-10-04', 'bs')).toBe('Sept – Oct 2026 AD');
    expect(otherPeriodLabel('month', '2026-10-15', 'ad')).toBe('असोज – कात्तिक २०८३ वि.सं.');
    expect(otherPeriodLabel('week', '2026-10-07', 'bs')).toBe('4 – 10 Oct 2026 AD');
    expect(bsMonthNameEn('2026-10-04')).toBe('Ashwin');
    expect(bsDate('2026-10-04')).toBe('१८ असोज २०८३');

    expect(dayHeading('2026-10-04')).toBe('Sun 4 Oct');
    expect(dayHeading('2026-10-04', { calendar: 'bs' })).toBe('आइत १८ असोज');
    expect(dayHeading('2026-10-04', { calendar: 'bs', year: true })).toBe('आइत १८ असोज २०८३');
    expect(dayNumber('2026-10-04', 'bs')).toBe('१८');
    expect(dayNumber('2026-10-04')).toBe('4');
    // The corner carries the other calendar, and says which script it is in.
    expect(cornerCell('2026-10-01', false, 'bs')).toEqual({ day: '1', month: 'Oct', title: 'English date (AD)', lang: 'en' });
    expect(cornerCell('2026-10-17', false, 'ad')).toEqual({ day: '१', month: 'कात्तिक', title: 'Nepali date (BS)', lang: 'ne' });
  });

  it('past the BS table the Nepali calendar falls back to AD', () => {
    expect(monthStart('2050-06-15', 'bs')).toBe('2050-06-01');
    expect(periodLabel('month', '2050-06-15', 'bs')).toBe('June 2050');
    expect(shiftAnchor('2050-06-15', 'month', 1, 'bs')).toBe('2050-07-01');
  });

  it('takes only a real day from the URL', () => {
    expect(isDay('2026-10-04')).toBe(true);
    expect(isDay('2026-02-30')).toBe(false);
    expect(isDay('soon')).toBe(false);
    expect(isDay(undefined)).toBe(false);
  });
});

describe('items on days', () => {
  it('a thing sits on its Kathmandu day, not the browser’s', () => {
    // 19:00 UTC on the 4th is 00:45 on the 5th in Kathmandu.
    const late = item({ id: 'a', at: '2026-10-04T19:00:00.000Z' });
    const early = item({ id: 'b', at: '2026-10-04T18:00:00.000Z' });
    const due = item({ id: 'c', kind: 'invoice', allDay: true, at: '2026-10-04T18:15:00.000Z' });
    const days = itemsByDay([late, early, due]);
    expect(days.get('2026-10-04').map((i) => i.id)).toEqual(['b']);
    // A due date first, then by the clock.
    expect(days.get('2026-10-05').map((i) => i.id)).toEqual(['c', 'a']);
    expect(ktmToday(Date.parse('2026-10-04T18:20:00.000Z'))).toBe('2026-10-05');
  });

  it('Mine is what I own; Unassigned is the ownable kinds with nobody on them', () => {
    const mine = item({ id: 'm', ownable: true, ownerId: 'me' });
    const theirs = item({ id: 't', ownable: true, ownerId: 'them' });
    const nobodys = item({ id: 'n', ownable: true, ownerId: null });
    const job = item({ id: 'j', kind: 'job', ownable: false, ownerId: null });
    const all = [mine, theirs, nobodys, job];
    expect(itemsInScope(all, 'all', 'me')).toEqual(all);
    expect(itemsInScope(all, 'mine', 'me').map((i) => i.id)).toEqual(['m']);
    expect(itemsInScope(all, 'unassigned', 'me').map((i) => i.id)).toEqual(['n']);
  });

  it('the kinds switched off round-trip through the URL, unknown ones dropped', () => {
    const hidden = parseHidden('invoice,job,nonsense');
    expect([...hidden].sort()).toEqual(['invoice', 'job']);
    expect(serializeHidden(hidden)).toBe('job,invoice');
    expect(serializeHidden(new Set())).toBeUndefined();
  });

  it('counts each kind and sums up the days on screen', () => {
    const span = { from: '2026-10-04', to: '2026-10-10' };
    const items = [
      item({ id: '1', state: 'overdue', at: '2026-09-01T04:00:00.000Z', ownable: true, ownerId: null }),
      item({ id: '2', state: 'today', at: '2026-10-05T04:00:00.000Z', ownable: true, ownerId: 'me' }),
      item({ id: '3', kind: 'job', at: '2026-10-07T04:00:00.000Z' }),
      item({ id: '4', kind: 'job', at: '2026-10-20T04:00:00.000Z' }),
    ];
    expect(countByKind(items)).toMatchObject({ followUp: 2, job: 2, invoice: 0 });
    expect(agendaSummary(items, span, '2026-10-05')).toEqual({ overdue: 1, today: 1, upcoming: 1, unowned: 1, todayInView: true });
    expect(agendaSummary(items, { from: '2026-11-01', to: '2026-11-07' }, '2026-10-05').todayInView).toBe(false);
  });
});

describe('the words', () => {
  it('the time of day, a window, or all day', () => {
    expect(itemTime(item({ at: '2026-10-04T04:15:00.000Z' }))).toBe('10:00');
    expect(itemTime(item({ kind: 'visit', at: '2026-10-04T04:15:00.000Z', endAt: '2026-10-04T06:15:00.000Z' }))).toBe('10:00–12:00');
    // A job ending another day shows its start only.
    expect(itemTime(item({ kind: 'job', at: '2026-10-04T04:15:00.000Z', endAt: '2026-10-08T12:15:00.000Z' }))).toBe('10:00');
    expect(itemTime(item({ kind: 'invoice', allDay: true, at: '2026-10-04T18:15:00.000Z' }))).toBe('All day');
  });

  it('what to do', () => {
    expect(itemAction(item({ type: 'CALL', note: 'Ask about the roof' }))).toBe('Call — Ask about the roof');
    expect(itemAction(item({ type: null }))).toBe('Follow up');
    expect(itemAction(item({ kind: 'visit', people: ['Hari', 'Suresh'] }))).toBe('Site visit · Hari, Suresh');
    expect(itemAction(item({ kind: 'job', people: [] }))).toBe('Job · Nobody assigned yet');
    // Money is the server's paisa, formatted — never worked out here.
    expect(itemAction(item({ kind: 'invoice', amount: 749_950 }))).toBe('Rs. 7,499.50 still owed');
    expect(itemAction(item({ kind: 'quotation', status: 'OFFICE_APPROVED' }))).toMatch(/not sent yet/);
  });

  it('how late: from the moment, or from the end of a due day', () => {
    const now = Date.parse('2026-10-05T06:15:00.000Z');
    expect(lateLabel(item({ state: 'overdue', at: '2026-10-05T05:30:00.000Z' }), now)).toBe('45 min late');
    expect(lateLabel(item({ state: 'overdue', kind: 'visit', at: '2026-10-05T01:00:00.000Z', endAt: '2026-10-05T03:15:00.000Z' }), now)).toBe('3 h late');
    // Due on the 3rd (Kathmandu): late from midnight at its end, the 3rd 18:15 UTC.
    expect(lateLabel(item({ state: 'overdue', kind: 'invoice', allDay: true, at: '2026-10-02T18:15:00.000Z' }), now)).toBe('1 d late');
    expect(lateLabel(item({ state: 'today', at: '2026-10-05T05:30:00.000Z' }), now)).toBeNull();
  });
});
