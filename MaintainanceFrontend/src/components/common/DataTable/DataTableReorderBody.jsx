import { ArrowDown, ArrowUp, GripVertical } from 'lucide-react';
import { useReducedMotion } from 'framer-motion';
import {
  DndContext, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors,
} from '@dnd-kit/core';
import {
  SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { TableBody, TableCell } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { cn } from '@/helpers/utils';

function SortableRow({ id, row, index, count, columns, onMove, rowLabel }) {
  const {
    attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging,
  } = useSortable({ id });
  const reduced = useReducedMotion();
  const name = rowLabel(row, index);

  return (
    <tr
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition: reduced ? undefined : transition }}
      className={cn('border-b bg-background last:border-0', isDragging && 'relative z-10 shadow-lift')}
    >
      <TableCell className="w-[120px]">
        <div className="flex items-center gap-0.5">
          <button
            type="button"
            ref={setActivatorNodeRef}
            {...attributes}
            {...listeners}
            aria-label={`Drag ${name}`}
            className="cursor-grab touch-none rounded-sm p-1 text-muted-foreground transition-colors hover:text-foreground active:cursor-grabbing"
          >
            <GripVertical className="h-4 w-4" aria-hidden />
          </button>
          <Button
            type="button" variant="ghost" size="icon" className="h-7 w-7"
            disabled={index === 0} onClick={() => onMove(index, index - 1)} aria-label={`Move ${name} up`}
          >
            <ArrowUp aria-hidden />
          </Button>
          <Button
            type="button" variant="ghost" size="icon" className="h-7 w-7"
            disabled={index === count - 1} onClick={() => onMove(index, index + 1)} aria-label={`Move ${name} down`}
          >
            <ArrowDown aria-hidden />
          </Button>
        </div>
      </TableCell>
      {columns.map((col) => (
        <TableCell key={col.key} className={col.className}>
          {col.cell ? col.cell(row) : row[col.key] ?? '—'}
        </TableCell>
      ))}
    </tr>
  );
}

/**
 * The table body in reorder mode. Rows drag by their handle (pointer, or Space and
 * the arrow keys on the focused handle, which dnd-kit announces), and every row also
 * has plain Move up / Move down buttons for anyone who would rather not drag.
 *
 * @param {object} props
 * @param {object[]} props.rows
 * @param {(row: object) => string} props.getRowId
 * @param {object[]} props.columns
 * @param {(from: number, to: number) => void} props.onMove
 * @param {(row: object, index: number) => string} [props.rowLabel] how a row is named to a screen reader
 */
export function DataTableReorderBody({ rows, getRowId, columns, onMove, rowLabel = (_row, i) => `row ${i + 1}` }) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const ids = rows.map(getRowId);

  const onDragEnd = ({ active, over }) => {
    if (!over || active.id === over.id) return;
    onMove(ids.indexOf(active.id), ids.indexOf(over.id));
  };

  return (
    // dnd-kit's screen-reader announcer is a <div>; portalled to <body>, it is not an invalid child of <table>.
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={onDragEnd}
      accessibility={{ container: typeof document === 'undefined' ? undefined : document.body }}
    >
      <SortableContext items={ids} strategy={verticalListSortingStrategy}>
        <TableBody>
          {rows.map((row, i) => (
            <SortableRow
              key={ids[i]} id={ids[i]} row={row} index={i} count={rows.length}
              columns={columns} onMove={onMove} rowLabel={rowLabel}
            />
          ))}
        </TableBody>
      </SortableContext>
    </DndContext>
  );
}
