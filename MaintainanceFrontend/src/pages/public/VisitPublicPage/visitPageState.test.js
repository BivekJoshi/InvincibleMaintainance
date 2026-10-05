import { describe, expect, it } from 'vitest';
import {
  MONTH_KEYS, respondBody, telHref, VISIT_NOTE_MAX, visitPageState, visitWhen, WEEKDAY_KEYS,
} from './visitPageState';
import { DOCUMENTS } from '@/config/i18n/documents';
import { createT, describeCatalogue } from '@/helpers/i18n';

const en = createT(DOCUMENTS, 'en');
const ne = createT(DOCUMENTS, 'ne');

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
    expect(visitWhen(WINDOW, en)).toEqual({ day: 'Friday, 2 October 2026', time: '10:00–12:00' });
    expect(visitWhen(WINDOW, ne)).toEqual({ day: 'शुक्रबार, 2 अक्टोबर 2026', time: '10:00–12:00' });
    // 00:30 on the 3rd in Kathmandu is still the 2nd in UTC.
    expect(visitWhen({ start: '2026-10-02T18:45:00.000Z' }, en)).toEqual({ day: 'Saturday, 3 October 2026', time: 'From 00:30' });
    expect(visitWhen({ start: '2026-10-02T18:45:00.000Z' }, ne)).toEqual({ day: 'शनिबार, 3 अक्टोबर 2026', time: '00:30 बजेदेखि' });
    expect(visitWhen({ start: null }, en)).toBeNull();
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

describe('the customer visit page — its words (`DOCUMENTS.visit`)', () => {
  // `config/i18n/catalogues.test.js` holds English and Nepali to the same keys; what the page builds at run time is here.
  it('has a day name for every weekday and a month name for every month, in both languages', () => {
    expect(WEEKDAY_KEYS).toHaveLength(7);
    expect(MONTH_KEYS).toHaveLength(12);
    for (const locale of ['en', 'ne']) {
      expect(Object.keys(DOCUMENTS[locale].visit.weekdays)).toEqual(WEEKDAY_KEYS);
      expect(Object.keys(DOCUMENTS[locale].visit.months)).toEqual(MONTH_KEYS);
    }
    // Every month of a year reads, in Nepali too — Latin digits, the year never grouped.
    for (let m = 0; m < 12; m += 1) {
      const start = new Date(Date.UTC(2026, m, 15, 4, 15)).toISOString();
      expect(visitWhen({ start }, ne).day).toMatch(/^[\u0900-\u097F]+, 15 [\u0900-\u097F]+ 2026$/);
    }
  });

  it('has words for every state it can show, in English and Nepali', () => {
    for (const locale of ['en', 'ne']) {
      for (const kind of ['confirmed', 'reschedule', 'cancelled', 'underway', 'done', 'closed']) {
        expect(DOCUMENTS[locale].visit.outcome[kind].title, `${locale} ${kind}`).toBeTruthy();
      }
    }
    // The Nepali words really are Nepali.
    expect(DOCUMENTS.ne.visit.buttons.confirm).toMatch(/[ऀ-ॿ]/);
    expect(DOCUMENTS.ne.visit.buttons.reschedule).toMatch(/[ऀ-ॿ]/);
    expect(DOCUMENTS.ne.visit.outcome.confirmed.title).toMatch(/[ऀ-ॿ]/);
  });

  it('offers the other language in that language', () => {
    expect(en('visit.otherLanguage')).toMatch(/[ऀ-ॿ]/);
    expect(ne('visit.otherLanguage')).toBe('Read in English');
  });

  it('words a too-late answer (VISIT_CLOSED) in both languages', () => {
    expect(en('errors.VISIT_CLOSED')).toMatch(/did not reach us in time/);
    expect(ne('errors.VISIT_CLOSED')).toMatch(/[ऀ-ॿ]/);
  });

  it('never talks about money (D1)', () => {
    const words = ['en', 'ne'].flatMap((locale) => describeCatalogue(DOCUMENTS[locale].visit)
      .flatMap((row) => (row.kind === 'text' ? [row.value] : Object.values(row.value))));
    expect(words.join(' ')).not.toMatch(/\b(rate|cost|total|margin|price|Rs)\b/i);
  });
});
