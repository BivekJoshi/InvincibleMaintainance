import { describe, expect, it } from 'vitest';
import {
  blankItem, blankMeasurement, groupByArea, isMeasured, lineQty, payloadIndexes, serverFlagFor, serverQtyFor,
  stepProgress, surveyPayload, surveyToForm,
} from '@/pages/tech/SurveyFormPage/surveyForm';

const TEMPLATE = {
  id: 't1', name: 'Damp',
  questions: [
    { key: 'moisture', label: 'Moisture', type: 'NUMBER', unit: '%', metric: 'moisture', flag: { above: 20 }, required: true, photoRequired: true },
    { key: 'dpc', label: 'DPC visible', type: 'YES_NO', flag: { equals: 'no' }, required: true, photoRequired: false },
  ],
};

const SURVEY = {
  id: 's1', status: 'DRAFT', template: TEMPLATE, site: { lat: null, lng: null },
  problemSummary: 'Damp in the living room', diagnosis: null, urgency: 'HIGH', areaUnit: 'sq.ft',
  readings: [
    { questionKey: 'moisture', label: 'Moisture', value: 24, unit: '%', mediaId: 'm1', flagged: true },
    { label: 'West wall', metric: 'moisture', value: 12, unit: '%' },
  ],
  items: [{
    kind: 'SERVICE', description: 'Wall putty', unit: 'sq.ft', qty: 229, wastagePct: 5, sortOrder: 0,
    measurements: [
      { area: 'बैठक कोठा', description: 'North wall', nos: 1, l: 12.5, h: 10 },
      { area: 'बैठक कोठा', description: 'Door', nos: 1, l: 3, h: 7, deduct: true },
      { area: 'Bedroom', description: 'East wall', nos: 1, l: 12.5, h: 10 },
    ],
  }],
};

describe('the survey stepper’s form', () => {
  it('splits the server’s readings into answers and other readings, and keeps the sizes as text', () => {
    const form = surveyToForm(SURVEY);
    expect(form.answers).toEqual({ moisture: { value: '24', mediaId: 'm1' } });
    expect(form.readings).toEqual([expect.objectContaining({ label: 'West wall', value: '12', unit: '%' })]);
    expect(form.items[0].measurements.map((m) => m.l)).toEqual(['12.5', '3', '12.5']);
    expect(form.urgency).toBe('HIGH');
  });

  it('builds a full-replace payload: answers first, measured lines with their rows, no rate anywhere', () => {
    const form = surveyToForm(SURVEY);
    form.answers.dpc = { textValue: 'no' };
    form.items[0].measurements[0].l = '12\'6"';
    form.items.push(blankItem({ description: 'Unfinished line' })); // no quantity: stays on the phone
    form.sitePin = { lat: 27.67, lng: 85.31, accuracy: 9 };
    const body = surveyPayload(form, TEMPLATE);

    expect(body.readings).toEqual([
      { questionKey: 'moisture', label: 'Moisture', metric: 'moisture', value: 24, unit: '%', mediaId: 'm1', sortOrder: 0 },
      { questionKey: 'dpc', label: 'DPC visible', metric: 'observation', textValue: 'no', sortOrder: 1 },
      { label: 'West wall', metric: 'moisture', value: 12, unit: '%', sortOrder: 2 },
    ]);
    expect(body.items).toEqual([{
      kind: 'SERVICE', description: 'Wall putty', unit: 'sq.ft', qty: 229, wastagePct: 5, isOptional: false, sortOrder: 0,
      measurements: [
        { area: 'बैठक कोठा', description: 'North wall', nos: 1, l: 12.5, h: 10 },
        { area: 'बैठक कोठा', description: 'Door', nos: 1, l: 3, h: 7, deduct: true },
        { area: 'Bedroom', description: 'East wall', nos: 1, l: 12.5, h: 10 },
      ],
    }]);
    expect(body.sitePin).toEqual({ lat: 27.67, lng: 85.31, accuracy: 9 });
    expect(body.problemSummary).toBe('Damp in the living room');
    expect(body).not.toHaveProperty('diagnosis');
    expect(JSON.stringify(body)).not.toMatch(/"(rate|amount|cost|_key)"/);
  });

  it('keeps an unreadable row on the phone, and a line whose deductions exceed it out of the payload', () => {
    const item = blankItem({ description: 'Plaster', unit: 'sq.ft', measurements: [
      { ...blankMeasurement('Hall'), nos: '1', l: '10', h: '10' },
      { ...blankMeasurement('Hall'), nos: '1', l: 'ten', h: '7' },
    ] });
    expect(isMeasured(item)).toBe(true);
    expect(lineQty(item)).toBe(100);
    expect(surveyPayload({ items: [item], answers: {}, readings: [] }, null).items[0].measurements).toHaveLength(1);

    const negative = blankItem({ description: 'Door only', measurements: [{ ...blankMeasurement('Hall'), nos: '1', l: '3', h: '7', deduct: true }] });
    expect(surveyPayload({ items: [negative], answers: {}, readings: [] }, null).items).toEqual([]);
  });

  it('shows the server’s quantity and flag only while the phone holds what the server holds', () => {
    const form = surveyToForm(SURVEY);
    expect(serverQtyFor(form.items[0], form, SURVEY)).toBe(229);
    expect(serverFlagFor(TEMPLATE.questions[0], form.answers.moisture, SURVEY)).toBe(true);

    form.items[0].measurements[2].h = '11';
    expect(serverQtyFor(form.items[0], form, SURVEY)).toBeNull();
    expect(serverFlagFor(TEMPLATE.questions[0], { value: '19' }, SURVEY)).toBeUndefined();
    expect(payloadIndexes(form.items).get(form.items[0]._key)).toBe(0);
  });

  it('groups rows by room and reports each step’s progress', () => {
    const form = surveyToForm(SURVEY);
    expect(groupByArea(form.items[0].measurements).map((g) => [g.area, g.rows.length])).toEqual([['बैठक कोठा', 2], ['Bedroom', 1]]);
    const progress = stepProgress(form, SURVEY, { visited: new Set(['before']), photos: 2 });
    expect(progress.before.done).toBe(true);
    expect(progress.arrived.done).toBe(false);
    expect(progress.checklist).toMatchObject({ done: false, count: [1, 2] });
    expect(progress.measure).toMatchObject({ done: true, count: 3 });
    expect(progress.photos).toMatchObject({ done: true, count: 2 });
    expect(progress.findings).toMatchObject({ done: false, count: [1, 3] });
    expect(progress.lines).toMatchObject({ done: true, count: 1 });
  });
});
