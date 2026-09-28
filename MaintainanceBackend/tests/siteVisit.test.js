import { describe, it, expect } from 'vitest';
import { checklistGaps, isFlagged } from '../src/services/survey.service.js';
import { singleArea } from '../src/services/boq.service.js';
import { visitWindowText } from '../src/services/visit.service.js';
import { inspectionQuestion, inspectionQuestions } from '../src/shared/schemas/survey.js';
import { measurementQty } from '../src/utils/quantity.js';

/** Phase L5: the checklist's flags and gaps, the room a line was measured in, the visit's window. */

const NUMBER = { key: 'moisture', label: 'Moisture', type: 'NUMBER', flag: { above: 20, below: 2 } };
const YES_NO = { key: 'dpc', label: 'DPC?', type: 'YES_NO', flag: { equals: 'no' } };
const CHOICE = { key: 'salt', label: 'Salt', type: 'CHOICE', options: ['None', 'Light', 'Heavy'], flag: { values: ['Heavy'] } };

describe('isFlagged', () => {
  it('a number above or below its thresholds; the threshold itself is not over', () => {
    expect(isFlagged(NUMBER, { value: 20.1 })).toBe(true);
    expect(isFlagged(NUMBER, { value: 20 })).toBe(false);
    expect(isFlagged(NUMBER, { value: 1.5 })).toBe(true);
    expect(isFlagged(NUMBER, { textValue: 'wet' })).toBe(false);
  });

  it('yes/no on its answer, a choice on its values — case aside; text and unflagged questions never', () => {
    expect(isFlagged(YES_NO, { textValue: 'No' })).toBe(true);
    expect(isFlagged(YES_NO, { textValue: 'yes' })).toBe(false);
    expect(isFlagged(CHOICE, { textValue: 'heavy' })).toBe(true);
    expect(isFlagged(CHOICE, { textValue: 'Light' })).toBe(false);
    expect(isFlagged({ key: 't', type: 'TEXT' }, { textValue: 'anything' })).toBe(false);
    expect(isFlagged({ key: 'n', type: 'NUMBER' }, { value: 99 })).toBe(false);
    expect(isFlagged(null, { value: 99 })).toBe(false);
  });
});

describe('checklistGaps', () => {
  const template = {
    questions: [
      { ...NUMBER, required: true, photoRequired: true },
      { ...YES_NO, required: true },
      { ...CHOICE, required: false, photoRequired: true },
      { key: 'story', label: 'Story', type: 'TEXT', required: true },
    ],
  };

  it('names each missing answer, then each missing photo on an answer', () => {
    expect(checklistGaps(template, [
      { questionKey: 'moisture', value: 24 },
      { questionKey: 'dpc', textValue: 'maybe' },
      { questionKey: 'salt', textValue: 'Heavy' },
      { questionKey: 'story', textValue: '   ' },
    ])).toEqual([
      { questionKey: 'moisture', label: 'Moisture', missing: 'photo' },
      { questionKey: 'dpc', label: 'DPC?', missing: 'answer' },
      { questionKey: 'salt', label: 'Salt', missing: 'photo' },
      { questionKey: 'story', label: 'Story', missing: 'answer' },
    ]);
  });

  it('an optional question left out is not a gap, even one that wants a photo; no template, no gaps', () => {
    expect(checklistGaps(template, [
      { questionKey: 'moisture', value: 0, mediaId: 'm1' },
      { questionKey: 'dpc', textValue: 'yes' },
      { questionKey: 'story', textValue: 'After rain' },
    ])).toEqual([]);
    expect(checklistGaps(null, [])).toEqual([]);
  });
});

describe('the measurement sheet by room', () => {
  it('two rooms with a door and a window deducted', () => {
    const bedroom = [{ area: 'Bedroom', nos: 2, l: 12.5, h: 9 }, { area: 'Bedroom', nos: 1, l: 3, h: 7, deduct: true }];
    const kitchen = [{ area: 'Kitchen', l: 10, h: 9 }, { area: 'Kitchen', l: 4, h: 4, deduct: true }];
    expect(measurementQty(bedroom)).toBe(204);
    expect(measurementQty(kitchen)).toBe(74);
    expect(singleArea(bedroom)).toBe('Bedroom');
    expect(singleArea([...bedroom, ...kitchen])).toBeNull();
    expect(singleArea([{ area: ' Roof ' }, { area: 'Roof' }, { area: '' }])).toBe('Roof');
    expect(singleArea(undefined)).toBeNull();
  });
});

describe('inspection question schema', () => {
  it('keys are unique, choices have options, and a flag fits its type', () => {
    expect(inspectionQuestions.safeParse([NUMBER, YES_NO, CHOICE]).success).toBe(true);
    expect(inspectionQuestions.safeParse([NUMBER, NUMBER]).success).toBe(false);
    expect(inspectionQuestion.safeParse({ ...CHOICE, options: ['Only'] }).success).toBe(false);
    expect(inspectionQuestion.safeParse({ ...YES_NO, flag: { above: 1 } }).success).toBe(false);
    expect(inspectionQuestion.safeParse({ ...NUMBER, flag: { above: 2, below: 5 } }).success).toBe(false);
    expect(inspectionQuestion.safeParse({ ...NUMBER, key: 'Has Space' }).success).toBe(false);
    expect(inspectionQuestion.parse({ ...NUMBER, flag: { above: '20', below: '' } }).flag).toEqual({ above: 20 });
  });
});

describe('visitWindowText', () => {
  it('the window in Kathmandu time (UTC+05:45)', () => {
    expect(visitWindowText(new Date('2026-10-01T04:15:00Z'), new Date('2026-10-01T06:15:00Z'))).toBe('10:00–12:00');
    expect(visitWindowText(new Date('2026-10-01T04:15:00Z'), null)).toBe('10:00');
    expect(visitWindowText(null, null)).toBeNull();
  });
});
