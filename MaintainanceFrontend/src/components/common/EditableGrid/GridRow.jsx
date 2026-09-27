import { memo } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useReducedMotion } from 'framer-motion';
import { Check, GripVertical, MoreHorizontal } from 'lucide-react';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/helpers/utils';
import { GridCellEditor } from './GridCellEditor';

const blank = (v) => v === undefined || v === null || v === '';

/** What a cell shows when it is not being edited. */
function display(column, value, row, ctx) {
  if (column.format) return column.format(value, row, ctx);
  const kind = typeof column.editor === 'function' ? column.editor(row) : column.editor;
  if (kind === 'boolean') {
    return value ? <Check className="h-4 w-4 text-primary" aria-label="Yes" /> : <span className="sr-only">No</span>;
  }
  return blank(value) ? '' : String(value);
}

const NO_DRAG = {};

/** A row that can be dragged by its handle (dnd-kit); the keyboard way is Alt+↑ / Alt+↓. */
function SortableGridRow(props) {
  const {
    attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging,
  } = useSortable({ id: props.rowKey });
  const reduced = useReducedMotion();
  return (
    <GridRowBody
      {...props}
      drag={{
        setNodeRef, setActivatorNodeRef, attributes, listeners, isDragging,
        style: { transform: CSS.Translate.toString(transform), transition: reduced ? undefined : transition },
      }}
    />
  );
}

/**
 * One grid row. Memoised: an edit re-renders the row it changed (and the one being edited), never all
 * five hundred. Every cell is a plain `gridcell`; the active one holds the roving tab stop, and only the
 * cell being edited renders an input. A read-only grid's rows are not sortable at all.
 */
export const GridRow = memo(function GridRow(props) {
  return props.sortable ? <SortableGridRow {...props} /> : <GridRowBody {...props} drag={NO_DRAG} />;
});

