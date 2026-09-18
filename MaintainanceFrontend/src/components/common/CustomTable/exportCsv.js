import { toKathmanduParts } from '@/helpers/format';

// A cell starting with one of these is read as a formula by Excel / Sheets (CSV injection).
const FORMULA_START = /^[=+\-@\t\r]/;

/** One CSV field: formula-safe, quoted when it holds a comma, quote or line break. */
export function csvField(value) {
  let text = value == null ? '' : String(value);
  if (FORMULA_START.test(text)) text = `'${text}`;
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** @param {unknown[][]} rows the header row first */
export const toCsv = (rows) => rows.map((row) => row.map(csvField).join(',')).join('\r\n');

/**
 * Downloads rows as `<name>-<Kathmandu date>.csv`. A UTF-8 byte-order mark goes first,
 * or Excel reads Nepali text as mojibake.
 *
 * @param {string} name
 * @param {unknown[][]} rows
 */
export function downloadCsv(name, rows) {
  const blob = new Blob([`\uFEFF${toCsv(rows)}`], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${name}-${toKathmanduParts(new Date()).date}.csv`;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
