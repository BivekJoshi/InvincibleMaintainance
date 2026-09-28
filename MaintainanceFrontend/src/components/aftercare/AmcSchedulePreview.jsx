import { useWatch } from 'react-hook-form';
import { skipToken } from '@reduxjs/toolkit/query';
import { CalendarClock, Loader2 } from 'lucide-react';
import { usePreviewAmcScheduleQuery } from '@/api/aftercareApi';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { amcSchedulePreviewSchema } from '@/form/schemas/aftercare.schema';
import { formatDate } from '@/helpers/format';
import { cn } from '@/helpers/utils';

/** The request for a schedule, or null while the dates and the visit count cannot make one yet. */
function scheduleRequest(values) {
  const parsed = amcSchedulePreviewSchema.safeParse({
    startDate: values?.startDate, endDate: values?.endDate, visitsPerYear: values?.visitsPerYear,
  });
  return parsed.success ? parsed.data : null;
}

/**
 * The AMC create sheet's **visit schedule** (a `preview` field): once the start, the end and the visits a year
 * make a contract, it asks `POST /admin/amc-contracts/preview` — debounced — and lists the visits exactly as
 * create will lay them down. The client never spaces the visits itself; the server's rule is the one saved.
 *
 * @param {{ field: { label?: string }, id: string }} props
 */
export function AmcSchedulePreview({ field, id }) {
  const values = useWatch();
  const body = scheduleRequest(values);
  const key = body ? JSON.stringify(body) : null;
  const settledKey = useDebouncedValue(key, 300);
  const settled = key === settledKey;
  const { data, error, isFetching } = usePreviewAmcScheduleQuery(settledKey ? JSON.parse(settledKey) : skipToken);

  let content;
  if (!body) {
    content = <p className="text-sm text-muted-foreground">Pick the start and end dates and the visits a year to see the visit schedule.</p>;
  } else if (error && settled) {
    content = <p role="alert" className="text-sm text-destructive">{error?.data?.error?.message ?? 'The schedule could not be worked out.'}</p>;
  } else if (!data) {
    content = <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Working out the visits…</p>;
  } else {
    content = (
      <div className={cn('space-y-2 transition-opacity', (isFetching || !settled) && 'opacity-60')} aria-busy={isFetching || !settled}>
        <p className="text-sm" data-testid="schedule-summary">
          <strong>{data.totalVisits} visit{data.totalVisits === 1 ? '' : 's'}</strong>, one about every {data.intervalDays} day{data.intervalDays === 1 ? '' : 's'}.
          <span className="block text-xs text-muted-foreground">A job is made for each a week before it is due.</span>
        </p>
        <ol className="grid max-h-56 gap-1 overflow-y-auto pr-1 text-sm sm:grid-cols-2" aria-label="Visits">
          {data.visits.map((v, i) => (
            <li key={`${v.dueDate}-${i}`} className="flex items-center justify-between gap-2 rounded-md border px-2 py-1">
              <span className="text-xs text-muted-foreground">Visit {i + 1}</span>
              <span className="tabular-nums">{formatDate(v.dueDate)}</span>
            </li>
          ))}
        </ol>
      </div>
    );
  }

  return (
    <div className="rounded-lg border bg-muted/20 p-3">
      <p id={`${id}-title`} className="mb-2 flex items-center gap-2 text-sm font-medium">
        <CalendarClock className="h-4 w-4 text-primary" aria-hidden /> {field?.label ?? 'Visit schedule'}
      </p>
      {content}
    </div>
  );
}
