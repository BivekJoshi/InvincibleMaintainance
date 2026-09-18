import { TableCell } from '@/components/ui/table';
import { cn } from '@/helpers/utils';

const stop = (e) => e.stopPropagation();

/** Row padding per density; the horizontal padding stays put so columns don't jump. */
export const DENSITY_CELL = { compact: 'py-1.5', normal: '', comfortable: 'py-5' };

/**
 * Renders a column def's `header` or `cell`. Called as a plain function, not through
 * TanStack's `flexRender`: that mounts a function as a component, and our column defs
 * are rebuilt every render, so each cell would unmount and remount on every render.
 *
 * @param {unknown} slot a node, or `(context) => node`
 * @param {object} context
 */
export const renderSlot = (slot, context) => (typeof slot === 'function' ? slot(context) : slot);

/** Body cells in on-screen order: left-pinned, then the middle, then right-pinned. */
export const cellsOf = (row) => [...row.getLeftVisibleCells(), ...row.getCenterVisibleCells(), ...row.getRightVisibleCells()];

/**
 * Width, pinning offset and sticky classes for a column's `<th>` and `<td>`s.
 * A column only gets a fixed width once it needs one — a display column, a pinned
 * column (its neighbours' offsets add up its width) or one the viewer resized;
 * every other column keeps the table's natural width.
 *
 * @param {import('@tanstack/react-table').Column<object, unknown>} column
 * @param {import('@tanstack/react-table').Table<object>} table
 * @returns {{ style: object, className: string }}
 */
export function columnBox(column, table) {
  const { display } = column.columnDef.meta ?? {};
  const pinned = column.getIsPinned();
  const sized = Boolean(display || pinned || table.getState().columnSizing[column.id] != null);
  const width = column.getSize();
  return {
    style: {
      ...(sized ? { width, minWidth: width, maxWidth: width } : null),
      ...(pinned === 'left' ? { left: column.getStart('left') } : null),
      ...(pinned === 'right' ? { right: column.getAfter('right') } : null),
    },
    className: cn(
      sized && !display && 'overflow-hidden text-ellipsis',
      pinned && 'sticky z-10 bg-background',
      // The edge of the pinned block, as a pseudo-element: collapsed borders do not stick.
      pinned === 'left' && column.getIsLastColumn('left') && 'after:absolute after:inset-y-0 after:right-0 after:w-px after:bg-border',
      pinned === 'right' && column.getIsFirstColumn('right') && 'after:absolute after:inset-y-0 after:left-0 after:w-px after:bg-border',
    ),
  };
}

/**
 * One body cell. Display columns (expand, select) set `meta.stopPropagation`, so a
 * click on their control does not also trigger the row's `onRowClick`. A pinned cell
 * is opaque, so it takes the row's hover and selected tint as an inset shadow.
 *
 * @param {{ cell: import('@tanstack/react-table').Cell<object, unknown>, density?: string }} props
 */
export function CustomTableCell({ cell, density = 'normal' }) {
  const { column } = cell;
  const { className, stopPropagation } = column.columnDef.meta ?? {};
  const box = columnBox(column, cell.getContext().table);
  return (
    <TableCell
      data-column-id={column.id}
      style={box.style}
      className={cn(
        DENSITY_CELL[density],
        className,
        box.className,
        column.getIsPinned() && 'group-hover:shadow-[inset_0_0_0_9999px_hsl(var(--muted)/0.5)] group-data-[state=selected]:shadow-[inset_0_0_0_9999px_hsl(var(--muted)/0.6)]',
      )}
      onClick={stopPropagation ? stop : undefined}
    >
      {renderSlot(column.columnDef.cell, cell.getContext())}
    </TableCell>
  );
}
