import { INSPECTION_QUESTION_TYPES, INSPECTION_QUESTION_TYPE_LABELS, SURVEY_METRICS } from '@/config/constants';
import {
  blankQuestion, cleanFlag, inspectionTemplateSchema, isBlankQuestion, splitNepaliOptions, splitOptions, suggestQuestionKey,
} from '@/form/schemas/inspectionTemplate.schema';
import { formatDate } from '@/helpers/format';
import { inUseCopy } from './inUseCopy';

const SERVICE_RELATION = { path: '/admin/services', labelKey: 'name' };
const GENERAL = 'General — any service';

const TYPE_OPTIONS = INSPECTION_QUESTION_TYPES.map((value) => ({ value, label: INSPECTION_QUESTION_TYPE_LABELS[value] }));
const YES_NO_FLAGS = [{ value: 'yes', label: 'Yes' }, { value: 'no', label: 'No' }, { value: '', label: 'Not flagged' }];
const UNIT_SUGGESTIONS = ['%', 'mm', 'cm', 'ft', 'm', '°C'];

const blank = (v) => v === undefined || v === null || String(v).trim() === '';
const listOf = (v) => (Array.isArray(v) ? v : []);
/** A cell only this type edits: its editor, or none (read-only and shaded) for any other type. */
const only = (types, editor) => (row) => (types.includes(row?.type) ? editor : null);
const shadeUnless = (types) => (row) => (types.includes(row?.type) ? undefined : 'bg-muted/40');

/** The row with part of its flag replaced — empty parts dropped, null when nothing is flagged. */
const withFlag = (row, patch) => ({ ...row, flag: cleanFlag({ ...row.flag, ...patch }) });

/** The row as another type: what the new type does not use goes (a unit on a yes/no, a flag above on a choice). */
function asType(row, type) {
  const flag = row.flag ?? {};
  const kept = {
    NUMBER: { above: flag.above, below: flag.below },
    YES_NO: { equals: flag.equals },
    CHOICE: { values: flag.values },
  }[type] ?? {};
  return {
    ...row,
    type,
    unit: type === 'NUMBER' ? row.unit ?? '' : '',
    metric: type === 'NUMBER' ? row.metric ?? '' : '',
    options: type === 'CHOICE' ? listOf(row.options) : [],
    optionsNe: type === 'CHOICE' ? listOf(row.optionsNe) : [],
    flag: cleanFlag(kept),
  };
}

/** The key follows the question's words until someone types a key of their own. */
function withLabel(row, label) {
  const follows = blank(row.key) || row.key === suggestQuestionKey(row.label);
  return { ...row, label, ...(follows ? { key: suggestQuestionKey(label) } : {}) };
}

/**
 * The questions grid (a `grid` field — EditableGrid behind ResourceForm). Each row is one question in the API's own
 * shape; the columns reach into it with `get` / `set`, so a saved template loads as it is and saves as it is. A cell a
 * type does not use is read-only and shaded: Unit, Metric, Flag above / below for a number, Options (and, since Phase
 * J1, their Nepali words — one per option, in order, for the surveyor's phone) for a choice, and Flag when for a
 * yes/no (Yes · No) or a choice (the options that flag, comma separated).
 */
