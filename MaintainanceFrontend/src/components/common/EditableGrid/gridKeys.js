/**
 * The EditableGrid's keyboard map (Phase L3), as data and two pure resolvers — one for a cell that is
 * selected, one for the cell being edited. The grid, its legend and its tests all read this.
 */

/** Row-level commands, the same whether a cell is being edited or not. */
function rowCommand(e) {
  const mod = e.ctrlKey || e.metaKey;
  if (mod && e.shiftKey && e.key === 'Enter') return 'addSection';
  if (mod && e.key === 'Enter') return 'addRow';
  if (mod && !e.shiftKey && (e.key === 'd' || e.key === 'D')) return 'duplicate';
  if (e.altKey && e.key === 'ArrowUp') return 'moveUp';
  if (e.altKey && e.key === 'ArrowDown') return 'moveDown';
  if ((e.ctrlKey && e.key === 'Delete') || (e.metaKey && e.key === 'Backspace')) return 'remove';
  if ((e.shiftKey && e.key === 'F10') || e.key === 'ContextMenu') return 'menu';
  return null;
}

/**
 * A key pressed on a selected cell (not being edited) → what the grid does.
 * @param {KeyboardEvent|{ key: string, ctrlKey?: boolean, metaKey?: boolean, altKey?: boolean, shiftKey?: boolean }} e
 * @returns {string|null}
 */
export function resolveCellKey(e) {
  const command = rowCommand(e);
  if (command) return command;
  const mod = e.ctrlKey || e.metaKey;
  if (mod && (e.key === 'z' || e.key === 'Z') && !e.shiftKey) return 'undo';
  if (mod && e.key === 'Home') return 'first';
  if (mod && e.key === 'End') return 'last';
  if (mod || e.altKey) return null;
  switch (e.key) {
    case 'ArrowUp': return 'up';
    case 'ArrowDown': return 'down';
    case 'ArrowLeft': return 'left';
    case 'ArrowRight': return 'right';
    case 'Home': return 'home';
    case 'End': return 'end';
    case 'Enter': case 'F2': return 'edit';
    case 'Tab': return e.shiftKey ? 'prev' : 'next';
    case 'Escape': return 'release';
    case 'Delete': case 'Backspace': return 'clear';
    case ' ': return 'toggle';
    case '/': return 'search';
    default: return e.key.length === 1 ? 'type' : null;
  }
}

/**
 * A key pressed in a cell's editor → `commit:<move>`, `cancel`, a row command, or null (the input keeps it).
 *
 * In **overwrite** mode (the edit began by typing over the cell) every arrow saves and moves, as in a
 * spreadsheet; in **edit** mode (Enter or F2) left and right move the caret.
 *
 * @param {KeyboardEvent|object} e
 * @param {'overwrite'|'edit'} mode
 * @returns {string|null}
 */
export function resolveEditorKey(e, mode) {
  const command = rowCommand(e);
  if (command && command !== 'menu') return command;
  if (e.ctrlKey || e.metaKey || e.altKey) return null;
  switch (e.key) {
    case 'Enter': return e.shiftKey ? 'commit:up' : 'commit:down';
    case 'Tab': return e.shiftKey ? 'commit:prev' : 'commit:next';
    case 'Escape': return 'cancel';
    case 'ArrowUp': return 'commit:up';
    case 'ArrowDown': return 'commit:down';
    case 'ArrowLeft': return mode === 'overwrite' ? 'commit:left' : null;
    case 'ArrowRight': return mode === 'overwrite' ? 'commit:right' : null;
    default: return null;
  }
}

/**
 * The legend under a grid: what each key does, for the commands this grid offers.
 * @param {{ sections?: boolean, search?: boolean, readOnly?: boolean, extra?: { keys: string, does: string }[] }} [opts]
 */
export function gridKeymap({ sections = false, search = false, readOnly = false, extra = [] } = {}) {
  const move = [
    { keys: '↑ ↓ ← →', does: 'Move between cells' },
    { keys: 'Home / End', does: 'First / last cell in the row' },
  ];
  if (readOnly) return [...move, ...extra.filter((x) => x.readOnly)];
  return [
    ...move,
    { keys: 'Enter / F2', does: 'Edit the cell — Enter again saves it and moves down' },
    { keys: 'Type', does: 'Overwrite the cell' },
    { keys: 'Tab / Shift+Tab', does: 'Save and move across — Tab after the last cell adds a row' },
    { keys: 'Esc', does: 'Cancel the edit; Esc then Tab leaves the grid' },
    { keys: 'Delete', does: 'Clear the cell' },
    { keys: 'Space', does: 'Tick or untick a yes/no cell' },
    { keys: 'Ctrl+Enter', does: 'Add a row below' },
    ...(sections ? [{ keys: 'Ctrl+Shift+Enter', does: 'Add a section below' }] : []),
    { keys: 'Ctrl+D', does: 'Duplicate the row' },
    { keys: 'Alt+↑ / Alt+↓', does: 'Move the row (the drag handle’s keyboard way)' },
    { keys: 'Ctrl+Delete', does: 'Remove the row' },
    { keys: 'Ctrl+Z', does: 'Undo the last change made in the grid' },
    ...(search ? [{ keys: '/', does: 'Search the rate library' }] : []),
    { keys: 'Ctrl+V', does: 'Paste rows copied from Excel' },
    { keys: 'Shift+F10', does: 'The row’s actions' },
    ...extra,
  ];
}
