import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  DndContext, PointerSensor, closestCenter, useSensor, useSensors,
} from '@dnd-kit/core';
import { SortableContext, arrayMove, verticalListSortingStrategy } from '@dnd-kit/sortable';
import {
  ArrowDown, ArrowUp, Copy, Heading, Keyboard, Library, Plus, StickyNote, Trash2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { parseLength } from '@/helpers/measurements';
import { cn } from '@/helpers/utils';
import { GridRow } from './GridRow';
import { gridKeymap, resolveCellKey } from './gridKeys';
import { isMultiCell, parseGridNumber, readPastedRows } from './gridPaste';

const ROW_HEIGHT = 36;
const HEADER_HEIGHT = 36;
/** Above this many rows only the rows in view (plus a margin) are rendered. */
const WINDOW_FROM = 60;
const OVERSCAN = 480;
const NO_ROWS = [];

const blank = (v) => v === undefined || v === null || (typeof v === 'string' && v.trim() === '');
const editorOf = (column, row) => (typeof column.editor === 'function' ? column.editor(row) : column.editor);
const getValue = (column, row) => (column.get ? column.get(row) : row?.[column.key]);
const setValue = (column, row, value) => (column.set ? column.set(row, value) : { ...row, [column.key]: value });
const same = (a, b) => (Number.isNaN(a) && Number.isNaN(b)) || a === b || (blank(a) && blank(b));

/** A row object's key when the caller gives none: stable for the object, new for a copy. */
const autoKeys = new WeakMap();
let autoSeq = 0;
function autoKey(row) {
  if (!row || typeof row !== 'object') return String(row);
  let key = autoKeys.get(row);
  if (!key) {
    autoSeq += 1;
    key = `row-${autoSeq}`;
    autoKeys.set(row, key);
  }
  return key;
}

/** Text typed into a cell → the value kept, by the editor. A number that cannot be read stays as typed, for the schema to name. */
function parseText(column, kind, text, row) {
  if (column.parse) return column.parse(text, row);
  const t = String(text ?? '');
  if (kind === 'text' || !kind) return t;
  if (t.trim() === '') return '';
  const n = kind === 'length' ? parseLength(t) : parseGridNumber(t);
  return Number.isFinite(n) ? n : t.trim();
}

const toText = (column, row) => {
  const value = getValue(column, row);
  if (column.toText) return column.toText(value, row);
  return value === undefined || value === null ? '' : String(value);
};

const PASTE_TYPES = { number: 'number', money: 'money', length: 'length' };

/** Which cells a row shows: a column may be `hidden` for it, or `span` the columns after it (a section's title). */
function layoutOf(columns, row, offset) {
  const cells = [];
  for (let c = 0; c < columns.length; c += 1) {
    const column = columns[c];
    if (!column.hidden?.(row)) {
      const span = Math.max(1, Math.min(column.span?.(row) ?? 1, columns.length - c));
      cells.push({ col: c, span, start: offset + c + 1 });
      c += span - 1;
    }
  }
  return cells;
}

/**
 * **EditableGrid** — the admin kit's spreadsheet (Phase L3), on TanStack-style column specs and dnd-kit.
 * Pages never render it: they reach it through ResourceForm field types (`lineItems`, `grid`,
 * `measurements`, `recipe`, `paymentSchedule`), which is how CLAUDE.md rule 3 still holds.
 *
 * - One cell edits at a time. It saves on Enter (and moves down), Tab (and moves across — past the last
 *   cell it adds a row) and blur; Esc cancels. Typing on a selected cell overwrites it.
 * - Row commands: Ctrl+Enter adds a row, Ctrl+Shift+Enter a section, Ctrl+D duplicates, Alt+↑/↓ moves (the
 *   drag handle's keyboard way), Ctrl+Delete removes, Ctrl+Z undoes, `/` opens `search`, Shift+F10 the row's
 *   menu. The map is `gridKeys.js`, shown in the legend.
 * - Paste: a range copied from Excel becomes rows (`paste(text)` → rows, or the columns in order); one value
 *   goes into the selected cell.
 * - Above `WINDOW_FROM` rows only the rows in view are rendered; every row is memoised, so an edit
 *   re-renders the row it touched.
 *
 * @param {object} props
 * @param {object[]} props.columns  `{ key, header, width? | grow + minWidth, align?, editor?: 'text'|'number'|'money'|
 *   'length'|'select'|'boolean'|'custom'|(row) => …, get?, set?, parse?, toText?, format?(value, row, ctx), editable?(row, i),
 *   hidden?(row), span?(row), onActivate?(row, i), options?, suggestions?, renderEditor?, label?(row, i), placeholder?,
 *   maxLength?, clearValue?, pasteType? }` — pass a stable array
 * @param {object[]} props.rows
 * @param {(rows: object[]) => void} props.onChange
 * @param {(row: object) => string} [props.getRowKey]
 * @param {(string|null)[]} [props.numbers]      what the # column shows per row (A, A.1…)
 * @param {(row: object) => 'item'|'section'|'note'} [props.rowKind]
 * @param {(kind: 'item'|'section'|'note', after?: object) => object} [props.makeRow]  a new row (told the row it goes after)
 * @param {('item'|'section'|'note')[]} [props.kinds]   which kinds of row can be added
 * @param {(row: object) => object} [props.duplicateRow]
 * @param {(row: object) => boolean} [props.isBlankRow]  a blank row is replaced by a paste or a pick
 * @param {(text: string) => object[]} [props.paste]
 * @param {{ label?: string, focusKey?: string, render: (p: { open: boolean, onOpenChange: Function, onPick: Function, onClosed: Function }) => import('react').ReactNode }} [props.search]
 * @param {(row: object, index: number) => object[]} [props.rowActions]  `[{ label, icon?, onSelect, disabled?, readOnly? }]`
 * @param {{ match: (e: KeyboardEvent) => boolean, keys: string, does: string, run: (index: number) => void, readOnly?: boolean }[]} [props.shortcuts]
 * @param {(row: object, index: number) => object|undefined} [props.rowMeta]   the server's figures for a row, handed to `format`
 * @param {(index: number) => Record<string, string>|undefined} [props.rowErrors]
 * @param {(row: object) => number} [props.rowHeight]
 * @param {{ current: object }} [props.apiRef]  receives `{ focusCell(rowIndex, key), insert(afterIndex, rows) }` — a field's own
 *   buttons (the recipe's "Add labour") put a row where it belongs and select it
 */
export function EditableGrid({
  columns,
  rows = NO_ROWS,
  onChange,
  getRowKey = autoKey,
  numbers,
  rowKind,
  makeRow,
  kinds = ['item'],
  duplicateRow,
  isBlankRow,
  readOnly = false,
  ariaLabel,
  maxRows = 500,
  paste,
  search,
  rowActions,
  shortcuts = [],
  rowMeta,
  rowErrors,
  rowHeight,
  emptyText = 'No rows yet.',
  addLabels = {},
  maxHeight = '34rem',
  focusRef,
  apiRef,
  toolbarExtra,
  footer,
  className,
}) {
  const gridId = `grid-${useId().replace(/[^\w-]/g, '')}`;
  const sortable = !readOnly;
  const actionsCol = rowActions || !readOnly ? columns.length : null;
  const offset = (sortable ? 1 : 0) + 1;

  const [active, setActiveState] = useState({ row: 0, col: 0 });
  const [editing, setEditingState] = useState(null);
  const [menuRow, setMenuRow] = useState(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [announcement, setAnnouncement] = useState('');
  const [viewport, setViewport] = useState({ top: 0, height: 0 });
  const [legendOpen, setLegendOpen] = useState(false);

  const containerRef = useRef(null);
  const scrollRef = useRef(null);
  const rowsRef = useRef(rows);
  rowsRef.current = rows;
  const activeRef = useRef(active);
  const editingRef = useRef(editing);
  const wantFocus = useRef(false);
  const desiredCol = useRef(null);
  const released = useRef(false);
  const undoStack = useRef([]);
  const lastEmitted = useRef(rows);
  const raf = useRef(0);
  const props = useRef({});
  props.current = {
    columns, onChange, makeRow, kinds, duplicateRow, isBlankRow, readOnly, maxRows, paste, search, rowActions, shortcuts, rowErrors,
  };

  // A row's cells are worked out once per row object, so an untouched row keeps the same array (and stays memoised).
  const layoutCache = useMemo(() => ({ columns, offset, map: new WeakMap() }), [columns, offset]);
  const layout = (row) => {
    if (!row || typeof row !== 'object') return layoutOf(layoutCache.columns, row, layoutCache.offset);
    let cells = layoutCache.map.get(row);
    if (!cells) {
      cells = layoutOf(layoutCache.columns, row, layoutCache.offset);
      layoutCache.map.set(row, cells);
    }
    return cells;
  };

  // A change that did not come from the grid (a drawer, a reload) ends what Ctrl+Z can undo.
  useEffect(() => {
    if (rows !== lastEmitted.current) {
      undoStack.current = [];
      lastEmitted.current = rows;
    }
  }, [rows]);

  const heights = useMemo(() => rows.map((r) => (rowHeight ? rowHeight(r) : ROW_HEIGHT)), [rows, rowHeight]);
  const offsets = useMemo(() => {
    const out = [0];
    heights.forEach((h) => out.push(out[out.length - 1] + h));
    return out;
  }, [heights]);

  // ── the API the rows call (stable: every method reads the latest state through refs)
  const api = useMemo(() => {
    const setActive = (next) => {
      activeRef.current = next;
      setActiveState(next);
    };
    const setEditing = (next) => {
      editingRef.current = next;
      setEditingState(next);
    };
    const current = () => rowsRef.current;
    const cols = () => props.current.columns;

    const isEditable = (row, index, col) => {
      const p = props.current;
      if (p.readOnly || col === actionsCol || !row) return false;
      const column = p.columns[col];
      if (!column || !editorOf(column, row)) return false;
      return column.editable ? column.editable(row, index) !== false : true;
    };
    const cellsOf = (r) => {
      const row = current()[r];
      if (!row) return [];
      const list = layoutOf(cols(), row, offset).map((c) => c.col);
      if (actionsCol != null) list.push(actionsCol);
      return list;
    };
    const editableCols = (r) => cellsOf(r).filter((c) => isEditable(current()[r], r, c));
    const landOn = (r, want) => {
      const row = current()[r];
      if (!row) return 0;
      if (want === actionsCol && actionsCol != null) return actionsCol;
      const cells = layoutOf(cols(), row, offset);
      const hit = cells.find((c) => want >= c.col && want < c.col + c.span);
      if (hit) return hit.col;
      const before = cells.filter((c) => c.col <= want);
      return (before[before.length - 1] ?? cells[0])?.col ?? 0;
    };
    const firstCol = (r) => editableCols(r)[0] ?? cellsOf(r)[0] ?? 0;

    const go = (row, col, { keepDesired = false } = {}) => {
      setActive({ row, col });
      if (!keepDesired) desiredCol.current = col;
      wantFocus.current = true;
    };
    const announce = (text) => setAnnouncement(text);

    const emit = (next, { focus, message, record = true } = {}) => {
      if (record) {
        undoStack.current.push(current());
        if (undoStack.current.length > 50) undoStack.current.shift();
      }
      rowsRef.current = next;
      lastEmitted.current = next;
      props.current.onChange(next);
      if (focus) go(focus.row, focus.col ?? firstCol(focus.row));
      if (message) announce(message);
    };

    const canAdd = (count = 1) => {
      const p = props.current;
      if (p.readOnly || !p.makeRow) return false;
      if (current().length + count > p.maxRows) {
        announce(`The grid holds at most ${p.maxRows} rows.`);
        return false;
      }
      return true;
    };

    /** Rows in after `r` (or in place of row `r` when it is blank), focusing the first one. */
    const insert = (r, newRows, { focusKey, message, replaceBlank = true } = {}) => {
      const p = props.current;
      const list = current();
      const replace = replaceBlank && r >= 0 && list[r] && p.isBlankRow?.(list[r]);
      const at = replace ? r : Math.min(list.length, r + 1);
      const room = p.maxRows - list.length + (replace ? 1 : 0);
      const adding = newRows.slice(0, Math.max(0, room));
      if (!adding.length) {
        announce(`The grid holds at most ${p.maxRows} rows.`);
        return;
      }
      const next = [...list.slice(0, at), ...adding, ...list.slice(replace ? at + 1 : at)];
      const focusCol = focusKey ? cols().findIndex((c) => c.key === focusKey) : -1;
      emit(next, { message: message ?? (adding.length === 1 ? 'Row added.' : `${adding.length} rows added.`) });
      // Worked out on the new rows (emit has made them current).
      go(at, focusCol >= 0 ? landOn(at, focusCol) : firstCol(at));
    };

    const addRow = (r, kind) => {
      const p = props.current;
      if (!p.kinds.includes(kind) || !canAdd()) return;
      const row = p.makeRow(kind, current()[r]);
      if (row) insert(current().length ? r : -1, [row], { replaceBlank: false, message: kind === 'section' ? 'Section added.' : kind === 'note' ? 'Note added.' : 'Row added.' });
    };

    const navigate = (dir) => {
      const { row: r, col: c } = activeRef.current;
      const list = current();
      const n = list.length;
      if (!n) return false;
      const want = desiredCol.current ?? c;
      const cells = cellsOf(r);
      const i = cells.indexOf(c);
      switch (dir) {
        case 'up': if (r > 0) go(r - 1, landOn(r - 1, want), { keepDesired: true }); else go(r, c); return true;
        case 'down': if (r < n - 1) go(r + 1, landOn(r + 1, want), { keepDesired: true }); else go(r, c); return true;
        case 'left': go(r, cells[Math.max(0, i - 1)] ?? c); return true;
        case 'right': go(r, cells[Math.min(cells.length - 1, i + 1)] ?? c); return true;
        case 'home': go(r, cells[0] ?? c); return true;
        case 'end': go(r, cells[cells.length - 1] ?? c); return true;
        case 'first': go(0, landOn(0, want), { keepDesired: true }); return true;
        case 'last': go(n - 1, landOn(n - 1, want), { keepDesired: true }); return true;
        case 'next': {
          const after = editableCols(r).filter((x) => x > c);
          if (after.length) { go(r, after[0]); return true; }
          for (let rr = r + 1; rr < n; rr += 1) {
            const e = editableCols(rr);
            if (e.length) { go(rr, e[0]); return true; }
          }
          if (props.current.makeRow && !props.current.readOnly && canAdd()) { addRow(r, 'item'); return true; }
          return false;
        }
        case 'prev': {
          const before = editableCols(r).filter((x) => x < c);
          if (before.length) { go(r, before[before.length - 1]); return true; }
          for (let rr = r - 1; rr >= 0; rr -= 1) {
            const e = editableCols(rr);
            if (e.length) { go(rr, e[e.length - 1]); return true; }
          }
          return false;
        }
        default: return false;
      }
    };

    const startEdit = (r, c, mode, draft) => {
      const p = props.current;
      const row = current()[r];
      if (!row) return;
      if (c === actionsCol) { setActive({ row: r, col: c }); setMenuRow(r); return; }
      const column = p.columns[c];
      if (!isEditable(row, r, c)) {
        if (column?.onActivate && mode !== 'overwrite') column.onActivate(row, r);
        return;
      }
      const kind = editorOf(column, row);
      if (kind === 'boolean') { toggle(r, c); return; }
      setActive({ row: r, col: c });
      desiredCol.current = c;
      setEditing({ row: r, col: c, mode, draft: mode === 'overwrite' ? draft : toText(column, row) });
    };

    const writeCell = (r, c, value, { move } = {}) => {
      const list = current();
      const row = list[r];
      const column = cols()[c];
      if (!row || !column) return;
      if (!same(value, getValue(column, row))) {
        const next = list.slice();
        next[r] = setValue(column, row, value);
        emit(next);
      }
      if (move) navigate(move);
    };

    const toggle = (r, c) => {
      const row = current()[r];
      const column = cols()[c];
      if (!row || !column || !isEditable(row, r, c) || editorOf(column, row) !== 'boolean') return;
      writeCell(r, c, !getValue(column, row));
      go(r, c);
    };

    const commitEdit = (value, move, { raw = false } = {}) => {
      const ed = editingRef.current;
      if (!ed) return;
      setEditing(null);
      const row = current()[ed.row];
      const column = cols()[ed.col];
      if (row && column) {
        const next = raw ? value : parseText(column, editorOf(column, row), value, row);
        writeCell(ed.row, ed.col, next);
      }
      if (move) {
        if (!navigate(move)) go(ed.row, ed.col);
      }
    };

    const cancelEdit = () => {
      const ed = editingRef.current;
      setEditing(null);
      if (ed) go(ed.row, ed.col);
    };

    const run = (action, at) => {
      const p = props.current;
      const r = at ?? activeRef.current.row;
      const c = activeRef.current.col;
      const list = current();
      const row = list[r];
      switch (action) {
        case 'addRow': addRow(r, 'item'); return true;
        case 'addSection': addRow(r, 'section'); return true;
        case 'addNote': addRow(r, 'note'); return true;
        case 'duplicate': {
          if (!row || p.readOnly || !canAdd()) return true;
          const copy = p.duplicateRow ? p.duplicateRow(row) : { ...row };
          const next = [...list.slice(0, r + 1), copy, ...list.slice(r + 1)];
          emit(next, { focus: { row: r + 1, col: landOn(r, c) }, message: 'Row duplicated.' });
          return true;
        }
        case 'moveUp': case 'moveDown': {
          if (!row || p.readOnly) return true;
          const to = action === 'moveUp' ? r - 1 : r + 1;
          if (to < 0 || to >= list.length) return true;
          emit(arrayMove(list, r, to), { focus: { row: to, col: c }, message: `Row moved ${action === 'moveUp' ? 'up' : 'down'}.` });
          return true;
        }
        case 'remove': {
          if (!row || p.readOnly) return true;
          const next = list.filter((_, i) => i !== r);
          const target = Math.min(r, next.length - 1);
          emit(next, { message: 'Row removed. Ctrl+Z brings it back.' });
          if (target >= 0) go(target, landOn(target, c));
          else { setActive({ row: 0, col: 0 }); wantFocus.current = true; }
          return true;
        }
        case 'undo': {
          const prev = undoStack.current.pop();
          if (prev) {
            rowsRef.current = prev;
            lastEmitted.current = prev;
            p.onChange(prev);
            announce('Undone.');
            const target = Math.min(r, prev.length - 1);
            if (target >= 0) go(target, c);
          }
          return true;
        }
        case 'menu': if (actionsCol != null && row) { setActive({ row: r, col: actionsCol }); setMenuRow(r); } return true;
        case 'search': if (p.search && !p.readOnly) setSearchOpen(true); return Boolean(p.search);
        default: return false;
      }
    };

    return {
      isEditable, startEdit, commitEdit, cancelEdit, run, navigate, insert, addRow, toggle, writeCell, go, firstCol,
      landOn, editableCols, announce, emit,
      pointerDown: (e, r, c) => {
        if (e.button !== 0) return;
        const ed = editingRef.current;
        if (ed && ed.row === r && ed.col === c) return;
        setActive({ row: r, col: c });
        desiredCol.current = c;
        released.current = false;
      },
      click: (r, c) => {
        const row = current()[r];
        const column = cols()[c];
        if (row && column && editorOf(column, row) === 'boolean') toggle(r, c);
      },
      openMenu: (r) => { setActive({ row: r, col: actionsCol }); setMenuRow(r); },
      closeMenu: () => setMenuRow(null),
      focusActive: () => { wantFocus.current = true; setActive({ ...activeRef.current }); },
      menuItems: (r) => {
        const p = props.current;
        const row = current()[r];
        if (!row) return [];
        const close = (fn) => () => { setMenuRow(null); fn(); };
        const custom = (p.rowActions?.(row, r) ?? [])
          .filter((a) => !p.readOnly || a.readOnly)
          .map((a) => ({ ...a, onSelect: close(a.onSelect) }));
        if (p.readOnly) return custom;
        const n = current().length;
        return [
          ...custom,
          ...(custom.length ? [{ separator: true }] : []),
          { label: 'Add a row below', icon: Plus, shortcut: 'Ctrl+Enter', onSelect: close(() => run('addRow', r)) },
          ...(p.kinds.includes('section') ? [{ label: 'Add a section below', icon: Heading, shortcut: 'Ctrl+Shift+Enter', onSelect: close(() => run('addSection', r)) }] : []),
          { label: 'Duplicate', icon: Copy, shortcut: 'Ctrl+D', onSelect: close(() => run('duplicate', r)) },
          { label: 'Move up', icon: ArrowUp, shortcut: 'Alt+↑', disabled: r === 0, onSelect: close(() => run('moveUp', r)) },
          { label: 'Move down', icon: ArrowDown, shortcut: 'Alt+↓', disabled: r >= n - 1, onSelect: close(() => run('moveDown', r)) },
          { separator: true },
          { label: 'Remove row', icon: Trash2, shortcut: 'Ctrl+Delete', destructive: true, onSelect: close(() => run('remove', r)) },
        ];
      },
    };
  }, [actionsCol, offset]);

  // Keep the selection on a row that exists.
  useEffect(() => {
    if (!rows.length) return;
    const { row, col } = activeRef.current;
    if (row >= rows.length) {
      const r = rows.length - 1;
      const next = { row: r, col: api.landOn(r, col) };
      activeRef.current = next;
      setActiveState(next);
    }
  }, [rows, api]);

  if (apiRef) {
    apiRef.current = {
      focusCell: (r, key) => {
        const c = columns.findIndex((col) => col.key === key);
        api.go(r, c >= 0 ? c : 0);
      },
      insert: (after, newRows, opts) => api.insert(after, newRows, { replaceBlank: false, ...opts }),
    };
  }

  // Hand the form a way to focus the grid (a failed save focuses its first bad cell).
  useEffect(() => {
    if (!focusRef) return;
    focusRef({
      focus: () => {
        const list = rowsRef.current;
        const errs = props.current.rowErrors;
        for (let r = 0; errs && r < list.length; r += 1) {
          const e = errs(r);
          const key = e && Object.keys(e)[0];
          if (key) {
            const c = props.current.columns.findIndex((col) => col.key === key);
            api.go(r, c >= 0 ? api.landOn(r, c) : api.firstCol(r));
            return;
          }
        }
        api.focusActive();
      },
    });
  }, [focusRef, api]);

  // Focus follows the selection after a keyboard move; a row outside the window is scrolled to first.
  // It runs after every render on purpose, and does nothing unless a move asked for focus.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useLayoutEffect(() => {
    if (!wantFocus.current) return;
    const { row, col } = active;
    const key = col === actionsCol ? '_actions' : columns[col]?.key;
    if (editing) { wantFocus.current = false; return; }
    const el = scrollRef.current?.querySelector(`[data-cell="${row}:${key}"]`);
    if (el) {
      wantFocus.current = false;
      el.focus({ preventScroll: true });
      el.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
      return;
    }
    const sc = scrollRef.current;
    if (sc && offsets[row] != null && rows.length > WINDOW_FROM) {
      sc.scrollTop = Math.max(0, offsets[row] - sc.clientHeight / 2);
      setViewport({ top: sc.scrollTop, height: sc.clientHeight });
    } else {
      wantFocus.current = false;
    }
  });

  // The visible window.
  const windowing = rows.length > WINDOW_FROM;
  useEffect(() => {
    const el = scrollRef.current;
    if (!el || !windowing) return undefined;
    const measure = () => setViewport({ top: el.scrollTop, height: el.clientHeight });
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [windowing]);
  const onScroll = () => {
    if (!windowing || raf.current) return;
    raf.current = requestAnimationFrame(() => {
      raf.current = 0;
      const el = scrollRef.current;
      if (el) setViewport({ top: el.scrollTop, height: el.clientHeight });
    });
  };
  useEffect(() => () => cancelAnimationFrame(raf.current), []);

  let start = 0;
  let end = rows.length - 1;
  if (windowing && viewport.height > 0) {
    const top = Math.max(0, viewport.top - HEADER_HEIGHT - OVERSCAN);
    const bottom = viewport.top + viewport.height + OVERSCAN;
    let lo = 0;
    let hi = rows.length - 1;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (offsets[mid + 1] > top) hi = mid; else lo = mid + 1;
    }
    start = lo;
    end = start;
    while (end < rows.length - 1 && offsets[end + 1] < bottom) end += 1;
  }
  if (editing) {
    start = Math.min(start, editing.row);
    end = Math.max(end, editing.row);
  }

  // ── keyboard and clipboard on the grid itself
  const onKeyDown = (e) => {
    const target = e.target;
    // Only this grid's own cells: a key from a drawer or a dialog (a portal) bubbles here through React too.
    if (!containerRef.current?.contains(target)) return;
    const onCell = target?.getAttribute?.('role') === 'gridcell' || target === containerRef.current;
    if (!onCell || editingRef.current) return;
    const list = rowsRef.current;
    const custom = shortcuts.find((s) => (!readOnly || s.readOnly) && s.match(e));
    if (custom && list.length) {
      e.preventDefault();
      custom.run(activeRef.current.row);
      return;
    }
    const action = resolveCellKey(e);
    if (!action) return;
    if (action !== 'next' && action !== 'prev') released.current = false;
    const { row: r, col: c } = activeRef.current;

    if (!list.length) {
      if (readOnly) return;
      if (action === 'addRow' || action === 'addSection' || action === 'search') {
        e.preventDefault();
        api.run(action, -1);
      } else if (action === 'type' && makeRow) {
        e.preventDefault();
        api.insert(-1, [makeRow('item')]);
        api.startEdit(0, api.firstCol(0), 'overwrite', e.key);
      }
      return;
    }

    switch (action) {
      case 'up': case 'down': case 'left': case 'right': case 'home': case 'end': case 'first': case 'last':
        e.preventDefault();
        api.navigate(action);
        return;
      case 'next': case 'prev':
        if (released.current) return;
        if (api.navigate(action)) e.preventDefault();
        return;
      case 'release':
        released.current = true;
        setAnnouncement('Press Tab to leave the grid.');
        return;
      case 'edit':
        e.preventDefault();
        api.startEdit(r, c, 'edit');
        return;
      case 'type':
        if (readOnly) return;
        e.preventDefault();
        api.startEdit(r, c, 'overwrite', e.key);
        return;
      case 'clear': {
        if (readOnly) return;
        e.preventDefault();
        const row = list[r];
        const column = columns[c];
        if (row && column && api.isEditable(row, r, c)) {
          api.writeCell(r, c, column.clearValue ?? (editorOf(column, row) === 'boolean' ? false : ''));
        }
        return;
      }
      case 'toggle':
        if (readOnly) return;
        e.preventDefault();
        api.toggle(r, c);
        return;
      default:
        if (readOnly && action !== 'menu') return;
        if (api.run(action)) e.preventDefault();
    }
  };

  const onPaste = (e) => {
    if (readOnly || !containerRef.current?.contains(e.target)) return;
    const text = e.clipboardData?.getData('text/plain') ?? '';
    if (!text) return;
    const multi = isMultiCell(text);
    if (editingRef.current && !multi) return; // into the input, as typed
    e.preventDefault();
    const list = rowsRef.current;
    const { row: r, col: c } = activeRef.current;
    if (!multi) {
      const row = list[r];
      const column = columns[c];
      if (row && column && api.isEditable(row, r, c) && editorOf(column, row) !== 'boolean') {
        api.writeCell(r, c, parseText(column, editorOf(column, row), text.trim(), row));
      }
      return;
    }
    if (editingRef.current) api.cancelEdit();
    let pasted;
    if (paste) pasted = paste(text);
    else {
      const specs = columns
        .filter((col) => editorOf(col, {}) && editorOf(col, {}) !== 'boolean' && editorOf(col, {}) !== 'custom')
        .map((col) => ({ key: col.key, type: col.pasteType ?? PASTE_TYPES[editorOf(col, {})] ?? 'text', aliases: [col.header] }));
      pasted = readPastedRows(text, specs).rows.map((values) => ({ ...(makeRow ? makeRow('item') : {}), ...values }));
    }
    if (!pasted?.length) return;
    api.insert(list.length ? r : -1, pasted, { message: `${pasted.length} ${pasted.length === 1 ? 'row' : 'rows'} pasted.` });
  };

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));
  const keys = useMemo(() => rows.map((row) => getRowKey(row)), [rows, getRowKey]);
  const onDragEnd = ({ active: dragged, over }) => {
    if (!over || dragged.id === over.id) return;
    const from = keys.indexOf(dragged.id);
    const to = keys.indexOf(over.id);
    if (from < 0 || to < 0) return;
    api.emit(arrayMove(rowsRef.current, from, to), { focus: { row: to, col: activeRef.current.col }, message: 'Row moved.' });
  };

  const template = [
    ...(sortable ? ['24px'] : []),
    '3.25rem',
    ...columns.map((c) => (c.grow ? `minmax(${c.minWidth ?? 160}px, ${c.grow}fr)` : `${c.width ?? 100}px`)),
    ...(actionsCol != null ? ['40px'] : []),
  ].join(' ');
  const minWidth = (sortable ? 24 : 0) + 52 + (actionsCol != null ? 40 : 0)
    + columns.reduce((t, c) => t + (c.grow ? (c.minWidth ?? 160) : (c.width ?? 100)), 0);

  const placeholderOf = (column, row) => (typeof column.placeholder === 'function' ? column.placeholder(row) : column.placeholder);
  const kindOf = (row) => (rowKind ? rowKind(row) : 'item');
  const keymap = gridKeymap({
    sections: kinds.includes('section'), search: Boolean(search), readOnly, extra: shortcuts.map(({ keys: k, does, readOnly: ro }) => ({ keys: k, does, readOnly: ro })),
  });
  const errorList = [];
  if (rowErrors) {
    for (let r = 0; r < rows.length && errorList.length < 5; r += 1) {
      const errs = rowErrors(r);
      if (errs) {
        Object.entries(errs).forEach(([key, message]) => {
          if (errorList.length < 5) errorList.push({ r, key, message });
        });
      }
    }
  }
  const columnHeader = (key) => columns.find((c) => c.key === key)?.header ?? key;

  const body = [];
  for (let i = start; i <= end && i < rows.length; i += 1) {
    const row = rows[i];
    const isActiveRow = active.row === i;
    body.push(
      <GridRow
        key={keys[i]}
        gridId={gridId}
        row={row}
        index={i}
        rowKey={keys[i]}
        number={numbers ? numbers[i] : String(i + 1)}
        height={heights[i]}
        cells={layout(row)}
        columns={columns}
        kind={kindOf(row)}
        activeCol={isActiveRow ? active.col : -1}
        editing={editing && editing.row === i ? editing : null}
        meta={rowMeta ? rowMeta(row, i) : undefined}
        errors={rowErrors ? rowErrors(i) : undefined}
        readOnly={readOnly}
        sortable={sortable}
        actionsCol={actionsCol}
        menuOpen={menuRow === i}
        api={api}
        placeholderOf={placeholderOf}
      />,
    );
  }

  // `addLabels.item: null` hides that button (a field with its own add buttons).
  const labelFor = (kind, fallback) => (kind in addLabels ? addLabels[kind] : fallback);
  const addButtons = readOnly ? [] : [
    { kind: 'item', label: labelFor('item', 'Add row'), icon: Plus },
    { kind: 'section', label: labelFor('section', 'Add section'), icon: Heading },
    { kind: 'note', label: labelFor('note', 'Add note'), icon: StickyNote },
  ].filter((b) => kinds.includes(b.kind) && b.label);

  return (
    <div className={cn('min-w-0 space-y-2', className)}>
      {!readOnly || toolbarExtra ? (
        <div className="flex flex-wrap items-center gap-2">
          {addButtons.map((b) => (
            <Button
              key={b.kind}
              type="button"
              variant="outline"
              size="sm"
              disabled={rows.length >= maxRows}
              onClick={() => api.run(b.kind === 'section' ? 'addSection' : b.kind === 'note' ? 'addNote' : 'addRow', rows.length - 1)}
            >
              <b.icon aria-hidden /> {b.label}
            </Button>
          ))}
          {search && !readOnly ? (
            <Button type="button" variant="outline" size="sm" onClick={() => setSearchOpen(true)}>
              <Library aria-hidden /> {search.label ?? 'From the library'} <kbd className="ml-1 rounded border px-1 text-[10px] text-muted-foreground">/</kbd>
            </Button>
          ) : null}
          {toolbarExtra}
        </div>
      ) : null}

      <div
        ref={containerRef}
        role="grid"
        aria-label={ariaLabel}
        aria-rowcount={rows.length + 1}
        aria-colcount={columns.length + 1 + (actionsCol != null ? 1 : 0)}
        aria-readonly={readOnly || undefined}
        aria-describedby={`${gridId}-hint`}
        tabIndex={rows.length ? -1 : 0}
        onKeyDown={onKeyDown}
        onPaste={onPaste}
        onBlur={(e) => {
          if (!containerRef.current?.contains(e.relatedTarget)) released.current = false;
        }}
        className="group/grid rounded-md border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        style={{ '--grid-cols': template }}
      >
        <div ref={scrollRef} onScroll={onScroll} className="relative overflow-auto" style={{ maxHeight }}>
          <div style={{ minWidth }}>
            <div role="rowgroup" className="sticky top-0 z-20">
              <div role="row" aria-rowindex={1} className="grid border-b bg-muted text-xs font-medium text-muted-foreground [grid-template-columns:var(--grid-cols)]" style={{ height: HEADER_HEIGHT }}>
                {sortable ? <div role="columnheader" aria-hidden className="border-r" /> : null}
                <div role="columnheader" className="flex items-center justify-end border-r px-1.5"><span aria-hidden>#</span><span className="sr-only">Number</span></div>
                {columns.map((c) => (
                  <div key={c.key} role="columnheader" className={cn('flex items-center border-r px-2', c.align === 'right' && 'justify-end text-right', c.align === 'center' && 'justify-center')}>
                    <span className="truncate">{c.header}</span>
                  </div>
                ))}
                {actionsCol != null ? <div role="columnheader"><span className="sr-only">Actions</span></div> : null}
              </div>
            </div>
            <div role="rowgroup">
              {rows.length && sortable ? (
                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd} accessibility={{ container: typeof document === 'undefined' ? undefined : document.body }}>
                  <SortableContext items={keys} strategy={verticalListSortingStrategy}>
                    {start > 0 ? <div aria-hidden style={{ height: offsets[start] }} /> : null}
                    {body}
                    {end < rows.length - 1 ? <div aria-hidden style={{ height: offsets[rows.length] - offsets[end + 1] }} /> : null}
                  </SortableContext>
                </DndContext>
              ) : rows.length ? (
                <>
                  {start > 0 ? <div aria-hidden style={{ height: offsets[start] }} /> : null}
                  {body}
                  {end < rows.length - 1 ? <div aria-hidden style={{ height: offsets[rows.length] - offsets[end + 1] }} /> : null}
                </>
              ) : (
                <div className="px-4 py-6 text-center text-sm text-muted-foreground">{emptyText}</div>
              )}
            </div>
          </div>
        </div>
      </div>

      {errorList.length ? (
        <ul className="space-y-0.5 text-xs font-medium text-destructive">
          {errorList.map(({ r, key, message }) => (
            <li key={`${r}:${key}`}>
              <button
                type="button"
                className="text-left underline-offset-2 hover:underline"
                onClick={() => {
                  const c = columns.findIndex((col) => col.key === key);
                  api.go(r, c >= 0 ? api.landOn(r, c) : api.firstCol(r));
                }}
              >
                Row {numbers?.[r] ?? r + 1} · {columnHeader(key)}: {message}
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 flex-1">{footer}</div>
        <Button type="button" variant="ghost" size="sm" className="h-7 text-xs text-muted-foreground" aria-expanded={legendOpen} aria-controls={legendOpen ? `${gridId}-help` : undefined} onClick={() => setLegendOpen((o) => !o)}>
          <Keyboard aria-hidden /> Keyboard
        </Button>
      </div>
      {legendOpen ? (
        <dl id={`${gridId}-help`} className="grid gap-x-4 gap-y-1 rounded-md border bg-muted/40 p-3 text-xs sm:grid-cols-2">
          {keymap.map((k) => (
            <div key={k.keys} className="flex gap-2">
              <dt className="w-36 shrink-0 font-mono text-foreground">{k.keys}</dt>
              <dd className="text-muted-foreground">{k.does}</dd>
            </div>
          ))}
        </dl>
      ) : null}

      <p id={`${gridId}-hint`} className="sr-only">
        {readOnly ? 'Arrow keys move between cells.' : 'Arrow keys move, Enter edits, typing overwrites. The Keyboard button lists every key.'}
      </p>
      <div aria-live="polite" className="sr-only">{announcement}</div>

      {search ? search.render({
        open: searchOpen,
        onOpenChange: setSearchOpen,
        // A modal dialog holds focus until it has closed; then the selected cell (or the row just added) takes it.
        onClosed: () => api.focusActive(),
        onPick: (picked) => {
          setSearchOpen(false);
          if (picked?.length) {
            const list = rowsRef.current;
            api.insert(list.length ? activeRef.current.row : -1, picked, { focusKey: search.focusKey, message: `${picked.length} ${picked.length === 1 ? 'row' : 'rows'} added from the library.` });
          }
        },
      }) : null}
    </div>
  );
}
