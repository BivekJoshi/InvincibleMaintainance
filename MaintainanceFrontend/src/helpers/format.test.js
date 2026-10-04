import { afterEach, describe, it, expect } from 'vitest';
import {
  formatNprShort, shortAge, formatRupees, fromKathmanduParts, parseRupees, rupeesInput, rupeesToPaisa, toKathmanduParts,
  formatNumber, formatNpr, formatDate, formatDateBs, formatDateAdBs, formatDateTime, formatTime, formatMinutes,
  toDevanagariDigits, toLatinDigits, localizeDigits, displayDigits, relativeTime, formatBsDay, formatDay,
} from '@/helpers/format';
import { setDisplayCalendar } from '@/helpers/displayCalendar';

describe('money — paisa from the API, rupees in the form', () => {
  it.each([
    [0, '0'],
    [1, '0.01'],
    [1234567890, '12345678.9'], // Rs. 1,23,45,678.90
  ])('%i paisa round-trips through the rupee input', (paisa, input) => {
    expect(rupeesInput(paisa)).toBe(input);
    expect(rupeesToPaisa(parseRupees(rupeesInput(paisa)))).toBe(paisa);
  });

  it('reads Indian digit grouping and a Rs. prefix', () => {
    expect(parseRupees('1,23,45,678.90')).toBe(12345678.9);
    expect(rupeesToPaisa(parseRupees('1,23,45,678.90'))).toBe(1234567890);
    expect(parseRupees('Rs. 500')).toBe(500);
    expect(parseRupees(' 0.01 ')).toBe(0.01);
    expect(parseRupees('0')).toBe(0);
  });

  it('shows rupees grouped the Indian way', () => {
    expect(formatRupees(12345678.9)).toBe('1,23,45,678.90');
    expect(formatRupees(0)).toBe('0.00');
    expect(formatRupees(0.01)).toBe('0.01');
    expect(formatRupees(undefined)).toBe('');
  });

  it('rounds to the paisa and never produces a fraction of one', () => {
    expect(parseRupees('1.239')).toBe(1.24);
    expect(rupeesToPaisa(12345678.9)).toBe(1234567890);
    expect(Number.isInteger(rupeesToPaisa(0.1 + 0.2))).toBe(true);
  });

  it('returns null for input it cannot read, instead of guessing', () => {
    for (const bad of ['', '   ', 'abc', '-5', '1.2.3', null, undefined, Number.NaN]) {
      expect(parseRupees(bad)).toBeNull();
    }
  });
});

describe('Kathmandu time (+05:45) for date and time inputs', () => {
  it('shows a UTC instant as Kathmandu wall-clock time', () => {
    expect(toKathmanduParts('2026-09-14T06:15:00.000Z')).toEqual({ date: '2026-09-14', time: '12:00' });
  });

  it('moves to the next day when Kathmandu already has', () => {
    expect(toKathmanduParts('2026-09-13T20:00:00.000Z')).toEqual({ date: '2026-09-14', time: '01:45' });
  });

  it('turns a Kathmandu date and time back into UTC', () => {
    expect(fromKathmanduParts('2026-09-14', '12:00')).toBe('2026-09-14T06:15:00.000Z');
    expect(fromKathmanduParts('2026-09-14')).toBe('2026-09-13T18:15:00.000Z');
  });

  it('round-trips', () => {
    const iso = '2026-12-31T23:59:00.000Z';
    const { date, time } = toKathmanduParts(iso);
    expect(fromKathmanduParts(date, time)).toBe(iso);
  });

  it('treats missing values as empty', () => {
    expect(toKathmanduParts(null)).toEqual({ date: '', time: '' });
    expect(toKathmanduParts('not a date')).toEqual({ date: '', time: '' });
    expect(fromKathmanduParts('')).toBeNull();
  });
});

