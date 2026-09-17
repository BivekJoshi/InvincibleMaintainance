import { forwardRef } from 'react';
import { Link } from 'react-router-dom';
import { useDraggable } from '@dnd-kit/core';
import { GripVertical, MoreHorizontal } from 'lucide-react';
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

/** The card's face — shared by the card in its column and the one under the pointer. */
export const BoardCardFace = forwardRef(function BoardCardFace({ lead, dragging, handle, menu, className, ...props }, ref) {
  const closed = ['WON', 'LOST'].includes(lead.status);
  return (
    <article
      ref={ref}
      className={cn(
        'rounded-lg border bg-card p-3 text-sm shadow-sm',
        dragging && 'opacity-40',
        className,
      )}
      {...props}
    >
      <div className="flex items-start gap-2">
        {handle}
        <div className="min-w-0 flex-1">
          <Link to={`/admin/leads/${lead.id}`} className="block truncate font-medium hover:underline">{lead.name}</Link>
          <p className="truncate text-xs text-muted-foreground">
            {lead.service?.name ?? 'General enquiry'}{lead.area ? ` · ${lead.area}` : ''}
          </p>
        </div>
        {menu}
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        {!closed ? <SlaChip sla={lead.sla} /> : null}
        {lead.priority !== 'NORMAL' ? <PriorityBadge priority={lead.priority} /> : null}
      </div>
      <div className="mt-2 flex items-center justify-between gap-2 text-xs text-muted-foreground">
        <span title={new Date(lead.createdAt).toLocaleString()}>{relativeTime(lead.createdAt)}</span>
        {lead.assignedTo ? (
          <Avatar className="h-6 w-6" title={lead.assignedTo.name}>
            <AvatarFallback className="text-[10px]">{initials(lead.assignedTo.name)}</AvatarFallback>
            <span className="sr-only">Owner {lead.assignedTo.name}</span>
          </Avatar>
        ) : <span>Unassigned</span>}
      </div>
    </article>
  );
});

/**
 * A lead on the board. Drag it by the handle, or — for the keyboard and for a screen
 * reader — use its "Move to" menu, which offers the same allowed moves.
 */
export function BoardCard({ lead, canWrite, onMove, pending }) {
  const moves = nextStatuses(lead.status);
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: lead.id,
    data: { lead },
    disabled: !canWrite || !moves.length || pending,
  });

  const handle = canWrite && moves.length ? (
    <button
      type="button"
      className="-ml-1 mt-0.5 cursor-grab touch-none rounded p-0.5 text-muted-foreground hover:bg-muted active:cursor-grabbing"
      aria-label={`Drag ${lead.name}`}
      {...listeners}
      {...attributes}
    >
      <GripVertical className="h-4 w-4" aria-hidden />
    </button>
  ) : null;

  const menu = canWrite && moves.length ? (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="-mr-1 -mt-1 h-7 w-7" aria-label={`Move ${lead.name}`} disabled={pending}>
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

  return (
    <BoardCardFace
      ref={setNodeRef}
      lead={lead}
      dragging={isDragging}
      handle={handle}
      menu={menu}
      className={cn(pending && 'animate-pulse motion-reduce:animate-none')}
      aria-busy={pending || undefined}
    />
  );
}
