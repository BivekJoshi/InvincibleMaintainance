import { useGetLeadSourceReportQuery } from '@/api/financeApi';
import { ReportTable } from '@/components/reports/ReportTable';
import { ReportToolbar } from '@/components/reports/ReportToolbar';
import { reportQueryParams } from '@/hooks/useReportParams';
import { LEAD_SOURCE_LABELS } from '@/config/constants';
import { formatNpr, titleCase } from '@/helpers/format';

const count = (n) => <span className="tabular-nums">{n ?? 0}</span>;

const columns = [
  { key: 'source', header: 'Source', cell: (r) => <span className="font-medium">{LEAD_SOURCE_LABELS[r.source] ?? titleCase(r.source ?? '')}</span> },
  { key: 'total', header: 'Leads', className: 'text-right', cell: (r) => count(r.total) },
  { key: 'open', header: 'Open', className: 'text-right', cell: (r) => count(r.open) },
  { key: 'won', header: 'Won', className: 'text-right', cell: (r) => count(r.won) },
  { key: 'lost', header: 'Lost', className: 'text-right', cell: (r) => count(r.lost) },
  { key: 'conversionRate', header: 'Won %', className: 'text-right', cell: (r) => <span className="font-medium tabular-nums">{r.conversionRate ?? 0}%</span> },
  { key: 'estimatedValue', header: 'Estimated value', className: 'text-right', cell: (r) => <span className="whitespace-nowrap tabular-nums">{formatNpr(r.estimatedValue)}</span> },
];

/**
 * Lead sources (Phase I10, `reports:sales`): leads created in the range by where they came from — open, won, lost,
 * the share won (the API's rate) and the website's estimates — most leads first.
 */
export function LeadSourcesReport({ params, patch }) {
  const query = reportQueryParams(params);
  const { data, isLoading, isFetching, error, refetch } = useGetLeadSourceReportQuery(query);
  return (
    <>
      <ReportToolbar params={params} onChange={patch} csv={{ path: '/admin/reports/lead-sources', params: query, name: 'lead-sources' }} />
      <ReportTable
        storageKey="report-lead-sources"
        columns={columns}
        rows={data ?? []}
        getRowId={(r) => r.source}
        isLoading={isLoading}
        isFetching={isFetching}
        error={error}
        refetch={refetch}
        rowLabel={(r) => LEAD_SOURCE_LABELS[r.source] ?? r.source}
        emptyTitle="No leads in this range"
      />
    </>
  );
}