const QUESTION_COLUMNS = [
  {
    key: 'label', header: 'Question', grow: 1, minWidth: 200, editor: 'text', maxLength: 200,
    placeholder: 'e.g. Moisture reading', set: withLabel,
  },
  {
    key: 'labelNe', header: 'In Nepali', width: 170, editor: 'text', maxLength: 200, placeholder: 'नेपालीमा',
    format: (v) => (blank(v) ? '' : <span lang="ne">{v}</span>),
  },
  {
    key: 'key', header: 'Key', width: 150, editor: 'text', maxLength: 40,
    parse: (text) => String(text ?? '').trim(),
    format: (v) => (blank(v) ? '' : <span className="font-mono text-xs">{v}</span>),
  },
  {
    key: 'type', header: 'Type', width: 104, editor: 'select', options: TYPE_OPTIONS,
    set: asType, format: (v) => INSPECTION_QUESTION_TYPE_LABELS[v] ?? '',
  },
  {
    key: 'unit', header: 'Unit', width: 72, editor: only(['NUMBER'], 'text'), maxLength: 20,
    suggestions: UNIT_SUGGESTIONS, cellClassName: shadeUnless(['NUMBER']),
  },
  {
    key: 'metric', header: 'Metric', width: 120, editor: only(['NUMBER'], 'text'), maxLength: 60,
    suggestions: SURVEY_METRICS, cellClassName: shadeUnless(['NUMBER']),
  },
  {
    key: 'options', header: 'Options', width: 180, editor: only(['CHOICE'], 'text'),
    placeholder: (row) => (row?.type === 'CHOICE' ? 'Rain, Pipe leak, Ground' : undefined),
    // An empty list reads as blank, so the cell shows its placeholder.
    get: (row) => (listOf(row.options).length ? row.options : ''),
    toText: (v) => listOf(v).join(', '),
    parse: splitOptions,
    set: (row, v) => ({ ...row, options: splitOptions(v) }),
    format: (v) => listOf(v).join(', '),
    cellClassName: shadeUnless(['CHOICE']),
  },
  {
    key: 'optionsNe', header: 'Options in Nepali', width: 180, editor: only(['CHOICE'], 'text'),
    placeholder: (row) => (row?.type === 'CHOICE' ? 'वर्षा, पाइप चुहावट, जमिन' : undefined),
    get: (row) => (listOf(row.optionsNe).length ? row.optionsNe : ''),
    toText: (v) => listOf(v).join(', '),
    parse: splitNepaliOptions,
    set: (row, v) => ({ ...row, optionsNe: splitNepaliOptions(v) }),
    format: (v) => (listOf(v).length ? <span lang="ne">{listOf(v).join(', ')}</span> : ''),
    cellClassName: shadeUnless(['CHOICE']),
  },
  {
    key: 'flagAbove', header: 'Flag above', width: 92, align: 'right', editor: only(['NUMBER'], 'number'),
    get: (row) => row.flag?.above ?? '', set: (row, v) => withFlag(row, { above: v }), cellClassName: shadeUnless(['NUMBER']),
  },
  {
    key: 'flagBelow', header: 'Flag below', width: 92, align: 'right', editor: only(['NUMBER'], 'number'),
    get: (row) => row.flag?.below ?? '', set: (row, v) => withFlag(row, { below: v }), cellClassName: shadeUnless(['NUMBER']),
  },
  {
    key: 'flagOn', header: 'Flag when', width: 140,
    editor: (row) => (row?.type === 'YES_NO' ? 'select' : row?.type === 'CHOICE' ? 'text' : null),
    options: YES_NO_FLAGS,
    placeholder: (row) => (row?.type === 'CHOICE' ? 'e.g. Pipe leak' : undefined),
    get: (row) => (row.type === 'CHOICE' ? (listOf(row.flag?.values).length ? row.flag.values : '') : row.flag?.equals ?? ''),
    toText: (v, row) => (row?.type === 'CHOICE' ? listOf(v).join(', ') : ''),
    parse: (text, row) => (row?.type === 'CHOICE' ? splitOptions(text) : String(text ?? '').trim().toLowerCase()),
    set: (row, v) => (row.type === 'CHOICE' ? withFlag(row, { values: splitOptions(v) }) : withFlag(row, { equals: v || undefined })),
    format: (v, row) => {
      if (row?.type === 'CHOICE') return listOf(v).join(', ');
      return row?.type === 'YES_NO' ? (YES_NO_FLAGS.find((o) => o.value && o.value === v)?.label ?? '') : '';
    },
    cellClassName: shadeUnless(['YES_NO', 'CHOICE']),
  },
  { key: 'required', header: 'Required', width: 84, align: 'center', editor: 'boolean' },
  { key: 'photoRequired', header: 'Needs photo', width: 96, align: 'center', editor: 'boolean' },
];

const countOf = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/** Under the grid: what the checklist asks, in words. */
function questionSummary(rows) {
  const questions = listOf(rows).filter((r) => !isBlankQuestion(r));
  if (!questions.length) return null;
  const n = (test) => questions.filter(test).length;
  return (
    <p className="text-xs text-muted-foreground" data-testid="question-summary">
      {[
        countOf(questions.length, 'question'),
        `${n((q) => q.required)} required`,
        `${n((q) => q.photoRequired)} need a photo`,
        `${n((q) => cleanFlag(q.flag))} can raise a flag`,
      ].join(' · ')}
    </p>
  );
}

