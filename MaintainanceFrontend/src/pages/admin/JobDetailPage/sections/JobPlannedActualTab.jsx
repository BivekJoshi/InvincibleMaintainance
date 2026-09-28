import { HardHat, Package, Timer } from 'lucide-react';
import { useGetJobPlannedVsActualQuery } from '@/api/jobsApi';
import { CustomTable } from '@/components/common/CustomTable/CustomTable';
import { ErrorState } from '@/components/common/ErrorState';
import { StateBadge } from '@/components/common/StateBadge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { CardSkeleton } from '@/components/ui/skeleton';
import { labourState, qtyWithUnit } from '@/helpers/execution';
import { formatQty } from '@/helpers/handoff';
import { cn } from '@/helpers/utils';
import { ShortfallPurchaseListButton } from './ShortfallPurchaseListButton';

const onePage = (rows) => ({ page: 1, pages: 1, total: rows.length, limit: rows.length || 1 });
const noop = () => {};

const nameCell = (r) => (
  <div className="min-w-0">
    <p className="truncate font-medium">{r.name ?? '—'}</p>
    {r.code ? <p className="font-mono text-xs text-muted-foreground">{r.code}</p> : null}
  </div>
);

const MATERIAL_COLUMNS = [
  { key: 'name', header: 'Material', cell: nameCell, exportValue: (r) => r.name ?? '' },
  { key: 'planned', header: 'Planned', className: 'text-right', cell: (r) => <span className="whitespace-nowrap tabular-nums">{qtyWithUnit(r.planned, r.unit)}</span> },
  { key: 'issued', header: 'Issued', className: 'text-right', cell: (r) => <span className="whitespace-nowrap tabular-nums">{qtyWithUnit(r.issued, r.unit)}</span> },
  {
    key: 'received', header: 'Received on site', className: 'text-right',
    cell: (r) => <span className="whitespace-nowrap tabular-nums text-muted-foreground" title="Deliveries the site diary recorded — they do not move stock">{qtyWithUnit(r.received, r.unit)}</span>,
  },
  {
    key: 'variance', header: 'Issued vs plan', className: 'text-right',
    cell: (r) => (r.overPlan ? (
      <StateBadge tone="warning" className="tabular-nums">
        <span data-testid={`over-plan-${r.materialId}`}>{Number(r.planned) ? `Over plan by ${qtyWithUnit(r.variance, r.unit)}` : 'Not in the plan'}</span>
      </StateBadge>
    ) : (
      <span className={cn('whitespace-nowrap text-xs tabular-nums', Number(r.variance) < 0 ? 'text-muted-foreground' : 'text-success')}>
        {Number(r.variance) < 0 ? `${qtyWithUnit(-Number(r.variance), r.unit)} still to issue` : 'On plan'}
      </span>
    )),
    exportValue: (r) => String(r.variance ?? ''),
  },
];

const LABOUR_WORDS = {
  over: { tone: 'warning', text: 'Over plan' },
  done: { tone: 'success', text: 'On plan' },
  under: { tone: 'muted', text: 'Within plan' },
  unplanned: { tone: 'warning', text: 'Not in the plan' },
};

const LABOUR_COLUMNS = [
  { key: 'name', header: 'Trade', cell: nameCell, exportValue: (r) => r.name ?? '' },
  { key: 'plannedDays', header: 'Planned days', className: 'text-right', cell: (r) => <span className="tabular-nums">{formatQty(r.plannedDays)}</span> },
  { key: 'loggedDays', header: 'Logged days', className: 'text-right', cell: (r) => <span className="font-medium tabular-nums" data-testid={`logged-${r.tradeId}`}>{formatQty(r.loggedDays)}</span> },
  {
    key: 'state', header: '',
    cell: (r) => {
      const words = LABOUR_WORDS[labourState(r)];
      return <StateBadge tone={words.tone}>{words.text}</StateBadge>;
    },
    exportValue: (r) => LABOUR_WORDS[labourState(r)].text,
  },
];

/**
 * The **Materials / Labour** tab (Phase L7) — `GET /admin/jobs/:id/planned-vs-actual` (`jobs:read`), quantities only:
 * per material, planned (the job's requirements) against issued (from stock) and received on site (the diary's
 * challans — they do not move stock), with the materials past their plan on the warning surface; per trade, the labour
 * days planned against the days the site diary logged (headcount × the hours worked of an 8-hour day); and the hours
 * the technicians' timers logged. "Create purchase list from shortfall" drafts what is short.
 */
export function JobPlannedActualTab({ job }) {
  const { data, isLoading, error, refetch } = useGetJobPlannedVsActualQuery(job.id);
  if (isLoading) return <CardSkeleton />;
  if (error) return <ErrorState error={error} onRetry={refetch} />;

  const materials = data?.materials ?? [];
  const labour = data?.labour ?? [];
  const over = materials.filter((m) => m.overPlan).length;

  return (
    <div className="space-y-4" data-testid="job-planned-actual">
      <Card role="region" aria-labelledby="pva-materials">
        <CardHeader className="flex-row flex-wrap items-start justify-between gap-2 space-y-0 pb-3">
          <div className="min-w-0 space-y-1">
            <CardTitle id="pva-materials" className="flex items-center gap-2 text-base"><Package className="h-4 w-4 text-primary" aria-hidden /> Materials</CardTitle>
            <CardDescription>Planned from the quotation’s take-off, issued from stock, and received on site as the diary recorded it.</CardDescription>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {over ? <StateBadge tone="warning">{over} over plan</StateBadge> : null}
            <ShortfallPurchaseListButton job={job} />
          </div>
        </CardHeader>
        <CardContent>
          <CustomTable
            columns={MATERIAL_COLUMNS}
            data={materials}
            meta={onePage(materials)}
            params={{}}
            onParamsChange={noop}
            searchable={false}
            pageSizes={[]}
            getRowId={(r) => r.materialId}
            rowLabel={(r) => r.name ?? r.code ?? 'Material'}
            emptyTitle="No materials planned, issued or received"
          />
        </CardContent>
      </Card>

      <Card role="region" aria-labelledby="pva-labour">
        <CardHeader className="pb-3">
          <CardTitle id="pva-labour" className="flex items-center gap-2 text-base"><HardHat className="h-4 w-4 text-primary" aria-hidden /> Labour</CardTitle>
          <CardDescription>
            Labour days planned against the days the site diary logged — each day’s headcount by trade, less the hours lost, of a
            {' '}{formatQty(data?.workdayHours ?? 8)}-hour day.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <CustomTable
            columns={LABOUR_COLUMNS}
            data={labour}
            meta={onePage(labour)}
            params={{}}
            onParamsChange={noop}
            searchable={false}
            pageSizes={[]}
            getRowId={(r) => r.tradeId}
            rowLabel={(r) => r.name ?? r.code ?? 'Trade'}
            emptyTitle="No labour planned or logged yet"
          />
          <p className="flex items-center gap-2 text-sm text-muted-foreground" data-testid="technician-hours">
            <Timer className="h-4 w-4" aria-hidden /> The technicians’ timers logged <strong className="text-foreground tabular-nums">{formatQty(data?.technicianHours ?? 0)} h</strong> on this job.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
