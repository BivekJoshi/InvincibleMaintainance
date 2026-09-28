import { Link } from 'react-router-dom';
import { TrendingDown } from 'lucide-react';
import { useGetLostReportQuery } from '@/api/reportsApi';
import { ReportTable } from '@/components/reports/ReportTable';
import { ReportToolbar } from '@/components/reports/ReportToolbar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { reportQueryParams } from '@/hooks/useReportParams';
import { LEAD_STATUS_LABELS, LOST_CATEGORY_LABELS } from '@/config/constants';
import { titleCase } from '@/helpers/format';

/** A count's share of the total, for the bars and the Share column — counts of leads, never money. */
const share = (count, total) => (total ? Math.round((count / total) * 100) : 0);
const categoryLabel = (c) => LOST_CATEGORY_LABELS[c] ?? titleCase(c ?? 'Not given');

/**
 * Lost leads (Phase L1's report, folded into Sales reports by Phase I10, `reports:sales`): leads lost in the range
 * (on the day they closed) — the count per category, then category × the stage it was lost at × service with its
 * share. The range is the reports' shared one; the CSV is the API's.
 */
export function LostReport({ params, patch }) {
  const query = reportQueryParams(params);
  const { data, isLoading, isFetching, error, refetch } = useGetLostReportQuery(query);
  const total = data?.total ?? 0;
  const byCategory = data?.byCategory ?? [];
  const rows = (data?.rows ?? []).map((r) => ({ ...r, id: `${r.category}:${r.stage ?? '-'}:${r.serviceId ?? '-'}` }));

  const columns = [
    { key: 'category', header: 'Why', cell: (r) => <span className="font-medium">{categoryLabel(r.category)}</span> },
    { key: 'stage', header: 'Lost at', cell: (r) => (r.stage ? LEAD_STATUS_LABELS[r.stage] ?? titleCase(r.stage) : '—') },
    { key: 'serviceName', header: 'Service', cell: (r) => r.serviceName ?? <span className="text-muted-foreground">General enquiry</span> },
    { key: 'count', header: 'Leads', className: 'text-right tabular-nums', cell: (r) => r.count },
    { key: 'share', header: 'Share', className: 'text-right tabular-nums', cell: (r) => `${share(r.count, total)}%` },
  ];

  return (
    <>
      <ReportToolbar params={params} onChange={patch} csv={{ path: '/admin/reports/lost', params: query, name: 'lost-leads' }} />
      <Card className="mb-4">
        <CardHeader className="flex-row items-center justify-between gap-2 space-y-0 pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <TrendingDown className="h-4 w-4 text-destructive" aria-hidden /> By category
          </CardTitle>
          <p className="text-sm tabular-nums text-muted-foreground">{isLoading ? '…' : `${total} lead${total === 1 ? '' : 's'} lost`}</p>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {[0, 1, 2].map((i) => <Skeleton key={i} className="h-14 rounded-lg" />)}
            </div>
          ) : byCategory.length ? (
            <ul aria-label="Lost leads by category" className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {byCategory.map((c) => (
                <li key={c.category ?? 'none'} className="rounded-lg border px-3 py-2">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="min-w-0 truncate text-sm font-medium">{categoryLabel(c.category)}</span>
                    <span className="shrink-0 text-sm tabular-nums">
                      <span className="font-semibold">{c.count}</span>
                      <span className="text-muted-foreground"> · {share(c.count, total)}%</span>
                    </span>
                  </div>
                  <div aria-hidden className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted">
                    <div className="h-full rounded-full bg-[hsl(var(--chart-1))]" style={{ width: `${share(c.count, total)}%` }} />
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">
              No lead was lost in this range. <Link to="/admin/leads?view=all&status=LOST" className="underline hover:text-primary">See every lost lead</Link>
            </p>
          )}
        </CardContent>
      </Card>
      <ReportTable
        storageKey="lost-report"
        columns={columns}
        rows={rows}
        isLoading={isLoading}
        isFetching={isFetching}
        error={error}
        refetch={refetch}
        rowLabel={(r) => `${categoryLabel(r.category)}, ${r.serviceName ?? 'General enquiry'}`}
        emptyTitle="Nothing lost in this range"
      />
    </>
  );
}
