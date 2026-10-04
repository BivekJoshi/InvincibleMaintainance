import { describe, expect, it } from 'vitest';
import { FIELD } from '@/config/i18n/field';
import { COMMON } from '@/config/i18n/common';
import {
  JOB_STATUSES, LOST_TIME_REASONS, PRIORITIES, SURVEY_ITEM_KINDS, SURVEY_METRICS, SURVEY_PHOTO_KINDS, SURVEY_STATUSES, WEATHER,
} from '@/config/constants';
import { FIELD_PHOTO_KINDS, queueSummary, refusalReason } from '@/helpers/fieldJob';
import { MUTATION_KINDS, TERMINAL_CODES } from '@/helpers/offlineQueue';
import { SURVEY_STEPS } from '@/pages/tech/SurveyFormPage/surveyForm';
import { createT, lookup } from '@/helpers/i18n';

/**
 * The field app's words (Phase J1, J1.2) — `catalogues.test.js` holds English and Nepali to the same keys; this holds
 * the keys the screens build at run time to the constants they are built from, and checks the counted and filled-in
 * words in both languages.
 */

const LOCALES = ['en', 'ne'];
const has = (locale, key) => typeof lookup(FIELD[locale], key) === 'string';

describe('FIELD — every value a screen names has words in both languages', () => {
  const cases = [
    ['status', JOB_STATUSES],
    ['priority', PRIORITIES],
    ['surveyStatus', SURVEY_STATUSES],
    ['photos.kinds', [...new Set([...FIELD_PHOTO_KINDS, ...SURVEY_PHOTO_KINDS, 'SIGNATURE'])]],
    ['diary.weather', WEATHER],
    ['diary.lost.reasons', LOST_TIME_REASONS],
    ['survey.checklist.metrics', SURVEY_METRICS],
    ['survey.lines.kinds', SURVEY_ITEM_KINDS],
    ['survey.steps', SURVEY_STEPS],
    ['sync.kinds', [...MUTATION_KINDS, 'photo', 'signature']],
    ['measure.refused', ['MEASUREMENT_CLOSED', 'LINE_NOT_MEASURED', 'NEGATIVE_LINE', 'NOT_FOUND']],
  ];

  it.each(cases)('%s', (prefix, values) => {
    for (const locale of LOCALES) {
      for (const value of values) expect(has(locale, `${prefix}.${value}`), `${locale} ${prefix}.${value}`).toBe(true);
    }
  });

  it('words every code the queue drops for good — in FIELD or in COMMON', () => {
    for (const locale of LOCALES) {
      for (const code of [...TERMINAL_CODES, 'BATCH_REFUSED', 'SYNC_FAILED', 'NO_MEDIA']) {
        const worded = has(locale, `errors.${code}`) || typeof lookup(COMMON[locale], `errors.${code}`) === 'string';
        expect(worded, `${locale} errors.${code}`).toBe(true);
      }
    }
  });

  it('writes Nepali in Devanagari, with Latin digits and the units as they are written on site', () => {
    const ne = createT(FIELD, 'ne');
    expect(ne('sync.offline')).toMatch(/[ऀ-ॿ]/);
    const everything = JSON.stringify(FIELD.ne);
    expect(everything).not.toMatch(/[०-९]/);
    expect(everything).not.toMatch(/मिमि|फिट\b/);
  });
});

describe('FIELD — counts and filled-in words', () => {
  const en = createT(FIELD, 'en');
  const ne = createT(FIELD, 'ne');

  it('counts in English and Nepali', () => {
    expect(en('job.finish.openTasks', { count: 1 })).toBe('1 checklist item is still open — tick it before completing.');
    expect(en('job.finish.openTasks', { count: 2 })).toBe('2 checklist items are still open — tick them before completing.');
    expect(ne('job.finish.openTasks', { count: 2 })).toBe('2 वटा चेकलिस्ट बाँकी छ — काम सक्नुअघि टिक लगाउनुहोस्।');
    expect(en('today.count', { count: 1 })).toBe('1 job assigned to you');
    expect(ne('today.count', { count: 3 })).toBe('तपाईंलाई 3 वटा काम दिइएको छ');
    expect(en('photos.queued', { count: 1 })).toBe('Photo saved — it uploads when there is signal.');
    expect(en('photos.queued', { count: 4 })).toBe('4 photos saved — they upload when there is signal.');
    expect(ne('photos.queued', { count: 4 })).toBe('4 फोटो सेभ भयो — सिग्नल आएपछि अपलोड हुन्छ।');
    expect(en('diary.headcount.total', { count: 1 })).toBe('1 person today');
    expect(ne('diary.headcount.total', { count: 12 })).toBe('आज 12 जना');
    expect(en('history.preset', { count: 30 })).toBe('30 days');
  });

  it('says what waits on the phone: "3 changes and 1 photo"', () => {
    expect(queueSummary(en, 3, 1)).toBe('3 changes and 1 photo');
    expect(queueSummary(en, 1, 0)).toBe('1 change');
    expect(queueSummary(en, 0, 2)).toBe('2 photos');
    expect(queueSummary(en, 0, 0)).toBe('');
    expect(queueSummary(ne, 3, 1)).toBe('3 परिवर्तन र 1 फोटो');
    expect(ne('sync.offlineBanner', { what: queueSummary(ne, 3, 1) }))
      .toBe('सिग्नल छैन। 3 परिवर्तन र 1 फोटो यो फोनमा सेभ छ — सिग्नल आएपछि अफिसमा पुग्छ।');
    expect(en('sync.buttonWaiting', { label: en('sync.offline'), count: 3 })).toBe('Offline — 3 waiting');
  });

  it('fills a quantity as it was formatted, and a count with lakh grouping', () => {
    expect(en('sheet.lineTotal', { qty: '1,210.5', unit: 'sq.ft' })).toBe('This line: 1,210.5 sq.ft');
    expect(ne('sheet.lineTotal', { qty: '210.5', unit: 'sq.ft' })).toBe('यो लाइन: 210.5 sq.ft');
    expect(ne('materialsSheet.moreMatches', { count: 125000 })).toBe('अरू 1,25,000 — खोजेर छान्नुहोस्');
  });

  it('says why the office refused a change — its own English, the code’s Nepali', () => {
    const commonEn = createT(COMMON, 'en');
    const commonNe = createT(COMMON, 'ne');
    const note = { code: 'INVALID_TRANSITION', message: 'The job was cancelled' };
    expect(refusalReason(note, en, commonEn)).toBe('The job was cancelled');
    expect(refusalReason(note, ne, commonNe)).toBe('अफिसले यो काम अगाडि बढाइसक्यो — यो परिवर्तन अब मिल्दैन।');
    expect(refusalReason({ code: 'PHOTOS_ONLY', message: 'Only images' }, ne, commonNe)).toBe('फोटो मात्र पठाउनुहोस्।');
    expect(refusalReason({ code: 'FILE_TOO_LARGE', message: null, details: { maxMb: 10 } }, ne, commonNe)).toBe('फाइल धेरै ठूलो भयो — बढीमा 10 MB।');
    expect(refusalReason({ code: 'SOMETHING_NEW', message: 'Server words' }, ne, commonNe)).toBe('Server words');
    expect(refusalReason({ code: null, message: null }, en, commonEn)).toBeNull();
  });
});
