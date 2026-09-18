import { useEffect, useMemo, useState } from 'react';

export const DENSITIES = ['compact', 'normal', 'comfortable'];

const storageKeyOf = (key) => `table:${key}:layout`;

/** @param {{ key: string, hidden?: boolean }[]} columns */
const defaultLayout = (columns) => ({
  columnVisibility: Object.fromEntries(columns.filter((c) => c.hidden).map((c) => [c.key, false])),
  columnOrder: [],
  columnSizing: {},
  columnPinning: { left: [], right: [] },
  density: 'normal',
});

const read = (storageKey, defaults) => {
  if (!storageKey) return defaults;
  try {
    const stored = JSON.parse(localStorage.getItem(storageKeyOf(storageKey)) ?? 'null');
    if (!stored || typeof stored !== 'object') return defaults;
    return {
      ...defaults,
      ...stored,
      columnVisibility: { ...defaults.columnVisibility, ...stored.columnVisibility },
      columnPinning: { ...defaults.columnPinning, ...stored.columnPinning },
      density: DENSITIES.includes(stored.density) ? stored.density : defaults.density,
    };
  } catch {
    return defaults;
  }
};

const initial = (key, columns) => {
  const defaults = defaultLayout(columns);
  return { key, defaults, layout: read(key, defaults) };
};

/** TanStack hands setters either a value or an updater function. */
const apply = (updater, previous) => (typeof updater === 'function' ? updater(previous) : updater);

/**
 * The part of a table's state that is the viewer's own arrangement — hidden, ordered,
 * resized and pinned columns, and row density. With a `storageKey` it is remembered in
 * this browser (and read defensively: private mode or cleared storage just starts fresh).
 *
 * @param {string|undefined} storageKey
 * @param {{ key: string, hidden?: boolean }[]} columns the caller's data columns
 */
export function useCustomTableLayout(storageKey, columns) {
  // The defaults are the columns as declared when this table (this storageKey) first showed; a
  // caller's columns array is new every render. A new storageKey on the same instance — one
  // list page moving between resources — loads that table's own layout.
  const [state, setState] = useState(() => initial(storageKey, columns));
  let current = state;
  if (state.key !== storageKey) {
    current = initial(storageKey, columns);
    setState(current);
  }
  const { key, defaults, layout } = current;

  useEffect(() => {
    if (!key) return;
    try {
      localStorage.setItem(storageKeyOf(key), JSON.stringify(layout));
    } catch { /* blocked storage: the layout just isn't remembered */ }
  }, [key, layout]);

  const setters = useMemo(() => {
    const setterFor = (name) => (updater) => setState((prev) => ({
      ...prev, layout: { ...prev.layout, [name]: apply(updater, prev.layout[name]) },
    }));
    return {
      setColumnVisibility: setterFor('columnVisibility'),
      setColumnOrder: setterFor('columnOrder'),
      setColumnSizing: setterFor('columnSizing'),
      setColumnPinning: setterFor('columnPinning'),
      setDensity: setterFor('density'),
      resetLayout: () => setState((prev) => ({ ...prev, layout: prev.defaults })),
    };
  }, []);

  const isDefault = JSON.stringify(layout) === JSON.stringify(defaults);

  return { layout, isDefault, ...setters };
}
