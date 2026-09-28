import { useGetSlaReportQuery } from '@/api/financeApi';
import { ReportFigures } from '@/components/reports/ReportFigures';
import { ReportTable } from '@/components/reports/ReportTable';
import { ReportToolbar } from '@/components/reports/ReportToolbar';
import { reportQueryParams } from '@/hooks/useReportParams';
import { formatMinutes } from '@/helpers/format';

const n = (v) => <span className="tabular-nums">{v ?? 0}</span>;

const columns = [
  { key: 'staff', header: 'Who', cell: (r) => <span className="font-medium">{r.staff}</span> },
  { key: 'total', header: 'Leads', className: 'text-right', cell: (r) => n(r.total) },
  { key: 'responded', header: 'Answered', className: 'text-right', cell: (r) => n(r.responded) },
  { key: 'onTime', header: 'Within 2 h', className: 'text-right', cell: (r) => n(r.onTime) },
  { key: 'complianceRate', header: 'Kept', className: 'text-right', cell: (r) => <span className="font-medium tabular-nums">{r.complianceRate ?? 0}%</span> },
];

/**
 * SLA compliance (Phase I10, `reports:sales`): of the leads created in the range with a two-hour promise, how many
 * were answered and how many in time — the API's rate, average and median response — and the same by person.
 */
export function SlaReport({ params, patch }) {
  const query = reportQueryParams(params);
  const { data, isLoading, isFetching, error, refetch } = useGetSlaReportQuery(query);
  return (
    <>
      <ReportToolbar params={params} onChange={patch} csv={{ path: '/admin/reports/sla', params: query, name: 'sla' }} />
      <ReportFigures
        isLoading={isLoading}
        label="The two-hour promise"
        items={data ? [
          { key: 'rate', label: 'Promise kept', value: `${data.complianceRate ?? 0}%`, hint: `${data.onTime ?? 0} of ${data.total ?? 0} leads`, bar: (data.complianceRate ?? 0) / 100 },
          { key: 'never', label: 'Never answered', value: data.neverResponded ?? 0, tone: data.neverResponded > 0 ? 'destructive' : undefined },
          { key: 'avg', label: 'Average first response', value: data.avgResponseMinutes == null ? '—' : formatMinutes(data.avgResponseMinutes) },
          { key: 'median', label: 'Median first response', value: data.medianResponseMinutes == null ? '—' : formatMinutes(data.medianResponseMinutes) },
        ] : []}
      />
      <ReportTable
        storageKey="report-sla"
        columns={columns}
        rows={data?.byStaff ?? []}
        getRowId={(r) => r.staff}
        isLoading={isLoading}
        isFetching={isFetching}
        error={error}
        refetch={refetch}
        rowLabel={(r) => r.staff}
        emptyTitle="No leads in this range"
      />
    </>
  );
}
