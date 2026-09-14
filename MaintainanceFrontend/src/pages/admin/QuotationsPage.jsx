import { useNavigate } from 'react-router-dom';
import { useGetQuotationsQuery } from '@/api/quotationsApi';
import { useListParams } from '@/hooks/useListParams';
import { PageHeader } from '@/components/common/PageHeader';
import { DataTable } from '@/components/common/DataTable/DataTable';
import { StatusBadge } from '@/components/ui/badge';
import { PageTransition } from '@/three/motion/motionKit';
import { QUOTATION_STATUSES } from '@/config/constants';
import { formatDate, formatDateTime, formatNpr, titleCase } from '@/helpers/format';

const columns = [
  {
    key: 'number', header: 'Number', sortable: true,
    cell: (r) => (
      <div className="min-w-0">
        <p className="font-mono text-xs font-medium">{r.number}</p>
        {r.version > 1 ? <p className="text-[11px] text-muted-foreground">v{r.version}</p> : null}
      </div>
    ),
  },
  {
    key: 'customer', header: 'Customer',
    cell: (r) => (
      <div className="min-w-0">
        <p className="truncate font-medium">{r.customer?.name}</p>
        <p className="truncate text-xs text-muted-foreground">{r.site?.area ?? r.site?.address ?? r.customer?.phone}</p>
      </div>
    ),
  },
  { key: 'status', header: 'Status', sortable: true, cell: (r) => <StatusBadge status={r.status} /> },
  { key: 'total', header: 'Total', sortable: true, cell: (r) => <span className="whitespace-nowrap font-medium tabular-nums">{formatNpr(r.total)}</span> },
  { key: 'validUntil', header: 'Valid until', sortable: true, cell: (r) => <span className="whitespace-nowrap text-xs text-muted-foreground">{formatDate(r.validUntil)}</span> },
  { key: 'createdAt', header: 'Created', sortable: true, cell: (r) => <span className="whitespace-nowrap text-xs text-muted-foreground">{formatDateTime(r.createdAt)}</span> },
];

const filters = [
  { key: 'status', label: 'Status', type: 'enum', allLabel: 'All statuses', options: QUOTATION_STATUSES.map((s) => ({ value: s, label: titleCase(s) })) },
];

export default function QuotationsPage() {
  const [params, setParams] = useListParams({ limit: 20 });
  const { data, isLoading, isFetching, error, refetch } = useGetQuotationsQuery(params);
  const navigate = useNavigate();

  return (
    <PageTransition>
      <PageHeader title="Quotations" description="Priced work, waiting on the customer." />
      <DataTable
        columns={columns}
        data={data?.items}
        meta={data?.meta}
        isLoading={isLoading}
        isFetching={isFetching}
        error={error}
        refetch={refetch}
        params={params}
        onParamsChange={setParams}
        onRowClick={(row) => navigate(`/admin/quotations/${row.id}`)}
        searchPlaceholder="Search number or customer…"
        emptyTitle="No quotations yet"
        emptyDescription="Build one from a submitted site survey, or start from a lead."
        filters={filters}
      />
    </PageTransition>
  );
}
