import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useDroppable } from '@dnd-kit/core';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { useGetLeadsQuery } from '@/api/leadsApi';
import { Skeleton } from '@/components/ui/skeleton';
import { LEAD_STATUS_LABELS } from '@/config/constants';
import { columnTableHref } from '@/helpers/leadBoard';
import { cn } from '@/helpers/utils';
import { BoardCard } from './BoardCard';

export const COLUMN_LIMIT = 20;

/**
 * One status. Loads its own page of leads (newest first) and reports them up, so the
 * board can show a card in the column it is moving to before the server confirms.
 * `dropState`: 'allowed' | 'refused' | null while a card is being dragged.
 * `folded` shows a narrow strip — the name and the count — that still accepts a drop;
 * `onUnfold` opens every folded column.
 */
export function BoardColumn({ status, query, cards, onLoaded, dropState, canWrite, onMove, pending, folded, onUnfold }) {
  const reduced = useReducedMotion();
  const { data, isLoading, isError } = useGetLeadsQuery({ ...query, status, limit: COLUMN_LIMIT, sort: '-createdAt' });
  const { setNodeRef, isOver } = useDroppable({ id: status, data: { status }, disabled: dropState === 'refused' });

  useEffect(() => { if (data) onLoaded(status, data.items); }, [data, status, onLoaded]);

  const total = data?.meta?.total ?? 0;
  const more = Math.max(0, total - (data?.items?.length ?? 0));
  const href = columnTableHref(query, status);

  if (folded) {
    return (
      <section
        ref={setNodeRef}
        aria-labelledby={`col-${status}`}
        className={cn(
          'flex w-12 shrink-0 flex-col items-center gap-2 self-stretch rounded-xl border bg-muted/30 py-3 transition-colors motion-reduce:transition-none',
          dropState === 'allowed' && 'w-40 border-dashed border-primary/60',
          dropState === 'allowed' && isOver && 'bg-primary/10',
          dropState === 'refused' && 'opacity-50',
        )}
        data-drop={dropState ?? undefined}
      >
        <span className="rounded-full bg-background px-2 py-0.5 text-xs tabular-nums text-muted-foreground" aria-label={`${total} leads`}>
          {isLoading ? '…' : total}
        </span>
        <button
          type="button"
          onClick={onUnfold}
          className="rounded px-1 py-2 text-sm font-semibold text-muted-foreground [writing-mode:vertical-rl] hover:bg-muted hover:text-foreground"
          aria-label={`Show the ${LEAD_STATUS_LABELS[status]} column`}
        >
          <span id={`col-${status}`}>{LEAD_STATUS_LABELS[status]}</span>
        </button>
      </section>
    );
  }

  return (
    <section
      ref={setNodeRef}
      aria-labelledby={`col-${status}`}
      className={cn(
        'flex w-72 shrink-0 flex-col rounded-xl border bg-muted/30 transition-colors motion-reduce:transition-none',
        dropState === 'allowed' && 'border-dashed border-primary/60',
        dropState === 'allowed' && isOver && 'bg-primary/10',
        dropState === 'refused' && 'opacity-50',
      )}
      data-drop={dropState ?? undefined}
    >
      <header className="flex items-center justify-between gap-2 border-b px-3 py-2">
        <h2 id={`col-${status}`} className="text-sm font-semibold">{LEAD_STATUS_LABELS[status]}</h2>
        <span className="rounded-full bg-background px-2 py-0.5 text-xs tabular-nums text-muted-foreground" aria-label={`${total} leads`}>
          {total}
        </span>
      </header>
      <div className="flex min-h-24 flex-1 flex-col gap-2 p-2">
        {isLoading ? (
          <><Skeleton className="h-24" /><Skeleton className="h-24" /></>
        ) : isError ? (
          <p className="p-2 text-xs text-destructive">Could not load this column.</p>
        ) : (
          <AnimatePresence initial={false}>
            {cards.map((lead) => (
              <motion.div
                key={lead.id}
                layout={!reduced}
                initial={reduced ? false : { opacity: 0, scale: 0.97 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={reduced ? { opacity: 0, transition: { duration: 0 } } : { opacity: 0, scale: 0.97 }}
                transition={{ duration: reduced ? 0 : 0.18 }}
              >
                <BoardCard lead={lead} canWrite={canWrite} onMove={onMove} pending={Boolean(pending[lead.id])} />
              </motion.div>
            ))}
          </AnimatePresence>
        )}
        {!isLoading && !cards.length ? <p className="p-2 text-center text-xs text-muted-foreground">Nothing here</p> : null}
      </div>
      {more > 0 ? (
        <Link to={href} className="border-t px-3 py-2 text-center text-xs font-medium text-primary hover:underline">
          +{more} more in the table
        </Link>
      ) : null}
    </section>
  );
}
