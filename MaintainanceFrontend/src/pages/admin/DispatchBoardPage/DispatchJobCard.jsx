import { forwardRef } from 'react';
import { Link } from 'react-router-dom';
import { useDraggable } from '@dnd-kit/core';
import { AlertTriangle, CalendarClock, GripVertical, MapPin } from 'lucide-react';
import { PriorityBadge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { JOB_STATUS_LABELS, JOB_TYPE_LABELS } from '@/config/constants';
import { windowLabel } from '@/helpers/dispatchBoard';
import { cn } from '@/helpers/utils';

/** Statuses a card can still be moved from; work under way stays where it is. */
const MOVABLE = ['DRAFT', 'SCHEDULED', 'ASSIGNED', 'ON_HOLD'];

/** The card's face — shared by the card in place and the one under the pointer. */
export const JobCardFace = forwardRef(function JobCardFace({ job, handle, action, clash, compact, dragging, className, ...props }, ref) {
  return (
    <article
      ref={ref}
      className={cn(
        'rounded-md border bg-card p-2 text-xs shadow-sm',
        clash && 'border-destructive/60',
        dragging && 'opacity-40',
        className,
      )}
      {...props}
    >
      <div className="flex items-start gap-1">
        {handle}
        <div className="min-w-0 flex-1">
          <Link to={`/admin/jobs/${job.id}`} className="block truncate font-medium hover:underline">
            <span className="font-mono">{job.number}</span> {compact ? null : `· ${job.title}`}
          </Link>
          <p className="truncate text-muted-foreground">{job.customer?.name}</p>
          {job.site?.area && !compact ? (
            <p className="flex items-center gap-1 truncate text-muted-foreground"><MapPin className="h-3 w-3 shrink-0" aria-hidden />{job.site.area}</p>
          ) : null}
        </div>
      </div>
      <div className="mt-1 flex flex-wrap items-center gap-1">
        <span className="tabular-nums">{windowLabel(job)}</span>
        {job.status !== 'ASSIGNED' && job.status !== 'SCHEDULED' ? <span className="text-muted-foreground">· {JOB_STATUS_LABELS[job.status]}</span> : null}
        <PriorityBadge priority={job.priority} />
        {clash ? (
          <span className="inline-flex items-center gap-0.5 text-destructive"><AlertTriangle className="h-3 w-3" aria-hidden /> Clash</span>
        ) : null}
        {compact ? null : <span className="text-muted-foreground">{JOB_TYPE_LABELS[job.type]}</span>}
      </div>
      {action}
    </article>
  );
});

/**
 * A job on the board. Drag it by the handle — or use "Schedule…", which opens the same move as a
 * dialog (the keyboard and screen-reader path). Work already under way is not draggable.
 *
 * @param {{ job: object, laneId?: string|null, clash?: boolean, compact?: boolean, pending?: boolean,
 *   onSchedule: (job: object) => void }} props
 */
export function DispatchJobCard({ job, laneId = null, clash, compact, pending, onSchedule }) {
  const movable = MOVABLE.includes(job.status);
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `${laneId ?? 'queue'}:${job.id}`,
    data: { job, laneId },
    disabled: !movable || pending,
  });

  const handle = movable ? (
    <button
      type="button"
      className="-ml-1 cursor-grab touch-none rounded p-0.5 text-muted-foreground hover:bg-muted active:cursor-grabbing"
      aria-label={`Drag ${job.number}`}
      {...listeners}
      {...attributes}
    >
      <GripVertical className="h-3.5 w-3.5" aria-hidden />
    </button>
  ) : null;

  const action = movable ? (
    <Button
      type="button" size="sm" variant="ghost"
      className="mt-1 h-6 w-full justify-start px-1 text-xs"
      onClick={() => onSchedule(job)}
      aria-label={`Schedule ${job.number}`}
      disabled={pending}
    >
      <CalendarClock className="h-3 w-3" aria-hidden /> Schedule…
    </Button>
  ) : null;

  return (
    <JobCardFace
      ref={setNodeRef}
      job={job}
      handle={handle}
      action={action}
      clash={clash}
      compact={compact}
      dragging={isDragging}
      className={cn(pending && 'animate-pulse motion-reduce:animate-none')}
      aria-busy={pending || undefined}
    />
  );
}
