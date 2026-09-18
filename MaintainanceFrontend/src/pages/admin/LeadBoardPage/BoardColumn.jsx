import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useDroppable } from '@dnd-kit/core';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { ArrowDownToLine, ArrowRight, ChevronRight, Inbox } from 'lucide-react';
import { useGetLeadsQuery } from '@/api/leadsApi';
import { Skeleton } from '@/components/ui/skeleton';
import { LEAD_STATUS_LABELS } from '@/config/constants';
import { columnTableHref, toneStyle } from '@/helpers/leadBoard';
import { cn } from '@/helpers/utils';
import { BoardCard } from './BoardCard';

export const COLUMN_LIMIT = 20;

/**
 * One status. Loads its own page of leads (newest first) and reports them up, so the
 * board can show a card in the column it is moving to before the server confirms.
 * `dropState`: 'allowed' | 'refused' | null while a card is being dragged.
 * `folded` shows a narrow strip — the name and the count — that still accepts a drop;
 * `onUnfold` opens every folded column. `share` is this stage's percentage of the board, and
 * `first` drops the chevron that joins a column to the one before it.
 */
export function BoardColumn({
  status, query, cards, onLoaded, dropState, canWrite, onMove, pending, folded, onUnfold, share, first,
}) {
  const reduced = useReducedMotion();
  const { data, isLoading, isError } = useGetLeadsQuery({ ...query, status, limit: COLUMN_LIMIT, sort: '-createdAt' });
  const { setNodeRef, isOver } = useDroppable({ id: status, data: { status }, disabled: dropState === 'refused' });

  useEffect(() => { if (data) onLoaded(status, data.items, data.meta?.total ?? data.items.length); }, [data, status, onLoaded]);

  const total = data?.meta?.total ?? 0;
  const more = Math.max(0, total - (data?.items?.length ?? 0));
  const href = columnTableHref(query, status);
  const label = LEAD_STATUS_LABELS[status];
  const allowed = dropState === 'allowed';
  const target = allowed && isOver;

  const dot = <span aria-hidden className="h-2.5 w-2.5 shrink-0 rounded-full bg-[hsl(var(--tone))] ring-4 ring-[hsl(var(--tone)/0.18)]" />;
  const count = (
    <span
      className="rounded-full bg-[hsl(var(--tone)/0.14)] px-2 py-0.5 text-xs font-semibold tabular-nums text-foreground"
      aria-label={`${total} leads`}
    >
      {isLoading ? '…' : total}
    </span>
  );

  if (folded) {
    return (
      <section
        ref={setNodeRef}
        style={toneStyle(status)}
        aria-labelledby={`col-${status}`}
        className={cn(
          'flex w-14 shrink-0 flex-col items-center gap-3 bg-[hsl(var(--tone)/0.06)] px-1 py-4 transition-all duration-200 motion-reduce:transition-none',
          allowed && 'w-44 px-2',
          dropState === 'refused' && 'opacity-40 saturate-50',
        )}
        data-drop={dropState ?? undefined}
      >
        {dot}
        {count}
        <button
          type="button"
          onClick={onUnfold}
          className="rounded-md px-1 py-2 text-sm font-semibold text-muted-foreground [writing-mode:vertical-rl] hover:bg-[hsl(var(--tone)/0.12)] hover:text-foreground"
          aria-label={`Show the ${label} column`}
        >
          <span id={`col-${status}`}>{label}</span>
        </button>
        {allowed ? (
          <div
            className={cn(
              'flex w-full flex-1 flex-col items-center justify-center gap-1 rounded-xl border-2 border-dotted border-[hsl(var(--tone)/0.55)] p-2 text-center text-xs font-medium text-[hsl(var(--tone))] transition-colors',
              target && 'border-[hsl(var(--tone))] bg-[hsl(var(--tone)/0.14)]',
            )}
          >
            <ArrowDownToLine className="h-4 w-4" aria-hidden /> Drop here
          </div>
        ) : null}
      </section>
    );
  }

  return (
    <section
      ref={setNodeRef}
      style={toneStyle(status)}
      aria-labelledby={`col-${status}`}
      className={cn(
        'relative flex min-w-[18rem] flex-1 shrink-0 flex-col bg-[hsl(var(--tone)/0.05)] transition-[opacity,filter,background-color] duration-200 motion-reduce:transition-none',
        target && 'bg-[hsl(var(--tone)/0.1)]',
        dropState === 'refused' && 'opacity-40 saturate-50',
      )}
      data-drop={dropState ?? undefined}
    >
      <span aria-hidden className="absolute inset-x-0 top-0 h-1 bg-[hsl(var(--tone))]" />
      {first ? null : (
        <span
          aria-hidden
          className="absolute -left-[13px] top-5 z-10 flex h-6 w-6 items-center justify-center rounded-full border bg-card text-muted-foreground shadow-[var(--elevation-1)]"
        >
          <ChevronRight className="h-3.5 w-3.5" />
        </span>
      )}
      <header className="flex items-center gap-2.5 bg-gradient-to-b from-[hsl(var(--tone)/0.12)] to-transparent px-4 pb-3 pt-4">
        {dot}
        <div className="min-w-0">
          <h2 id={`col-${status}`} className="truncate text-sm font-semibold tracking-tight">{label}</h2>
          {share != null ? <p className="text-[11px] tabular-nums text-muted-foreground">{share}% of the board</p> : null}
        </div>
        <span className="ml-auto">{count}</span>
      </header>

      <div
        className={cn(
          'mx-2 mb-2 flex max-h-[calc(100dvh-17rem)] min-h-40 flex-1 flex-col gap-2.5 overflow-y-auto rounded-xl p-1.5 [scrollbar-width:thin]',
          'outline-2 outline-offset-0 transition-[outline-color,background-color] duration-200 motion-reduce:transition-none',
          allowed ? 'outline-dotted outline-[hsl(var(--tone)/0.55)]' : 'outline-none',
          target && 'bg-[hsl(var(--tone)/0.08)] outline-[hsl(var(--tone))]',
        )}
      >
        {allowed ? (
          <p className={cn(
            'flex items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-medium text-[hsl(var(--tone))] transition-colors',
            target && 'bg-[hsl(var(--tone)/0.14)]',
          )}
          >
            <ArrowDownToLine className="h-3.5 w-3.5" aria-hidden /> Drop to move to {label}
          </p>
        ) : null}
        {isLoading ? (
          <><Skeleton className="h-28 rounded-xl" /><Skeleton className="h-28 rounded-xl" /></>
        ) : isError ? (
          <p className="rounded-lg bg-destructive/10 p-3 text-xs text-destructive">Could not load this column.</p>
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
        {!isLoading && !isError && !cards.length && !allowed ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-1.5 rounded-xl border-2 border-dotted border-border py-8 text-xs text-muted-foreground">
            <Inbox className="h-5 w-5 opacity-60" aria-hidden />
            Nothing here
          </div>
        ) : null}
      </div>

      {more > 0 ? (
        <Link
          to={href}
          className="group mx-2 mb-3 inline-flex items-center justify-center gap-1 rounded-lg py-1.5 text-xs font-medium text-muted-foreground hover:bg-[hsl(var(--tone)/0.1)] hover:text-foreground"
        >
          +{more} more in the table
          <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none" aria-hidden />
        </Link>
      ) : null}
    </section>
  );
}
