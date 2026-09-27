/**
 * A grid row's field errors as react-hook-form reports them (`{ qty: { message } }`, or an array's error for a
 * nested list) → the messages an EditableGrid shows on its cells. `rename` moves an error onto the column
 * that shows it (a quotation row's measurement errors show on its Qty cell).
 *
 * @param {object|undefined} rowError
 * @param {Record<string, string>} [rename]
 * @returns {Record<string, string>|undefined}
 */
export function cellMessages(rowError, rename = {}) {
  if (!rowError || typeof rowError !== 'object') return undefined;
  const out = {};
  for (const [key, err] of Object.entries(rowError)) {
    if (key === 'ref' || key === 'type' || key === 'message') continue;
    const message = err?.message ?? (err && typeof err === 'object' ? (err.root?.message ?? 'Check this') : null);
    const target = rename[key] ?? key;
    if (message && !out[target]) out[target] = message;
  }
  return Object.keys(out).length ? out : undefined;
}
