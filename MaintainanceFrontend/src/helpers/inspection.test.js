import { describe, expect, it } from 'vitest';
import {
  answerNumber, answerToReading, flagRule, isAnswered, missingAnswers, optionLabel, predictFlag, questionLabel, readingToAnswer,
} from '@/helpers/inspection';

const moisture = { key: 'moisture_low', label: 'Moisture at 300 mm', labelNe: '300 मिमिमा चिस्यान', type: 'NUMBER', unit: '%', metric: 'moisture', flag: { above: 20 }, required: true, photoRequired: true };
const band = { key: 'band', label: 'Damp band height', type: 'NUMBER', flag: { above: 900, below: 100 }, required: false, photoRequired: false };
const salt = { key: 'salt', label: 'Salt deposits', type: 'CHOICE', options: ['None', 'Light', 'Heavy'], flag: { values: ['Heavy'] }, required: true, photoRequired: false };
const dpc = { key: 'dpc_visible', label: 'DPC visible', type: 'YES_NO', flag: { equals: 'no' }, required: true, photoRequired: false };
const story = { key: 'story', label: 'What the customer says', type: 'TEXT', required: false, photoRequired: false };
const sketchOnly = { key: 'sketch', label: 'Wall sketch', type: 'TEXT', required: false, photoRequired: true };
const TEMPLATE = { questions: [moisture, salt, dpc, story, sketchOnly] };

describe('inspection answers', () => {
  it('reads a number as typed, and knows an answer when it sees one', () => {
    expect(answerNumber(' 18.5 ')).toBe(18.5);
    expect(answerNumber('')).toBeUndefined();
    expect(answerNumber('eighteen')).toBeNaN();
    expect(isAnswered(moisture, { value: '0' })).toBe(true);
    expect(isAnswered(moisture, { value: 'x' })).toBe(false);
    expect(isAnswered(dpc, { textValue: 'maybe' })).toBe(false);
    expect(isAnswered(dpc, { textValue: 'no' })).toBe(true);
    expect(isAnswered(story, { textValue: '  ' })).toBe(false);
  });

  it('flags as the server does: strictly above or below, the yes/no it names, the choices it lists', () => {
    expect(predictFlag(moisture, { value: '20' })).toBe(false);
    expect(predictFlag(moisture, { value: '20.1' })).toBe(true);
    expect(predictFlag(band, { value: '50' })).toBe(true);
    expect(predictFlag(band, { value: '500' })).toBe(false);
    expect(predictFlag(salt, { textValue: 'Heavy' })).toBe(true);
    expect(predictFlag(salt, { textValue: 'heavy' })).toBe(true);
    expect(predictFlag(salt, { textValue: 'Light' })).toBe(false);
    expect(predictFlag(dpc, { textValue: 'no' })).toBe(true);
    expect(predictFlag(dpc, { textValue: 'yes' })).toBe(false);
    expect(predictFlag(story, { textValue: 'Heavy' })).toBe(false);
    expect(predictFlag(moisture, {})).toBe(false);
  });

  it('turns an answer into the reading the API stores, and back', () => {
    expect(answerToReading(moisture, { value: '24', photoUploadId: 'u1' }, 0)).toEqual({
      questionKey: 'moisture_low', label: 'Moisture at 300 mm', metric: 'moisture', value: 24, unit: '%', photoUploadId: 'u1', sortOrder: 0,
    });
    expect(answerToReading(moisture, { value: '24', mediaId: 'm1', photoUploadId: 'u1' }, 0).mediaId).toBe('m1');
    expect(answerToReading(dpc, { textValue: 'no' }, 2)).toEqual({
      questionKey: 'dpc_visible', label: 'DPC visible', metric: 'observation', textValue: 'no', sortOrder: 2,
    });
    expect(answerToReading(salt, {}, 1)).toBeNull();
    expect(readingToAnswer(moisture, { value: 24, mediaId: 'm1' })).toEqual({ value: '24', mediaId: 'm1' });
    expect(readingToAnswer(salt, { textValue: 'Light' })).toEqual({ textValue: 'Light' });
  });

  it('names what blocks a submit, in the API’s SURVEY_INCOMPLETE shape', () => {
    expect(missingAnswers(TEMPLATE, {})).toEqual([
      { questionKey: 'moisture_low', label: 'Moisture at 300 mm', missing: 'answer' },
      { questionKey: 'salt', label: 'Salt deposits', missing: 'answer' },
      { questionKey: 'dpc_visible', label: 'DPC visible', missing: 'answer' },
      { questionKey: 'sketch', label: 'Wall sketch', missing: 'photo' },
    ]);
    expect(missingAnswers(TEMPLATE, {
      moisture_low: { value: '24' },
      salt: { textValue: 'None' },
      dpc_visible: { textValue: 'yes' },
      // A photo with no answer: the photo rides on the answer's reading, so the answer is what is missing.
      sketch: { photoUploadId: 'u9' },
    })).toEqual([
      { questionKey: 'moisture_low', label: 'Moisture at 300 mm', missing: 'photo' },
      { questionKey: 'sketch', label: 'Wall sketch', missing: 'answer' },
    ]);
    expect(missingAnswers(TEMPLATE, {
      moisture_low: { value: '24', photoUploadId: 'u1' }, salt: { textValue: 'None' }, dpc_visible: { textValue: 'yes' },
      sketch: { textValue: 'Drawn on the back of the card', mediaId: 'm2' },
    })).toEqual([]);
    expect(missingAnswers(null, {})).toEqual([]);
  });

  it('words the question and its rule for the phone', () => {
    expect(questionLabel(moisture, 'ne')).toBe('300 मिमिमा चिस्यान');
    expect(questionLabel(moisture, 'en')).toBe('Moisture at 300 mm');
    expect(questionLabel(salt, 'ne')).toBe('Salt deposits');
    expect(flagRule(moisture)).toEqual({ type: 'range', parts: [{ op: 'above', value: '20 %' }] });
    expect(flagRule(dpc)).toEqual({ type: 'equals', value: 'no' });
    expect(flagRule(salt)).toEqual({ type: 'values', values: ['Heavy'] });
    expect(flagRule(story)).toBeNull();
  });
});

describe('inspection answers in Nepali (Phase J1)', () => {
  it('reads a number typed in Devanagari digits, and sends the Latin number', () => {
    expect(answerNumber('२४.५')).toBe(24.5);
    expect(predictFlag(moisture, { value: '२४' })).toBe(true);
    expect(answerToReading(moisture, { value: '२४', mediaId: 'm1' }, 0)).toMatchObject({ value: 24 });
  });

  it('shows a choice in the office’s Nepali words, and keeps the English option as the answer', () => {
    const saltNe = { ...salt, optionsNe: ['छैन', 'थोरै', 'धेरै'] };
    expect(optionLabel(saltNe, 'Heavy', 'ne')).toBe('धेरै');
    expect(optionLabel(saltNe, 'Heavy', 'en')).toBe('Heavy');
    expect(optionLabel(salt, 'Heavy', 'ne')).toBe('Heavy');
    expect(optionLabel({ ...salt, optionsNe: ['छैन', '', null] }, 'Light', 'ne')).toBe('Light');
    expect(answerToReading(saltNe, { textValue: 'Heavy' }, 0)).toMatchObject({ textValue: 'Heavy' });
    expect(predictFlag(saltNe, { textValue: 'Heavy' })).toBe(true);
  });
});
