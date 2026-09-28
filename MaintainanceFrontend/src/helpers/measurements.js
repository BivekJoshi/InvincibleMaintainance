/**
 * The measurement sheet (Phase L3) on the client: reading what a site engineer types, and showing a row's
 * value and the sheet's total **as a preview**. Quantities, never money. The quantity a quotation saves is
 * the server's (`utils/quantity.js#measurementQty`), which these mirror only so the sheet reads back as it
 * is typed; the builder shows the server's figure once its preview answers.
 */

const blank = (v) => v === undefined || v === null || String(v).trim() === '';
const NUM = String.raw`\d+(?:\.\d+)?|\.\d+`;
const FEET = String.raw`(?:'|’|′|ft\.?|feet)`;
const INCH = String.raw`(?:"|”|″|''|’’|in\.?|inch(?:es)?)`;
const FEET_INCHES = new RegExp(String.raw`^(${NUM})\s*${FEET}\s*-?\s*(?:(${NUM})\s*(?:${INCH})?)?$`, 'i');
const INCHES = new RegExp(String.raw`^(${NUM})\s*${INCH}$`, 'i');
const PLAIN = new RegExp(String.raw`^(${NUM})$`);

/**
 * A length as typed, in feet-inches or as a number: `12'6"` → 12.5, `12'` → 12, `6"` → 0.5, `12' 6` → 12.5,
 * `12'-6"` → 12.5, `12.5` → 12.5, `1,200` → 1200. A number already is one. Blank → undefined; anything
 * else → NaN, so a form can say it could not read it.
 *
 * Feet and inches become decimal feet, the unit a sheet in feet is measured in (a sheet in metres takes
 * plain numbers).
 *
 * @param {string|number|null|undefined} input
 * @returns {number|undefined}
 */
export function parseLength(input) {
  if (typeof input === 'number') return Number.isFinite(input) ? input : Number.NaN;
  if (blank(input)) return undefined;
  const text = String(input).trim().replace(/,/g, '');
  let m = text.match(PLAIN);
  if (m) return Number(m[1]);
  m = text.match(FEET_INCHES);
  if (m) return Number(m[1]) + (m[2] ? Number(m[2]) / 12 : 0);
  m = text.match(INCHES);
  if (m) return Number(m[1]) / 12;
  return Number.NaN;
}

const q3 = (n) => Math.round(n * 1000) / 1000;
const DIMENSIONS = ['nos', 'l', 'b', 'h'];

/**
 * One measurement row's value: `nos × L × B × H` over the dimensions it has (a wall is nos × L × H, a floor
 * L × B, a count just nos), negative for a deduction (a door, a window). Null for a row with no numbers, or
 * one whose numbers cannot be read.
 * @param {{ nos?: any, l?: any, b?: any, h?: any, deduct?: boolean }} row
 * @returns {number|null}
 */
export function measurementRowValue(row) {
  const dims = DIMENSIONS.map((k) => parseLength(row?.[k])).filter((v) => v !== undefined);
  if (!dims.length || dims.some((v) => !Number.isFinite(v))) return null;
  const value = dims.reduce((a, v) => a * v, 1);
  return row.deduct ? -value : value;
}

/**
 * The sheet's total, rounded to 3 dp once at the end — the preview of what the server will save.
 * @param {object[]} [rows]
 */
export function measurementTotal(rows = []) {
  return q3((rows ?? []).reduce((total, row) => total + (measurementRowValue(row) ?? 0), 0));
}

/** A row the user added and left empty is not a measurement. */
export const isBlankMeasurement = (row) => !row
  || (['area', 'description', ...DIMENSIONS].every((k) => blank(row[k])));

/**
 * The phone's measurement cards (Phase L5's survey, Phase L8's final measurement) read a sheet as it is typed: these
 * say which rows can go to the server and what they come to, as a preview.
 */

/** A row every size of which reads (blank sizes are fine — a wall has no breadth). */
export const isReadableMeasurement = (row) => DIMENSIONS.every((k) => {
  const v = parseLength(row?.[k]);
  return v === undefined || Number.isFinite(v);
});

/** The rows that go to the server: not blank, every size readable. A row that does not read waits on the phone. */
export const savedMeasurements = (rows = []) => (rows ?? []).filter((row) => !isBlankMeasurement(row) && isReadableMeasurement(row));

/** A row's value, or null while it cannot be read. */
export const readableRowValue = (row) => (isReadableMeasurement(row) ? measurementRowValue(row) : null);

/** A room's (or a sheet's) total on this phone — a preview — over its rows that read. */
export const readableTotal = (rows = []) => measurementTotal((rows ?? []).filter(isReadableMeasurement));

/** Rooms in the order they were first measured; a row with no room sits under `''`. */
export function groupMeasurementsByArea(rows = []) {
  const groups = new Map();
  for (const row of rows ?? []) {
    const area = String(row?.area ?? '').trim();
    if (!groups.has(area)) groups.set(area, []);
    groups.get(area).push(row);
  }
  return [...groups.entries()].map(([area, list]) => ({ area, rows: list }));
}

/**
 * The sheet as the API takes it: blank rows dropped, lengths as numbers, text trimmed, `deduct` only when
 * set. A length that cannot be read is left as NaN for the schema to refuse.
 * @param {object[]} [rows]
 */
export function measurementsBody(rows = []) {
  return (rows ?? []).filter((row) => !isBlankMeasurement(row)).map((row) => {
    const out = {};
    const area = String(row.area ?? '').trim();
    const description = String(row.description ?? '').trim();
    if (area) out.area = area;
    if (description) out.description = description;
    for (const k of DIMENSIONS) {
      const v = parseLength(row[k]);
      if (v !== undefined) out[k] = v;
    }
    if (row.deduct) out.deduct = true;
    return out;
  });
}

/** A quantity for display: at most 3 decimals, no trailing zeros, Indian grouping. */
export function formatQty(value) {
  if (value === undefined || value === null || value === '') return '';
  const n = Number(value);
  if (!Number.isFinite(n)) return String(value);
  return new Intl.NumberFormat('en-IN', { maximumFractionDigits: 3 }).format(n);
}
