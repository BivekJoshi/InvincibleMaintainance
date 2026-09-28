import { Star } from 'lucide-react';
import { useGetTechnicianReportQuery } from '@/api/financeApi';
import { ReportTable } from '@/components/reports/ReportTable';
import { ReportToolbar } from '@/components/reports/ReportToolbar';
import { reportQueryParams } from '@/hooks/useReportParams';
import { formatMinutes } from '@/helpers/format';

const rating = (v) => (v == null ? <span className="text-muted-foreground">—</span> : (
  <span className="inline-flex items-center gap-1 tabular-nums"><Star className="h-3.5 w-3.5 text-sla-warn" aria-hidden />{v}</span>
));

const columns = [
  { key: 'name', header: 'Technician', cell: (r) => <span className="font-medium">{r.name}</span> },
  { key: 'assigned', header: 'Jobs', className: 'text-right', cell: (r) => <span className="tabular-nums">{r.assigned}</span> },
  { key: 'completed', header: 'Finished', className: 'text-right', cell: (r) => <span className="tabular-nums">{r.completed}</span> },
  { key: 'completionRate', header: 'Finished %', className: 'text-right', cell: (r) => <span className="tabular-nums">{r.completionRate}%</span> },
  { key: 'minutesLogged', header: 'Time logged', className: 'text-right', cell: (r) => <span className="whitespace-nowrap tabular-nums">{formatMinutes(r.minutesLogged)}</span> },
  { key: 'avgRating', header: 'Rating (range)', className: 'text-right', cell: (r) => rating(r.avgRating) },
  { key: 'lifetimeRating', header: 'Rating (all time)', className: 'text-right', cell: (r) => rating(r.lifetimeRating) },
];

/**
 * Technicians (Phase I10, `reports:ops`): jobs created in the range each person was on, how many they finished, the
 * time they logged and what customers rated them — the API's figures, most finished first. Never a labour rate.
 */
export function TechniciansReport({ params, patch }) {
  const query = reportQueryParams(params);
  const { data, isLoading, isFetching, error, refetch } = useGetTechnicianReportQuery(query);
  return (
    <>
      <ReportToolbar params={params} onChange={patch} csv={{ path: '/admin/reports/technicians', params: query, name: 'technicians' }} />
      <ReportTable
        storageKey="report-technicians"
        columns={columns}
        rows={data ?? []}
        getRowId={(r) => r.technicianId}
        isLoading={isLoading}
        isFetching={isFetching}
        error={error}
        refetch={refetch}
        rowLabel={(r) => r.name}
        emptyTitle="No jobs in this range"
      />
    </>
  );
}
