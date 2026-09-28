import { parseLength } from '@/helpers/measurements';

/**
 * What a spreadsheet puts on the clipboard, read into grid rows (Phase L3). Pure — the EditableGrid calls
 * it on paste, and its tests run without a DOM.
 *
 * Excel and Google Sheets copy a range as TSV: rows end with a newline, cells are separated by tabs, and a
 * cell holding a tab, a newline or a quote is wrapped in quotes with `""` for a quote.
 */

/**
 * TSV text → rows of cell strings. Trailing empty rows (Excel ends with a newline) and rows with no text at
 * all are dropped.
 * @param {string} text
 * @returns {string[][]}
 */
export function parseClipboard(text) {
  const rows = [];
  let row = [];
  let cell = '';
  let quoted = false;
  const src = String(text ?? '').replace(/\r\n?/g, '\n');
  for (let i = 0; i < src.length; i += 1) {
    const ch = src[i];
    if (quoted) {
      if (ch === '"' && src[i + 1] === '"') { cell += '"'; i += 1; } else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"' && cell === '') quoted = true;
    else if (ch === '\t') { row.push(cell); cell = ''; } else if (ch === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; } else cell += ch;
  }
  if (cell !== '' || row.length) { row.push(cell); rows.push(row); }
  return rows.map((r) => r.map((c) => c.trim())).filter((r) => r.some((c) => c !== ''));
}

/** Whether pasted text is more than one cell — a range to insert as rows, not a value for one cell. */
export const isMultiCell = (text) => /[\t\n]/.test(String(text ?? '').replace(/\r?\n$/, ''));

/**
 * A number as a spreadsheet shows it: Indian digit grouping (`1,23,456.50`), a currency prefix
 * (`Rs`, `Rs.`, `NPR`, `रु`), a trailing `%` or `/-`. Blank, `-` and `—` → undefined; anything else that is
 * not a number → NaN.
 * @param {string|number|null|undefined} text
 * @returns {number|undefined}
 */
export function parseGridNumber(text) {
  if (typeof text === 'number') return Number.isFinite(text) ? text : Number.NaN;
  const raw = String(text ?? '').trim();
  if (raw === '' || /^[-–—]$/.test(raw)) return undefined;
  const cleaned = raw
    .replace(/^(?:rs\.?|npr|nrs\.?|रु\.?)\s*/i, '')
    .replace(/\/-$/, '')
    .replace(/%$/, '')
    .replace(/[,\s]/g, '');
  return /^(\d+\.?\d*|\.\d+)$/.test(cleaned) ? Number(cleaned) : Number.NaN;
}

/** A header cell or alias, compared without case, spaces or punctuation: "Qty." = "qty", "Rate (Rs)" = "raters". */
const norm = (s) => String(s ?? '').toLowerCase().replace(/[^a-z0-9%\p{Script=Devanagari}]/gu, '');

/** A serial-number cell: `1`, `2.`, `A`, `A.1`, `iv`, `(a)`, `1.2.3`. */
const INDEX_CELL = /^\(?([A-Z]{1,2}|[ivx]{1,5}|\d{1,4})([.)]\d{0,3})*[.)]?$/i;
const INDEX_HEADERS = new Set(['sn', 'sno', 'snno', 'no', 'sl', 'slno', 'srno', 'itemno', 'code', '#', 'ref', 'refno', 'क्रस']);

/**
 * @typedef {object} PasteColumn
 * @property {string} key
 * @property {string[]} [aliases]  header words that name this column (`qty`, `quantity`, `nos`)
 * @property {'text'|'number'|'money'|'length'} [type]
 */

const readCell = (type, text) => {
  if (type === 'text' || !type) return text;
  const n = type === 'length' ? parseLength(text) : parseGridNumber(text);
  if (n === undefined) return '';
  // Unreadable → the text as it was, so the grid shows it and the schema names the problem.
  return Number.isFinite(n) ? n : text;
};

