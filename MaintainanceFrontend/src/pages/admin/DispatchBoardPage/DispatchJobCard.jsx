import { forwardRef } from 'react';
import { Link } from 'react-router-dom';
import { useDraggable } from '@dnd-kit/core';
import {
  AlertTriangle, CalendarClock, Clock, GripVertical, Hammer, MapPin, PlugZap, RefreshCw, ScanSearch, ShieldCheck, Wrench,
} from 'lucide-react';
import { PriorityBadge } from '@/components/ui/badge';
import { JOB_STATUS_LABELS, JOB_TYPE_LABELS } from '@/config/constants';
import { jobToneStyle, windowLabel } from '@/helpers/dispatchBoard';
import { cn } from '@/helpers/utils';

/** Statuses a card can still be moved from; work under way stays where it is. */
const MOVABLE = ['DRAFT', 'SCHEDULED', 'ASSIGNED', 'ON_HOLD'];

/** The icon for each kind of work. */
const TYPE_ICONS = {
  INSPECTION: ScanSearch,
  REPAIR: Wrench,
  INSTALLATION: PlugZap,
  RENOVATION: Hammer,
  AMC_VISIT: RefreshCw,
  WARRANTY: ShieldCheck,
};

/**
 * The card's face — shared by the card in place and the one under the pointer. Its stripe is
 * the job's status colour; a clash hatches it red.
 */
export const JobCardFace = forwardRef(function JobCardFace({ job, handle, action, clash, compact, dragging, className, style, ...props }, ref) {
  const TypeIcon = TYPE_ICONS[job.type] ?? Wrench;
  const quiet = job.status === 'ASSIGNED' || job.status === 'SCHEDULED';
  return (
    <article
      ref={ref}
      style={{ ...jobToneStyle(job.status), ...style }}
      className={cn(
        'group/job relative overflow-hidden rounded-lg border border-border/70 bg-card py-1.5 pl-2.5 pr-1.5 text-xs',
        'shadow-[var(--elevation-1)] transition-[box-shadow,border-color,transform] duration-200 motion-reduce:transition-none',
        'hover:border-[hsl(var(--tone)/0.5)] hover:shadow-[var(--elevation-2)]',
        clash && 'border-destructive/60 bg-[repeating-linear-gradient(135deg,hsl(var(--destructive)/0.06)_0_6px,transparent_6px_12px)]',
        dragging && 'border-dashed bg-transparent opacity-40 shadow-none',
        className,
      )}
      {...props}
    >
      <span aria-hidden className="absolute inset-y-0 left-0 w-1 bg-[hsl(var(--tone))]" />
      <div className="flex items-start gap-1.5">
        <span
          aria-hidden
          className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-[hsl(var(--tone)/0.14)] text-[hsl(var(--tone))]"
          title={JOB_TYPE_LABELS[job.type]}
        >
          <TypeIcon className="h-3 w-3" />
        </span>
        <div className="min-w-0 flex-1">
          <Link to={`/admin/jobs/${job.id}`} className="block truncate font-semibold hover:text-primary hover:underline">
            <span className="font-mono">{job.number}</span> {compact ? null : <span className="font-medium">· {job.title}</span>}
          </Link>
          <p className="truncate text-muted-foreground">{job.customer?.name}</p>
        </div>
        {handle}
      </div>
      <div className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-1">
        <span className="inline-flex items-center gap-1 rounded bg-muted/70 px-1 py-px font-medium tabular-nums">
          <Clock className="h-3 w-3 text-muted-foreground" aria-hidden /> {windowLabel(job)}
        </span>
        {quiet ? null : (
          <span className="inline-flex items-center gap-1 text-muted-foreground">
            <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-[hsl(var(--tone))]" /> {JOB_STATUS_LABELS[job.status]}
          </span>
        )}
        <PriorityBadge priority={job.priority} />
        {clash ? (
          <span className="inline-flex items-center gap-0.5 font-semibold text-destructive"><AlertTriangle className="h-3 w-3" aria-hidden /> Clash</span>
        ) : null}
      </div>
      {job.site?.area && !compact ? (
        <p className="mt-1 flex items-center gap-1 truncate text-muted-foreground"><MapPin className="h-3 w-3 shrink-0" aria-hidden />{job.site.area}</p>
      ) : null}
      {action}
    </article>
  );
});

/** Links and buttons keep their clicks; anywhere else on the card starts a drag. */
const startsOnControl = (event) => Boolean(event.target.closest('a, button'));

/**
 * A job on the board. Grab it anywhere with the pointer; the grip is its keyboard handle, and
 * "Schedule…" opens the same move as a dialog (the screen-reader path). Work already under way
 * is not draggable.
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
      className="-mr-0.5 cursor-grab touch-none rounded p-0.5 text-muted-foreground/60 transition-opacity hover:bg-muted hover:text-foreground active:cursor-grabbing motion-reduce:transition-none"
      aria-label={`Drag ${job.number}`}
      {...listeners}
      {...attributes}
    >
      <GripVertical className="h-3.5 w-3.5" aria-hidden />
    </button>
  ) : null;

  const action = movable ? (
    <button
      type="button"
      className="mt-1.5 inline-flex h-6 w-full items-center gap-1 rounded-md border border-dashed border-border px-1.5 text-[11px] font-medium text-muted-foreground transition-colors hover:border-[hsl(var(--tone)/0.6)] hover:bg-[hsl(var(--tone)/0.08)] hover:text-foreground disabled:opacity-50"
      onClick={() => onSchedule(job)}
      aria-label={`Schedule ${job.number}`}
      disabled={pending}
    >
      <CalendarClock className="h-3 w-3" aria-hidden /> Schedule…
    </button>
  ) : null;

  const onPointerDown = movable && !pending && listeners?.onPointerDown
    ? (event) => { if (!startsOnControl(event)) listeners.onPointerDown(event); }
    : undefined;

  return (
    <JobCardFace
      ref={setNodeRef}
      job={job}
      handle={handle}
      action={action}
      clash={clash}
      compact={compact}
      dragging={isDragging}
      onPointerDown={onPointerDown}
      className={cn(
        movable && !pending && 'cursor-grab active:cursor-grabbing',
        pending && 'animate-pulse motion-reduce:animate-none',
      )}
      aria-busy={pending || undefined}
    />
  );
}
