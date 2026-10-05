import { toLatinDigits } from '@/helpers/format';

/**
 * An inspection template's questions on the phone (Phase L5): what an answer looks like, which reading it
 * becomes, whether it is flagged and what is still missing before the survey can be submitted.
 *
 * The server is the authority on both `flagged` (it computes it from the template's flag when a reading is
 * saved) and on what blocks a submit (422 `SURVEY_INCOMPLETE`). These mirror it so the surveyor sees a flag
 * the moment a number is typed, and a missing answer before the phone even tries — with no signal at all.
 *
 * A question: `{ key, label, labelNe?, type: 'YES_NO'|'NUMBER'|'CHOICE'|'TEXT', unit?, metric?, options?,
 * optionsNe?, flag?, required, photoRequired }` — `optionsNe` (Phase J1) is display only: the Nepali words for
 * `options`, same length and order; the answer is always the English `options[i]`. An answer (the stepper's own state, one per question key):
 * `{ value?: string, textValue?: string, mediaId?: string, photoUploadId?: string }` — `value` is a
 * NUMBER's figure as typed, `textValue` a YES_NO's `'yes'`/`'no'`, a CHOICE's option or a TEXT's words;
 * `photoUploadId` names a picture still in the upload queue (`helpers/uploadQueue.js`), which the sync engine
 * turns into the reading's `mediaId` once the picture is on the server.
 */

const blank = (v) => v === undefined || v === null || String(v).trim() === '';

/**
 * A NUMBER answer as a number: `12.5` (or `१२.५`, typed on a Nepali keyboard), `12,5` is not read; blank → undefined;
 * unreadable → NaN.
 */
export function answerNumber(value) {
  if (blank(value)) return undefined;
  const n = Number(toLatinDigits(value).trim().replace(/,/g, ''));
  return Number.isFinite(n) ? n : Number.NaN;
}

/** The question's words in the viewer's language — the Nepali label where the office wrote one. */
export const questionLabel = (question, locale = 'en') => (locale === 'ne' && question?.labelNe?.trim()
  ? question.labelNe
  : question?.label ?? '');

/**
 * A CHOICE option's words in the viewer's language — the template's `optionsNe[i]` in Nepali where the office wrote
 * one, else the option itself. Display only: the answer stays `option`.
 */
export function optionLabel(question, option, locale = 'en') {
  if (locale !== 'ne') return option;
  const i = (question?.options ?? []).indexOf(option);
  const ne = i < 0 ? null : question?.optionsNe?.[i];
  return typeof ne === 'string' && ne.trim() ? ne : option;
}

/** True once the question has an answer the API can store (a number that reads, a pick, some words). */
export function isAnswered(question, answer) {
  if (!answer) return false;
  if (question.type === 'NUMBER') {
    const n = answerNumber(answer.value);
    return n !== undefined && Number.isFinite(n);
  }
  if (question.type === 'YES_NO') return ['yes', 'no'].includes(String(answer.textValue ?? '').trim().toLowerCase());
  return !blank(answer.textValue);
}

/** A photo answers the question once one is taken — uploaded (`mediaId`) or still waiting (`photoUploadId`). */
export const hasPhoto = (answer) => Boolean(answer?.mediaId || answer?.photoUploadId);

/**
 * Would the server flag this answer? NUMBER: strictly above `flag.above` or strictly below `flag.below`;
 * YES_NO: the answer is `flag.equals`; CHOICE: the pick is one of `flag.values`. TEXT is never flagged.
 * @returns {boolean}
 */
export function predictFlag(question, answer) {
  const flag = question?.flag;
  if (!flag || !isAnswered(question, answer)) return false;
  switch (question.type) {
    case 'NUMBER': {
      const n = answerNumber(answer.value);
      return (flag.above != null && n > Number(flag.above)) || (flag.below != null && n < Number(flag.below));
    }
    case 'YES_NO':
      return Boolean(flag.equals) && String(answer.textValue).toLowerCase() === String(flag.equals).toLowerCase();
    case 'CHOICE': {
      const pick = String(answer.textValue).trim().toLowerCase();
      return Array.isArray(flag.values) && flag.values.some((v) => String(v).toLowerCase() === pick);
    }
    default:
      return false;
  }
}

/**
 * The reading an answer becomes (`PUT /tech/surveys/:id` `readings[]`), or null when there is nothing to
 * store yet. The answer's picture travels as `mediaId`, or as `photoUploadId` while it waits to upload —
 * never sent as such: the sync engine resolves it first.
 *
 * @param {object} question
 * @param {object} answer
 * @param {number} sortOrder
 */
export function answerToReading(question, answer, sortOrder) {
  if (!isAnswered(question, answer)) return null;
  const reading = {
    questionKey: question.key,
    label: question.label,
    metric: question.metric || 'observation',
    sortOrder,
  };
  if (question.type === 'NUMBER') {
    reading.value = answerNumber(answer.value);
    if (question.unit) reading.unit = question.unit;
  } else {
    reading.textValue = String(answer.textValue).trim();
  }
  if (answer.mediaId) reading.mediaId = answer.mediaId;
  else if (answer.photoUploadId) reading.photoUploadId = answer.photoUploadId;
  return reading;
}

/** A saved reading back into the stepper's answer for its question. */
export function readingToAnswer(question, reading) {
  if (!reading) return {};
  const answer = {};
  if (question?.type === 'NUMBER') answer.value = reading.value == null ? '' : String(reading.value);
  else answer.textValue = reading.textValue ?? '';
  if (reading.mediaId) answer.mediaId = reading.mediaId;
  return answer;
}

/**
 * What still blocks a submit — the same list, in the same shape, as the API's 422 `SURVEY_INCOMPLETE`
 * `details` (`survey.service#checklistGaps`): a required question with no answer, else a photo-required one
 * with no photo. One step stricter than the server: a photo-required question with its photo but no answer is
 * named too (`answer`), because the photo travels on the answer's reading and a reading needs an answer.
 *
 * @param {{ questions?: object[] }|null|undefined} template
 * @param {Record<string, object>} answers by question key
 * @returns {{ questionKey: string, label: string, missing: 'answer'|'photo' }[]}
 */
export function missingAnswers(template, answers = {}) {
  const out = [];
  for (const question of template?.questions ?? []) {
    const answer = answers?.[question.key];
    const answered = isAnswered(question, answer);
    if (question.required && !answered) {
      out.push({ questionKey: question.key, label: question.label, missing: 'answer' });
    } else if (question.photoRequired && !hasPhoto(answer)) {
      out.push({ questionKey: question.key, label: question.label, missing: 'photo' });
    } else if (question.photoRequired && !answered) {
      out.push({ questionKey: question.key, label: question.label, missing: 'answer' });
    }
  }
  return out;
}

/** How a question's flag reads, for the hint under it: "Flagged above 20 %", "Flagged: yes". */
export function flagRule(question) {
  const flag = question?.flag;
  if (!flag) return null;
  if (question.type === 'NUMBER') {
    const unit = question.unit ? ` ${question.unit}` : '';
    const parts = [];
    if (flag.above != null) parts.push({ op: 'above', value: `${flag.above}${unit}` });
    if (flag.below != null) parts.push({ op: 'below', value: `${flag.below}${unit}` });
    return parts.length ? { type: 'range', parts } : null;
  }
  if (question.type === 'YES_NO' && flag.equals) return { type: 'equals', value: flag.equals };
  if (question.type === 'CHOICE' && flag.values?.length) return { type: 'values', values: flag.values };
  return null;
}
