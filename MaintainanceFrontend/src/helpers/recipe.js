import { paisaToRupees, parseRupees, rupeesToPaisa } from '@/helpers/format';

/**
 * A rate-library recipe (Phase L2) between the API and the `recipe` form field. Pure.
 *
 * The API sends components with money in paisa and the material or trade embedded (so a reader who may
 * not list materials still sees names); the form edits rows with money in **rupees**; a request sends
 * rupees and ids only. The client never works out a cost or a margin — `POST /admin/rate-card/derive`
 * does, margins at the form's rate and at the derived rate included — so nothing here adds up money.
 */

/** The field's sections, in the order the rows are kept. */
export const RECIPE_SECTIONS = [
  { key: 'materials', title: 'Materials', kinds: ['MATERIAL'], addLabel: 'Add material', empty: 'No materials.' },
  { key: 'labour', title: 'Labour', kinds: ['LABOUR'], addLabel: 'Add labour', empty: 'No labour.' },
  { key: 'other', title: 'Equipment & other', kinds: ['EQUIPMENT', 'OTHER'], addLabel: 'Add equipment or other cost', empty: 'No equipment or other costs.' },
];

/** Equipment and other lines carry their own cost per unit. */
export const isPriced = (kind) => kind === 'EQUIPMENT' || kind === 'OTHER';
const blank = (v) => v == null || String(v).trim() === '';

/** A new, empty row of a kind. */
export function blankRecipeRow(kind) {
  if (kind === 'MATERIAL') return { kind, materialId: null, material: null, qty: '', wastagePct: '' };
  if (kind === 'LABOUR') return { kind, tradeId: null, trade: null, qty: '' };
  return { kind, description: '', qty: '', cost: '' };
}

/** Rows grouped by section, each section keeping its own order — the order the field shows and saves. */
export const sortRecipeRows = (rows) => RECIPE_SECTIONS.flatMap((s) => rows.filter((r) => s.kinds.includes(r?.kind)));

/**
 * The API's components (paisa) → the rows the field edits (rupees).
 * @param {object[]} [components]
 */
export function toRecipeRows(components) {
  if (!Array.isArray(components)) return [];
  return sortRecipeRows(components.map((c) => {
    const row = blankRecipeRow(c.kind);
    if (c.kind === 'MATERIAL') return { ...row, materialId: c.materialId ?? null, material: c.material ?? null, qty: c.qty ?? '', wastagePct: c.wastagePct ?? '' };
    if (c.kind === 'LABOUR') return { ...row, tradeId: c.tradeId ?? null, trade: c.trade ?? null, qty: c.qty ?? '' };
    return { ...row, description: c.description ?? '', qty: c.qty ?? '', cost: c.cost == null ? '' : paisaToRupees(c.cost) };
  }));
}

/** A row the user added and left empty is not a line. */
export function isBlankRecipeRow(row) {
  if (!row) return true;
  if (row.kind === 'MATERIAL') return !row.materialId && blank(row.qty) && blank(row.wastagePct);
  if (row.kind === 'LABOUR') return !row.tradeId && blank(row.qty);
  return blank(row.description) && blank(row.qty) && blank(row.cost);
}

const num = (v) => (blank(v) ? undefined : Number(v));
/** Rupees as typed (`1,200.50`, `Rs. 90`) → a number, or undefined; unreadable text is NaN. */
const rupeesOf = (v) => (typeof v === 'number' ? v : blank(v) ? undefined : (parseRupees(v) ?? Number.NaN));

/**
 * One row → the request's shape for its kind: `{ kind, materialId, qty, wastagePct }`,
 * `{ kind, tradeId, qty }` or `{ kind, description, qty, cost }` (cost in rupees).
 */
export function recipeLineBody(row) {
  if (row.kind === 'MATERIAL') {
    const wastagePct = num(row.wastagePct);
    return { kind: row.kind, materialId: row.materialId, qty: num(row.qty), ...(wastagePct != null ? { wastagePct } : {}) };
  }
  if (row.kind === 'LABOUR') return { kind: row.kind, tradeId: row.tradeId, qty: num(row.qty) };
  const cost = rupeesOf(row.cost);
  return { kind: row.kind, description: String(row.description ?? '').trim(), qty: num(row.qty), ...(cost !== undefined ? { cost } : {}) };
}

/** The request's `components`: blank rows dropped, display-only keys (the embedded material or trade) gone. */
export const recipeBody = (rows) => (Array.isArray(rows) ? rows : []).filter((r) => !isBlankRecipeRow(r)).map(recipeLineBody);

/** Whether a line can be priced as it stands: what it is, a quantity above 0, and (equipment/other) a cost. */
function isCompleteLine(line) {
  if (!(line.qty > 0)) return false;
  if (line.kind === 'MATERIAL') return Boolean(line.materialId);
  if (line.kind === 'LABOUR') return Boolean(line.tradeId);
  return Boolean(line.description) && Number.isFinite(line.cost) && line.cost >= 0;
}

const pctOrNull = (v) => (blank(v) || Number.isNaN(Number(v)) ? null : Number(v));

/**
 * The live cost card's `POST /admin/rate-card/derive` body, from the form's values as typed.
 * `ready` is false — and nothing should be sent — until there is at least one line and every line is
 * complete; `unfinished` counts the lines still missing something.
 *
 * @param {object} values  the rate form's values (money in rupees)
 * @returns {{ ready: boolean, unfinished: number, body: object|null }}
 */
export function deriveRequest(values = {}) {
  const components = recipeBody(values.components);
  const unfinished = components.filter((c) => !isCompleteLine(c)).length;
  if (!components.length || unfinished) return { ready: false, unfinished, body: null };
  const recipeQty = Number(values.recipeQty);
  const roundTo = rupeesOf(values.roundTo);
  const rate = rupeesOf(values.rate);
  return {
    ready: true,
    unfinished: 0,
    body: {
      recipeQty: recipeQty > 0 ? recipeQty : 1,
      overheadPct: pctOrNull(values.overheadPct),
      profitPct: pctOrNull(values.profitPct),
      roundTo: Number.isFinite(roundTo) ? roundTo : null,
      // The rate on the form, so the server answers with the margin at it too.
      ...(Number.isFinite(rate) ? { rate } : {}),
      components,
    },
  };
}

/** The rate a form holds (rupees, as typed) → paisa, or null. */
export const formRateToPaisa = (rate) => {
  const rupees = rupeesOf(rate);
  return Number.isFinite(rupees) ? rupeesToPaisa(rupees) : null;
};
