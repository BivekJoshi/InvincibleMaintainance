import { newKey } from '@/helpers/fieldDb';
import { addDaysTo } from '@/helpers/dispatchBoard';
import { formatDate, formatDateBs } from '@/helpers/format';

/**
 * The site diary's state and the one payload it queues (Phase L7). Pure: the page holds the state, these turn it into
 * `PUT /tech/jobs/:id/diary/:day`'s body — a **full replace** of the day — which travels as the `diary_save` sync kind,
 * online or not. One entry per job per Kathmandu day.
 *
 * The form (never sent as it is; `meta.form` of a queued save keeps it on the phone, as typed):
 * ```
 * { weather: null | 'SUNNY' | …,
 *   headcount: { [tradeId]: count },                  // 0–200 people of that trade
 *   progress: { [jobLineId]: pct },                   // only the lines marked on this day (0–100)
 *   received: [{ _key, materialId, description, qty, unit, challanNo }],   // qty as typed
 *   issues, note,
 *   lostHours: 0–24 (half hours), lostReason: null | 'RAIN' | …,
 *   photos: [{ _key, uploadId?, mediaId? }] }         // uploadId while the picture waits in the upload queue
 * ```
 * **No money** (D1): nothing here carries a rate, a cost or an amount — a line is its number, words and quantity.
 */

/** How far back a day may be filled in, and the most people and photos a day takes (the API's limits). */
export const DIARY_DAYS_BACK = 60;
export const MAX_HEADCOUNT = 200;
export const MAX_PHOTOS = 30;
export const MAX_LOST_HOURS = 24;
const MAX_QTY = 1_000_000;

/** A job the diary is closed for — the API answers 422: not scheduled yet, cancelled or verified. */
export const DIARY_CLOSED_STATUSES = ['DRAFT', 'CANCELLED', 'VERIFIED'];
export const diaryClosed = (job) => Boolean(job && DIARY_CLOSED_STATUSES.includes(job.status));

const text = (v) => (v === undefined || v === null ? '' : String(v));
const blank = (v) => text(v).trim() === '';
const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));

/** A quantity as typed (`2.5`, `1,200`) → a number; blank → undefined; unreadable → NaN. */
export function parseQty(value) {
  if (typeof value === 'number') return value;
  if (blank(value)) return undefined;
  const cleaned = text(value).replace(/,/g, '').trim();
  return /^(\d+\.?\d*|\.\d+)$/.test(cleaned) ? Number(cleaned) : Number.NaN;
}

export const blankDelivery = (patch = {}) => ({
  _key: newKey(), materialId: null, description: '', qty: '', unit: '', challanNo: '', ...patch,
});

export const blankDiaryForm = () => ({
  weather: null,
  headcount: {},
  progress: {},
  received: [],
  issues: '',
  lostHours: 0,
  lostReason: null,
  photos: [],
  note: '',
});

/** The server's day (a Diary, or null) → the form. */
export function diaryToForm(entry) {
  if (!entry) return blankDiaryForm();
  return {
    weather: entry.weather ?? null,
    headcount: Object.fromEntries((entry.headcount ?? []).map((h) => [h.tradeId, Number(h.count) || 0])),
    progress: Object.fromEntries((entry.progress ?? []).map((p) => [p.jobLineId, Number(p.progressPct) || 0])),
    received: (entry.received ?? []).map((r) => blankDelivery({
      materialId: r.materialId ?? null,
      description: text(r.description),
      qty: r.qty == null ? '' : String(r.qty),
      unit: text(r.unit),
      challanNo: text(r.challanNo),
    })),
    issues: text(entry.issues),
    lostHours: Number(entry.lostHours) || 0,
    lostReason: entry.lostReason ?? null,
    photos: (entry.photoMediaIds ?? []).map((mediaId) => ({ _key: newKey(), mediaId })),
    note: text(entry.note),
  };
}

const isBlankDelivery = (r) => !r.materialId && blank(r.description) && blank(r.qty) && blank(r.challanNo);

/**
 * What is wrong with the form, by where it shows — the API's rules, so a save is never refused for them:
 * `{ received: { [key]: { description?, qty? } }, lostHours?, lostReason?, photos? }`, each a word key of
 * `fieldCopy.diary` (`needWhat`, `invalidQty`, `tooMany`, `needReason`, `max`). Empty when it can be saved.
 */
export function diaryProblems(form) {
  const problems = {};
  const received = {};
  for (const row of form.received ?? []) {
    if (isBlankDelivery(row)) continue;
    const issue = {};
    if (blank(row.description)) issue.description = 'needWhat';
    const qty = parseQty(row.qty);
    if (!(Number.isFinite(qty) && qty > 0 && qty <= MAX_QTY)) issue.qty = 'invalidQty';
    if (Object.keys(issue).length) received[row._key] = issue;
  }
  if (Object.keys(received).length) problems.received = received;
  const hours = Number(form.lostHours);
  if (!(Number.isFinite(hours) && hours >= 0 && hours <= MAX_LOST_HOURS)) problems.lostHours = 'tooMany';
  else if (hours > 0 && !form.lostReason) problems.lostReason = 'needReason';
  if ((form.photos ?? []).length > MAX_PHOTOS) problems.photos = 'max';
  return problems;
}

