import { z } from 'zod';
import { INSPECTION_QUESTION_TYPES } from '@/config/constants';

/**
 * An inspection template (Phase L5) — a service's site checklist, edited as the registry entry
 * `inspection-templates`. Mirrors `inspectionQuestion`, `inspectionQuestions` and `inspectionTemplateSchema` in
 * MaintainanceBackend/src/shared/schemas/survey.js — change both together (`inspectionTemplate.schema.test.js` runs
 * the same cases through both).
 *
 * The questions are a `grid` field whose rows are already in the API's shape (`{ key, label, labelNe?, type, unit?,
 * metric?, options?, flag?, required, photoRequired }`), so a saved template loads as it is. A row left completely
 * empty is allowed here — the grid's spare line — and dropped, so an error's index is the row the grid shows. Every
 * rule is `questionIssues` (the API's paths); the form puts each message on the grid column that edits it
 * (`FORM_COLUMN`: `flag.above` → the **Flag above** cell).
 */

export const QUESTION_KEY_RE = /^[a-z0-9_]{1,40}$/;
export const QUESTION_KEY_HINT = 'Use a-z, 0-9 and underscore (up to 40)';
const FLAG_KEYS = ['above', 'below', 'equals', 'values'];

const blank = (v) => v === undefined || v === null || (typeof v === 'string' && v.trim() === '');
const text = (v) => (blank(v) ? '' : String(v).trim());
const listOf = (v) => (Array.isArray(v) ? v : []);
/** A flag threshold as typed: blank is none, anything else a number (NaN when it cannot be read). */
const threshold = (v) => {
  if (blank(v)) return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : Number.NaN;
};

/**
 * A key suggested from the question's words: `Moisture reading (%)` → `moisture_reading`. Empty for words with
 * no a-z or 0-9 in them (a Nepali-only label) — the office types the key then.
 */
export function suggestQuestionKey(label) {
  return String(label ?? '')
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 40)
    .replace(/_+$/, '');
}

/** `Rain, Pipe leak ,, Ground` → `['Rain', 'Pipe leak', 'Ground']`: comma separated, trimmed, blanks and repeats dropped. */
export function splitOptions(value) {
  const parts = Array.isArray(value) ? value : String(value ?? '').split(',');
  return [...new Set(parts.map((s) => String(s ?? '').trim()).filter(Boolean))];
}

/** A flag with its empty parts removed, or null when nothing is left. */
export function cleanFlag(flag) {
  const out = Object.fromEntries(Object.entries(flag ?? {}).filter(([, v]) => !blank(v) && !(Array.isArray(v) && !v.length)));
  return Object.keys(out).length ? out : null;
}

/** The grid's spare line: no words, no options, no flag, nothing ticked. The type alone does not make a question. */
export function isBlankQuestion(row) {
  if (!row) return true;
  return blank(row.label) && blank(row.labelNe) && blank(row.key) && blank(row.unit) && blank(row.metric)
    && !listOf(row.options).length && !cleanFlag(row.flag) && !row.required && !row.photoRequired;
}

/** A new question: a yes/no, the commonest line on a checklist. */
export const blankQuestion = () => ({
  label: '', labelNe: '', key: '', type: 'YES_NO', required: false, photoRequired: false,
});

/**
 * What the API refuses in one question, at the API's paths (`['flag', 'below']`). The list's own rules (at least one
 * question, a key used twice) are the list schema's.
 *
 * @param {object} q  a question as typed
 * @returns {{ path: (string|number)[], message: string }[]}
 */