describe('formatMinutes', () => {
  it('reads as hours and minutes', async () => {
    const { formatMinutes } = await import('@/helpers/format');
    expect(formatMinutes(95)).toBe('1 h 35 min');
    expect(formatMinutes(120)).toBe('2 h');
    expect(formatMinutes(45)).toBe('45 min');
    expect(formatMinutes(0)).toBe('0 min');
    expect(formatMinutes(null)).toBe('0 min');
  });
});

describe('formatNprShort — chart axes in K, lakh and crore', () => {
  it.each([
    [0, 'Rs 0'],
    [50_000, 'Rs 500'],
    [4_500_000, 'Rs 45K'],
    [12_50_000_00, 'Rs 12.5L'],
    [1_00_00_000_00, 'Rs 1Cr'],
    [345e9, 'Rs 345Cr'],
  ])('%i paisa → %s', (paisa, text) => {
    expect(formatNprShort(paisa)).toBe(text);
  });
});

describe('shortAge', () => {
  const t0 = Date.parse('2026-09-19T06:00:00.000Z');
  const ago = (minutes) => new Date(t0 - minutes * 60000).toISOString();
  it('says the age in its largest whole unit', () => {
    expect(shortAge(ago(0), t0)).toBe('now');
    expect(shortAge(ago(12), t0)).toBe('12m');
    expect(shortAge(ago(185), t0)).toBe('3h');
    expect(shortAge(ago(9 * 1440 + 5), t0)).toBe('9d');
    expect(shortAge(ago(150 * 1440), t0)).toBe('5mo');
    expect(shortAge('not a date', t0)).toBe('—');
  });
});

describe('Nepali display (Phase J1)', () => {
  // 14 Sept 2026, 12:00 in Kathmandu = 29 Bhadra 2083 BS.
  const NOON = '2026-09-14T06:15:00.000Z';

  it('groups numbers the Nepali way in both languages, Latin digits by default', () => {
    expect(formatNumber(1234567.5)).toBe('12,34,567.5');
    expect(formatNumber(1234567.5, { locale: 'ne' })).toBe('12,34,567.5');
    expect(displayDigits('ne')).toBe('latin');
    expect(displayDigits('en')).toBe('latin');
    expect(formatNumber('', { locale: 'ne' })).toBe('');
    expect(formatNumber('abc')).toBe('');
  });

  it('prints Devanagari digits only when asked, and only for display', () => {
    expect(formatNumber(1234567.5, { locale: 'ne', digits: 'deva' })).toBe('१२,३४,५६७.५');
    expect(toDevanagariDigits('JOB-2083-0042')).toBe('JOB-२०८३-००४२');
    expect(localizeDigits('12', 'en', 'deva')).toBe('१२');
    expect(localizeDigits('12', 'ne')).toBe('12');
    // What a Nepali keyboard types is read back as the Latin digits the API expects.
    expect(toLatinDigits('१२,५००.५०')).toBe('12,500.50');
    expect(parseRupees('रु. १,२५,०००')).toBe(125000);
    expect(rupeesToPaisa(parseRupees('१२.५'))).toBe(1250);
  });

  it('writes money with रु. in Nepali, and the back office keeps Rs.', () => {
    expect(formatNpr(12345678990)).toBe('Rs. 12,34,56,789.90');
    expect(formatNpr(12345678990, { locale: 'ne' })).toBe('रु. 12,34,56,789.90');
    expect(formatNpr(12345678990, { locale: 'ne', digits: 'deva' })).toBe('रु. १२,३४,५६,७८९.९०');
    expect(formatNpr(500, { locale: 'ne', symbol: false })).toBe('5.00');
  });

  it('dates in Kathmandu, with Nepali month names and the BS option', () => {
    expect(formatDate(NOON)).toMatch(/^14 Sept? 2026$/);
    expect(formatDate(NOON, { locale: 'ne' })).toBe('2026 सेप्टेम्बर 14');
    expect(formatDate(NOON, { locale: 'ne', digits: 'deva' })).toBe('२०२६ सेप्टेम्बर १४');
    expect(formatDate(NOON, { locale: 'ne', calendar: 'bs' })).toBe('29 भदौ 2083');
    expect(formatDate(NOON, { calendar: 'bs' })).toBe('29 Bhadra 2083');
    expect(formatDateBs(NOON, { locale: 'ne', long: true, digits: 'deva' })).toBe('२९ भदौ २०८३');
    expect(formatDateAdBs(NOON, { locale: 'ne' })).toBe('2026 सेप्टेम्बर 14 (2083-05-29 वि.सं.)');
    expect(formatDateAdBs(NOON)).toMatch(/^14 Sept? 2026 \(2083-05-29 BS\)$/);
    // 23:00 on the 13th UTC is already the 14th in Kathmandu.
    expect(formatDate('2026-09-13T23:00:00.000Z', { locale: 'ne' })).toBe('2026 सेप्टेम्बर 14');
    expect(formatTime(NOON, { locale: 'ne' })).toBe('12:00');
    expect(formatDateTime(NOON, { locale: 'ne' })).toMatch(/2026 सेप्टेम्बर 14.*12:00/);
  });

  it('says a length of time and a relative time in Nepali', () => {
    expect(formatMinutes(95)).toBe('1 h 35 min');
    expect(formatMinutes(0)).toBe('0 min');
    expect(formatMinutes(95, { locale: 'ne' })).toBe('1 घण्टा 35 मिनेट');
    expect(formatMinutes(0, { locale: 'ne' })).toBe('0 मिनेट');
    const threeHoursAgo = new Date(Date.now() - 3 * 3600_000).toISOString();
    expect(relativeTime(threeHoursAgo, { locale: 'ne' })).toBe('3 घण्टा पहिले');
    expect(relativeTime(threeHoursAgo)).toBe('3 hours ago');
  });
});

