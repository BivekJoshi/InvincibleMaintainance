import { newKey } from '@/helpers/fieldDb';
import {
  answerToReading, hasPhoto, isAnswered, missingAnswers, readingToAnswer,
} from '@/helpers/inspection';
import {
  isBlankMeasurement, measurementRowValue, measurementTotal, measurementsBody, parseLength,
} from '@/helpers/measurements';

/**
 * The survey stepper's state, and the one payload it queues (Phase L5). Pure: the page holds the state,
 * these turn it into `PUT /tech/surveys/:id`'s body — a **full replace** of the survey's fields, readings and
 * items — which travels as the `survey_draft` sync kind, online or not.
 *
 * The form (never sent as it is; `meta.form` of a queued draft keeps it on the phone, as typed):
 * ```
 * { problemSummary, diagnosis, recommendation, accessNotes, riskNotes, areaValue, areaUnit, estimatedDays, urgency,
 *   answers: { [questionKey]: { value?, textValue?, mediaId?, photoUploadId? } },   // the template's questions
 *   readings: [{ _key, label, metric, value, unit, textValue }],                       // other readings
 *   items: [{ _key, kind, materialId, rateCardItemId, description, unit, qty, wastagePct, isOptional, note,
 *             measurements: [{ _key, area, description, nos, l, b, h, deduct }] }],     // lengths as typed: 12'6"
 *   sitePin: null | { lat, lng, accuracy } }                                           // the Arrived step
 * ```
 * Quantities only: nothing here carries a rate, a cost or an amount (D1).
 */

export const SURVEY_STEPS = ['before', 'arrived', 'checklist', 'measure', 'photos', 'findings', 'lines'];

/** Statuses the surveyor may still change. */
export const EDITABLE_STATUSES = ['DRAFT', 'RETURNED'];

/** How long the stepper waits after the last change before it queues a save. */
export const AUTOSAVE_MS = 1200;

const text = (v) => (v === undefined || v === null ? '' : String(v));

export const blankReading = () => ({ _key: newKey(), label: '', metric: 'moisture', value: '', unit: '', textValue: '' });

export const blankItem = (patch = {}) => ({
  _key: newKey(),
  kind: 'MATERIAL',
  description: '',
  unit: 'nos',
  qty: '',
  wastagePct: 0,
  materialId: null,
  rateCardItemId: null,
  isOptional: false,
  note: '',
  measurements: [],
  ...patch,
});

export const blankMeasurement = (area = '') => ({
  _key: newKey(), area, description: '', nos: '', l: '', b: '', h: '', deduct: false,
});

/** The survey as the field API returned it → the stepper's state. */
export function surveyToForm(survey) {
  const questions = survey?.template?.questions ?? [];
  const byKey = new Map(questions.map((q) => [q.key, q]));
  const answers = {};
  const readings = [];
  for (const r of survey?.readings ?? []) {
    const question = r.questionKey ? byKey.get(r.questionKey) : null;
    if (question) {
      answers[question.key] = readingToAnswer(question, r);
      continue;
    }
    readings.push({
      _key: newKey(),
      label: text(r.label),
      metric: r.metric || 'observation',
      value: text(r.value),
      unit: text(r.unit),
      textValue: text(r.textValue),
    });
  }
  return {
    problemSummary: text(survey?.problemSummary),
    diagnosis: text(survey?.diagnosis),
    recommendation: text(survey?.recommendation),
    accessNotes: text(survey?.accessNotes),
    riskNotes: text(survey?.riskNotes),
    areaValue: text(survey?.areaValue),
    areaUnit: survey?.areaUnit || 'sq.ft',
    estimatedDays: text(survey?.estimatedDays),
    urgency: survey?.urgency || 'NORMAL',
    answers,
    readings: readings.length || questions.length ? readings : [blankReading()],
    items: (survey?.items ?? []).map((item) => ({
      ...blankItem(),
      kind: item.kind ?? 'MATERIAL',
      materialId: item.materialId ?? null,
      rateCardItemId: item.rateCardItemId ?? null,
      description: text(item.description),
      unit: item.unit || 'nos',
      qty: text(item.qty),
      wastagePct: item.wastagePct ?? 0,
      isOptional: Boolean(item.isOptional),
      note: text(item.note),
      measurements: (item.measurements ?? []).map((m) => ({
        _key: newKey(),
        area: text(m.area),
        description: text(m.description),
        nos: text(m.nos),
        l: text(m.l),
        b: text(m.b),
        h: text(m.h),
        deduct: Boolean(m.deduct),
      })),
    })),
    sitePin: null,
  };
}

const DIMENSIONS = ['nos', 'l', 'b', 'h'];

/** A row every size of which reads (blank sizes are fine — a wall has no breadth). */
export const isReadableMeasurement = (row) => DIMENSIONS.every((k) => {
  const v = parseLength(row?.[k]);
  return v === undefined || Number.isFinite(v);
});

/** The rows that go to the server: not blank, every size readable. A row that does not read waits on the phone. */
export const savedMeasurements = (rows = []) => (rows ?? []).filter((row) => !isBlankMeasurement(row) && isReadableMeasurement(row));

