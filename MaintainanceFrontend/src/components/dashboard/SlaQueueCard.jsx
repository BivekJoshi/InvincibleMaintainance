import { Link } from 'react-router-dom';
import { PhoneCall } from 'lucide-react';
import { ChartCard } from '@/components/charts/ChartCard';
import { SlaChip } from '@/components/common/SlaChip';
import { RunwayStrip } from '@/components/leads/ResponseRunway';
import { PriorityBadge } from '@/components/ui/badge';
import { LEAD_SOURCE_LABELS } from '@/config/constants';
import { slaState } from '@/helpers/dashboard';

/** The people still waiting for a first call, the tightest deadline first. */
export function SlaQueueCard({ queue, className }) {
  const { total, items } = queue;
  return (
    <ChartCard
      title="Call these next"
      subtitle={total ? `${total} lead${total === 1 ? '' : 's'} not yet contacted` : 'Everyone has had a first call'}
      icon={PhoneCall}
      to="/admin/sla"
      linkLabel="Open the SLA board"
      className={className}
    >
      {items.length ? (
        <RunwayStrip leads={items.map((l) => ({ ...l, sla: { dueAt: l.slaDueAt } }))} className="mb-2" />
      ) : null}
      {items.length ? (
        <ul className="-mx-1 divide-y">
          {items.map((l) => (
            <li key={l.id}>
              <Link
                to={`/admin/leads/${l.id}`}
                className="flex items-center gap-3 rounded-md px-1 py-2 transition-colors hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1.5">
                    <span className="truncate text-sm font-medium">{l.name}</span>
                    <PriorityBadge priority={l.priority} className="px-1.5 py-0 text-[9px]" />
                  </span>
                  <span className="block truncate text-[11px] text-muted-foreground">
                    {[l.service, l.area, LEAD_SOURCE_LABELS[l.source] ?? l.source].filter(Boolean).join(' · ')}
                    {' — '}
                    {l.assignedTo ?? <span className="font-medium text-warning-foreground">unassigned</span>}
                  </span>
                </span>
                <SlaChip sla={{ state: slaState(l.slaDueAt), dueAt: l.slaDueAt }} className="shrink-0" />
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="grid flex-1 place-items-center py-8 text-center text-sm text-muted-foreground">
          Nobody is waiting on a call.
        </p>
      )}
    </ChartCard>
  );
}
