import { forwardRef } from 'react';
import { Link } from 'react-router-dom';
import { useDraggable } from '@dnd-kit/core';
import { Clock, GripVertical, MoreHorizontal, Phone } from 'lucide-react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { SlaChip } from '@/components/common/SlaChip';
import { PriorityBadge } from '@/components/ui/badge';
import { LEAD_STATUS_LABELS } from '@/config/constants';
import { nextStatuses } from '@/helpers/leadBoard';
import { initials, relativeTime } from '@/helpers/format';
import { cn } from '@/helpers/utils';

/**
 * The card's face — shared by the card in its column and the one under the pointer.
 * Its accent comes from the `--tone` its column (or the drag overlay) sets.
 */
export const BoardCardFace = forwardRef(function BoardCardFace({ lead, dragging, handle, menu, className, ...props }, ref) {
  const closed = ['WON', 'LOST'].includes(lead.status);
  return (
    <article
      ref={ref}
      className={cn(
        'group/card relative overflow-hidden rounded-xl border border-border/70 bg-card py-3 pl-4 pr-3 text-sm',
        'shadow-[var(--elevation-1)] transition-[transform,box-shadow,border-color] duration-200 motion-reduce:transition-none',
        'hover:-translate-y-0.5 hover:border-[hsl(var(--tone)/0.45)] hover:shadow-[var(--elevation-2)] motion-reduce:hover:translate-y-0',
        dragging && 'border-dashed border-[hsl(var(--tone)/0.6)] bg-transparent opacity-50 shadow-none hover:translate-y-0',
        className,
      )}
      {...props}
    >
      <span aria-hidden className="absolute inset-y-0 left-0 w-1 bg-[hsl(var(--tone))] opacity-80" />
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <Link to={`/admin/leads/${lead.id}`} className="block truncate font-semibold leading-tight hover:text-primary hover:underline">
            {lead.name}
          </Link>
          <p className="mt-0.5 truncate text-xs text-muted-foreground">
            {lead.service?.name ?? 'General enquiry'}{lead.area ? ` · ${lead.area}` : ''}
          </p>
        </div>
        <div className="-mr-1 -mt-1 flex shrink-0 items-center">
          {handle}
          {menu}
        </div>
      </div>
      {lead.phone ? (
        <a
          href={`tel:${lead.phone}`}
          className="mt-2 inline-flex items-center gap-1.5 rounded-md bg-muted/60 px-1.5 py-0.5 text-xs tabular-nums text-muted-foreground hover:bg-[hsl(var(--tone)/0.12)] hover:text-foreground"
          aria-label={`Call ${lead.name}`}
        >
          <Phone className="h-3 w-3" aria-hidden /> {lead.phone}
        </a>
      ) : null}
      {!closed || lead.priority !== 'NORMAL' ? (
        <div className="mt-2 flex flex-wrap items-center gap-1.5 empty:hidden">
          {!closed ? <SlaChip sla={lead.sla} /> : null}
          {lead.priority !== 'NORMAL' ? <PriorityBadge priority={lead.priority} /> : null}
        </div>
      ) : null}
      <div className="mt-3 flex items-center justify-between gap-2 border-t border-dotted border-border pt-2 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1" title={new Date(lead.createdAt).toLocaleString()}>
          <Clock className="h-3 w-3" aria-hidden /> {relativeTime(lead.createdAt)}
        </span>
        {lead.assignedTo ? (
          <Avatar className="h-6 w-6 ring-2 ring-card" title={lead.assignedTo.name}>
            <AvatarFallback className="bg-[hsl(var(--tone)/0.15)] text-[10px] font-semibold text-foreground">
              {initials(lead.assignedTo.name)}
            </AvatarFallback>
            <span className="sr-only">Owner {lead.assignedTo.name}</span>
          </Avatar>
        ) : <span className="italic">Unassigned</span>}
      </div>
    </article>
  );
});

/** Links, buttons and the menu keep their clicks; anywhere else on the card starts a drag. */
const startsOnControl = (event) => Boolean(event.target.closest('a, button, [role="menuitem"]'));

/**
 * A lead on the board. Grab it anywhere with the pointer; the grip is its keyboard
 * handle, and — for a screen reader too — its "Move to" menu offers the same allowed moves.
 */
export function BoardCard({ lead, canWrite, onMove, pending }) {
  const moves = nextStatuses(lead.status);
  const movable = canWrite && moves.length > 0;
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: lead.id,
    data: { lead },
    disabled: !movable || pending,
  });

  const handle = movable ? (
    <button
      type="button"
      className="cursor-grab touch-none rounded-md p-1 text-muted-foreground/60 opacity-0 transition-opacity hover:bg-muted hover:text-foreground focus-visible:opacity-100 active:cursor-grabbing group-hover/card:opacity-100 motion-reduce:transition-none"
      aria-label={`Drag ${lead.name}`}
      {...listeners}
      {...attributes}
    >
      <GripVertical className="h-4 w-4" aria-hidden />
    </button>
  ) : null;

  const menu = movable ? (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground" aria-label={`Move ${lead.name}`} disabled={pending}>
          <MoreHorizontal />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">Move to</DropdownMenuLabel>
        {moves.map((to) => (
          <DropdownMenuItem key={to} onSelect={() => onMove(lead, to)}>{LEAD_STATUS_LABELS[to]}</DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  ) : null;

  const onPointerDown = movable && !pending && listeners?.onPointerDown
    ? (event) => { if (!startsOnControl(event)) listeners.onPointerDown(event); }
    : undefined;

  return (
    <BoardCardFace
      ref={setNodeRef}
      lead={lead}
      dragging={isDragging}
      handle={handle}
      menu={menu}
      onPointerDown={onPointerDown}
      className={cn(
        movable && !pending && 'cursor-grab active:cursor-grabbing',
        pending && 'animate-pulse motion-reduce:animate-none',
      )}
      aria-busy={pending || undefined}
    />
  );
}
