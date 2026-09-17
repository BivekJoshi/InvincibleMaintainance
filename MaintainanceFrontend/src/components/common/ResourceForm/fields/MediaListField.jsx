import { useState } from 'react';
import { useController } from 'react-hook-form';
import { ArrowLeft, ArrowRight, GripVertical, ImagePlus, X } from 'lucide-react';
import { useReducedMotion } from 'framer-motion';
import {
  DndContext, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors,
} from '@dnd-kit/core';
import {
  SortableContext, arrayMove, rectSortingStrategy, sortableKeyboardCoordinates, useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Button } from '@/components/ui/button';
import { MediaPicker } from '@/components/common/MediaPicker/MediaPicker';
import { MediaThumb } from '@/components/common/MediaPicker/MediaThumb';
import { useGetMediaQuery } from '@/api/mediaApi';
import { cn } from '@/helpers/utils';
import { FormField } from '../FormField';

function SortableImage({ id, index, count, onMove, onRemove, disabled }) {
  const {
    attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging,
  } = useSortable({ id, disabled });
  const reduced = useReducedMotion();
  const { data: media } = useGetMediaQuery(id);
  const name = `image ${index + 1}`;

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition: reduced ? undefined : transition }}
      className={cn('group relative overflow-hidden rounded-md border bg-background', isDragging && 'z-10 shadow-lift')}
    >
      <div className="aspect-[4/3]"><MediaThumb media={media} /></div>
      <div className="flex items-center justify-between gap-1 border-t px-1 py-0.5">
        <button
          type="button"
          ref={setActivatorNodeRef}
          {...attributes}
          {...listeners}
          disabled={disabled}
          aria-label={`Drag ${name}`}
          className="cursor-grab touch-none rounded-sm p-1 text-muted-foreground hover:text-foreground active:cursor-grabbing"
        >
          <GripVertical className="h-4 w-4" aria-hidden />
        </button>
        <div className="flex items-center">
          <Button type="button" variant="ghost" size="icon" className="h-7 w-7" disabled={disabled || index === 0} onClick={() => onMove(index, index - 1)} aria-label={`Move ${name} earlier`}>
            <ArrowLeft aria-hidden />
          </Button>
          <Button type="button" variant="ghost" size="icon" className="h-7 w-7" disabled={disabled || index === count - 1} onClick={() => onMove(index, index + 1)} aria-label={`Move ${name} later`}>
            <ArrowRight aria-hidden />
          </Button>
          <Button type="button" variant="ghost" size="icon" className="h-7 w-7" disabled={disabled} onClick={() => onRemove(index)} aria-label={`Remove ${name}`}>
            <X aria-hidden />
          </Button>
        </div>
      </div>
    </li>
  );
}

/**
 * `{ type: 'mediaList', maxItems? }` — an ordered gallery of media ids. Images drag
 * into order (pointer, or Space and the arrow keys on a handle), and every image
 * also has Move earlier / Move later buttons. Picking adds to the end and skips
 * images already in the gallery.
 */
export function MediaListField({ field, id }) {
  const { field: input, fieldState } = useController({ name: field.name });
  const [open, setOpen] = useState(false);
  const ids = Array.isArray(input.value) ? input.value : [];
  const full = field.maxItems != null && ids.length >= field.maxItems;

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const update = (next) => { input.onChange(next); input.onBlur(); };
  const move = (from, to) => { if (to >= 0 && to < ids.length) update(arrayMove(ids, from, to)); };

  return (
    <FormField id={id} field={field} error={fieldState.error} as="fieldset">
      {() => (
        <div className="space-y-3">
          {ids.length ? (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={({ active, over }) => { if (over && active.id !== over.id) move(ids.indexOf(active.id), ids.indexOf(over.id)); }}
            >
              <SortableContext items={ids} strategy={rectSortingStrategy}>
                <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                  {ids.map((mediaId, i) => (
                    <SortableImage
                      key={mediaId} id={mediaId} index={i} count={ids.length} disabled={field.disabled}
                      onMove={move} onRemove={(index) => update(ids.filter((_, j) => j !== index))}
                    />
                  ))}
                </ul>
              </SortableContext>
            </DndContext>
          ) : (
            <p className="text-sm text-muted-foreground">No images yet.</p>
          )}
          <Button ref={input.ref} type="button" variant="outline" size="sm" disabled={field.disabled || full} onClick={() => setOpen(true)}>
            <ImagePlus aria-hidden /> {field.addLabel ?? 'Add images'}
          </Button>
          <MediaPicker
            open={open}
            onOpenChange={setOpen}
            multiple
            onSelect={(picked) => {
              const next = [...ids, ...picked.filter((p) => !ids.includes(p))];
              update(field.maxItems != null ? next.slice(0, field.maxItems) : next);
            }}
          />
        </div>
      )}
    </FormField>
  );
}
