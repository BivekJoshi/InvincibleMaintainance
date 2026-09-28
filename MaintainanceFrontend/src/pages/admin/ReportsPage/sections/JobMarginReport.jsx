import { useNavigate } from 'react-router-dom';
import { useGetJobMarginReportQuery } from '@/api/financeApi';
import { ReportFigures } from '@/components/reports/ReportFigures';
import { ReportTable } from '@/components/reports/ReportTable';
import { ReportToolbar } from '@/components/reports/ReportToolbar';
import { reportQueryParams } from '@/hooks/useReportParams';
import { JOB_TYPE_LABELS } from '@/config/constants';
import { formatNpr, titleCase } from '@/helpers/format';
import { cn } from '@/helpers/utils';

const money = (paisa, className) => <span className={cn('whitespace-nowrap tabular-nums', className)}>{formatNpr(paisa)}</span>;
const pct = (v) => (v == null ? <span className="text-muted-foreground">—</span> : <span className={cn('font-medium tabular-nums', v < 0 && 'text-destructive')}>{v}%</span>);

const jobColumns = [
  {
    key: 'number', header: 'Job',
    cell: (r) => (
      <div className="min-w-0 max-w-xs">
        <p className="font-mono text-xs text-muted-foreground">{r.number}</p>
        <p className="truncate font-medium">{r.title}</p>
      </div>
    ),
  },
  { key: 'type', header: 'Type', cell: (r) => JOB_TYPE_LABELS[r.type] ?? titleCase(r.type ?? '') },
  { key: 'invoiced', header: 'Invoiced', className: 'text-right', cell: (r) => money(r.invoiced) },
  { key: 'materialCost', header: 'Materials', className: 'text-right', cell: (r) => money(r.materialCost, 'text-muted-foreground') },
  { key: 'labourCost', header: 'Labour', className: 'text-right', cell: (r) => money(r.labourCost, 'text-muted-foreground') },
  { key: 'expenseCost', header: 'Expenses', className: 'text-right', cell: (r) => money(r.expenseCost, 'text-muted-foreground') },
  { key: 'cost', header: 'Cost', className: 'text-right', cell: (r) => money(r.cost) },
  { key: 'margin', header: 'Margin', className: 'text-right', cell: (r) => money(r.margin, r.margin < 0 ? 'text-destructive font-semibold' : 'font-semibold') },
  { key: 'marginPct', header: 'Margin %', className: 'text-right', cell: (r) => pct(r.marginPct) },
];

const typeColumns = [
  { key: 'type', header: 'Type of work', cell: (r) => <span className="font-medium">{JOB_TYPE_LABELS[r.type] ?? titleCase(r.type ?? '')}</span> },
  { key: 'count', header: 'Jobs', className: 'text-right', cell: (r) => <span className="tabular-nums">{r.count}</span> },
  { key: 'invoiced', header: 'Invoiced', className: 'text-right', cell: (r) => money(r.invoiced) },
  { key: 'cost', header: 'Cost', className: 'text-right', cell: (r) => money(r.cost) },
  { key: 'margin', header: 'Margin', className: 'text-right', cell: (r) => money(r.margin, r.margin < 0 ? 'text-destructive' : undefined) },
  { key: 'marginPct', header: 'Margin %', className: 'text-right', cell: (r) => pct(r.marginPct) },
];

/**
 * Job margin (Phase I10) — **`costs:read` only** (the money wall: MANAGER and ADMIN): each finished job in the range,
 * what it was invoiced against its cost — materials at cost, labour, expenses — and the margin, as the API works them
 * out; then by type of work. A job opens its page.
 */
export function JobMarginReport({ params, patch }) {
  const navigate = useNavigate();
  const query = reportQueryParams(params);
  const { data, isLoading, isFetching, error, refetch } = useGetJobMarginReportQuery(query);
  const totals = data?.totals;
  return (
    <>
      <ReportToolbar params={params} onChange={patch} csv={{ path: '/admin/reports/job-margin', params: query, name: 'job-margin' }} />
      <ReportFigures
        isLoading={isLoading}
        label="Margin totals"
        className="lg:grid-cols-3"
        items={totals ? [
          { key: 'i', label: 'Invoiced', value: formatNpr(totals.invoiced) },
          { key: 'c', label: 'Cost', value: formatNpr(totals.cost) },
          { key: 'm', label: 'Margin', value: formatNpr(totals.margin), tone: totals.margin < 0 ? 'destructive' : 'success' },
        ] : []}
      />
      <ReportTable
        storageKey="report-job-margin"
        columns={jobColumns}
        rows={data?.rows ?? []}
        getRowId={(r) => r.jobId}
        isLoading={isLoading}
        isFetching={isFetching}
        error={error}
        refetch={refetch}
        onRowClick={(r) => navigate(`/admin/jobs/${r.jobId}?tab=costing`)}
        rowLabel={(r) => `${r.number} ${r.title}`}
        emptyTitle="No finished jobs in this range"
      />
      <h2 className="mb-2 mt-6 text-sm font-semibold">By type of work</h2>
      <ReportTable
        storageKey="report-job-margin-type"
        columns={typeColumns}
        rows={data?.byType ?? []}
        getRowId={(r) => r.type}
        isLoading={isLoading}
        rowLabel={(r) => JOB_TYPE_LABELS[r.type] ?? r.type}
        emptyTitle="No finished jobs in this range"
      />
    </>
  );
}