/** A line measured by its sheet (at least one row that goes to the server). */
export const isMeasured = (item) => savedMeasurements(item?.measurements).length > 0;

/** A line's quantity on this phone: the sheet's total (a preview — the server derives the saved one) or the typed one. */
export function lineQty(item) {
  if (isMeasured(item)) return measurementTotal(savedMeasurements(item.measurements));
  const n = Number(item?.qty);
  return Number.isFinite(n) ? n : 0;
}

/** One line as the API takes it, or null while it cannot be saved (no description, no quantity above 0). */
function itemBody(item, sortOrder) {
  const description = text(item.description).trim();
  const qty = lineQty(item);
  if (!description || !(qty > 0)) return null;
  const measured = isMeasured(item);
  return {
    kind: item.kind,
    ...(item.materialId ? { materialId: item.materialId } : {}),
    ...(item.rateCardItemId ? { rateCardItemId: item.rateCardItemId } : {}),
    description,
    unit: item.unit,
    // Measured: the server derives the quantity from the rows and ignores this one — sent as a fallback.
    qty,
    wastagePct: Number(item.wastagePct || 0),
    isOptional: Boolean(item.isOptional),
    ...(text(item.note).trim() ? { note: text(item.note).trim() } : {}),
    ...(measured ? { measurements: measurementsBody(savedMeasurements(item.measurements)) } : {}),
    sortOrder,
  };
}

/** Which of the form's lines went out, at which position — `sortOrder` in the payload, and on the server. */
export function payloadIndexes(items = []) {
  const out = new Map();
  let n = 0;
  items.forEach((item) => {
    if (itemBody(item, 0)) {
      out.set(item._key, n);
      n += 1;
    }
  });
  return out;
}

const freeReadingBody = (r) => {
  const label = text(r.label).trim();
  const hasValue = text(r.value).trim() !== '' && Number.isFinite(Number(r.value));
  const observation = text(r.textValue).trim();
  if (!label || (!hasValue && !observation)) return null;
  return {
    label,
    metric: r.metric || 'observation',
    ...(hasValue ? { value: Number(r.value) } : {}),
    ...(text(r.unit).trim() ? { unit: text(r.unit).trim() } : {}),
    ...(observation ? { textValue: observation } : {}),
  };
};

const optional = (v) => (text(v).trim() ? text(v).trim() : undefined);
const optionalNumber = (v) => (text(v).trim() === '' || !Number.isFinite(Number(v)) ? undefined : Number(v));

/**
 * The `survey_draft` payload: every field, the readings (the template's answers first, then the others) and the
 * lines with their measurement rows — a full replace. A reading still waiting for its photo carries
 * `photoUploadId`, which the sync engine swaps for the uploaded picture's `mediaId` before it is sent.
 *
 * @param {object} form
 * @param {{ questions?: object[] }|null} template
 */
export function surveyPayload(form, template) {
  const answered = (template?.questions ?? [])
    .map((q) => answerToReading(q, form.answers?.[q.key], 0))
    .filter(Boolean);
  const free = (form.readings ?? []).map(freeReadingBody).filter(Boolean);
  const readings = [...answered, ...free].map((r, i) => ({ ...r, sortOrder: i }));

  const items = [];
  for (const item of form.items ?? []) {
    const body = itemBody(item, items.length);
    if (body) items.push(body);
  }

  const body = {
    problemSummary: optional(form.problemSummary),
    diagnosis: optional(form.diagnosis),
    recommendation: optional(form.recommendation),
    accessNotes: optional(form.accessNotes),
    riskNotes: optional(form.riskNotes),
    areaValue: optionalNumber(form.areaValue),
    areaUnit: optional(form.areaUnit),
    estimatedDays: optionalNumber(form.estimatedDays),
    urgency: form.urgency || undefined,
    readings,
    items,
    ...(form.sitePin ? { sitePin: form.sitePin } : {}),
  };
  return Object.fromEntries(Object.entries(body).filter(([, v]) => v !== undefined));
}

const sameRows = (a = [], b = []) => {
  const norm = (rows) => JSON.stringify((rows ?? []).map((r) => ({
    area: text(r.area).trim() || null,
    description: text(r.description).trim() || null,
    nos: r.nos ?? null,
    l: r.l ?? null,
    b: r.b ?? null,
    h: r.h ?? null,
    deduct: Boolean(r.deduct),
  })));
  return norm(a) === norm(b);
};

/**
 * The server's quantity for a measured line — shown once the phone's rows are the ones the server has (after a
 * sync), and null before: the server derives it from the rows (`utils/quantity.js#measurementQty`).
 *
 * @param {object} item the form's line
 * @param {object} form
 * @param {object} survey as the field API last returned it
 * @returns {number|null}
 */
export function serverQtyFor(item, form, survey) {
  if (!isMeasured(item)) return null;
  const index = payloadIndexes(form.items).get(item._key);
  if (index === undefined) return null;
  const saved = (survey?.items ?? []).slice().sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))[index];
  if (!saved?.measurements?.length) return null;
  if (!sameRows(measurementsBody(savedMeasurements(item.measurements)), saved.measurements)) return null;
  return saved.qty == null ? null : Number(saved.qty);
}

