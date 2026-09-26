import { describe, it, expect } from 'vitest';
import {
  activityBody, activityFormSchema, leadActivitySchema, leadOutcomeIssues, lostReasonSchema, nextActionSchema,
  qualificationSchema,
} from '@/form/schemas/lead.schema';

const AT = '2026-09-17T04:15:00.000Z';
const errorsOf = (schema, value) => {
  const result = schema.safeParse(value);
  return result.success ? {} : Object.fromEntries(result.error.issues.map((i) => [i.path.join('.'), i.message]));
};

describe('the outcome rules (the API’s addActivity, mirrored)', () => {
  it.each([
    ['no_answer', {}, true],
    ['book_visit', {}, true],
    ['quote_without_visit', {}, true],
    ['price_shopping', {}, true],
    ['call_back', {}, false],
    ['call_back', { nextAction: { at: AT, type: 'CALL' } }, true],
    ['not_now', {}, false],
    ['not_now', { nextAction: { at: AT, type: 'FOLLOW_UP' } }, true],
    ['wrong_number', {}, false],
    ['wrong_number', { nextAction: { at: AT, type: 'CALL' } }, true],
    ['wrong_number', { close: { lostCategory: 'UNREACHABLE' } }, true],
    ['not_interested', {}, false],
    ['not_interested', { close: { lostCategory: 'PRICE' } }, true],
    ['not_interested', { close: { lostCategory: 'OTHER' } }, false],
    ['not_interested', { close: { lostCategory: 'OTHER', lostReason: 'Moved abroad' } }, true],
    // The API refuses a next action and a close together.
    ['wrong_number', { nextAction: { at: AT, type: 'CALL' }, close: { lostCategory: 'UNREACHABLE' } }, false],
  ])('%s with %o is %s', (outcome, extra, ok) => {
    const body = { type: 'call', summary: 'x', outcome, ...extra };
    expect(leadOutcomeIssues(body).length === 0).toBe(ok);
    expect(leadActivitySchema.safeParse(body).success).toBe(ok);
  });

  it('a close needs the outcome that closed it', () => {
    expect(errorsOf(leadActivitySchema, { type: 'call', summary: 'x', close: { lostCategory: 'PRICE' } })).toHaveProperty('close');
  });

  it('an outcome needs a contact, never a note', () => {
    expect(errorsOf(leadActivitySchema, { type: 'note', summary: 'x', outcome: 'no_answer' })).toHaveProperty('outcome');
    expect(leadActivitySchema.safeParse({ type: 'note', summary: 'Customer sent photos' }).success).toBe(true);
    expect(errorsOf(leadActivitySchema, { type: 'call', summary: '' })).toHaveProperty('summary');
  });

  it('a next action has a real time and a known type; the note is 300 at most', () => {
    expect(leadActivitySchema.safeParse({ type: 'call', summary: 'x', outcome: 'call_back', nextAction: { at: 'tomorrow', type: 'CALL' } }).success).toBe(false);
    expect(leadActivitySchema.safeParse({ type: 'call', summary: 'x', outcome: 'call_back', nextAction: { at: AT, type: 'LUNCH' } }).success).toBe(false);
    expect(leadActivitySchema.safeParse({
      type: 'call', summary: 'x', outcome: 'call_back', nextAction: { at: AT, type: 'CALL', note: 'क'.repeat(301) },
    }).success).toBe(false);
  });
});

