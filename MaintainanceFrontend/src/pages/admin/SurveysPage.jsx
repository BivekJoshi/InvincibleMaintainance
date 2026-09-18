import { useNavigate } from 'react-router-dom';
import { Ruler } from 'lucide-react';
import { useGetSurveysQuery } from '@/api/surveysApi';
import { useListParams } from '@/hooks/useListParams';
import { PageHeader } from '@/components/common/PageHeader';
import { CustomTable } from '@/components/common/CustomTable/CustomTable';
import { StatusBadge } from '@/components/ui/badge';
import { PageTransition } from '@/three/motion/motionKit';
import { SURVEY_STATUSES } from '@/config/constants';
import { formatDate, formatDateTime, titleCase } from '@/helpers/format';

const columns = [
  {
    key: 'number', header: 'Survey', sortable: true,
    cell: (r) => (
      <div className="min-w-0">
        <p className="font-mono text-xs font-medium">{r.number}</p>
        <p className="truncate text-xs text-muted-foreground">{r.job?.number}</p>
      </div>
    ),
  },
  {
    key: 'customer', header: 'Customer',
    cell: (r) => (
      <div className="min-w-0">
        <p className="truncate font-medium">{r.customer?.name}</p>
        <a href={`tel:${r.customer?.phone}`} onClick={(e) => e.stopPropagation()} className="text-xs text-muted-foreground hover:text-primary hover:underline">
          {r.customer?.phone}
        </a>
      </div>
    ),
  },
  { key: 'service', header: 'Service', cell: (r) => r.service?.name ?? <span className="text-muted-foreground">General</span> },
  { key: 'status', header: 'Status', sortable: true, cell: (r) => <StatusBadge status={r.status} /> },
  {
    // What the office needs at a glance: is there enough here to price?
    key: 'scope', header: 'Scope',
    cell: (r) => (
      <span className="whitespace-nowrap text-xs text-muted-foreground">
        <Ruler className="mr-1 inline h-3.5 w-3.5" aria-hidden />
        {r._count?.items ?? 0} line{(r._count?.items ?? 0) === 1 ? '' : 's'} · {r._count?.readings ?? 0} reading{(r._count?.readings ?? 0) === 1 ? '' : 's'}
      </span>
    ),
  },
  { key: 'surveyor', header: 'Surveyor', cell: (r) => r.surveyor?.user?.name ?? <span className="text-muted-foreground">Unassigned</span> },
  { key: 'visit', header: 'Visited', cell: (r) => <span className="whitespace-nowrap text-xs text-muted-foreground">{formatDate(r.job?.scheduledStart)}</span> },
  {
    key: 'quotation', header: 'Quotation',
    cell: (r) => (r.quotation
      ? <span className="font-mono text-xs">{r.quotation.number}</span>
      : <span className="text-xs text-muted-foreground">—</span>),
  },
  { key: 'createdAt', header: 'Created', sortable: true, cell: (r) => <span className="whitespace-nowrap text-xs text-muted-foreground">{formatDateTime(r.createdAt)}</span> },
];

const filters = [
  {
    key: 'status', label: 'Status', type: 'enum', allLabel: 'All statuses', className: 'w-[170px]',
    options: SURVEY_STATUSES.map((s) => ({ value: s, label: titleCase(s) })),
  },
];

export default function SurveysPage() {
  const [params, setParams] = useListParams({ limit: 20 });
  const { data, isLoading, isFetching, error, refetch } = useGetSurveysQuery(params);
  const navigate = useNavigate();

  return (
    <PageTransition>
      <PageHeader
        title="Site surveys"
        description="What the surveyor measured on site, waiting to be priced."
      />

      <CustomTable
        storageKey="surveys"
        exportable
        columns={columns}
        data={data?.items}
        meta={data?.meta}
        isLoading={isLoading}
        isFetching={isFetching}
        error={error}
        refetch={refetch}
        params={params}
        onParamsChange={setParams}
        onRowClick={(row) => navigate(`/admin/surveys/${row.id}`)}
        searchPlaceholder="Search number, customer, diagnosis…"
        emptyTitle="No surveys yet"
        emptyDescription="A survey appears here once a surveyor submits it from the field."
        filters={filters}
      />
    </PageTransition>
  );
}
