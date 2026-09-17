import { Link } from 'react-router-dom';
import { ClipboardList, MapPin } from 'lucide-react';
import { ChartCard } from '@/components/charts/ChartCard';
import { PriorityBadge, StatusBadge } from '@/components/ui/badge';
import { JOB_STATUS_LABELS } from '@/config/constants';
import { initials } from '@/helpers/format';
import { ktmDay } from '@/helpers/dispatchBoard';
import { timeWindow } from '@/helpers/dashboard';

/** Today's run sheet: when, what, where, who — a row per job, earliest first. */
export function TodayJobsCard({ sheet, className }) {
  const { total, items } = sheet;
  const day = ktmDay();
  return (
    <ChartCard
      title="Today’s run sheet"
      subtitle={total ? `${total} job${total === 1 ? '' : 's'} on the calendar today` : 'Nothing booked for today'}
      icon={ClipboardList}
      to="/admin/dispatch"
      linkLabel="Open the dispatch board"
      className={className}
    >
      {items.length ? (
        <>
          <ul className="-mx-1 divide-y">
            {items.map((j) => (
              <li key={j.id}>
                <Link
                  to={`/admin/jobs/${j.id}`}
                  className="grid grid-cols-[4.75rem_minmax(0,1fr)_auto] items-center gap-3 rounded-md px-1 py-2 transition-colors hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <span className="text-xs font-semibold tabular-nums">{timeWindow(j.scheduledStart, j.scheduledEnd)}</span>
                  <span className="min-w-0">
                    <span className="flex items-center gap-1.5">
                      <span className="truncate text-sm font-medium">{j.title}</span>
                      <PriorityBadge priority={j.priority} className="px-1.5 py-0 text-[9px]" />
                    </span>
                    <span className="flex items-center gap-1 truncate text-[11px] text-muted-foreground">
                      <span className="tabular-nums">{j.number}</span>
                      {j.customer ? <> · <span className="truncate">{j.customer}</span></> : null}
                      {j.area ? <> · <MapPin className="h-3 w-3 shrink-0" aria-hidden /><span className="truncate">{j.area}</span></> : null}
                    </span>
                  </span>
                  <span className="flex items-center gap-2">
                    <span className="hidden -space-x-1.5 sm:flex" aria-label={j.technicians.length ? `Going: ${j.technicians.join(', ')}` : 'Nobody assigned'}>
                      {j.technicians.length ? j.technicians.slice(0, 3).map((t) => (
                        <span key={t} title={t} className="grid h-6 w-6 place-items-center rounded-full border-2 border-card bg-secondary text-[9px] font-semibold">
                          {initials(t)}
                        </span>
                      )) : <span className="text-[11px] font-medium text-warning-foreground">Unassigned</span>}
                    </span>
                    <StatusBadge status={j.status} label={JOB_STATUS_LABELS[j.status]} className="px-2 py-0 text-[10px]" />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
          {total > items.length ? (
            <Link to={`/admin/jobs?from=${day}&to=${day}`} className="mt-auto pt-2 text-xs font-medium text-primary hover:underline">
              See all {total} jobs today
            </Link>
          ) : null}
        </>
      ) : (
        <p className="grid flex-1 place-items-center py-8 text-center text-sm text-muted-foreground">
          The day is open. Accepted work waiting to be booked is on the dispatch board.
        </p>
      )}
    </ChartCard>
  );
}