/**
 * Pasted TSV → the values of each row, keyed by the spec's columns.
 *
 * - **Header row** — when the first row's cells name at least two of the columns (by `aliases` or key), it is
 *   read as a header: it is not pasted, and it decides which cell goes to which column (so `S.N. · Particulars ·
 *   Qty · Unit · Rate · Amount` lands right). Cells it does not name (S.N., Amount) are ignored.
 * - **No header** — cells go to the columns in order. A leading serial-number column (`1`, `A.1`) is dropped
 *   when the rows have more cells than there are columns; extra cells at the end are ignored.
 * - Numbers are read with `parseGridNumber` (grouping, `Rs.`), lengths with `parseLength` (feet-inches).
 *
 * @param {string} text
 * @param {PasteColumn[]} columns
 * @returns {{ rows: Record<string, any>[], header: boolean }}
 */
export function readPastedRows(text, columns) {
  const table = parseClipboard(text);
  if (!table.length) return { rows: [], header: false };

  const aliasOf = new Map();
  columns.forEach((col) => [col.key, ...(col.aliases ?? [])].forEach((a) => aliasOf.set(norm(a), col.key)));
  const first = table[0];
  const named = first.map((cell) => aliasOf.get(norm(cell)) ?? null);
  const header = new Set(named.filter(Boolean)).size >= Math.min(2, columns.length);

  let mapping;
  let body = table;
  if (header) {
    mapping = named;
    body = table.slice(1);
  } else {
    const width = Math.max(...table.map((r) => r.length));
    const leadingIndex = width > columns.length
      && table.every((r) => r[0] === '' || INDEX_CELL.test(r[0]) || INDEX_HEADERS.has(norm(r[0])))
      && table.some((r) => r[0] !== '');
    const offset = leadingIndex ? 1 : 0;
    mapping = Array.from({ length: width }, (_, i) => columns[i - offset]?.key ?? null);
  }

  const typeOf = new Map(columns.map((c) => [c.key, c.type ?? 'text']));
  const rows = body.map((cells) => {
    const values = {};
    cells.forEach((cell, i) => {
      const key = mapping[i];
      if (key && values[key] === undefined) values[key] = readCell(typeOf.get(key), cell);
    });
    columns.forEach((c) => { if (values[c.key] === undefined) values[c.key] = ''; });
    return values;
  });
  return { rows, header };
}

/** The paste spec of a priced BOQ: description · unit · qty · rate, with the words estimators head them with. */
export const BOQ_PASTE_COLUMNS = [
  { key: 'description', type: 'text', aliases: ['description', 'item', 'items', 'particulars', 'particular', 'work', 'details', 'descriptionofwork', 'descriptionofitem', 'itemofwork', 'scope', 'विवरण'] },
  { key: 'unit', type: 'text', aliases: ['unit', 'units', 'uom', 'एकाइ'] },
  { key: 'qty', type: 'number', aliases: ['qty', 'quantity', 'qnty', 'qtty', 'quantities', 'परिमाण'] },
  { key: 'rate', type: 'money', aliases: ['rate', 'rates', 'raters', 'ratenrs', 'raters.', 'unitrate', 'unitprice', 'price', 'दर'] },
];

const hasValue = (v) => v !== '' && v !== undefined && v !== null;

/**
 * Pasted BOQ text → BOQ rows: `{ rowType, description, unit, qty, rate }`. A row with text but no quantity and
 * no rate is a **SECTION** (its text the title) — an estimator's heading row. Rates stay rupees.
 * @param {string} text
 */
export function pastedBoqRows(text) {
  const { rows } = readPastedRows(text, BOQ_PASTE_COLUMNS);
  return rows
    .filter((v) => hasValue(v.description) || hasValue(v.qty) || hasValue(v.rate))
    .map((v) => {
      if (hasValue(v.description) && !hasValue(v.qty) && !hasValue(v.rate)) {
        return { rowType: 'SECTION', description: String(v.description).slice(0, 500) };
      }
      return {
        rowType: 'ITEM',
        description: String(v.description ?? '').slice(0, 500),
        unit: String(v.unit ?? '').slice(0, 20),
        qty: v.qty,
        rate: v.rate,
      };
    });
}
