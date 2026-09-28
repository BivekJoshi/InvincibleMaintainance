import { paisaToRupees } from '@/helpers/format';
import { recipeBody, toRecipeRows } from '@/helpers/recipe';
import { boqRowBody, isBlankBoqRow, toBoqRows } from '@/helpers/boq';
import { measurementsBody } from '@/helpers/measurements';
import { scheduleBody, toStageRows } from '@/helpers/paymentSchedule';

/** Field types that show something and hold no value of their own (the rate library's cost card). */
export const DISPLAY_TYPES = new Set(['preview']);

/** Every field spec with `group` wrappers flattened away. */
export function flattenFields(fields = []) {
  return fields.flatMap((f) => (f.type === 'group' ? flattenFields(f.fields) : [f]));
}

/**
 * What an empty field holds. Numbers, money, dates and media are `undefined` rather
 * than null, because zod's `.optional()` accepts undefined and a mirrored
 * `z.coerce.number()` would turn null into 0. A relation is null, because the API's
 * relation ids are `.nullable()` and null is how a relation is cleared.
 */
function emptyValue(type) {
  switch (type) {
    case 'text': case 'textarea': case 'prose': case 'markdown': case 'slug': return '';
    case 'switch': case 'checkbox': return false;
    case 'relation': return null;
    case 'stringList': case 'mediaList': case 'weekdays': case 'objectList': case 'lineItems': case 'checklist': case 'recipe':
    case 'grid': case 'measurements': case 'paymentSchedule': return [];
    case 'keyValue': return {};
    default: return undefined;
  }
}

const blankCell = (v) => v === undefined || v === null || v === false || String(v).trim() === '';
/** A generic grid row left empty — every value blank — is not a row. */
const isBlankGridRow = (row) => Object.entries(row ?? {}).every(([k, v]) => k === '_key' || blankCell(v));
const withoutKey = ({ _key, ...row }) => row;

/**
 * A record as the API returns it → the values the form edits.
 *
 * `record` is in API shape: money in integer **paisa**. Money fields are converted to
 * rupees here — the only direction a form needs, because requests send rupees.
 *
 * @param {object[]} fields
 * @param {object} [record]
 */
export function toFormValues(fields, record) {
  const out = { ...(record ?? {}) };
  const names = new Set(flattenFields(fields).map((f) => f.name));
  // A column the form does not edit keeps its value, but a null one is dropped: the schema's
  // `.optional()` refuses null, and an invisible field must not block a save (a testimonial's jobId).
  for (const [key, value] of Object.entries(out)) {
    if (value === null && !names.has(key)) delete out[key];
  }
  for (const f of flattenFields(fields)) {
    if (DISPLAY_TYPES.has(f.type)) continue;
    let value = record?.[f.name];
    if (f.type === 'money' && value != null) value = paisaToRupees(value);
    if (f.type === 'lineItems' && Array.isArray(value)) value = toBoqRows(value);
    if (f.type === 'recipe' && Array.isArray(value)) value = toRecipeRows(value);
    if ((f.type === 'measurements' || f.type === 'grid') && Array.isArray(value)) value = value.map((row) => ({ ...row }));
    // Stages arrive in basis points with the server's amounts; the grid edits a share in % and never holds an amount.
    if (f.type === 'paymentSchedule' && Array.isArray(value)) value = toStageRows(value);
    if (value == null) value = f.defaultValue ?? emptyValue(f.type);
    out[f.name] = value;
  }
  return out;
}

/**
 * The form's validated values → a request body. Money stays in rupees (the API
 * converts); blank list items are dropped; an empty optional value is omitted — or sent
 * as null when its spec says `nullable: true`, which is how a column is cleared.
 *
 * @param {object[]} fields
 * @param {object} values
 */
export function toRequestValues(fields, values) {
  const out = { ...values };
  for (const f of flattenFields(fields)) {
    if (DISPLAY_TYPES.has(f.type)) continue;
    const value = out[f.name];
    if (f.nullable && (value == null || value === '' || Number.isNaN(value))) {
      out[f.name] = null;
    } else if (f.type === 'recipe') {
      out[f.name] = recipeBody(value);
    } else if (f.type === 'lineItems') {
      // The quotation schema already turns rows into the request's; rows still carrying a client key are converted here.
      const rows = Array.isArray(value) ? value : [];
      out[f.name] = rows.some((r) => r && '_key' in r) ? rows.filter((r) => !isBlankBoqRow(r)).map(boqRowBody) : rows;
    } else if (f.type === 'paymentSchedule') {
      // The schema already sends `{ label, basisPoints, trigger }`; rows still carrying a client key are converted
      // here. No stages is no change: the API keeps the schedule it has (or starts a new quotation on the default).
      const rows = Array.isArray(value) ? value : undefined;
      const body = rows && rows.some((r) => r && '_key' in r) ? scheduleBody(rows) : rows;
      out[f.name] = body?.length ? body : undefined;
    } else if (f.type === 'measurements') {
      out[f.name] = measurementsBody(Array.isArray(value) ? value : []);
    } else if (f.type === 'grid') {
      out[f.name] = (Array.isArray(value) ? value : []).filter((row) => !isBlankGridRow(row)).map(withoutKey);
    } else if (f.type === 'stringList') {
      out[f.name] = (Array.isArray(value) ? value : []).map((s) => String(s).trim()).filter(Boolean);
    } else if (f.type === 'objectList') {
      // A row left completely empty is not an item.
      out[f.name] = (Array.isArray(value) ? value : [])
        .filter((row) => Object.values(row ?? {}).some((v) => String(v ?? '').trim()));
    } else if (f.type === 'relation') {
      out[f.name] = value || null;
    } else if (value === '' && !['text', 'textarea', 'prose', 'markdown', 'slug'].includes(f.type)) {
      out[f.name] = undefined;
    }
  }
  return out;
}
