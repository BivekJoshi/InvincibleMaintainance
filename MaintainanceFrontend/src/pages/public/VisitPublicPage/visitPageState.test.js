import { describe, expect, it } from 'vitest';
import { respondBody, telHref, VISIT_NOTE_MAX, visitPageState, visitWhen } from './visitPageState';
import { VISIT_PAGE_COPY, visitCopy } from './visitPageCopy';

/** Every key path in a copy object (functions and strings are leaves). */
const paths = (value, prefix = '') => (value && typeof value === 'object'
  ? Object.entries(value).flatMap(([k, v]) => paths(v, prefix ? `${prefix}.${k}` : k))
  : [prefix]);

/** Friday 2 October 2026, 10:00–12:00 in Kathmandu (+05:45). */
const WINDOW = { start: '2026-10-02T04:15:00.000Z', end: '2026-10-02T06:15:00.000Z' };

describe('the customer visit page — what it shows', () => {
  it.each([
    [{ status: 'SCHEDULED', answer: null, canAnswer: true }, 'open'],
    [{ status: 'ASSIGNED', answer: 'CONFIRMED', canAnswer: true }, 'confirmed'],
    [{ status: 'ASSIGNED', answer: 'RESCHEDULE_REQUESTED', canAnswer: true }, 'reschedule'],
    [{ status: 'CANCELLED', answer: null, canAnswer: false }, 'cancelled'],
    [{ status: 'EN_ROUTE', answer: 'CONFIRMED', canAnswer: false }, 'underway'],
    [{ status: 'IN_PROGRESS', answer: null, canAnswer: false }, 'underway'],
    [{ status: 'COMPLETED', answer: 'CONFIRMED', canAnswer: false }, 'done'],
    [{ status: 'VERIFIED', answer: null, canAnswer: false }, 'done'],
    // Past its window, still scheduled: the API says no more answers.
    [{ status: 'ASSIGNED', answer: null, canAnswer: false }, 'closed'],
    [null, 'closed'],
  ])('%j → %s', (visit, kind) => {
    expect(visitPageState(visit).kind).toBe(kind);
  });

  it('takes the API’s word that it is closed (VISIT_CLOSED) over the page’s copy', () => {
    const state = visitPageState({ status: 'SCHEDULED', answer: null, canAnswer: true }, { closed: true });
    expect(state).toEqual({ kind: 'closed', canAnswer: false });
  });

  it('reads the window in Kathmandu time, in both languages, with Latin digits', () => {
    expect(visitWhen(WINDOW, visitCopy('en'))).toEqual({ day: 'Friday, 2 October 2026', time: '10:00–12:00' });
    expect(visitWhen(WINDOW, visitCopy('ne'))).toEqual({ day: 'शुक्रबार, 2 अक्टोबर 2026', time: '10:00–12:00' });
    // 00:30 on the 3rd in Kathmandu is still the 2nd in UTC.
    expect(visitWhen({ start: '2026-10-02T18:45:00.000Z' }, visitCopy('en'))).toEqual({ day: 'Saturday, 3 October 2026', time: 'From 00:30' });
    expect(visitWhen({ start: null }, visitCopy('en'))).toBeNull();
  });

  it('sends the note only with a reschedule, trimmed, and never an empty one', () => {
    expect(respondBody('confirm', 'ignored')).toEqual({ answer: 'confirm' });
    expect(respondBody('reschedule', '  शनिबार बिहान  ')).toEqual({ answer: 'reschedule', note: 'शनिबार बिहान' });
    expect(respondBody('reschedule', '   ')).toEqual({ answer: 'reschedule' });
    expect(respondBody('reschedule')).toEqual({ answer: 'reschedule' });
    expect(VISIT_NOTE_MAX).toBe(500);
  });

  it('dials a phone as printed', () => {
    expect(telHref('01-5407720')).toBe('tel:015407720');
    expect(telHref('+977 980-1234567')).toBe('tel:+9779801234567');
  });
});

describe('the customer visit page — its words', () => {
  it('says everything in Nepali that it says in English', () => {
    expect(paths(VISIT_PAGE_COPY.ne).sort()).toEqual(paths(VISIT_PAGE_COPY.en).sort());
    // The Nepali words really are Nepali.
    expect(VISIT_PAGE_COPY.ne.buttons.confirm).toMatch(/[ऀ-ॿ]/);
    expect(VISIT_PAGE_COPY.ne.buttons.reschedule).toMatch(/[ऀ-ॿ]/);
    expect(VISIT_PAGE_COPY.ne.outcome.confirmed.title).toMatch(/[ऀ-ॿ]/);
    expect(visitCopy('fr')).toBe(VISIT_PAGE_COPY.en);
  });

  it('has a day name for every weekday and a month name for every month', () => {
    for (const locale of ['en', 'ne']) {
      expect(VISIT_PAGE_COPY[locale].weekdays).toHaveLength(7);
      expect(VISIT_PAGE_COPY[locale].months).toHaveLength(12);
    }
  });

  it('has words for every state it can show, in English and Nepali', () => {
    for (const locale of ['en', 'ne']) {
      for (const kind of ['confirmed', 'reschedule', 'cancelled', 'underway', 'done', 'closed']) {
        expect(VISIT_PAGE_COPY[locale].outcome[kind].title, `${locale} ${kind}`).toBeTruthy();
      }
    }
  });

  it('offers the other language in that language', () => {
    expect(VISIT_PAGE_COPY.en.otherLanguage).toEqual({ locale: 'ne', label: expect.stringMatching(/[ऀ-ॿ]/) });
    expect(VISIT_PAGE_COPY.ne.otherLanguage).toEqual({ locale: 'en', label: 'Read in English' });
  });

  it('never talks about money (D1)', () => {
    const words = JSON.stringify(VISIT_PAGE_COPY, (_, v) => (typeof v === 'function' ? v('X', 'Y') : v));
    expect(words).not.toMatch(/\b(rate|cost|total|margin|price|Rs)\b/i);
  });
});