export function questionIssues(q) {
  const out = [];
  const add = (path, message) => out.push({ path, message });
  const type = q?.type;

  if (!QUESTION_KEY_RE.test(text(q?.key))) add(['key'], QUESTION_KEY_HINT);
  const label = text(q?.label);
  if (!label) add(['label'], 'Write the question');
  else if (label.length > 200) add(['label'], 'At most 200 characters');
  if (text(q?.labelNe).length > 200) add(['labelNe'], 'At most 200 characters');
  if (!INSPECTION_QUESTION_TYPES.includes(type)) add(['type'], 'Pick a type');
  if (text(q?.unit).length > 20) add(['unit'], 'At most 20 characters');
  if (text(q?.metric).length > 60) add(['metric'], 'At most 60 characters');

  const options = q?.options ?? [];
  if (!Array.isArray(options)) add(['options'], 'Options are a list');
  else if (options.some((o) => blank(o))) add(['options'], 'An option cannot be empty');
  else if (options.some((o) => String(o).trim().length > 80)) add(['options'], 'An option is at most 80 characters');
  else if (options.length > 20) add(['options'], 'At most 20 options');
  const offered = listOf(options).map((o) => text(o));
  if (type === 'CHOICE' && offered.length < 2) add(['options'], 'A choice needs at least two options');

  const flag = q?.flag ?? {};
  if (typeof flag !== 'object' || Array.isArray(flag)) {
    add(['flag'], 'Not a flag');
    return out;
  }
  const unknown = Object.keys(flag).filter((k) => !FLAG_KEYS.includes(k));
  if (unknown.length) add(['flag'], `Not a flag: ${unknown.join(', ')}`);

  const above = threshold(flag.above);
  const below = threshold(flag.below);
  if (Number.isNaN(above)) add(['flag', 'above'], 'Use a number');
  if (Number.isNaN(below)) add(['flag', 'below'], 'Use a number');
  if ((above !== undefined || below !== undefined) && type !== 'NUMBER') add(['flag'], 'Only a number is flagged above or below a value');
  if (Number.isFinite(above) && Number.isFinite(below) && below > above) add(['flag', 'below'], 'Flag below cannot be higher than flag above');

  if (flag.equals !== undefined) {
    if (!['yes', 'no'].includes(flag.equals)) add(['flag', 'equals'], 'Flag on yes or no');
    else if (type !== 'YES_NO') add(['flag', 'equals'], 'Only a yes/no question is flagged on yes or no');
  }

  const values = flag.values ?? [];
  if (!Array.isArray(values)) add(['flag', 'values'], 'The flagged options are a list');
  else if (values.length) {
    if (values.some((v) => blank(v))) add(['flag', 'values'], 'A flagged option cannot be empty');
    else if (values.length > 20) add(['flag', 'values'], 'At most 20 flagged options');
    else if (type !== 'CHOICE') add(['flag', 'values'], 'Only a choice is flagged on its options');
    else if (values.some((v) => !offered.includes(text(v)))) add(['flag', 'values'], 'Flag only options the question offers');
  }
  return out;
}

/** Where the questions grid shows an issue: the column that edits it (a flag on the wrong type is fixed on Type). */
const FORM_COLUMN = {
  'flag.above': 'flagAbove',
  'flag.below': 'flagBelow',
  'flag.equals': 'flagOn',
  'flag.values': 'flagOn',
  flag: 'type',
};
const columnOf = (path) => FORM_COLUMN[path.join('.')] ?? String(path[0]);

/**
 * One question → the API's shape, and nothing else: no empty keys, no unit on a yes/no, no options on a number, the
 * flag the type reads (`{ above?, below? }` · `{ equals }` · `{ values }`), numbers as numbers.
 */
export function questionBody(row) {
  const type = row.type;
  const flag = row.flag ?? {};
  let kept = null;
  if (type === 'NUMBER') kept = cleanFlag({ above: threshold(flag.above), below: threshold(flag.below) });
  if (type === 'YES_NO') kept = cleanFlag({ equals: flag.equals });
  if (type === 'CHOICE') kept = cleanFlag({ values: splitOptions(flag.values ?? []) });
  const labelNe = text(row.labelNe);
  const unit = text(row.unit);
  const metric = text(row.metric);
  return {
    key: text(row.key),
    label: text(row.label),
    ...(labelNe ? { labelNe } : {}),
    type,
    ...(type === 'NUMBER' && unit ? { unit } : {}),
    ...(type === 'NUMBER' && metric ? { metric } : {}),
    ...(type === 'CHOICE' ? { options: splitOptions(row.options ?? []) } : {}),
    ...(kept ? { flag: kept } : {}),
    required: Boolean(row.required),
    photoRequired: Boolean(row.photoRequired),
  };
}

/** One grid row as typed: a blank one passes (and is dropped by the list); the rest must be a question the API takes. */
const questionRow = z.object({}).passthrough().superRefine((row, ctx) => {
  if (isBlankQuestion(row)) return;
  questionIssues(row).forEach(({ path, message }) => ctx.addIssue({ code: z.ZodIssueCode.custom, path: [columnOf(path)], message }));
});

/** The questions grid → the API's questions: 1–60, every key once, blank rows dropped. */
export const inspectionQuestionsSchema = z.array(questionRow)
  .superRefine((rows, ctx) => {
    const filled = rows.map((row, index) => ({ row, index })).filter(({ row }) => !isBlankQuestion(row));
    if (!filled.length) ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Add at least one question' });
    if (filled.length > 60) ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'At most 60 questions' });
    const seen = new Set();
    filled.forEach(({ row, index }) => {
      const key = text(row.key);
      if (!key) return;
      if (seen.has(key)) ctx.addIssue({ code: z.ZodIssueCode.custom, path: [index, 'key'], message: `The key "${key}" is used twice` });
      seen.add(key);
    });
  })
  .transform((rows) => rows.filter((row) => !isBlankQuestion(row)).map(questionBody));

/** `/admin/inspection-templates` — the registry entry's form. `serviceId` null is the general checklist. */
export const inspectionTemplateSchema = z.object({
  name: z.string().trim().min(1, 'Name the checklist').max(120, 'At most 120 characters'),
  serviceId: z.string().min(1).nullable().optional(),
  questions: inspectionQuestionsSchema,
  isActive: z.coerce.boolean().default(true),
});
