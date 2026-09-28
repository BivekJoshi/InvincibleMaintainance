import { paisaToRupees, parseRupees } from '@/helpers/format';
import { validScheduleBody } from '@/helpers/paymentSchedule';
import { isBlankMeasurement, measurementsBody } from '@/helpers/measurements';

/**
 * A quotation's bill of quantities (Phase L3) between the API and the builder's `lineItems` field. Pure.
 *
 * The API sends rows with money in paisa, their number (`A`, `A.1`), measured and billed quantities and — for
 * `costs:read` only — cost. The form edits rows with rates in **rupees**, each with a client `_key` (the saved
 * row's id, so a reload is not an edit). A request sends rupees and never a cost; the server works out every
 * amount, total and margin (`POST /admin/quotations/preview` while editing).
 */

export const ROW_TYPES = ['ITEM', 'SECTION', 'NOTE'];
export const ROW_TYPE_LABELS = { ITEM: 'Row', SECTION: 'Section', NOTE: 'Note' };

const blank = (v) => v === undefined || v === null || String(v).trim() === '';
const trim = (v) => String(v ?? '').trim();

/** A, B … Z, AA, AB … — a section's letter by its position (the API's `boq.service#boqNumbers`). */
function letter(n) {
  let out = '';
  for (let x = n + 1; x > 0; x = Math.floor((x - 1) / 26)) out = String.fromCharCode(65 + ((x - 1) % 26)) + out;
  return out;
}

/**
 * Each row's number, as the API numbers them: a section its letter, an item `A.1` under a section (`1`, `2`
 * before any), a note none. Display only — the server numbers the saved rows the same way.
 * @param {{ rowType?: string }[]} rows
 * @returns {(string|null)[]}
 */
export function boqNumbers(rows) {
  let section = -1;
  let item = 0;
  return (rows ?? []).map((row) => {
    if (row?.rowType === 'SECTION') {
      section += 1;
      item = 0;
      return letter(section);
    }
    if (row?.rowType === 'NOTE') return null;
    item += 1;
    return section < 0 ? String(item) : `${letter(section)}.${item}`;
  });
}

let seq = 0;
/** A client key for a row that has no id yet. */
export const newRowKey = () => {
  seq += 1;
  return `new-${Date.now().toString(36)}-${seq}`;
};

/** A new, empty row of a type. */
export function blankBoqRow(rowType = 'ITEM') {
  const row = { _key: newRowKey(), rowType, description: '', spec: '' };
  if (rowType !== 'ITEM') return row;
  return {
    ...row, kind: null, rateCardItemId: null, materialId: null, unit: '', qty: '', measurements: null,
    wastagePct: '', rate: '', isOptional: false, isProvisional: false,
  };
}

/** A copy of a row as a new row: no id, so the server prices it fresh (and snapshots today's recipe). */
export function duplicateBoqRow(row) {
  const { id: _id, recipe: _recipe, ...rest } = row;
  return { ...rest, _key: newRowKey(), measurements: row.measurements ? row.measurements.map((m) => ({ ...m })) : row.measurements };
}

/** A row that was added and left empty. */
export function isBlankBoqRow(row) {
  if (!row) return true;
  if (!blank(row.description) || !blank(row.spec)) return false;
  if ((row.rowType ?? 'ITEM') !== 'ITEM') return true;
  const measured = (row.measurements ?? []).some((m) => !isBlankMeasurement(m));
  return !measured && blank(row.qty) && blank(row.rate) && !row.rateCardItemId && !row.materialId;
}

/**
 * The API's rows (paisa) → the rows the `lineItems` field edits (rupees). The typed quantity is the one before
 * wastage (`netQty`; a row saved before Phase L3 has only `qty`). The frozen recipe rides along for the recipe
 * drawer and is never sent back.
 * @param {object[]} [items]
 */
export function toBoqRows(items) {
  if (!Array.isArray(items)) return [];
  return items.map((item, i) => {
    const rowType = item.rowType ?? 'ITEM';
    const base = { _key: item.id ?? item._key ?? `row-${i}`, ...(item.id ? { id: item.id } : {}), rowType, description: item.description ?? '', spec: item.spec ?? '' };
    if (rowType !== 'ITEM') return base;
    const measured = Array.isArray(item.measurements) && item.measurements.length ? item.measurements : null;
    return {
      ...base,
      kind: item.kind ?? null,
      rateCardItemId: item.rateCardItemId ?? null,
      materialId: item.materialId ?? null,
      unit: item.unit ?? '',
      qty: measured ? '' : (item.netQty ?? item.qty ?? ''),
      measurements: measured,
      wastagePct: item.wastagePct ? item.wastagePct : '',
      rate: item.rate == null ? '' : paisaToRupees(item.rate),
      isOptional: Boolean(item.isOptional),
      isProvisional: Boolean(item.isProvisional),
      ...(item.recipe ? { recipe: item.recipe } : {}),
      ...(item.code ? { code: item.code } : {}),
      // An invoice line that bills a job keeps it (Phase I's `lineItems` invoice variant); a quotation row has none.
      ...(item.jobId ? { jobId: item.jobId } : {}),
    };
  });
}