describe('the composer’s values → the request', () => {
  it('fills the summary with the outcome and the next action’s type with the suggested one', () => {
    expect(activityBody({ type: 'call', outcome: 'call_back', summary: '', nextActionAt: AT })).toEqual({
      type: 'call', outcome: 'call_back', summary: 'Call back', nextAction: { at: AT, type: 'CALL' },
    });
    expect(activityBody({ type: 'whatsapp', outcome: 'not_now', summary: ' पछि फोन गर्नु ', nextActionAt: AT, nextActionNote: ' After Dashain ' })).toEqual({
      type: 'whatsapp', outcome: 'not_now', summary: 'पछि फोन गर्नु', nextAction: { at: AT, type: 'FOLLOW_UP', note: 'After Dashain' },
    });
  });

  it('sends only what the outcome takes', () => {
    // A default next action is the server's: nothing is sent unless staff override it.
    expect(activityBody({ type: 'call', outcome: 'no_answer', summary: '', nextActionAt: AT })).toEqual({
      type: 'call', outcome: 'no_answer', summary: 'No answer / switched off',
    });
    expect(activityBody({ type: 'call', outcome: 'price_shopping', overrideNext: true, nextActionAt: AT, nextActionType: 'CALL' }))
      .toMatchObject({ nextAction: { at: AT, type: 'CALL' } });
    expect(activityBody({ type: 'call', outcome: 'not_interested', nextActionAt: AT, lostCategory: 'BUDGET', lostReason: '' })).toEqual({
      type: 'call', outcome: 'not_interested', summary: 'Not interested', close: { lostCategory: 'BUDGET' },
    });
    expect(activityBody({ type: 'call', outcome: 'wrong_number', resolution: 'close', lostCategory: 'UNREACHABLE' }))
      .toMatchObject({ close: { lostCategory: 'UNREACHABLE' } });
    expect(activityBody({ type: 'call', outcome: 'wrong_number', resolution: 'close' })).not.toHaveProperty('nextAction');
    // A note carries no outcome even if one was picked before switching.
    expect(activityBody({ type: 'note', outcome: 'call_back', summary: 'Sent photos' })).toEqual({ type: 'note', summary: 'Sent photos' });
  });

  it('puts each refusal on the field that fixes it', () => {
    expect(errorsOf(activityFormSchema, { type: 'call', outcome: 'call_back' })).toEqual({ nextActionAt: 'When should we call back?' });
    expect(errorsOf(activityFormSchema, { type: 'call', outcome: 'not_interested' }))
      .toEqual({ lostCategory: 'Not interested closes the lead — pick why it was lost' });
    expect(errorsOf(activityFormSchema, { type: 'call', outcome: 'wrong_number' })).toEqual({ resolution: 'Set a next action or close the lead' });
    expect(errorsOf(activityFormSchema, { type: 'call', outcome: 'wrong_number', resolution: 'next' })).toEqual({ nextActionAt: 'Say when' });
    expect(errorsOf(activityFormSchema, { type: 'call' })).toEqual({ summary: 'Say what happened' });
    expect(activityFormSchema.safeParse({ type: 'call', outcome: 'book_visit' }).success).toBe(true);
  });
});

describe('the small forms', () => {
  it('LOST needs a category; the words are optional except for "Other"', () => {
    expect(errorsOf(lostReasonSchema, { lostReason: 'Too dear' })).toHaveProperty('lostCategory');
    expect(lostReasonSchema.parse({ lostCategory: 'PRICE', lostReason: '' })).toEqual({ lostCategory: 'PRICE', lostReason: undefined });
    expect(errorsOf(lostReasonSchema, { lostCategory: 'OTHER', lostReason: '' })).toHaveProperty('lostReason');
    expect(lostReasonSchema.parse({ lostCategory: 'OTHER', lostReason: 'विदेश गए' })).toEqual({ lostCategory: 'OTHER', lostReason: 'विदेश गए' });
  });

  it('a next action needs a time and a type', () => {
    expect(errorsOf(nextActionSchema, { type: 'CALL' })).toEqual({ at: 'Say when' });
    expect(nextActionSchema.parse({ at: AT, type: 'VISIT', note: '' })).toEqual({ at: AT, type: 'VISIT', note: undefined });
  });

  it('qualification: every part optional, whole numbers in range, bands not amounts', () => {
    expect(qualificationSchema.parse({})).toEqual({ note: undefined });
    expect(qualificationSchema.parse({ propertyType: 'house', floors: 3, buildingAgeYears: 0, budgetBand: '1l_5l', decisionMaker: 'owner_abroad' }))
      .toMatchObject({ floors: 3, buildingAgeYears: 0, budgetBand: '1l_5l' });
    expect(qualificationSchema.safeParse({ floors: 2.5 }).success).toBe(false);
    expect(qualificationSchema.safeParse({ floors: -1 }).success).toBe(false);
    expect(qualificationSchema.safeParse({ floors: 61 }).success).toBe(false);
    expect(qualificationSchema.safeParse({ budgetBand: 250000 }).success).toBe(false);
  });
});
