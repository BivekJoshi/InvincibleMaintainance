import { useState } from 'react';
import { Inbox } from 'lucide-react';
import { useGetUnassignedJobsQuery } from '@/api/jobsApi';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
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

  return (
    <aside aria-labelledby="queue-title" className="space-y-3 rounded-lg border bg-muted/20 p-3">
      <div className="flex items-baseline justify-between gap-2">
        <h2 id="queue-title" className="flex items-center gap-2 text-sm font-semibold"><Inbox className="h-4 w-4" aria-hidden /> Unassigned</h2>
        <span className="text-xs tabular-nums text-muted-foreground" aria-live="polite">{data?.meta?.total ?? 0} waiting</span>
      </div>
      <Input
        value={q}
        onChange={(e) => { setQ(e.target.value); setPage(1); }}
        placeholder="Search number, title, customer…"
        aria-label="Search unassigned jobs"
        className="h-8 text-xs"
      />
      <div className="space-y-2" aria-busy={isFetching || undefined}>
        {isLoading ? <><Skeleton className="h-20" /><Skeleton className="h-20" /></> : null}
        {!isLoading && !items.length ? <p className="py-4 text-center text-xs text-muted-foreground">Nothing waiting.</p> : null}
        {items.map((job) => (
          <DispatchJobCard key={job.id} job={job} onSchedule={onSchedule} pending={pending[job.id]} />
        ))}
      </div>
      {pages > 1 ? (
        <div className="flex items-center justify-between gap-2 text-xs">
          <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Previous</Button>
          <span className="tabular-nums text-muted-foreground">{page} / {pages}</span>
          <Button size="sm" variant="outline" disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>Next</Button>
        </div>
      ) : null}

      {unscheduledAssigned?.length ? (
        <div className="space-y-2 border-t pt-3">
          <h3 className="text-xs font-semibold">Assigned, no time yet</h3>
          {unscheduledAssigned.map((job) => (
            <DispatchJobCard key={job.id} job={job} onSchedule={onSchedule} pending={pending[job.id]} />
          ))}
        </div>
      ) : null}
    </aside>
  );
}
