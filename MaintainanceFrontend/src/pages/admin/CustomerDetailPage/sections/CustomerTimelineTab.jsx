import { Link } from 'react-router-dom';
import { useGetCustomerTimelineQuery } from '@/api/customersApi';
import { EmptyState } from '@/components/common/EmptyState';
import { ErrorState } from '@/components/common/ErrorState';
import { StateBadge } from '@/components/common/StateBadge';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/hooks/useAuth';
import { formatDate } from '@/helpers/format';

const KINDS = {
  lead: { label: 'Enquiry', tone: 'info', href: (e) => `/admin/leads/${e.id}`, cap: 'leads:read' },
  quotation: { label: 'Quotation', tone: 'warning', href: (e) => `/admin/quotations/${e.id}`, cap: 'quotations:read' },
  job: { label: 'Job', tone: 'success' },
  invoice: { label: 'Invoice', tone: 'muted' },
  warranty: { label: 'Warranty', tone: 'success' },
};

/** Everything that happened with this customer, newest first. */
export function CustomerTimelineTab({ customerId }) {
  const { can } = useAuth();
  const { data, isLoading, error, refetch } = useGetCustomerTimelineQuery(customerId);
  if (error) return <ErrorState error={error} onRetry={refetch} />;
  if (isLoading) return <div className="space-y-3"><Skeleton className="h-10" /><Skeleton className="h-10" /></div>;
  if (!data?.length) return <EmptyState title="Nothing yet" description="Enquiries, quotations, jobs and invoices appear here." />;

  return (
    <ol className="space-y-2">
      {data.map((e) => {
        const kind = KINDS[e.kind] ?? { label: e.kind, tone: 'muted' };
        const linked = kind.href && (!kind.cap || can(kind.cap));
        const body = (
          <>
            <StateBadge tone={kind.tone} className="w-24 justify-center">{kind.label}</StateBadge>
            <span className="min-w-0 flex-1 truncate">{e.label}</span>
            <time dateTime={e.at} className="shrink-0 text-xs tabular-nums text-muted-foreground">{formatDate(e.at)}</time>
          </>
        );
        return (
          <li key={`${e.kind}-${e.id}`}>
            {linked ? (
              <Link to={kind.href(e)} className="flex items-center gap-3 rounded-md border px-3 py-2 text-sm hover:bg-muted">{body}</Link>
            ) : (
              <div className="flex items-center gap-3 rounded-md border px-3 py-2 text-sm">{body}</div>
            )}
          </li>
        );
      })}
    </ol>
  );
}
