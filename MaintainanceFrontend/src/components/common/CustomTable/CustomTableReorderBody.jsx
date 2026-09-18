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
import { CustomTableCell, cellsOf } from './CustomTableCell';

function SortableRow({ row, index, count, onMove, rowLabel, density }) {
  const {
    attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging,
  } = useSortable({ id: row.id });
  const reduced = useReducedMotion();
  const name = rowLabel(row.original, index);

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
      {cellsOf(row).map((cell) => <CustomTableCell key={cell.id} cell={cell} density={density} />)}
    </tr>
  );
}

/**
 * The table body in reorder mode. Rows drag by their handle (pointer, or Space and
 * the arrow keys on the focused handle, which dnd-kit announces), and every row also
 * has plain Move up / Move down buttons for anyone who would rather not drag.
 *
 * @param {object} props
 * @param {import('@tanstack/react-table').Row<object>[]} props.rows  the table's row model, in display order
 * @param {(from: number, to: number) => void} props.onMove
 * @param {(row: object, index: number) => string} [props.rowLabel] how a row is named to a screen reader
 * @param {string} [props.density] row padding, as the table's
 */
export function CustomTableReorderBody({ rows, onMove, rowLabel = (_row, i) => `row ${i + 1}`, density }) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const ids = rows.map((row) => row.id);

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
            <SortableRow key={row.id} row={row} index={i} count={rows.length} onMove={onMove} rowLabel={rowLabel} density={density} />
          ))}
        </TableBody>
      </SortableContext>
    </DndContext>
  );
}
