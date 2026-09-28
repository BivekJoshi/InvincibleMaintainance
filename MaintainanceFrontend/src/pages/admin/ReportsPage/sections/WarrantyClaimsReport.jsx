import { useGetWarrantyClaimReportQuery } from '@/api/financeApi';
import { ReportFigures } from '@/components/reports/ReportFigures';
import { ReportTable } from '@/components/reports/ReportTable';
import { ReportToolbar } from '@/components/reports/ReportToolbar';
import { reportQueryParams } from '@/hooks/useReportParams';
import { JOB_TYPE_LABELS } from '@/config/constants';
import { titleCase } from '@/helpers/format';

const figures = [
  { key: 'warranties', header: 'Warranties', className: 'text-right', cell: (r) => <span className="tabular-nums">{r.warranties}</span> },
  { key: 'claims', header: 'Claims', className: 'text-right', cell: (r) => <span className="tabular-nums">{r.claims}</span> },
  { key: 'claimRate', header: 'Claim rate', className: 'text-right', cell: (r) => <span className="font-medium tabular-nums">{r.claimRate}%</span> },
];
const serviceColumns = [{ key: 'service', header: 'Service', cell: (r) => <span className="font-medium">{r.service}</span> }, ...figures];
const typeColumns = [{ key: 'type', header: 'Type of work', cell: (r) => JOB_TYPE_LABELS[r.type] ?? titleCase(r.type ?? '') }, ...figures];

/**
 * Warranty claims (Phase I10, `reports:ops`): warranties issued and claims raised in the range, and the claim rate —
 * the honest quality measure — by service (Phase I's `byService`) and by type of work, all the API's figures.
 */
export function WarrantyClaimsReport({ params, patch }) {
  const query = reportQueryParams(params);
  const { data, isLoading, isFetching, error, refetch } = useGetWarrantyClaimReportQuery(query);
  return (
    <>
      <ReportToolbar params={params} onChange={patch} csv={{ path: '/admin/reports/warranty-claims', params: query, name: 'warranty-claims' }} />
      <ReportFigures
        isLoading={isLoading}
        label="Warranty claims"
        className="lg:grid-cols-3"
        items={data ? [
          { key: 'w', label: 'Warranties issued', value: data.totalWarranties ?? 0 },
          { key: 'c', label: 'Claims raised', value: data.totalClaims ?? 0 },
          { key: 'r', label: 'Claim rate', value: `${data.claimRate ?? 0}%`, tone: data.claimRate > 10 ? 'destructive' : undefined },
        ] : []}
      />
      <h2 className="mb-2 text-sm font-semibold">By service</h2>
      <ReportTable
        storageKey="report-claims-service"
        columns={serviceColumns}
        rows={data?.byService ?? []}
        getRowId={(r) => r.service}
        isLoading={isLoading}
        isFetching={isFetching}
        error={error}
        refetch={refetch}
        rowLabel={(r) => r.service}
        emptyTitle="No warranties in this range"
      />
      <h2 className="mb-2 mt-6 text-sm font-semibold">By type of work</h2>
      <ReportTable
        storageKey="report-claims-type"
        columns={typeColumns}
        rows={data?.byType ?? []}
        getRowId={(r) => r.type}
        isLoading={isLoading}
        rowLabel={(r) => JOB_TYPE_LABELS[r.type] ?? r.type}
        emptyTitle="No warranties in this range"
      />
    </>
  );
}
