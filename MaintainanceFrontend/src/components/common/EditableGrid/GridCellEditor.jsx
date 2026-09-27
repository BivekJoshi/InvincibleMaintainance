import { useLayoutEffect, useRef, useState } from 'react';
import { Popover, PopoverAnchor, PopoverContent } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { cn } from '@/helpers/utils';
import { resolveEditorKey } from './gridKeys';

const INPUT_MODES = { number: 'decimal', money: 'decimal', length: 'text' };

/**
 * The one editor on screen — the grid renders it in the cell being edited and nowhere else, so a keystroke
 * re-renders this input, not the grid. It saves on Enter, Tab and blur (`api.commitEdit(text, move)`) and
 * cancels on Esc; a row command pressed mid-edit (Ctrl+Enter…) saves first, then runs.
 */
function TextEditor({ column, editing, api, id, label, placeholder }) {
  const [draft, setDraft] = useState(editing.draft ?? '');
  const done = useRef(false);
  const input = useRef(null);
  const listId = column.suggestions?.length ? `${id}-list` : undefined;

  useLayoutEffect(() => {
    const el = input.current;
    if (!el) return;
    el.focus({ preventScroll: true });
    const end = el.value.length;
    try { el.setSelectionRange(end, end); } catch { /* number-like inputs refuse a selection */ }
  }, []);

  const finish = (move) => {
    if (done.current) return;
    done.current = true;
    api.commitEdit(draft, move);
  };

  const onKeyDown = (e) => {
    const action = resolveEditorKey(e, editing.mode);
    if (!action) return;
    e.preventDefault();
    e.stopPropagation();
    if (action === 'cancel') {
      done.current = true;
      api.cancelEdit();
    } else if (action.startsWith('commit:')) {
      finish(action.slice(7));
    } else {
      finish(null);
      api.run(action);
    }
  };

  return (
    <>
      <input
        ref={input}
        id={id}
        aria-label={label}
        value={draft}
        placeholder={placeholder}
        maxLength={column.maxLength}
        inputMode={INPUT_MODES[column.editor] ?? 'text'}
        autoComplete="off"
        list={listId}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={onKeyDown}
        onBlur={() => finish(null)}
        className={cn(
          'h-full w-full min-w-0 rounded-sm bg-background px-2 text-sm outline-none ring-2 ring-ring',
          column.align === 'right' && 'text-right tabular-nums',
        )}
      />
      {listId ? (
        <datalist id={listId}>
          {column.suggestions.map((s) => <option key={s} value={s} />)}
        </datalist>
      ) : null}
    </>
  );
}

/**
 * A pick from a short fixed list (`options`): a searchable list anchored to the cell. Typing over the cell
 * starts the search with that letter; Enter picks and moves right; Esc leaves the value as it was.
 */
function SelectEditor({ column, row, editing, api, label }) {
  const [search, setSearch] = useState(editing.draft ?? '');
  const done = useRef(false);
  const options = (typeof column.options === 'function' ? column.options(row) : column.options) ?? [];

  const finish = (value, move) => {
    if (done.current) return;
    done.current = true;
    if (value === undefined) api.cancelEdit();
    else api.commitEdit(value, move, { raw: true });
  };

  return (
    <Popover open onOpenChange={(open) => { if (!open) finish(undefined); }}>
      <PopoverAnchor asChild><div className="h-full w-full rounded-sm ring-2 ring-ring" /></PopoverAnchor>
      <PopoverContent className="w-56 p-0" align="start" onCloseAutoFocus={(e) => e.preventDefault()}>
        <Command
          onKeyDown={(e) => {
            if (e.key === 'Tab') {
              e.preventDefault();
              finish(undefined);
            }
          }}
        >
          <CommandInput autoFocus value={search} onValueChange={setSearch} placeholder="Search…" aria-label={label} />
          <CommandList>
            <CommandEmpty>Nothing matches.</CommandEmpty>
            {options.map((o) => (
              <CommandItem key={o.value} value={o.label} onSelect={() => finish(o.value, 'right')}>
                {o.label}
              </CommandItem>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

/**
 * The editor for one cell, by its column's `editor`: text-like inputs (`text`, `number`, `money`, `length`),
 * a `select`, or the column's own `renderEditor` (`custom` — a record picker).
 */
export function GridCellEditor({ column, row, index, editing, api, id, label, placeholder }) {
  const kind = typeof column.editor === 'function' ? column.editor(row) : column.editor;
  if (kind === 'select') return <SelectEditor column={column} row={row} editing={editing} api={api} label={label} />;
  if (kind === 'custom') {
    return column.renderEditor({
      row,
      index,
      value: column.get ? column.get(row) : row?.[column.key],
      draft: editing.draft,
      id,
      label,
      commit: (value, move = 'right') => api.commitEdit(value, move, { raw: true }),
      cancel: () => api.cancelEdit(),
    });
  }
  return <TextEditor column={{ ...column, editor: kind }} editing={editing} api={api} id={id} label={label} placeholder={placeholder} />;
}
