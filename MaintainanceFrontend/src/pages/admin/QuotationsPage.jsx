import { useNavigate } from 'react-router-dom';
import { useGetQuotationsQuery } from '@/features/quotations/quotationsApi';
import { useListParams } from '@/hooks/useListParams';
import { PageHeader } from '@/components/common/PageHeader';
import { DataTable } from '@/components/common/DataTable';
import { StatusBadge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PageTransition } from '@/components/motion';
import { QUOTATION_STATUSES } from '@/lib/constants';
import { formatDate, formatDateTime, formatNpr, titleCase } from '@/lib/format';

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
        toolbar={
          <Select value={params.status ?? 'all'} onValueChange={(v) => setParams({ ...params, page: 1, status: v === 'all' ? undefined : v })}>
            <SelectTrigger className="w-[160px]"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              {QUOTATION_STATUSES.map((s) => <SelectItem key={s} value={s}>{titleCase(s)}</SelectItem>)}
            </SelectContent>
          </Select>
        }
      />
    </PageTransition>
  );
}