/**
 * The server's `flagged` for a question — authoritative once the answer on the phone is the one the server
 * holds; undefined before (the stepper then shows its own prediction).
 */
export function serverFlagFor(question, answer, survey) {
  const reading = (survey?.readings ?? []).find((r) => r.questionKey === question.key);
  if (!reading || typeof reading.flagged !== 'boolean') return undefined;
  const mine = answerToReading(question, answer, 0);
  if (!mine) return undefined;
  const same = question.type === 'NUMBER'
    ? Number(reading.value) === mine.value
    : text(reading.textValue).trim() === mine.textValue;
  return same ? reading.flagged : undefined;
}

/** Rooms in the order they were first measured; a row with no room sits under `''`. */
export function groupByArea(rows = []) {
  const groups = new Map();
  for (const row of rows) {
    const area = text(row.area).trim();
    if (!groups.has(area)) groups.set(area, []);
    groups.get(area).push(row);
  }
  return [...groups.entries()].map(([area, list]) => ({ area, rows: list }));
}

/** Every room named on the survey — the photo step suggests them. */
export function areasOf(form) {
  const seen = new Set();
  for (const item of form?.items ?? []) {
    for (const row of item.measurements ?? []) {
      const area = text(row.area).trim();
      if (area) seen.add(area);
    }
  }
  return [...seen];
}

/** A room's total on this phone (a preview), over its rows that read. */
export const roomTotal = (rows) => measurementTotal(rows.filter(isReadableMeasurement));

/** A row's value, or null while it cannot be read. */
export const rowValue = (row) => (isReadableMeasurement(row) ? measurementRowValue(row) : null);

/**
 * Where each step stands, for the step bar: `done` (a tick) and a short `count`.
 *
 * @param {object} form
 * @param {object} survey
 * @param {{ visited?: Set<string>, photos?: number }} [ctx] steps opened this session; photos on the server
 *   and waiting on the phone
 * @returns {Record<string, { done: boolean, count?: [number, number]|number, alert?: boolean }>}
 */
export function stepProgress(form, survey, { visited = new Set(), photos = 0 } = {}) {
  const questions = survey?.template?.questions ?? [];
  const missing = missingAnswers(survey?.template, form.answers);
  const answered = questions.filter((q) => isAnswered(q, form.answers?.[q.key])
    && (!q.photoRequired || hasPhoto(form.answers?.[q.key]))).length;
  const measuredRows = (form.items ?? []).reduce((n, item) => n + savedMeasurements(item.measurements).length, 0);
  const lines = payloadIndexes(form.items).size;
  const findings = [form.problemSummary, form.diagnosis, form.recommendation].filter((v) => text(v).trim()).length;
  const freeReadings = (form.readings ?? []).map(freeReadingBody).filter(Boolean).length;
  return {
    before: { done: visited.has('before') },
    arrived: { done: Boolean(form.sitePin || (survey?.site?.lat != null && survey?.site?.lng != null)) },
    checklist: questions.length
      ? { done: !missing.length, count: [answered, questions.length], alert: false }
      : { done: freeReadings > 0, count: freeReadings },
    measure: { done: measuredRows > 0, count: measuredRows },
    photos: { done: photos > 0, count: photos },
    findings: { done: findings === 3, count: [findings, 3] },
    lines: { done: lines > 0, count: lines },
  };
}

/** The id a checklist question's card carries, so the incomplete panel (and a refused submit) can point at it. */
export const questionDomId = (key) => `question-${key}`;

/** Where the phone's map app should go: the pin when the site has one, else the address. */
export function siteMapHref(site) {
  if (site?.lat != null && site?.lng != null) return `https://www.google.com/maps?q=${site.lat},${site.lng}`;
  if (site?.address) return `https://www.google.com/maps?q=${encodeURIComponent(site.address)}`;
  return null;
}

/** Worse than this many metres and the phone is guessing — the surveyor is told to step outside. */
export const WEAK_FIX_M = 50;

const round6 = (n) => Math.round(n * 1e6) / 1e6;

/** The phone's position once, as a promise: `{ lat, lng, accuracy }` (metres, rounded). */
export function currentFix(geolocation = globalThis.navigator?.geolocation) {
  return new Promise((resolve, reject) => {
    if (!geolocation?.getCurrentPosition) {
      reject(Object.assign(new Error('unsupported'), { reason: 'unsupported' }));
      return;
    }
    geolocation.getCurrentPosition(
      (pos) => resolve({
        lat: round6(pos.coords.latitude),
        lng: round6(pos.coords.longitude),
        ...(Number.isFinite(pos.coords.accuracy) ? { accuracy: Math.round(pos.coords.accuracy) } : {}),
      }),
      (err) => reject(Object.assign(new Error(err?.message ?? 'geolocation'), {
        reason: err?.code === 1 ? 'denied' : err?.code === 3 ? 'timeout' : 'unavailable',
      })),
      { enableHighAccuracy: true, timeout: 20_000, maximumAge: 0 },
    );
  });
}