const numberOf = (v) => {
  if (typeof v === 'number') return v;
  if (blank(v)) return undefined;
  const cleaned = String(v).replace(/,/g, '').trim();
  return /^(\d+\.?\d*|\.\d+)$/.test(cleaned) ? Number(cleaned) : Number.NaN;
};
/** A rate as typed (`1,250.50`, `Rs. 95`) → rupees; blank → undefined; unreadable → NaN. */
export const rateOf = (v) => (typeof v === 'number' ? v : blank(v) ? undefined : (parseRupees(v) ?? Number.NaN));
export const qtyOf = numberOf;

/**
 * One form row → the request's row (rupees). Keys the server ignores (a cost, the recipe, `_key`) are not sent.
 * A SECTION and a NOTE carry only their text. An ITEM with a measurement sheet sends the sheet, not a qty.
 * @param {object} row
 */
export function boqRowBody(row) {
  const rowType = row.rowType ?? 'ITEM';
  const body = { ...(row.id ? { id: row.id } : {}), rowType, description: trim(row.description) };
  const spec = trim(row.spec);
  if (spec) body.spec = spec;
  if (rowType !== 'ITEM') return body;
  const measurements = measurementsBody(row.measurements ?? []);
  const unit = trim(row.unit);
  const wastagePct = numberOf(row.wastagePct);
  return {
    ...body,
    ...(row.kind ? { kind: row.kind } : {}),
    ...(row.rateCardItemId ? { rateCardItemId: row.rateCardItemId } : {}),
    ...(row.materialId ? { materialId: row.materialId } : {}),
    ...(unit ? { unit } : {}),
    ...(measurements.length ? { measurements } : { qty: numberOf(row.qty) }),
    ...(wastagePct !== undefined ? { wastagePct } : {}),
    rate: rateOf(row.rate),
    isOptional: Boolean(row.isOptional),
    isProvisional: Boolean(row.isProvisional),
  };
}

const finite = (v) => typeof v === 'number' && Number.isFinite(v);

/**
 * Whether a row can be priced as it stands — the rows a live preview sends. A section or note needs its text;
 * an item its description, a readable rate and a quantity (typed, or a sheet with a value).
 */
export function isPreviewable(body) {
  if (!body.description) return false;
  if (body.rowType !== 'ITEM') return true;
  if (!finite(body.rate) || body.rate < 0) return false;
  if (body.wastagePct !== undefined && !(finite(body.wastagePct) && body.wastagePct >= 0 && body.wastagePct <= 100)) return false;
  if (body.measurements) return body.measurements.every((m) => ['nos', 'l', 'b', 'h'].every((k) => m[k] === undefined || finite(m[k])));
  return finite(body.qty) && body.qty > 0;
}

/**
 * The builder's live `POST /admin/quotations/preview` body from the form's values as typed, and which row each
 * sent row is. A row that cannot be priced yet is left out (its amount shows as "—" until it can); `skipped`
 * counts them. Rupees in, the server's paisa out.
 *
 * @param {{ items?: object[], discount?: number, vatApplied?: boolean }} values
 * @param {{ quotationId?: string }} [opts]
 * @returns {{ body: object, keys: string[], skipped: number, stagesSent: boolean }}  `stagesSent`: the body carries
 *   the payment schedule (only a whole one is sent), so the answer's `paymentStages` are the ones on screen
 */
export function previewRequest(values = {}, { quotationId } = {}) {
  const keys = [];
  const items = [];
  let skipped = 0;
  for (const row of values.items ?? []) {
    if (isBlankBoqRow(row)) continue;
    const body = boqRowBody(row);
    if (!isPreviewable(body)) {
      skipped += 1;
      continue;
    }
    keys.push(row._key);
    items.push(body);
  }
  const discount = rateOf(values.discount);
  // Phase L4: a whole payment schedule rides along, so the server answers each stage's amount for these totals.
  const paymentStages = Array.isArray(values.paymentStages) ? validScheduleBody(values.paymentStages) : null;
  return {
    body: {
      ...(quotationId ? { quotationId } : {}),
      items,
      ...(finite(discount) ? { discount } : {}),
      vatApplied: values.vatApplied !== false,
      ...(paymentStages ? { paymentStages } : {}),
    },
    keys,
    skipped,
    stagesSent: Boolean(paymentStages),
  };
}