describe('the back office’s Calendar switch', () => {
  // 06:15 UTC on 4 Oct 2026 is 12:00 in Kathmandu — 18 Ashwin 2083.
  const iso = '2026-10-04T06:15:00.000Z';
  afterEach(() => setDisplayCalendar('ad'));

  it('in Nepali, an admin date is BS in Nepali script; the time stays Latin', () => {
    setDisplayCalendar('bs');
    expect(formatDate(iso)).toBe('१८ असोज २०८३');
    expect(formatDate(iso, { year: undefined })).toBe('१८ असोज');
    expect(formatDate(iso, { weekday: 'long', day: 'numeric', month: 'long', year: undefined })).toBe('आइत १८ असोज');
    expect(formatDate(iso, { day: undefined, year: undefined, month: 'short' })).toBe('असोज');
    expect(formatDateTime(iso)).toBe('१८ असोज २०८३, 12:00');
    expect(formatDay('2026-10-04', { weekday: 'short', day: 'numeric', month: 'short', year: undefined })).toBe('आइत १८ असोज');
  });

  it('never moves a date that names its locale or calendar — the site, the documents, the field app', () => {
    setDisplayCalendar('bs');
    expect(formatDate(iso, { locale: 'en' })).toBe('04 Oct 2026');
    expect(formatDate(iso, { calendar: 'ad' })).toBe('04 Oct 2026');
    expect(formatDateTime(iso, { locale: 'en' })).toBe('04 Oct 2026, 12:00');
    expect(formatDateAdBs(iso)).toBe('04 Oct 2026 (2083-06-18 BS)');
  });

  it('in English, nothing changes', () => {
    expect(formatDate(iso)).toBe('04 Oct 2026');
    expect(formatDay('2026-10-04', { weekday: 'short', day: 'numeric', month: 'short', year: undefined })).toBe('Sun 4 Oct');
    expect(formatBsDay(iso)).toBe('१८ असोज २०८३');
  });
});
