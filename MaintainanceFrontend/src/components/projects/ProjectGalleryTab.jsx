import { useEffect, useState } from 'react';
import { useDispatch } from 'react-redux';
import { ArrowLeft, ArrowRight, GripVertical, ImagePlus, Trash2 } from 'lucide-react';
import { useReducedMotion } from 'framer-motion';
import {
  DndContext, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors,
} from '@dnd-kit/core';
import {
  SortableContext, arrayMove, rectSortingStrategy, sortableKeyboardCoordinates, useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  useAddProjectImageMutation, useRemoveProjectImageMutation, useReorderProjectImagesMutation,
} from '@/api/cmsApi';
import { useGetMediaQuery } from '@/api/mediaApi';
import { useConfirm } from '@/hooks/useConfirm';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/common/EmptyState';
import { MediaPicker } from '@/components/common/MediaPicker/MediaPicker';
import { MediaThumb } from '@/components/common/MediaPicker/MediaThumb';
import { toastError, toastSuccess } from '@/redux/slices/uiSlice';
import { cn } from '@/helpers/utils';

const messageOf = (err) => err?.data?.error?.message;

function GalleryImage({ image, index, count, busy, canWrite, onMove, onRemove }) {
  const {
    attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging,
  } = useSortable({ id: image.id, disabled: !canWrite || busy });
  const reduced = useReducedMotion();
  const { data: media } = useGetMediaQuery(image.mediaId);
  const name = `picture ${index + 1}`;
  const caption = image.caption || media?.caption;

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition: reduced ? undefined : transition }}
      className={cn('flex flex-col overflow-hidden rounded-lg border bg-background', isDragging && 'relative z-10 shadow-lift')}
    >
      <div className="relative aspect-[4/3]">
        <MediaThumb media={media} />
        <span className="absolute left-2 top-2 rounded-full bg-background/90 px-2 py-0.5 text-[11px] font-semibold tabular-nums shadow-sm">
          {index + 1}
        </span>
      </div>
      <p className="min-h-[2.25rem] px-2.5 pt-2 text-xs text-muted-foreground">
        {caption || <span className="italic">No caption — the site uses the project title as its description.</span>}
      </p>
      {canWrite ? (
        <div className="mt-auto flex items-center justify-between gap-1 border-t px-1 py-0.5">
          <button
            type="button"
            ref={setActivatorNodeRef}
            {...attributes}
            {...listeners}
            disabled={busy}
            aria-label={`Drag ${name}`}
            className="cursor-grab touch-none rounded-sm p-1 text-muted-foreground hover:text-foreground active:cursor-grabbing"
          >
            <GripVertical className="h-4 w-4" aria-hidden />
          </button>
          <div className="flex items-center">
            <Button type="button" variant="ghost" size="icon" className="h-7 w-7" disabled={busy || index === 0} onClick={() => onMove(index, index - 1)} aria-label={`Move ${name} earlier`}>
              <ArrowLeft aria-hidden />
            </Button>
            <Button type="button" variant="ghost" size="icon" className="h-7 w-7" disabled={busy || index === count - 1} onClick={() => onMove(index, index + 1)} aria-label={`Move ${name} later`}>
              <ArrowRight aria-hidden />
            </Button>
            <Button type="button" variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" disabled={busy} onClick={() => onRemove(image, index)} aria-label={`Remove ${name}`}>
              <Trash2 aria-hidden />
            </Button>
          </div>
        </div>
      ) : null}
    </li>
  );
}

/**
 * A project's photo gallery, on its own tab of the project's edit page. Unlike the form
 * beside it, every change here saves at once through the project image endpoints: add
 * from the media library (or upload), drag or Move earlier / later, remove. The order is
 * the order the case-study page shows them in.
 *
 * @param {{ record: object, canWrite: boolean }} props  the project, as the API returns it
 */