function GridRowBody({
  gridId, row, index, number, height, cells, columns, kind, activeCol, editing, meta, errors,
  readOnly, sortable, actionsCol, menuOpen, api, placeholderOf, drag,
}) {
  const {
    attributes, listeners, setNodeRef, setActivatorNodeRef, isDragging, style: dragStyle,
  } = drag;
  const ctx = { index, meta, number };
  const name = number ? `row ${number}` : `row ${index + 1}`;

  return (
    <div
      ref={setNodeRef}
      role="row"
      aria-rowindex={index + 2}
      data-row={index}
      data-kind={kind}
      style={{ height, ...dragStyle }}
      className={cn(
        'grid border-b bg-background [grid-template-columns:var(--grid-cols)]',
        kind === 'section' && 'bg-muted/60 font-semibold',
        kind === 'note' && 'italic text-muted-foreground',
        meta?.muted && 'text-muted-foreground',
        isDragging && 'relative z-10 shadow-lift',
      )}
    >
      {sortable ? (
        <div role="presentation" className="flex items-center justify-center" style={{ gridColumn: 1 }}>
          <button
            type="button"
            ref={setActivatorNodeRef}
            {...attributes}
            {...listeners}
            tabIndex={-1}
            aria-label={`Drag ${name} (or Alt+↑ / Alt+↓)`}
            className="cursor-grab touch-none rounded-sm p-0.5 text-muted-foreground/70 hover:text-foreground active:cursor-grabbing"
          >
            <GripVertical className="h-3.5 w-3.5" aria-hidden />
          </button>
        </div>
      ) : null}
      <div
        role="rowheader"
        className="flex items-center justify-end truncate px-1.5 font-mono text-xs text-muted-foreground"
        style={{ gridColumn: sortable ? 2 : 1 }}
      >
        {number ?? ''}
      </div>
      {cells.map(({ col, span, start }) => {
        const column = columns[col];
        const isActive = activeCol === col;
        const isEditing = editing && editing.col === col;
        const value = column.get ? column.get(row) : row?.[column.key];
        const error = errors?.[column.key];
        const cellId = `${gridId}-r${index}-c${col}`;
        const editable = !readOnly && api.isEditable(row, index, col);
        return (
          <div
            key={column.key}
            id={cellId}
            role="gridcell"
            data-cell={`${index}:${column.key}`}
            tabIndex={isActive && !isEditing ? 0 : -1}
            aria-selected={isActive || undefined}
            aria-readonly={!editable || undefined}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? `${cellId}-error` : undefined}
            title={error || undefined}
            style={{ gridColumn: `${start} / span ${span}` }}
            onMouseDown={(e) => api.pointerDown(e, index, col)}
            onClick={() => api.click(index, col)}
            onDoubleClick={() => api.startEdit(index, col, 'edit')}
            className={cn(
              'relative flex min-w-0 items-center border-r px-2 text-sm outline-none',
              column.align === 'right' && 'justify-end text-right tabular-nums',
              column.align === 'center' && 'justify-center',
              editable ? 'cursor-cell' : 'cursor-default',
              // The selection shows while the grid has focus; a grid you have left looks at rest.
              isActive && !isEditing && 'group-focus-within/grid:bg-primary/[0.06] group-focus-within/grid:ring-2 group-focus-within/grid:ring-inset group-focus-within/grid:ring-primary/70',
              error && 'bg-destructive/10 ring-1 ring-inset ring-destructive',
              isEditing && 'p-0.5',
              column.cellClassName?.(row),
            )}
          >
            {isEditing ? (
              <GridCellEditor
                column={column}
                row={row}
                index={index}
                editing={editing}
                api={api}
                id={`${cellId}-editor`}
                label={column.label ? column.label(row, index) : `${column.header}, ${name}`}
                placeholder={placeholderOf(column, row)}
              />
            ) : (
              <span className={cn('min-w-0', column.wrap ? 'w-full' : 'truncate')}>
                {display(column, value, row, ctx)}
                {isActive && blank(value) && placeholderOf(column, row) && editable ? (
                  <span className="text-muted-foreground/70">{placeholderOf(column, row)}</span>
                ) : null}
              </span>
            )}
            {error ? <span id={`${cellId}-error`} className="sr-only">{error}</span> : null}
          </div>
        );
      })}
      {actionsCol != null ? (
        <div
          role="gridcell"
          data-cell={`${index}:_actions`}
          tabIndex={activeCol === actionsCol ? 0 : -1}
          aria-selected={activeCol === actionsCol || undefined}
          style={{ gridColumn: -2 }}
          onMouseDown={(e) => api.pointerDown(e, index, actionsCol)}
          className={cn(
            'flex items-center justify-center outline-none',
            activeCol === actionsCol && 'group-focus-within/grid:bg-primary/[0.06] group-focus-within/grid:ring-2 group-focus-within/grid:ring-inset group-focus-within/grid:ring-primary/70',
          )}
        >
          {menuOpen ? (
            <DropdownMenu open onOpenChange={(open) => { if (!open) api.closeMenu(); }}>
              <DropdownMenuTrigger asChild>
                <button type="button" tabIndex={-1} aria-label={`Actions for ${name}`} className="rounded-sm p-1 text-muted-foreground hover:text-foreground">
                  <MoreHorizontal className="h-4 w-4" aria-hidden />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-60" onCloseAutoFocus={(e) => { e.preventDefault(); api.focusActive(); }}>
                {api.menuItems(index).map((item, i) => (item.separator ? (
                  <DropdownMenuSeparator key={`sep-${i}`} />
                ) : (
                  <DropdownMenuItem
                    key={item.label}
                    disabled={item.disabled}
                    onSelect={() => item.onSelect()}
                    className={item.destructive ? 'text-destructive focus:text-destructive' : undefined}
                  >
                    {item.icon ? <item.icon className="h-4 w-4" aria-hidden /> : null}
                    <span className="flex-1">{item.label}</span>
                    {item.shortcut ? <span className="ml-3 text-xs tracking-wide text-muted-foreground">{item.shortcut}</span> : null}
                  </DropdownMenuItem>
                )))}
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <button
              type="button"
              tabIndex={-1}
              aria-label={`Actions for ${name}`}
              onClick={() => api.openMenu(index)}
              className="rounded-sm p-1 text-muted-foreground hover:text-foreground"
            >
              <MoreHorizontal className="h-4 w-4" aria-hidden />
            </button>
          )}
        </div>
      ) : null}
    </div>
  );
}
