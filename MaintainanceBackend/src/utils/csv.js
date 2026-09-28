import { rupeesText } from './money.js';
import { local } from './dates.js';

/**
 * CSV for the report downloads (Phase I). A download is never unbounded: at most `CSV_MAX_ROWS` rows, and the
 * caller says when it cut. A cell a spreadsheet would run as a formula (`=`, `+`, `-`, `@` at the start of a
 * text) is prefixed with `'`; numbers are written as numbers.
 */

export const CSV_MAX_ROWS = 10_000;

const FORMULA = /^[=+\-@\t\r]/;

/** A cell written as it is — an amount from rupeesText, which may start with a minus sign. */
class Raw {
  constructor(text) { this.text = text; }
}

function cell(value) {
  if (value === null || value === undefined) return '';
  if (value instanceof Raw) return value.text;
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : '';
  if (value instanceof Date) return local(value, 'YYYY-MM-DD HH:mm');
  const text = String(value);
  const safe = FORMULA.test(text) ? `'${text}` : text;
  return /[",\n\r]/.test(safe) || safe !== text ? `"${safe.replace(/"/g, '""')}"` : safe;
}

/**
 * Column helpers: `money` is paisa written as rupees (`1234.56`), `day` a Kathmandu date.
 * @typedef {{ header: string, value: (row: object) => unknown, type?: 'money'|'day' }} CsvColumn
 */
export const money = (header, value) => ({ header, value, type: 'money' });
export const day = (header, value) => ({ header, value, type: 'day' });
export const text = (header, value) => ({ header, value });

/**
 * @param {CsvColumn[]} columns
 * @param {object[]} rows
 * @returns {{ csv: string, rows: number, truncated: boolean }}
 */
export function toCsv(columns, rows) {
  const kept = rows.slice(0, CSV_MAX_ROWS);
  const line = (values) => values.map(cell).join(',');
  const body = kept.map((row) => line(columns.map((c) => {
    const v = c.value(row);
    if (c.type === 'money') return v === null || v === undefined ? '' : new Raw(rupeesText(v));
    if (c.type === 'day') return v ? local(v, 'YYYY-MM-DD') : '';
    return v;
  })));
  return { csv: [line(columns.map((c) => c.header)), ...body].join('\r\n'), rows: kept.length, truncated: rows.length > kept.length };
}
