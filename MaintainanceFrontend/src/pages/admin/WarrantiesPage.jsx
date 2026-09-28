import { Link, useNavigate } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { Copy, ExternalLink, FileText, LifeBuoy } from 'lucide-react';
import { useGetWarrantiesQuery } from '@/api/aftercareApi';
import { PageHeader } from '@/components/common/PageHeader';
import { CustomTable } from '@/components/common/CustomTable/CustomTable';
import { StateBadge } from '@/components/common/StateBadge';
import { AftercareStatus } from '@/components/aftercare/AftercareStatus';
import { ViewTabs } from '@/components/aftercare/ViewTabs';
import { Button } from '@/components/ui/button';
import { PageTransition } from '@/three/motion/motionKit';
import { useListParams } from '@/hooks/useListParams';
import { useAuth } from '@/hooks/useAuth';
import {
  DEFAULT_EXPIRING_DAYS, EXPIRING_DAY_OPTIONS, WARRANTY_VIEWS, selectView, viewQuery,
} from '@/config/admin/aftercareViews';
import { CUSTOMER_RELATION } from '@/config/admin/jobViews';
import { JOB_TYPE_LABELS } from '@/config/constants';
import { certificateUrl, coverLeft } from '@/helpers/aftercare';
import { formatDate, titleCase } from '@/helpers/format';
import { toastError, toastSuccess } from '@/redux/slices/uiSlice';
import { cn } from '@/helpers/utils';

const columns = [
  {
    key: 'job', header: 'Job', label: 'Job',
    cell: (r) => (
      <div className="min-w-0 max-w-xs">
        <p className="font-mono text-xs text-muted-foreground">{r.job?.number}</p>
        <p className="truncate font-medium">{r.job?.title}</p>
        <p className="text-xs text-muted-foreground">{JOB_TYPE_LABELS[r.job?.type] ?? titleCase(r.job?.type ?? '')}</p>
      </div>
    ),
    exportValue: (r) => `${r.job?.number ?? ''} ${r.job?.title ?? ''}`.trim(),
  },
  {
    key: 'customer', header: 'Customer',
    cell: (r) => (
      <div className="min-w-0 max-w-[220px]">
        <p className="truncate">{r.customer?.name}</p>
        {r.customer?.phone ? (
          <a href={`tel:${r.customer.phone}`} onClick={(e) => e.stopPropagation()} className="text-xs text-muted-foreground hover:text-primary hover:underline">
            {r.customer.phone}
          </a>
        ) : null}
      </div>
    ),
    exportValue: (r) => r.customer?.name ?? '',
  },
  {
    key: 'scope', header: 'Covers',
    cell: (r) => <span className="line-clamp-2 max-w-sm text-sm">{r.scope || <span className="text-muted-foreground">Workmanship</span>}</span>,
    exportValue: (r) => r.scope ?? '',
  },
  {
    key: 'status', header: 'Status', sortable: true,
    cell: (r) => (
      <div className="flex flex-wrap items-center gap-1.5">
        <AftercareStatus kind="warranty" status={r.status} />
        {r.claims?.length ? <StateBadge>{r.claims.length} claim{r.claims.length === 1 ? '' : 's'}</StateBadge> : null}
      </div>
    ),
    exportValue: (r) => r.status,
  },
  {
    key: 'endsAt', header: 'Covered until', sortable: true,
    cell: (r) => {
      const left = r.status === 'VOID' ? null : coverLeft(r);
      return (
        <div className="whitespace-nowrap text-xs">
          <p>{formatDate(r.endsAt)}</p>
          {left ? <p className={cn(left.soon ? 'font-medium text-warning-foreground' : 'text-muted-foreground')}>{left.label}</p> : null}
        </div>
      );
    },
    exportValue: (r) => formatDate(r.endsAt),
  },
];

const DAY_FILTER = {
  key: 'days', label: 'Ending within', type: 'enum', className: 'w-[170px]',
  defaultValue: String(DEFAULT_EXPIRING_DAYS),
  options: EXPIRING_DAY_OPTIONS.map((d) => ({ value: String(d), label: `Ending within ${d} days` })),
};
const CUSTOMER_FILTER = { key: 'customerId', label: 'Customer', type: 'relation', relation: CUSTOMER_RELATION };

/**
 * Every warranty a completed job issued (Phase I): tabs by status and an "Expiring soon" preset — active cover
 * ending within N days (`?view=expiring&days=30`) — search by customer or job number. A row opens the warranty;
 * its menu copies or opens the customer's certificate.
 */
export default function WarrantiesPage() {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const { can } = useAuth();
  const [params, setParams] = useListParams({ limit: 20 });
  const { view, query } = viewQuery(WARRANTY_VIEWS, params, 'all');
  const { data, isLoading, isFetching, error, refetch } = useGetWarrantiesQuery({
    ...query, sort: query.sort ?? (view === 'expiring' ? 'endsAt' : '-endsAt'),
  });

  const copy = async (row) => {
    const link = certificateUrl(row);
    try {
      await navigator.clipboard.writeText(link);
      dispatch(toastSuccess('Certificate link copied'));
    } catch {
      dispatch(toastError('Could not copy the link', link));
    }
  };

  const rowActions = (row) => [
    { label: 'Open', icon: FileText, onSelect: () => navigate(`/admin/warranties/${row.id}`) },
    ...(certificateUrl(row) ? [
      { label: 'Copy certificate link', icon: Copy, onSelect: () => copy(row) },
      { label: 'Open certificate', icon: ExternalLink, onSelect: () => window.open(certificateUrl(row), '_blank', 'noopener') },
    ] : []),
  ];

  return (
    <PageTransition>
      <PageHeader
        title="Warranties"
        description="The cover every completed job carries, and where it stands."
        actions={can('warranties:read') ? (
          <Button asChild variant="outline" size="sm"><Link to="/admin/warranty-claims"><LifeBuoy aria-hidden /> Claims</Link></Button>
        ) : null}
      />
      <ViewTabs views={WARRANTY_VIEWS} value={view} label="Warranty status" onChange={(next) => setParams(selectView(params, next))} />
      <CustomTable
        storageKey="warranties"
        exportable
        exportName="warranties"
        columns={columns}
        data={data?.items}
        meta={data?.meta}
        isLoading={isLoading}
        isFetching={isFetching}
        error={error}
        refetch={refetch}
        params={params}
        onParamsChange={setParams}
        onRowClick={(row) => navigate(`/admin/warranties/${row.id}`)}
        rowLabel={(r) => `Warranty for ${r.job?.number ?? 'a job'}, ${r.customer?.name ?? ''}`}
        rowActions={rowActions}
        filters={view === 'expiring' ? [DAY_FILTER, CUSTOMER_FILTER] : [CUSTOMER_FILTER]}
        searchPlaceholder="Search customer, phone or job number…"
        emptyTitle={view === 'expiring' ? 'Nothing is running out' : 'No warranties here'}
        emptyDescription={view === 'expiring'
          ? 'No active cover ends in that window.'
          : 'A warranty is issued when a job is completed.'}
      />
    </PageTransition>
  );
}
