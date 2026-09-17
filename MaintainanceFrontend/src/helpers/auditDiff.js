/**
 * An audit row's before/after as a list of changes, one per field — and one per nested
 * field, so a settings row (`{ 'contact.phones': ['…'] }`) or a JSON column (`skills`,
 * `translations`) shows what inside it moved rather than two blobs.
 *
 * Objects are walked key by key; arrays of objects index by position (`items.0.qty`); an
 * array of plain values is one value, because "the list changed" is what a reader wants.
 */

/** @typedef {'added'|'removed'|'changed'|'same'} DiffKind */
/** @typedef {{ path: string, kind: DiffKind, before: unknown, after: unknown }} DiffEntry */

const isObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const isObjectArray = (v) => Array.isArray(v) && v.some((x) => isObject(x) || Array.isArray(x));
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

function kindOf(before, after) {
  if (before === undefined && after !== undefined) return 'added';
  if (after === undefined && before !== undefined) return 'removed';
  return same(before, after) ? 'same' : 'changed';
}

function walk(before, after, prefix, out) {
  // The top level is always walked; below it, only a container that is one on both sides.
  const nestable = !prefix || (isObject(before) && isObject(after));
  const listable = Array.isArray(before) && Array.isArray(after) && (isObjectArray(before) || isObjectArray(after));

  if (!nestable && !listable) {
    out.push({ path: prefix, kind: kindOf(before, after), before, after });
    return;
  }
  const keys = listable
    ? [...Array(Math.max(before.length, after.length)).keys()].map(String)
    : [...new Set([...Object.keys(before ?? {}), ...Object.keys(after ?? {})])];
  if (prefix && !keys.length) {
    out.push({ path: prefix, kind: kindOf(before, after), before, after });
    return;
  }
  for (const key of keys) {
    walk(before?.[key], after?.[key], prefix ? `${prefix}.${key}` : key, out);
  }
}

/**
 * @param {object|null|undefined} before
 * @param {object|null|undefined} after
 * @param {{ includeSame?: boolean }} [opts]  unchanged fields are left out unless asked for
 * @returns {DiffEntry[]}
 */
export function diffEntries(before, after, { includeSame = false } = {}) {
  const out = [];
  walk(before ?? undefined, after ?? undefined, '', out);
  return includeSame ? out : out.filter((e) => e.kind !== 'same');
}

/** How each kind is marked: the theme's semantic surfaces, and a word for screen readers. */
export const DIFF_KIND_STYLES = {
  added: { label: 'Added', className: 'surface-success', sign: '+' },
  removed: { label: 'Removed', className: 'bg-destructive/10 text-destructive', sign: '−' },
  changed: { label: 'Changed', className: 'surface-warning', sign: '~' },
  same: { label: 'Unchanged', className: 'text-muted-foreground', sign: '' },
};
