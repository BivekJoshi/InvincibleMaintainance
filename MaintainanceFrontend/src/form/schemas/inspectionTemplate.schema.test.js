import { describe, expect, it } from 'vitest';
import {
  inspectionTemplateSchema, isBlankQuestion, questionBody, splitOptions, suggestQuestionKey,
} from '@/form/schemas/inspectionTemplate.schema';
// The API's own schema: the one test import that is a relative path, because it is outside `src/`.
import { inspectionTemplateSchema as apiSchema } from '../../../../MaintainanceBackend/src/shared/schemas/survey.js';

const MOISTURE = {
  key: 'moisture', label: 'Moisture reading', labelNe: 'ओसको मात्रा', type: 'NUMBER', unit: '%', metric: 'moisture',
  flag: { above: 20 }, required: true, photoRequired: true,
};
const SALT = { key: 'salt_deposits', label: 'Salt deposits on the wall', type: 'YES_NO', flag: { equals: 'yes' }, required: true, photoRequired: false };
const SOURCE = {
  key: 'water_source', label: 'Source of water', type: 'CHOICE', options: ['Rain', 'Pipe leak', 'Ground'],
  flag: { values: ['Pipe leak'] }, required: false, photoRequired: false,
};
const NOTES = { key: 'notes', label: 'Anything else', type: 'TEXT', required: false, photoRequired: false };
const DAMP = { name: 'Damp and seepage — site checklist', serviceId: 'svc-damp', questions: [MOISTURE, SALT, SOURCE, NOTES], isActive: true };

const withQuestion = (patch, i = 0) => ({ ...DAMP, questions: DAMP.questions.map((q, j) => (j === i ? { ...q, ...patch } : q)) });

/** [what, template, the grid column the form names] — each refused by the API and by the form. */
const REFUSED = [
  ['a key used twice', { ...DAMP, questions: [MOISTURE, { ...SALT, key: 'moisture' }] }, [1, 'key']],
  ['a key with capitals and a space', withQuestion({ key: 'Moisture %' }), [0, 'key']],
  ['a key longer than 40', withQuestion({ key: 'k'.repeat(41) }), [0, 'key']],
  ['a question with no words', withQuestion({ label: '  ' }), [0, 'label']],
  ['a choice with one option', withQuestion({ options: ['Rain'], flag: null }, 2), [2, 'options']],
  ['a choice with no options', withQuestion({ options: undefined, flag: null }, 2), [2, 'options']],
  ['a yes/no flagged above a number', withQuestion({ flag: { above: 3 } }, 1), [1, 'type']],
  ['a number flagged on yes', withQuestion({ flag: { equals: 'yes' } }), [0, 'flagOn']],
  ['a yes/no flagged on maybe', withQuestion({ flag: { equals: 'maybe' } }, 1), [1, 'flagOn']],
  ['a flag below higher than the flag above', withQuestion({ flag: { above: 10, below: 30 } }), [0, 'flagBelow']],
  ['a threshold that is not a number', withQuestion({ flag: { above: 'twenty' } }), [0, 'flagAbove']],
  ['a flagged value the choice does not offer', withQuestion({ flag: { values: ['Flood'] } }, 2), [2, 'flagOn']],
  ['a number flagged on options', withQuestion({ flag: { values: ['Rain'] } }), [0, 'flagOn']],
  ['a flag the API does not know', withQuestion({ flag: { over: 5 } }), [0, 'type']],
  ['an unknown type', withQuestion({ type: 'PHOTO' }), [0, 'type']],
  ['no questions', { ...DAMP, questions: [] }, null],
  ['no name', { ...DAMP, name: ' ' }, null],
];