const questionsOf = (r) => listOf(r.questions);
const serviceOf = (r) => r.service?.name ?? (r.serviceId ? 'A service' : GENERAL);

/**
 * A service's site checklist (Phase L5). A survey gets its service's first active template by sort order (so
 * Reorder matters), else the first general one (`serviceId` null) — the API's `survey.service#templateFor`. Every
 * question is a reading in the field app's stepper, a required one (or one that needs a photo) blocks submit, and the
 * server flags an answer past the question's threshold — the office review lists flagged readings first. Templates
 * are read with `surveys:read` and changed with `surveys:write` (SALES, MANAGER; DISPATCHER reads them).
 *
 * @type {import('../resourceRegistry').ResourceEntry}
 */
export const inspectionTemplates = {
  resource: 'inspection-templates',
  path: '/admin/inspection-templates',
  basePath: '/admin/inspection-templates',
  model: 'inspectionTemplate',
  label: 'Inspection template',
  labelPlural: 'Inspection templates',
  description: 'What a surveyor checks on site, service by service.',
  notice: 'A survey gets its service’s checklist on the surveyor’s phone — the first one in use in this order — or the first general one when the service has none. A required answer or photo must be there before the survey can be submitted, and an answer past a flag is listed first when the office reviews it.',
  activeCopy: inUseCopy('Surveys already done keep their answers.'),
  capability: 'surveys:read',
  writeCapability: 'surveys:write',
  schema: inspectionTemplateSchema,
  sortable: true,
  titleOf: (record) => record.name,
  publicHref: () => null,
  searchPlaceholder: 'Search checklists…',
  emptyTitle: 'No inspection templates yet',
  emptyDescription: 'Write down what a surveyor must check for a service — once. Flagged answers reach the office first.',

  columns: [
    {
      key: 'name', header: 'Checklist', sortable: true,
      cell: (r) => <p className="max-w-md truncate font-medium">{r.name}</p>,
    },
    {
      key: 'service', header: 'Service', exportValue: serviceOf,
      cell: (r) => <span className={r.serviceId ? undefined : 'text-muted-foreground'}>{serviceOf(r)}</span>,
    },
    {
      key: 'questions', header: 'Questions', className: 'text-right',
      exportValue: (r) => questionsOf(r).length,
      cell: (r) => <span className="tabular-nums">{questionsOf(r).length}</span>,
    },
    {
      key: 'checks', header: 'Required · photo',
      exportValue: (r) => `${questionsOf(r).filter((q) => q.required).length} required · ${questionsOf(r).filter((q) => q.photoRequired).length} photo`,
      cell: (r) => (
        <span className="whitespace-nowrap text-sm tabular-nums">
          {questionsOf(r).filter((q) => q.required).length} required
          <span className="text-muted-foreground"> · {questionsOf(r).filter((q) => q.photoRequired).length} photo</span>
        </span>
      ),
    },
    {
      key: 'updatedAt', header: 'Updated', sortable: true,
      cell: (r) => <span className="whitespace-nowrap text-xs text-muted-foreground">{formatDate(r.updatedAt)}</span>,
    },
  ],

  filters: [
    { key: 'serviceId', label: 'Service', type: 'relation', relation: SERVICE_RELATION },
  ],

  fields: [
    { name: 'name', type: 'text', label: 'Name', required: true, maxLength: 120, placeholder: 'Damp and seepage — site checklist' },
    {
      name: 'serviceId', type: 'relation', label: 'Service', relation: SERVICE_RELATION, placeholder: GENERAL,
      description: 'The surveyor gets this checklist on a survey for this service. Leave it empty for a general checklist that suits any service.',
    },
    {
      name: 'questions', type: 'grid', label: 'Questions', required: true, columns: QUESTION_COLUMNS, makeRow: blankQuestion,
      maxItems: 60, addLabel: 'Add question', emptyText: 'No questions yet — add the first one.', footer: questionSummary,
      description: 'One row per question, in the order the surveyor meets them. The key links an answer to its question — keep it once surveys have used it. A flag marks an answer the office should see first: a number above or below a value, a yes or a no, or the options you name. Options are separated by commas.',
    },
    { name: 'isActive', type: 'switch', label: 'In use', description: 'A retired checklist is not offered on new surveys.' },
  ],

  defaultValues: { isActive: true, serviceId: null, questions: [blankQuestion()] },
};
