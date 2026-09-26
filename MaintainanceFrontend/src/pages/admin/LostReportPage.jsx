import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { TrendingDown } from 'lucide-react';
import { useGetLostReportQuery } from '@/api/reportsApi';
import { PageHeader } from '@/components/common/PageHeader';
import { CustomTable } from '@/components/common/CustomTable/CustomTable';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { PageTransition } from '@/three/motion/motionKit';
import { useListParams } from '@/hooks/useListParams';
import { LEAD_STATUS_LABELS, LOST_CATEGORY_LABELS } from '@/config/constants';
import { formatDate, toKathmanduParts, titleCase } from '@/helpers/format';

/** The report opens on the last 90 Kathmandu days; the range is in the URL like any list filter. */
const DEFAULT_DAYS = 90;
const ktmDay = (ms) => toKathmanduParts(new Date(ms).toISOString()).date;

const share = (count, total) => (total ? Math.round((count / total) * 100) : 0);

const categoryLabel = (c) => LOST_CATEGORY_LABELS[c] ?? titleCase(c ?? 'Not given');

const filters = [{ key: 'lost', label: 'Lost between', type: 'dateRange' }];

/**
 * Why leads are lost — `GET /admin/reports/lost?from&to` (`reports:sales`, Phase L1): the count per
 * category, then category × the stage it was lost at × service as a table. Phase I10 folds it into
 * `/admin/reports`.
 */
export default function LostReportPage() {
  const defaults = useMemo(() => {
    const now = Date.now();
    return { from: ktmDay(now - (DEFAULT_DAYS - 1) * 86_400_000), to: ktmDay(now) };
  }, []);
  const [params, setParams] = useListParams(defaults);
  const { data, isLoading, isFetching, error, refetch } = useGetLostReportQuery({ from: params.from, to: params.to });

  const total = data?.total ?? 0;
  const byCategory = data?.byCategory ?? [];
  const rows = useMemo(
    () => (data?.rows ?? []).map((r) => ({ ...r, id: `${r.category}:${r.stage ?? '-'}:${r.serviceId ?? '-'}` })),
    [data],
  );

  const columns = [
    { key: 'category', header: 'Why', cell: (r) => <span className="font-medium">{categoryLabel(r.category)}</span> },
    { key: 'stage', header: 'Lost at', cell: (r) => (r.stage ? LEAD_STATUS_LABELS[r.stage] ?? titleCase(r.stage) : '—') },
    {
      key: 'serviceName', header: 'Service',
      cell: (r) => r.serviceName ?? <span className="text-muted-foreground">General enquiry</span>,
      exportValue: (r) => r.serviceName ?? 'General enquiry',
    },
    { key: 'count', header: 'Leads', className: 'text-right tabular-nums', cell: (r) => r.count },
    {
      key: 'share', header: 'Share', className: 'text-right tabular-nums',
      cell: (r) => `${share(r.count, total)}%`, exportValue: (r) => share(r.count, total),
    },
  ];

  const range = params.from || params.to
    ? `${params.from ? formatDate(params.from) : 'the start'} – ${params.to ? formatDate(params.to) : 'today'}`
    : 'all time';

  return (
    <PageTransition>
      <PageHeader
        title="Lost leads"
        description={`Why leads were lost, ${range} — by category, the stage they were lost at, and service.`}
      />

      <Card className="mb-4">
        <CardHeader className="flex-row items-center justify-between gap-2 space-y-0 pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <TrendingDown className="h-4 w-4 text-destructive" aria-hidden /> By category
          </CardTitle>
          <p className="text-sm tabular-nums text-muted-foreground">
            {isLoading ? '…' : `${total} lead${total === 1 ? '' : 's'} lost`}
          </p>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {[0, 1, 2].map((i) => <Skeleton key={i} className="h-14 rounded-lg" />)}
            </div>
          ) : byCategory.length ? (
            <ul aria-label="Lost leads by category" className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {byCategory.map((c) => (
                <li key={c.category} className="rounded-lg border px-3 py-2">
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

      <CustomTable
        storageKey="lost-report"
        columns={columns}
        data={rows}
        meta={{ page: 1, pages: 1, total: rows.length, limit: rows.length || 1 }}
        pageSizes={[]}
        params={params}
        onParamsChange={setParams}
        isLoading={isLoading}
        isFetching={isFetching}
        error={error}
        refetch={refetch}
        searchable={false}
        filters={filters}
        exportable
        exportName="lost-leads"
        emptyTitle="Nothing lost in this range"
        emptyDescription="Widen the dates to look further back."
        rowLabel={(r) => `${categoryLabel(r.category)}, ${r.serviceName ?? 'General enquiry'}`}
      />
    </PageTransition>
  );
}