describe('the inspection template schema mirrors the API (Phase L5)', () => {
  it('takes a whole checklist — a number with a unit and a flag, a yes/no, a choice, a text, Nepali words', () => {
    expect(apiSchema.safeParse(DAMP).success).toBe(true);
    const parsed = inspectionTemplateSchema.parse(DAMP);
    expect(parsed.questions).toEqual([MOISTURE, SALT, SOURCE, NOTES]);
    // What the form sends is what the API reads back.
    expect(apiSchema.parse(parsed).questions).toEqual(apiSchema.parse(DAMP).questions);
  });

  it.each(REFUSED)('refuses %s, as the API does', (_what, template, at) => {
    expect(apiSchema.safeParse(template).success).toBe(false);
    const result = inspectionTemplateSchema.safeParse(template);
    expect(result.success).toBe(false);
    if (at) expect(result.error.issues.map((i) => i.path)).toContainEqual(['questions', ...at]);
  });

  it('says which key is used twice', () => {
    const result = inspectionTemplateSchema.safeParse(REFUSED[0][1]);
    expect(result.error.issues.find((i) => i.path.join('.') === 'questions.1.key').message).toBe('The key "moisture" is used twice');
  });

  it('drops the grid’s blank line, keeps the index of the others, and sends the general checklist as null', () => {
    const rows = [{ label: '', key: '', type: 'YES_NO', required: false }, { ...SALT, key: 'Salt' }];
    const result = inspectionTemplateSchema.safeParse({ ...DAMP, serviceId: null, questions: rows });
    expect(result.error.issues.map((i) => i.path)).toEqual([['questions', 1, 'key']]);

    const ok = inspectionTemplateSchema.parse({ ...DAMP, serviceId: null, questions: [...rows.slice(0, 1), SALT, rows[0]] });
    expect(ok.questions).toEqual([SALT]);
    expect(ok.serviceId).toBeNull();
    expect(apiSchema.safeParse(ok).success).toBe(true);
    expect(inspectionTemplateSchema.safeParse({ ...DAMP, questions: rows.slice(0, 1) }).error.issues[0])
      .toMatchObject({ path: ['questions'], message: 'Add at least one question' });
  });

  it('sends exactly the API’s shape: what a type does not use is left out, thresholds as numbers', () => {
    expect(questionBody({
      key: ' salt ', label: 'Salt', labelNe: '', type: 'YES_NO', unit: 'mm', metric: 'moisture', options: ['a', 'b'],
      flag: { equals: 'no', above: '' }, required: true, photoRequired: false,
    })).toEqual({ key: 'salt', label: 'Salt', type: 'YES_NO', flag: { equals: 'no' }, required: true, photoRequired: false });
    expect(questionBody({ key: 'm', label: 'M', type: 'NUMBER', unit: '%', flag: { above: '20', below: 5 }, required: false }))
      .toEqual({ key: 'm', label: 'M', type: 'NUMBER', unit: '%', flag: { above: 20, below: 5 }, required: false, photoRequired: false });
    expect(questionBody({ key: 'm', label: 'M', type: 'NUMBER', flag: null })).not.toHaveProperty('flag');
    expect(questionBody({ key: 'c', label: 'C', type: 'CHOICE', options: [' a ', 'b', 'a'], flag: { values: [] } }))
      .toEqual({ key: 'c', label: 'C', type: 'CHOICE', options: ['a', 'b'], required: false, photoRequired: false });
  });

  it('suggests a key from the words, and reads options as comma-separated text', () => {
    expect(suggestQuestionKey('Moisture reading (%)')).toBe('moisture_reading');
    expect(suggestQuestionKey('DPC visible?')).toBe('dpc_visible');
    expect(suggestQuestionKey('Crème — façade')).toBe('creme_facade');
    expect(suggestQuestionKey('ओसको मात्रा')).toBe('');
    expect(suggestQuestionKey('a'.repeat(39) + ' b')).toBe('a'.repeat(39));
    expect(splitOptions('Rain, Pipe leak ,, Ground, Rain')).toEqual(['Rain', 'Pipe leak', 'Ground']);
    expect(splitOptions('')).toEqual([]);
    expect(isBlankQuestion({ label: '', key: '', type: 'CHOICE', options: [], flag: null, required: false })).toBe(true);
    expect(isBlankQuestion({ label: '', type: 'YES_NO', required: true })).toBe(false);
  });
});
