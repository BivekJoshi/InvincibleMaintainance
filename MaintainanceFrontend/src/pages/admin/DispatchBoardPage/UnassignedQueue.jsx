import { useState } from 'react';
import { Inbox, PartyPopper, Search, UserCheck } from 'lucide-react';
import { useGetUnassignedJobsQuery } from '@/api/jobsApi';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { cn } from '@/helpers/utils';
import { DispatchJobCard } from './DispatchJobCard';

const PAGE_SIZE = 10;

/**
 * Work nobody is on yet — an accepted quotation lands here as an unscheduled job — most urgent
 * first, paged by the API. Drag a card onto a technician's row, or press its "Schedule…". Below it,
 * jobs that have people but no time yet.
 */
export function UnassignedQueue({ unscheduledAssigned, onSchedule, pending }) {
  const [page, setPage] = useState(1);
  const [q, setQ] = useState('');
  const search = useDebouncedValue(q);
  const { data, isLoading, isFetching } = useGetUnassignedJobsQuery({ page, limit: PAGE_SIZE, ...(search ? { q: search } : {}) });
  const items = data?.items ?? [];
  const pages = data?.meta?.pages ?? 1;

  const total = data?.meta?.total ?? 0;

  return (
    <aside
      aria-labelledby="queue-title"
      className="flex flex-col overflow-hidden rounded-2xl border bg-card shadow-[var(--elevation-1)] xl:sticky xl:top-4 xl:max-h-[calc(100dvh-2rem)]"
    >
      <div className="space-y-3 border-b border-dotted bg-gradient-to-br from-warning/15 via-warning/5 to-transparent p-4">
        <div className="flex items-center justify-between gap-2">
          <h2 id="queue-title" className="flex items-center gap-2 text-sm font-semibold">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-warning/20 text-warning-foreground">
              <Inbox className="h-4 w-4" aria-hidden />
            </span>
            Unassigned
          </h2>
          <span
            className={cn(
              'rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums',
              total ? 'bg-warning/20 text-warning-foreground' : 'bg-success/15 text-success-foreground',
            )}
            aria-live="polite"
          >
            {total} waiting
          </span>
        </div>
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input
            value={q}
            onChange={(e) => { setQ(e.target.value); setPage(1); }}
            placeholder="Search number, title, customer…"
            aria-label="Search unassigned jobs"
            className="h-8 bg-background/80 pl-8 text-xs"
          />
        </div>
      </div>

      <div className="flex-1 space-y-2 overflow-y-auto p-3 [scrollbar-width:thin]" aria-busy={isFetching || undefined}>
        {isLoading ? <><Skeleton className="h-20 rounded-lg" /><Skeleton className="h-20 rounded-lg" /></> : null}
        {!isLoading && !items.length ? (
          <div className="flex flex-col items-center gap-1.5 rounded-xl border-2 border-dotted py-8 text-center text-xs text-muted-foreground">
            <PartyPopper className="h-5 w-5 text-success" aria-hidden />
            Nothing waiting.
          </div>
        ) : null}
        {items.map((job) => (
          <DispatchJobCard key={job.id} job={job} onSchedule={onSchedule} pending={pending[job.id]} />
        ))}
        {pages > 1 ? (
          <div className="flex items-center justify-between gap-2 pt-1 text-xs">
            <Button size="sm" variant="ghost" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Previous</Button>
            <span className="tabular-nums text-muted-foreground">{page} / {pages}</span>
            <Button size="sm" variant="ghost" disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>Next</Button>
          </div>
        ) : null}

        {unscheduledAssigned?.length ? (
          <div className="space-y-2 border-t border-dotted pt-3">
            <h3 className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
              <UserCheck className="h-3.5 w-3.5" aria-hidden /> Assigned, no time yet
              <span className="ml-auto rounded-full bg-muted px-1.5 tabular-nums">{unscheduledAssigned.length}</span>
            </h3>
            {unscheduledAssigned.map((job) => (
              <DispatchJobCard key={job.id} job={job} onSchedule={onSchedule} pending={pending[job.id]} />
            ))}
          </div>
        ) : null}
      </div>
    </aside>
  );
}
