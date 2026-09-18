import { useRef, useState } from 'react';
import {
  ArrowDown, ArrowLeft, ArrowRight, ArrowUp, ChevronsUpDown, EyeOff, MoreVertical, Pin, PinOff, RotateCcw, X,
} from 'lucide-react';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { TableHead } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { cn } from '@/helpers/utils';
import { columnBox, renderSlot } from './CustomTableCell';

const MIN_WIDTH = 60;
const KEY_STEP = 16;

/**
 * One header cell: the sort toggle, the column's actions menu (sort, pin, move, hide,
 * reset size) and a resize handle. Resizing starts from the column's rendered width,
 * not TanStack's default size, so a column never jumps when first dragged; the handle
 * is also a focusable separator that ArrowLeft / ArrowRight resize.
 *
 * @param {object} props
 * @param {import('@tanstack/react-table').Header<object, unknown>} props.header
 * @param {boolean} props.reordering        row reorder mode: no sorting, no column actions
 * @param {boolean} props.stickyHeader
 * @param {{ actions: boolean, resizing: boolean, pinning: boolean, ordering: boolean }} props.features
 * @param {(id: string, step: -1 | 1) => void} props.onMove
 * @param {{ left: boolean, right: boolean }} props.canMove
 */
export function CustomTableHead({ header, reordering, stickyHeader, features, onMove, canMove }) {
  const ref = useRef(null);
  const [resizing, setResizing] = useState(false);
  const { column } = header;
  const { table } = header.getContext();
  const { display, label, className } = column.columnDef.meta ?? {};
  const sorted = column.getIsSorted();
  const pinned = column.getIsPinned();
  const box = columnBox(column, table);
  const content = renderSlot(column.columnDef.header, header.getContext());
  const canResize = features.resizing && !display && !reordering;
  const isSized = table.getState().columnSizing[column.id] != null;

  const renderedWidth = () => Math.round(ref.current?.getBoundingClientRect().width || column.getSize());
  const setWidth = (width) => table.setColumnSizing((prev) => ({ ...prev, [column.id]: Math.max(MIN_WIDTH, Math.round(width)) }));

  const startResize = (e) => {
    if (e.button !== 0) return;
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = renderedWidth();
    setResizing(true);
    const move = (ev) => setWidth(startWidth + ev.clientX - startX);
    const end = () => {
      setResizing(false);
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', end);
      window.removeEventListener('pointercancel', end);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', end);
    window.addEventListener('pointercancel', end);
  };

  const resizeByKey = (e) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    e.preventDefault();
    setWidth(renderedWidth() + (e.key === 'ArrowRight' ? KEY_STEP : -KEY_STEP));
  };

  // A pinned column needs a fixed width for its neighbours' offsets; keep the one it has on screen.
  const pin = (side) => {
    if (!isSized) setWidth(renderedWidth());
    column.pin(side);
  };

  return (
    <TableHead
      ref={ref}
      style={box.style}
      aria-sort={sorted === 'asc' ? 'ascending' : sorted === 'desc' ? 'descending' : undefined}
      // Name the header by its column, so a cell is announced "Phone", not "Phone, Phone column actions".
      aria-label={!display && label ? label : undefined}
      className={cn(
        'group/head relative bg-background shadow-[inset_0_0_0_9999px_hsl(var(--muted)/0.4)]',
        className,
        box.className,
        stickyHeader && 'sticky top-0 z-20',
        pinned && (stickyHeader ? 'z-30' : 'z-20'),
      )}
    >
      <div className="inline-flex max-w-full items-center gap-1">
        {column.getCanSort() && !reordering ? (
          <button
            type="button"
            onClick={column.getToggleSortingHandler()}
            className="inline-flex min-w-0 items-center gap-1 transition-colors hover:text-foreground"
          >
            <span className="truncate">{content}</span>
            {sorted === 'asc' ? <ArrowUp className="h-3 w-3 shrink-0" />
              : sorted === 'desc' ? <ArrowDown className="h-3 w-3 shrink-0" />
                : <ChevronsUpDown className="h-3 w-3 shrink-0 opacity-40" />}
          </button>
        ) : content}
        {features.actions && !display && !reordering ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button" variant="ghost" size="icon"
                className="h-6 w-6 shrink-0 opacity-50 transition-opacity hover:opacity-100 focus-visible:opacity-100 group-hover/head:opacity-100 data-[state=open]:opacity-100"
                aria-label={`${label || column.id} column actions`}
              >
                <MoreVertical aria-hidden />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="min-w-44 normal-case tracking-normal">
              <DropdownMenuLabel className="truncate">{label || column.id}</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {column.getCanSort() ? (
                <>
                  <DropdownMenuItem disabled={sorted === 'asc'} onSelect={() => column.toggleSorting(false)}>
                    <ArrowUp aria-hidden /> Sort ascending
                  </DropdownMenuItem>
                  <DropdownMenuItem disabled={sorted === 'desc'} onSelect={() => column.toggleSorting(true)}>
                    <ArrowDown aria-hidden /> Sort descending
                  </DropdownMenuItem>
                  {sorted ? (
                    <DropdownMenuItem onSelect={() => column.clearSorting()}><X aria-hidden /> Clear sort</DropdownMenuItem>
                  ) : null}
                  <DropdownMenuSeparator />
                </>
              ) : null}
              {features.pinning ? (
                <>
                  {pinned !== 'left' ? <DropdownMenuItem onSelect={() => pin('left')}><Pin aria-hidden /> Pin to left</DropdownMenuItem> : null}
                  {pinned !== 'right' ? <DropdownMenuItem onSelect={() => pin('right')}><Pin className="rotate-90" aria-hidden /> Pin to right</DropdownMenuItem> : null}
                  {pinned ? <DropdownMenuItem onSelect={() => column.pin(false)}><PinOff aria-hidden /> Unpin</DropdownMenuItem> : null}
                </>
              ) : null}
              {features.ordering && !pinned ? (
                <>
                  <DropdownMenuItem disabled={!canMove.left} onSelect={() => onMove(column.id, -1)}>
                    <ArrowLeft aria-hidden /> Move left
                  </DropdownMenuItem>
                  <DropdownMenuItem disabled={!canMove.right} onSelect={() => onMove(column.id, 1)}>
                    <ArrowRight aria-hidden /> Move right
                  </DropdownMenuItem>
                </>
              ) : null}
              {column.getCanHide() || (features.resizing && isSized && !pinned) ? <DropdownMenuSeparator /> : null}
              {features.resizing && isSized && !pinned ? (
                <DropdownMenuItem onSelect={() => column.resetSize()}><RotateCcw aria-hidden /> Reset width</DropdownMenuItem>
              ) : null}
              {column.getCanHide() ? (
                <DropdownMenuItem onSelect={() => column.toggleVisibility(false)}><EyeOff aria-hidden /> Hide column</DropdownMenuItem>
              ) : null}
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null}
      </div>
      {canResize ? (
        // A separator with a value is focusable and operable (the WAI-ARIA window splitter).
        <div
          role="separator"
          aria-orientation="vertical"
          aria-label={`Resize ${label || column.id}`}
          aria-valuenow={isSized ? column.getSize() : undefined}
          tabIndex={0}
          onPointerDown={startResize}
          onKeyDown={resizeByKey}
          onDoubleClick={() => column.resetSize()}
          className={cn(
            'absolute right-0 top-0 z-10 h-full w-1.5 cursor-col-resize touch-none select-none bg-border opacity-0 transition-opacity',
            'hover:bg-primary/60 hover:opacity-100 focus-visible:bg-primary focus-visible:opacity-100 focus-visible:outline-none group-hover/head:opacity-100',
            resizing && 'bg-primary opacity-100',
          )}
        />
      ) : null}
    </TableHead>
  );
}