export const hasProblems = (problems) => Object.keys(problems ?? {}).length > 0;

/**
 * The form → the day's body (`PUT /tech/jobs/:id/diary/:day`, and the `diary_save` payload with its `day`). A trade
 * with nobody and an empty delivery are left out; a line is sent only once it was marked on this day. The photos
 * still waiting in the upload queue are not here — they ride in the entry's `meta.photoUploadIds` and the sync engine
 * adds their media ids once they are up (`useOfflineQueue#resolveDiaryPhotos`).
 *
 * @param {object} form
 * @param {string} day `YYYY-MM-DD`, Kathmandu
 */
export function diaryPayload(form, day) {
  const issues = text(form.issues).trim();
  const note = text(form.note).trim();
  const lostHours = Number(form.lostHours) || 0;
  return {
    day,
    ...(form.weather ? { weather: form.weather } : {}),
    headcount: Object.entries(form.headcount ?? {})
      .map(([tradeId, count]) => ({ tradeId, count: Math.round(Number(count) || 0) }))
      .filter((h) => h.count > 0),
    progress: Object.entries(form.progress ?? {})
      .map(([jobLineId, pct]) => ({ jobLineId, progressPct: clamp(Math.round(Number(pct) || 0), 0, 100) })),
    received: (form.received ?? []).filter((r) => !isBlankDelivery(r)).map((r) => ({
      ...(r.materialId ? { materialId: r.materialId } : {}),
      description: text(r.description).trim(),
      qty: parseQty(r.qty),
      ...(blank(r.unit) ? {} : { unit: text(r.unit).trim() }),
      ...(blank(r.challanNo) ? {} : { challanNo: text(r.challanNo).trim() }),
    })),
    ...(issues ? { issues } : {}),
    lostHours,
    ...(lostHours > 0 && form.lostReason ? { lostReason: form.lostReason } : {}),
    photoMediaIds: (form.photos ?? []).filter((p) => p.mediaId).map((p) => p.mediaId).slice(0, MAX_PHOTOS),
    ...(note ? { note } : {}),
  };
}

/** The photos of the form still waiting to upload — the queued save's `meta.photoUploadIds`. */
export const waitingPhotoIds = (form) => (form.photos ?? []).filter((p) => p.uploadId && !p.mediaId).map((p) => p.uploadId);

/** A queued save of this job's day — what a newer save of the same day replaces (`supersede`). */
export const isDiarySave = (jobId, day) => (entry) => entry.kind === 'diary_save' && entry.jobId === jobId && entry.payload?.day === day;

/** The days of this job saved on the phone and not sent yet, newest first. */
export function waitingDays(mutations = [], jobId) {
  const days = new Set(mutations.filter((m) => m.kind === 'diary_save' && m.jobId === jobId).map((m) => m.payload?.day));
  return [...days].filter(Boolean).sort().reverse();
}

/** The days a diary may be filled in for: today and the 60 before it. */
export const diaryDayBounds = (today) => ({ min: addDaysTo(today, -DIARY_DAYS_BACK), max: today });

/** Whether `day` can be filled in: a real `YYYY-MM-DD`, not after today, at most 60 days back. */
export function isDiaryDay(day, today) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text(day)) || Number.isNaN(Date.parse(`${day}T00:00:00Z`))) return false;
  const { min, max } = diaryDayBounds(today);
  return day >= min && day <= max;
}

/** A Kathmandu day in words: "Mon, 28 Sept 2026". Noon in Kathmandu, so no timezone moves it. */
export const dayLabel = (day) => formatDate(`${day}T06:15:00.000Z`, { weekday: 'short' });
/** The same day in BS: "12 Asoj 2083" (`locale: 'ne'` → "12 असोज 2083"). */
export const dayLabelBs = (day, locale = 'en') => formatDateBs(`${day}T06:15:00.000Z`, { long: true, locale });

/** A progress step of 5 %, kept within 0–100. */
export const stepPct = (pct, by) => clamp((Number(pct) || 0) + by, 0, 100);
/** Lost hours move by half an hour, within 0–24. */
export const stepHours = (hours, by) => clamp(Math.round(((Number(hours) || 0) + by) * 2) / 2, 0, MAX_LOST_HOURS);
/** A trade's count moves by one, within 0–200. */
export const stepCount = (count, by) => clamp((Number(count) || 0) + by, 0, MAX_HEADCOUNT);

export const headcountTotal = (headcount = {}) => Object.values(headcount).reduce((sum, n) => sum + (Number(n) || 0), 0);

/**
 * The job's lines grouped by their section, in order — the progress cards. A line with no section goes under
 * `noSection` (the words the caller gives).
 * @param {{ section?: string|null }[]} lines
 */
export function linesBySection(lines = [], noSection = '') {
  const groups = [];
  const byTitle = new Map();
  for (const line of lines) {
    const title = line.section || noSection;
    if (!byTitle.has(title)) {
      const group = { title, lines: [] };
      byTitle.set(title, group);
      groups.push(group);
    }
    byTitle.get(title).lines.push(line);
  }
  return groups;
}

/** A quantity without float noise: 240, 1.5, 0.333. */
export const qtyText = (n) => (n == null || n === '' ? '' : String(Number(Number(n).toFixed(3))));
