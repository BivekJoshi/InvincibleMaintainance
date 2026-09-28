import { useGetFunnelReportQuery } from '@/api/financeApi';
import { ReportFigures } from '@/components/reports/ReportFigures';
import { ReportTable } from '@/components/reports/ReportTable';
import { ReportToolbar } from '@/components/reports/ReportToolbar';
import { reportQueryParams } from '@/hooks/useReportParams';

const columns = [
  { key: 'label', header: 'Stage', cell: (r) => <span className="font-medium">{r.label}</span> },
  { key: 'count', header: 'Leads', className: 'text-right', cell: (r) => <span className="tabular-nums">{r.count}</span> },
  { key: 'pct', header: 'Of enquiries', className: 'text-right', cell: (r) => <span className="tabular-nums">{r.pct}%</span> },
];

/**
 * The funnel (Phase I10, `reports:sales`): of the leads created in the range, how many were contacted, quoted and
 * won — each stage's count and share as the API gives them — and how many were lost.
 */
export function FunnelReport({ params, patch }) {
  const query = reportQueryParams(params);
  const { data, isLoading, isFetching, error, refetch } = useGetFunnelReportQuery(query);
  const stages = data?.stages ?? [];
  return (
    <>
      <ReportToolbar params={params} onChange={patch} csv={{ path: '/admin/reports/funnel', params: query, name: 'funnel' }} />
      <ReportFigures
        isLoading={isLoading}
        label="The funnel"
        className="lg:grid-cols-5"
        items={[
          ...stages.map((s) => ({ key: s.key, label: s.label, value: s.count, hint: `${s.pct}%`, bar: (s.pct ?? 0) / 100 })),
          data ? { key: 'lost', label: 'Lost', value: data.lost ?? 0 } : null,
        ]}
      />
      <ReportTable
        storageKey="report-funnel"
        columns={columns}
        rows={stages}
        getRowId={(r) => r.key}
        isLoading={isLoading}
        isFetching={isFetching}
        error={error}
        refetch={refetch}
        rowLabel={(r) => r.label}
        emptyTitle="No leads in this range"
      />
    </>
  );
}