/**
 * What each row shows from the server — its number, quantities, amount and (for `costs:read`) cost — keyed by
 * the row's `_key`, and each section's subtotal by the section row's key.
 *
 * @param {object[]} items   the server's rows: a preview's `items` or a saved quotation's `items`
 * @param {string[]} keys    the row key of each, in the same order
 * @param {{ index: number|null, subtotal: number }[]} [sections]
 * @returns {Map<string, object>}
 */
export function serverFiguresByKey(items = [], keys = [], sections = []) {
  const byKey = new Map();
  items.forEach((item, i) => {
    const key = keys[item.index ?? i] ?? keys[i];
    if (key) byKey.set(key, item);
  });
  for (const s of sections ?? []) {
    if (s.index == null) continue;
    const key = keys[s.index];
    if (key) byKey.set(key, { ...(byKey.get(key) ?? {}), subtotal: s.subtotal });
  }
  return byKey;
}

/** A labour item in the library, by its category. */
export const kindForCategory = (category) => (/labou?r/i.test(String(category ?? '')) ? 'LABOUR' : 'SERVICE');

/**
 * A rate-library item (paisa) → a new BOQ row priced from it. The server snapshots its recipe when the row is
 * first saved (L-D1); the rate is copied as the starting sell rate and stays editable.
 * @param {{ id: string, code?: string, name: string, unit: string, rate: number, category?: string }} item
 */
export function libraryRow(item) {
  return {
    ...blankBoqRow('ITEM'),
    rateCardItemId: item.id,
    code: item.code,
    description: item.name,
    unit: item.unit ?? '',
    rate: paisaToRupees(item.rate),
    kind: kindForCategory(item.category),
  };
}

/**
 * How long a trade's man-days take with a crew: days ÷ crew, to one decimal. Quantity maths, never money —
 * the Labour tab's crew-size calculator. Null without a crew of at least one.
 * @param {number} days
 * @param {number|string} crew
 */
export function crewDuration(days, crew) {
  const c = Number(crew);
  if (!(c >= 1) || !Number.isFinite(Number(days))) return null;
  return Math.round((Number(days) / c) * 10) / 10;
}

/**
 * A reviewed survey's priced lines → the rows `POST /admin/surveys/:id/quotation` takes (rupees). Every line goes
 * in: one the reviewer leaves out of the total (an optional one, by default) becomes an **optional row**. The
 * quantity sent is the surveyor's (`rawQty`) — the server adds the wastage — and the surveyor's note becomes the
 * row's specification. A measured line carries its measurement rows (Phase L5), from which the server derives the
 * row's quantity. The server groups the rows into sections — by the room when all of a line's rows share one,
 * else by category.
 *
 * @param {object[]} lines  `GET /admin/surveys/:id/pricing` lines (paisa)
 * @param {Record<string, { rate?: string, included?: boolean }>} draft  the reviewer's edits, by survey item
 * @returns {object[]}  rows with `rate` NaN where no rate is set yet
 */
export function surveyQuotationRows(lines = [], draft = {}) {
  return lines.map((line) => {
    const edit = draft[line.surveyItemId] ?? {};
    const typed = edit.rate;
    const rate = typed !== undefined && String(typed).trim() !== ''
      ? (parseRupees(typed) ?? Number.NaN)
      : line.ratePaisa != null ? paisaToRupees(line.ratePaisa) : Number.NaN;
    const counted = edit.included ?? !line.isOptional;
    return {
      rowType: 'ITEM',
      kind: line.kind,
      ...(line.rateCardItemId ? { rateCardItemId: line.rateCardItemId } : {}),
      ...(line.materialId ? { materialId: line.materialId } : {}),
      description: line.description,
      ...(line.unit ? { unit: line.unit } : {}),
      qty: line.rawQty ?? line.qty,
      // The surveyor's measurement sheet travels with the line (Phase L5): the server derives the BOQ row's
      // quantity from the same rows, so the quotation's measured rows equal the survey's.
      ...(Array.isArray(line.measurements) && line.measurements.length ? { measurements: line.measurements } : {}),
      wastagePct: Number(line.wastagePct ?? 0),
      isOptional: !counted,
      ...(line.note ? { spec: line.note } : {}),
      rate,
    };
  });
}