export function ProjectGalleryTab({ record, canWrite }) {
  const dispatch = useDispatch();
  const [confirm, confirmDialog] = useConfirm();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [order, setOrder] = useState(null);
  const [adding, setAdding] = useState(false);
  const [addImage] = useAddProjectImageMutation();
  const [reorder, { isLoading: reordering }] = useReorderProjectImagesMutation();
  const [removeImage, { isLoading: removing }] = useRemoveProjectImageMutation();

  // The refetched project replaces any optimistic order.
  useEffect(() => { setOrder(null); }, [record.images]);
  const images = order ?? record.images ?? [];
  const busy = adding || reordering || removing;

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const move = async (from, to) => {
    if (from === to || to < 0 || to >= images.length) return;
    const next = arrayMove(images, from, to);
    setOrder(next);
    try {
      await reorder({ projectId: record.id, items: next.map((img, i) => ({ id: img.id, sortOrder: i })) }).unwrap();
    } catch (err) {
      setOrder(null);
      dispatch(toastError('The new order was not saved', messageOf(err)));
    }
  };

  const onPick = async (ids, rows) => {
    const have = new Set(images.map((img) => img.mediaId));
    const fresh = ids.filter((id) => !have.has(id));
    if (!fresh.length) return;
    setAdding(true);
    let added = 0;
    try {
      for (const [i, mediaId] of fresh.entries()) {
        const row = rows.find((r) => r.id === mediaId);
        // One at a time, so the saved order is the order they were picked in.
        await addImage({
          projectId: record.id,
          mediaId,
          sortOrder: images.length + i,
          ...(row?.caption ? { caption: row.caption.slice(0, 300) } : {}),
        }).unwrap();
        added += 1;
      }
      dispatch(toastSuccess(added === 1 ? 'Picture added to the gallery' : `${added} pictures added to the gallery`));
    } catch (err) {
      dispatch(toastError(added ? `${added} added, then one failed` : 'Could not add the picture', messageOf(err)));
    } finally {
      setAdding(false);
    }
  };

  const onRemove = async (image, index) => {
    const ok = await confirm({
      title: `Remove picture ${index + 1} from this gallery?`,
      description: 'It leaves the project page at once. The file stays in the media library.',
      confirmLabel: 'Remove',
      destructive: true,
    });
    if (!ok) return;
    try {
      await removeImage({ projectId: record.id, imageId: image.id }).unwrap();
      dispatch(toastSuccess('Picture removed from the gallery'));
    } catch (err) {
      dispatch(toastError('Could not remove the picture', messageOf(err)));
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {images.length
            ? `${images.length} picture${images.length === 1 ? '' : 's'}, in the order the project page shows them. Changes save at once.`
            : 'Site photographs for the project page, in the order you add them.'}
        </p>
        {canWrite ? (
          <Button type="button" onClick={() => setPickerOpen(true)} loading={adding}>
            <ImagePlus aria-hidden /> Add pictures
          </Button>
        ) : null}
      </div>

      {images.length ? (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={({ active, over }) => {
            if (!over || active.id === over.id) return;
            const ids = images.map((img) => img.id);
            move(ids.indexOf(active.id), ids.indexOf(over.id));
          }}
          accessibility={{ container: typeof document === 'undefined' ? undefined : document.body }}
        >
          <SortableContext items={images.map((img) => img.id)} strategy={rectSortingStrategy}>
            <ul aria-label="Gallery pictures" className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {images.map((image, i) => (
                <GalleryImage
                  key={image.id} image={image} index={i} count={images.length}
                  busy={busy} canWrite={canWrite} onMove={move} onRemove={onRemove}
                />
              ))}
            </ul>
          </SortableContext>
        </DndContext>
      ) : (
        <EmptyState
          icon={ImagePlus}
          title="No pictures yet"
          description="Before, during and after photographs make the case. Add them from the media library or upload new ones."
          className="rounded-lg border border-dashed py-10"
        />
      )}

      <MediaPicker
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        multiple
        title="Add pictures to the gallery"
        onSelect={onPick}
      />
      {confirmDialog}
    </div>
  );
}
