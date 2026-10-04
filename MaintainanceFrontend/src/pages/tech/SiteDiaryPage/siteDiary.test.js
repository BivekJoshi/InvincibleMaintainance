import { describe, expect, it } from 'vitest';
import {
  blankDelivery, diaryDayBounds, diaryPayload, diaryProblems, diaryToForm, hasProblems, isDiaryDay, isDiarySave,
  linesBySection, parseQty, stepCount, stepHours, stepPct, waitingDays, waitingPhotoIds,
} from '@/pages/tech/SiteDiaryPage/siteDiary';
import { diarySchema } from '../../../../../MaintainanceBackend/src/shared/schemas/ops.js';

const ENTRY = {
  id: 'd1', jobId: 'j1', day: '2026-09-27', weather: 'HEAVY_RAIN',
  headcount: [{ tradeId: 'tr1', count: 4 }],
  progress: [{ jobLineId: 'l1', progressPct: 35 }],
  received: [{ materialId: 'm1', description: 'Cement', qty: 20, unit: 'bag', challanNo: 'C-77' }],
  issues: 'पानी परेर काम रोकियो', lostHours: 4, lostReason: 'RAIN', photoMediaIds: ['media-1'], note: null,
};

describe('the site diary form (Phase L7)', () => {
  it('round-trips the server’s day through the form and back to the same full-replace body', () => {
    const form = diaryToForm(ENTRY);
    expect(form.headcount).toEqual({ tr1: 4 });
    expect(form.progress).toEqual({ l1: 35 });
    expect(form.photos.map((p) => p.mediaId)).toEqual(['media-1']);
    expect(diaryPayload(form, '2026-09-27')).toEqual({
      day: '2026-09-27',
      weather: 'HEAVY_RAIN',
      headcount: [{ tradeId: 'tr1', count: 4 }],
      progress: [{ jobLineId: 'l1', progressPct: 35 }],
      received: [{ materialId: 'm1', description: 'Cement', qty: 20, unit: 'bag', challanNo: 'C-77' }],
      issues: 'पानी परेर काम रोकियो',
      lostHours: 4,
      lostReason: 'RAIN',
      photoMediaIds: ['media-1'],
    });
  });

  it('builds a body the API’s own schema takes (strict), and one it would refuse is caught first', () => {
    const { day: _day, ...body } = diaryPayload(diaryToForm(ENTRY), '2026-09-27');
    expect(diarySchema.safeParse(body).success).toBe(true);

    const form = { ...diaryToForm(null), lostHours: 2, received: [blankDelivery({ description: '', qty: 'lots' })] };
    const problems = diaryProblems(form);
    expect(problems).toEqual({
      received: { [form.received[0]._key]: { description: 'needWhat', qty: 'invalidQty' } },
      lostReason: 'needReason',
    });
    expect(hasProblems(problems)).toBe(true);
    // The API refuses the same day for the same reason.
    const { day: _d, ...refused } = diaryPayload({ ...form, received: [] }, '2026-09-27');
    expect(diarySchema.safeParse(refused).success).toBe(false);
  });

  it('leaves out a trade with nobody, an empty delivery and a reason with no hours; keeps a zero-progress line marked', () => {
    const form = {
      ...diaryToForm(null),
      headcount: { tr1: 0, tr2: 3 },
      progress: { l9: 0 },
      received: [blankDelivery()],
      lostHours: 0,
      lostReason: 'RAIN',
      issues: '   ',
    };
    expect(diaryProblems(form)).toEqual({});
    expect(diaryPayload(form, '2026-09-28')).toEqual({
      day: '2026-09-28', headcount: [{ tradeId: 'tr2', count: 3 }], progress: [{ jobLineId: 'l9', progressPct: 0 }],
      received: [], lostHours: 0, photoMediaIds: [],
    });
  });

  it('keeps a photo still uploading out of the body — it rides in the entry’s meta', () => {
    const form = { ...diaryToForm(null), photos: [{ _key: 'a', mediaId: 'm1' }, { _key: 'b', uploadId: 'up-2' }] };
    expect(diaryPayload(form, '2026-09-28').photoMediaIds).toEqual(['m1']);
    expect(waitingPhotoIds(form)).toEqual(['up-2']);
  });

  it('steps progress by 5 % within 0–100, hours by halves within 0–24, people within 0–200', () => {
    expect(stepPct(95, 5)).toBe(100);
    expect(stepPct(100, 5)).toBe(100);
    expect(stepPct(3, -5)).toBe(0);
    expect(stepHours(23.5, 0.5)).toBe(24);
    expect(stepHours(24, 0.5)).toBe(24);
    expect(stepHours(0.5, -0.5)).toBe(0);
    expect(stepCount(200, 1)).toBe(200);
    expect(stepCount(0, -1)).toBe(0);
    expect(parseQty('1,200.5')).toBe(1200.5);
    expect(parseQty('')).toBeUndefined();
    expect(parseQty('-2')).toBeNaN();
  });

  it('allows today and the 60 days before it, never tomorrow', () => {
    expect(diaryDayBounds('2026-09-28')).toEqual({ min: '2026-07-30', max: '2026-09-28' });
    expect(isDiaryDay('2026-09-28', '2026-09-28')).toBe(true);
    expect(isDiaryDay('2026-07-30', '2026-09-28')).toBe(true);
    expect(isDiaryDay('2026-07-29', '2026-09-28')).toBe(false);
    expect(isDiaryDay('2026-09-29', '2026-09-28')).toBe(false);
    expect(isDiaryDay('2026-13-01', '2026-09-28')).toBe(false);
    expect(isDiaryDay('', '2026-09-28')).toBe(false);
  });

  it('knows the saves of a job’s day, and the days waiting on the phone', () => {
    const queue = [
      { kind: 'diary_save', jobId: 'j1', payload: { day: '2026-09-27' } },
      { kind: 'diary_save', jobId: 'j1', payload: { day: '2026-09-28' } },
      { kind: 'diary_save', jobId: 'j2', payload: { day: '2026-09-28' } },
      { kind: 'status', jobId: 'j1', payload: { status: 'IN_PROGRESS' } },
    ];
    expect(queue.filter(isDiarySave('j1', '2026-09-28'))).toHaveLength(1);
    expect(waitingDays(queue, 'j1')).toEqual(['2026-09-28', '2026-09-27']);
  });

  it('groups the job’s lines by section, in order', () => {
    const groups = linesBySection([
      { id: 'a', section: 'Waterproofing' }, { id: 'b', section: null }, { id: 'c', section: 'Waterproofing' },
    ], 'Other work');
    expect(groups.map((g) => [g.title, g.lines.map((l) => l.id)])).toEqual([['Waterproofing', ['a', 'c']], ['Other work', ['b']]]);
  });
});

describe('the site diary form — typed on a Nepali keyboard (Phase J1)', () => {
  it('reads a delivery’s quantity in Devanagari digits', () => {
    expect(parseQty('१.५')).toBe(1.5);
    expect(parseQty('१,२००')).toBe(1200);
    expect(parseQty('एक')).toBeNaN();
  });
});
