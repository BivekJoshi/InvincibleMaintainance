import { useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { CalendarDays, ChevronRight, History } from 'lucide-react';
import { useGetMyJobsQuery } from '@/api/techApi';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { StatusBadge } from '@/components/ui/badge';
import { CardSkeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/common/EmptyState';
import { ErrorState } from '@/components/common/ErrorState';
import { PageTransition } from '@/three/motion/motionKit';
import { useFieldCopy } from '@/hooks/useFieldCopy';
import { historyQuery, jobsInRange, recentRange } from '@/helpers/fieldJob';
import { ktmDay } from '@/helpers/dispatchBoard';
import { formatDate, formatTime } from '@/helpers/format';
import { cn } from '@/helpers/utils';

const PRESETS = [7, 30, 90];
const DAY = /^\d{4}-\d{2}-\d{2}$/;

/**
 * `/tech/history` — the technician's own jobs between two Kathmandu days (the last 30 by default), newest
 * first, each opening read only at `/tech/history/:id`. The range lives in the URL, so coming back from a
 * job lands on the same list.
 */
export default function TechHistoryPage() {
  const copy = useFieldCopy();
  const words = copy.history;
  const [params, setParams] = useSearchParams();
  const today = ktmDay();
  const fallback = recentRange(30, today);
  const from = DAY.test(params.get('from') ?? '') ? params.get('from') : fallback.from;
  const to = DAY.test(params.get('to') ?? '') ? params.get('to') : fallback.to;
  const badRange = from > to;

  const { data, isLoading, isFetching, error, refetch } = useGetMyJobsQuery(historyQuery({ from, to }), { skip: badRange });
  const jobs = useMemo(() => jobsInRange(data ?? [], { from, to }), [data, from, to]);

  const setRange = (next) => setParams({ from: next.from, to: next.to }, { replace: true });
  const preset = PRESETS.find((days) => {
    const r = recentRange(days, today);
    return r.from === from && r.to === to;
  });

  return (
    <PageTransition>
      <h1 className="text-xl font-bold">{words.title}</h1>
      <p className="mt-0.5 text-sm text-muted-foreground">{words.subtitle}</p>

      <div className="mt-4 grid grid-cols-3 gap-2" role="group" aria-label={words.title}>
        {PRESETS.map((days) => (
          <Button
            key={days}
            type="button"
            size="lg"
            variant={preset === days ? 'default' : 'outline'}
            aria-pressed={preset === days}
            className="px-2"
            onClick={() => setRange(recentRange(days, today))}
          >
            {words.presets[days]}
          </Button>
        ))}
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <Label htmlFor="history-from">{words.from}</Label>
          <Input
            id="history-from" type="date" value={from} max={today} className="h-11 text-base"
            onChange={(e) => e.target.value && setRange({ from: e.target.value, to })}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="history-to">{words.to}</Label>
          <Input
            id="history-to" type="date" value={to} className="h-11 text-base"
            onChange={(e) => e.target.value && setRange({ from, to: e.target.value })}
          />
        </div>
      </div>
      {badRange ? <p className="mt-2 text-sm text-destructive" role="alert">{words.badRange}</p> : null}

      {badRange ? null : error && !data ? (
        <ErrorState error={error} onRetry={refetch} className="mt-4" />
      ) : isLoading ? (
        <div className="mt-5"><CardSkeleton /></div>
      ) : !jobs.length ? (
        <EmptyState icon={History} title={words.emptyTitle} description={words.emptyBody} />
      ) : (
        <>
          <p className={cn('mt-4 text-xs text-muted-foreground', isFetching ? 'opacity-60' : '')}>{words.count(jobs.length)}</p>
          {/* No stagger: a quarter's history is a hundred rows, and the last would fade in seconds later. */}
          <ul className="mt-2 space-y-2">
            {jobs.map((job) => (
              <li key={job.id}>
                <Link
                  to={`/tech/history/${job.id}`}
                  state={{ back: `/tech/history?from=${from}&to=${to}` }}
                  className="flex items-center gap-3 rounded-lg border bg-background p-4 active:bg-muted"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-xs text-muted-foreground">{job.number}</span>
                      <StatusBadge status={job.status} label={copy.status[job.status]} />
                    </div>
                    <p className="mt-1 truncate font-medium">{job.title}</p>
                    {job.customer?.name ? <p className="truncate text-sm text-muted-foreground">{job.customer.name}</p> : null}
                    <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                      <CalendarDays className="h-3.5 w-3.5" aria-hidden />
                      {formatDate(job.scheduledStart)} · {formatTime(job.scheduledStart)}
                    </p>
                  </div>
                  <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden />
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
    </PageTransition>
  );
}
