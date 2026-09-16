import { Link } from 'react-router-dom';
import { ArrowDown, ArrowUp, GripVertical } from 'lucide-react';
import { useReducedMotion } from 'framer-motion';
import {
  DndContext, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors,
} from '@dnd-kit/core';
import {
  SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { homeSectionInfo } from '@/config/admin/homeSections';
import { cn } from '@/helpers/utils';

function SectionRow({ section, index, count, empty, disabled, onMove, onChange }) {
  const {
    attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging,
  } = useSortable({ id: section.key, disabled });
  const reduced = useReducedMotion();
  const info = homeSectionInfo(section.key);
  const limitId = `limit-${section.key}`;
  const limit = section.settings?.limit;

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition: reduced ? undefined : transition }}
      className={cn(
        'flex flex-col gap-3 rounded-lg border bg-background p-3 sm:flex-row sm:items-center',
        isDragging && 'relative z-10 shadow-lift',
        !section.isVisible && 'bg-muted/40',
      )}
    >
      <div className="flex items-center gap-0.5">
        <button
          type="button"
          ref={setActivatorNodeRef}
          {...attributes}
          {...listeners}
          disabled={disabled}
          aria-label={`Drag ${info.label}`}
          className="cursor-grab touch-none rounded-sm p-1 text-muted-foreground transition-colors hover:text-foreground active:cursor-grabbing disabled:cursor-not-allowed disabled:opacity-50"
        >
          <GripVertical className="h-4 w-4" aria-hidden />
        </button>
        <Button
          type="button" variant="ghost" size="icon" className="h-7 w-7"
          disabled={disabled || index === 0} onClick={() => onMove(index, index - 1)} aria-label={`Move ${info.label} up`}
        >
          <ArrowUp aria-hidden />
        </Button>
        <Button
          type="button" variant="ghost" size="icon" className="h-7 w-7"
          disabled={disabled || index === count - 1} onClick={() => onMove(index, index + 1)} aria-label={`Move ${info.label} down`}
        >
          <ArrowDown aria-hidden />
        </Button>
        <span className="ml-1 w-6 text-right font-mono text-xs tabular-nums text-muted-foreground">{index + 1}</span>
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2 font-medium">
          <p>{info.label}</p>
          {!section.isVisible ? <Badge variant="outline" className="text-[10px]">Hidden</Badge> : null}
          {section.isVisible && empty ? (
            <Badge variant="outline" className="surface-warning text-[10px]" title="The site skips a section with nothing in it">
              No content — not shown
            </Badge>
          ) : null}
        </div>
        <p className="text-xs text-muted-foreground">
          {info.shows}{' '}
          {info.manage ? <Link to={info.manage} className="font-medium text-primary underline-offset-2 hover:underline">Edit content</Link> : null}
          {!info.manage && info.source ? <span>Content: {info.source}.</span> : null}
        </p>
      </div>

      <div className="flex items-center gap-4 sm:justify-end">
        {info.limit ? (
          <div className="flex items-center gap-2">
            <Label htmlFor={limitId} className="whitespace-nowrap text-xs text-muted-foreground">Show up to</Label>
            <Input
              id={limitId}
              type="number"
              inputMode="numeric"
              min={1}
              max={info.limit.max}
              step={1}
              disabled={disabled}
              value={limit ?? ''}
              placeholder={String(info.limit.default)}
              onChange={(e) => {
                const raw = e.target.value;
                const { limit: _drop, ...rest } = section.settings ?? {};
                onChange({ settings: raw === '' ? rest : { ...rest, limit: Number(raw) } });
              }}
              className="h-8 w-20"
            />
          </div>
        ) : null}
        <div className="flex items-center gap-2">
          <Switch
            checked={section.isVisible}
            disabled={disabled}
            onCheckedChange={(isVisible) => onChange({ isVisible })}
            aria-label={`Show ${info.label} on the home page`}
          />
          <span className="w-6 text-xs text-muted-foreground" aria-hidden>{section.isVisible ? 'On' : 'Off'}</span>
        </div>
      </div>
    </li>
  );
}

/**
 * The composer's section list: drag by the handle (pointer, or Space and the arrow keys,
 * which dnd-kit announces), or use Move up / Move down. Visibility and the item limit
 * change the draft only; the page saves.
 *
 * @param {object} props
 * @param {{ key: string, isVisible: boolean, settings?: object }[]} props.sections  in draft order
 * @param {Set<string>} props.emptyKeys   visible sections the site currently skips for having no content
 * @param {boolean} [props.disabled]
 * @param {(from: number, to: number) => void} props.onMove
 * @param {(key: string, patch: object) => void} props.onChange
 */
export function HomeSectionList({ sections, emptyKeys, disabled, onMove, onChange }) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const ids = sections.map((s) => s.key);

  const onDragEnd = ({ active, over }) => {
    if (!over || active.id === over.id) return;
    onMove(ids.indexOf(active.id), ids.indexOf(over.id));
  };

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
      <SortableContext items={ids} strategy={verticalListSortingStrategy}>
        <ol className="space-y-2" aria-label="Home page sections, top to bottom">
          {sections.map((section, i) => (
            <SectionRow
              key={section.key}
              section={section}
              index={i}
              count={sections.length}
              empty={emptyKeys.has(section.key)}
              disabled={disabled}
              onMove={onMove}
              onChange={(patch) => onChange(section.key, patch)}
            />
          ))}
        </ol>
      </SortableContext>
    </DndContext>
  );
}
