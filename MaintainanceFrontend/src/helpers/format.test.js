import { describe, it, expect } from 'vitest';
import {
  formatRupees, fromKathmanduParts, parseRupees, rupeesInput, rupeesToPaisa, toKathmanduParts,
} from '@/helpers/format';

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
