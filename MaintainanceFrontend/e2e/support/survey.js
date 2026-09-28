import { readFileSync } from 'node:fs';

/**
 * Phase L5: a survey is submitted only with its inspection template answered — every required question, and a
 * photo on every photo-required one (422 SURVEY_INCOMPLETE otherwise). The seeded seepage service has such a
 * template, so a run that submits a survey over the API answers it here.
 */
export const SITE_PHOTO = readFileSync(new URL('../fixtures/site-photo.jpg', import.meta.url));

/** A plausible answer for a question: a NUMBER just past its flag (so the office sees a flagged reading). */
export function answerFor(question) {
  switch (question.type) {
    case 'NUMBER':
      return { value: question.flag?.above != null ? Number(question.flag.above) + 1.5 : 12, ...(question.unit ? { unit: question.unit } : {}) };
    case 'YES_NO':
      return { textValue: 'no' };
    case 'CHOICE':
      return { textValue: question.options?.[0] ?? 'Not sure' };
    default:
      return { textValue: 'Seen on site' };
  }
}

/**
 * The readings that satisfy a survey's template, as the surveyor would send them — one photo uploaded through
 * the field API and put on every photo-required question.
 *
 * @param {{ get: Function, upload: Function }} surveyor `apiAs('SURVEYOR')`
 * @param {string} surveyId
 * @returns {Promise<{ readings: object[], template: object|null, mediaId: string|null }>}
 */
export async function checklistReadings(surveyor, surveyId) {
  const survey = await surveyor.get(`/tech/surveys/${surveyId}`);
  const questions = survey.template?.questions ?? [];
  let mediaId = null;
  if (questions.some((q) => q.photoRequired)) {
    const uploaded = await surveyor.upload(`/tech/surveys/${surveyId}/photos`, {
      fields: { kind: 'ISSUE', area: 'North wall', caption: 'Moisture meter reading' },
      file: { name: 'site-photo.jpg', mimeType: 'image/jpeg', buffer: SITE_PHOTO },
    });
    mediaId = uploaded.media[0].id;
  }
  const readings = questions
    .filter((q) => q.required || q.photoRequired)
    .map((q, i) => ({ questionKey: q.key, label: q.label, ...answerFor(q), ...(q.photoRequired ? { mediaId } : {}), sortOrder: i }));
  return { readings, template: survey.template ?? null, mediaId };
}
