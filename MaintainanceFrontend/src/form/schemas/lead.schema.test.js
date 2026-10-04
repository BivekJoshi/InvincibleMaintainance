import { describe, it, expect } from 'vitest';
import { translateValidationMessage } from '@/form/zodMessages';
import {
  activityBody, activityFormSchema, convertSiteSchema, leadActivitySchema, leadOutcomeIssues, lostReasonSchema,
  nextActionSchema, qualificationSchema, visitBookingBody, visitBookingSchema, visitWindowIssue,
} from '@/form/schemas/lead.schema';

const AT = '2026-09-17T04:15:00.000Z';
/** Each field's message as an English form shows it — a shared field names its words (`vKey`), resolved here. */
const errorsOf = (schema, value) => {
  const result = schema.safeParse(value);
  return result.success ? {} : Object.fromEntries(result.error.issues.map((i) => [i.path.join('.'), translateValidationMessage(i.message)]));
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

describe('booking the visit (Phase L5)', () => {
  const BOOKING = {
    date: '2026-10-03', startTime: '10:00', endTime: '12:00', surveyorId: '', address: 'Jhamsikhel, Lalitpur',
    siteContactName: '', siteContactPhone: '', landmark: '',
  };

  it('builds the window at Kathmandu’s +05:45, whatever the browser’s zone', () => {
    const body = visitBookingBody(visitBookingSchema.parse(BOOKING));
    expect(body).toEqual({
      createInspectionJob: true,
      scheduledStart: '2026-10-03T04:15:00.000Z',
      scheduledEnd: '2026-10-03T06:15:00.000Z',
      site: { label: 'Primary site', address: 'Jhamsikhel, Lalitpur' },
    });
    // 00:30 Kathmandu is the evening before in UTC.
    expect(visitBookingBody(visitBookingSchema.parse({ ...BOOKING, startTime: '00:30', endTime: '05:45' })))
      .toMatchObject({ scheduledStart: '2026-10-02T18:45:00.000Z', scheduledEnd: '2026-10-03T00:00:00.000Z' });
  });

  it('refuses a window that ends at or before its start, on the end', () => {
    expect(visitWindowIssue('10:00', '10:00')).toBe('The window must end after it starts');
    expect(visitWindowIssue('12:00', '09:30')).toBe('The window must end after it starts');
    expect(visitWindowIssue('09:30', '12:00')).toBeNull();
    expect(visitWindowIssue('', '12:00')).toBeNull();
    expect(errorsOf(visitBookingSchema, { ...BOOKING, endTime: '09:00' })).toEqual({ endTime: 'The window must end after it starts' });
    expect(errorsOf(visitBookingSchema, { ...BOOKING, startTime: '' })).toEqual({ startTime: 'Pick a start time' });
    expect(errorsOf(visitBookingSchema, { ...BOOKING, endTime: '25:00' })).toEqual({ endTime: 'Pick an end time' });
  });

  it('keeps a Devanagari contact and normalises a Nepali number; sends only what was filled', () => {
    const parsed = visitBookingSchema.parse({
      ...BOOKING, surveyorId: 't1', siteContactName: ' हरि बहादुर ', siteContactPhone: '+977 9841234567',
      landmark: 'भाटभटेनी अगाडि, निलो गेट',
    });
    expect(visitBookingBody(parsed)).toMatchObject({
      surveyorId: 't1', siteContactName: 'हरि बहादुर', siteContactPhone: '9841234567', landmark: 'भाटभटेनी अगाडि, निलो गेट',
    });
    expect(visitBookingSchema.parse({ ...BOOKING, siteContactName: 'Hari', siteContactPhone: '01-5407720' }).siteContactPhone)
      .toBe('01-5407720');
    const bare = visitBookingBody(visitBookingSchema.parse({ ...BOOKING, address: '' }));
    expect(Object.keys(bare).sort()).toEqual(['createInspectionJob', 'scheduledEnd', 'scheduledStart']);
  });

  it('refuses a number that is not Nepali, or one with nobody’s name, and overlong words', () => {
    expect(errorsOf(visitBookingSchema, { ...BOOKING, siteContactName: 'Hari', siteContactPhone: '12345' }))
      .toEqual({ siteContactPhone: expect.stringMatching(/9808338255 or 01-5407720/) });
    expect(errorsOf(visitBookingSchema, { ...BOOKING, siteContactPhone: '9841234567' }))
      .toEqual({ siteContactName: 'Say whose number this is' });
    expect(errorsOf(visitBookingSchema, { ...BOOKING, siteContactName: 'क'.repeat(121) })).toHaveProperty('siteContactName');
    expect(errorsOf(visitBookingSchema, { ...BOOKING, landmark: 'क'.repeat(201) })).toHaveProperty('landmark');
    expect(visitBookingSchema.safeParse({ ...BOOKING, landmark: 'क'.repeat(200) }).success).toBe(true);
    expect(errorsOf(visitBookingSchema, { ...BOOKING, address: 'ab' })).toEqual({ address: 'Where is the work?' });
  });

  it('the convert sheet takes the same site contact', () => {
    const site = { label: 'Primary site', address: 'Jhamsikhel', createQuotation: false };
    expect(convertSiteSchema.parse({ ...site, siteContactName: 'सीता', siteContactPhone: '977-9808338255', landmark: '' }))
      .toMatchObject({ siteContactName: 'सीता', siteContactPhone: '9808338255', landmark: undefined });
    expect(errorsOf(convertSiteSchema, { ...site, siteContactPhone: '9808338255' })).toEqual({ siteContactName: 'Say whose number this is' });
    expect(convertSiteSchema.safeParse({ ...site, siteContactName: 'Hari', siteContactPhone: '98083382' }).success).toBe(false);
  });
});
