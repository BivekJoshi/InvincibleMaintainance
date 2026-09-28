import { Link } from 'react-router-dom';
import { BadgeIndianRupee, ClipboardList, Flag, Milestone } from 'lucide-react';
import { useGetJobProgressQuery } from '@/api/jobsApi';
import { CustomTable } from '@/components/common/CustomTable/CustomTable';
import { EmptyState } from '@/components/common/EmptyState';
import { ErrorState } from '@/components/common/ErrorState';
import { StateBadge } from '@/components/common/StateBadge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { CardSkeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/hooks/useAuth';
import { PAYMENT_TRIGGER_LABELS } from '@/config/constants';
import { nextBillPrompt, pctText, qtyWithUnit, seesEarnedValue } from '@/helpers/execution';
import { formatSignedNpr } from '@/helpers/format';
import { formatShare } from '@/helpers/paymentSchedule';
import { cn } from '@/helpers/utils';

const onePage = (rows) => ({ page: 1, pages: 1, total: rows.length, limit: rows.length || 1 });
const noop = () => {};

const money = (paisa) => <span className="whitespace-nowrap tabular-nums">{formatSignedNpr(paisa)}</span>;

function lineColumns(showMoney) {
  return [
    { key: 'number', header: 'No.', cell: (r) => <span className="font-mono text-xs">{r.number ?? '—'}</span> },
    {
      key: 'description', header: 'Item',
      cell: (r) => (
        <span className="block max-w-md">
          {r.description}
          {r.source === 'VARIATION' ? <StateBadge tone="info" className="ml-2 align-middle text-[10px]">Variation</StateBadge> : null}
          {r.isProvisional ? <StateBadge tone="muted" className="ml-2 align-middle text-[10px]">Provisional</StateBadge> : null}
        </span>
      ),
      exportValue: (r) => r.description,
    },
    {
      key: 'quotedQty', header: 'Quoted', className: 'text-right',
      cell: (r) => <span className={cn('whitespace-nowrap tabular-nums', Number(r.quotedQty) < 0 && 'text-destructive')}>{qtyWithUnit(r.quotedQty, r.unit)}</span>,
    },
    {
      key: 'progressPct', header: 'Progress',
      cell: (r) => (
        <div className="flex min-w-36 items-center gap-2">
          <Progress value={Number(r.progressPct) || 0} className="h-2 flex-1" aria-label={`${r.number ?? ''} ${r.description}`.trim()} />
          <span className="w-12 shrink-0 text-right text-xs font-medium tabular-nums" data-testid={`line-progress-${r.id}`}>{pctText(r.progressPct)}</span>
        </div>
      ),
      exportValue: (r) => pctText(r.progressPct),
    },
    ...(showMoney ? [
      { key: 'rate', header: 'Rate', className: 'text-right', cell: (r) => (r.rate != null ? money(r.rate) : '—') },
      { key: 'value', header: 'Value', className: 'text-right', cell: (r) => (r.value != null ? money(r.value) : '—') },
      { key: 'earned', header: 'Earned', className: 'text-right', cell: (r) => (r.earned != null ? <strong className="font-semibold">{money(r.earned)}</strong> : '—') },
    ] : []),
  ];
}

const STAGE_COLUMNS = [
  { key: 'label', header: 'Stage', cell: (r) => <span className="font-medium">{r.label}</span> },
  { key: 'trigger', header: 'Falls due', cell: (r) => <span className="text-xs text-muted-foreground">{PAYMENT_TRIGGER_LABELS[r.trigger] ?? r.trigger}</span> },
  { key: 'basisPoints', header: 'Share', className: 'text-right', cell: (r) => <span className="tabular-nums">{formatShare(r.basisPoints)}</span> },
  { key: 'cumulativeBp', header: 'Reached at', className: 'text-right', cell: (r) => <span className="tabular-nums text-muted-foreground">{formatShare(r.cumulativeBp)}</span> },
  {
    key: 'state', header: 'Bill',
    cell: (r) => (r.billed ? <StateBadge tone="success">Billed</StateBadge>
      : r.due ? <StateBadge tone="warning">Due now</StateBadge>
        : <StateBadge tone="muted">Not yet</StateBadge>),
  },
];

/**
 * The **BOQ & progress** tab (Phase L7) — `GET /admin/jobs/:id/progress` (`jobs:read`). The job's lines by section with
 * the quoted quantity and progress (set by the latest site diary day that mentions a line), a variation's lines marked;
 * the job's progress by value (`earnedPct`); the payment schedule's stages, and — once earned value passes a MILESTONE
 * stage that is not billed — the prompt for the next running bill (L8 raises it; for now it links to the invoices).
 *
 * **Money only for those who may see it**: a line's rate, value and earned value, and the totals, are the server's paisa
 * — sent only to `quotations:read` / `invoices:read` holders — and shown only to them (a dispatcher sees progress and
 * quantities). Nothing is added up here.
 */
export function JobProgressTab({ job }) {
  const { can } = useAuth();
  const { data, isLoading, error, refetch } = useGetJobProgressQuery(job.id);

  if (isLoading) return <CardSkeleton />;
  if (error) return <ErrorState error={error} onRetry={refetch} />;
  const sections = data?.sections ?? [];
  if (!sections.some((s) => s.lines?.length)) {
    return <EmptyState title="No bill of quantities on this job" description="A job made from an accepted quotation carries its lines here." />;
  }

  const showMoney = seesEarnedValue(can) && data.totals?.value != null;
  const columns = lineColumns(showMoney);
  const prompt = nextBillPrompt(data.nextBill);
  const stages = data.stages ?? [];
  const earnedPct = Number(data.totals?.earnedPct) || 0;

  return (
    <div className="space-y-4" data-testid="job-progress">
      {prompt ? (
        <div role="status" data-testid="next-bill" className="surface-warning flex flex-wrap items-center gap-3 rounded-lg border p-3 text-sm">
          <Flag className="h-4 w-4 shrink-0" aria-hidden />
          <p className="min-w-0 flex-1 font-medium">{prompt}</p>
          {can('invoices:read') ? (
            <Link to="/admin/invoices" className="font-medium underline underline-offset-2">Open invoices</Link>
          ) : <span className="text-xs">Tell accounts.</span>}
        </div>
      ) : null}

      <Card role="region" aria-labelledby="progress-summary">
        <CardHeader className="pb-3">
          <CardTitle id="progress-summary" className="flex items-center gap-2 text-base">
            <ClipboardList className="h-4 w-4 text-primary" aria-hidden /> Work done
          </CardTitle>
          <CardDescription>By value of the lines, from the latest site diary day that marks each one.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-3">
            <Progress value={earnedPct} className="h-3 flex-1" aria-label="Work done by value" />
            <span className="text-lg font-semibold tabular-nums" data-testid="earned-pct">{pctText(earnedPct)}</span>
          </div>
          {showMoney ? (
            <dl className="grid grid-cols-2 gap-3 text-sm sm:max-w-md" data-testid="earned-value">
              <div>
                <dt className="flex items-center gap-1 text-xs text-muted-foreground"><BadgeIndianRupee className="h-3.5 w-3.5" aria-hidden /> Value of the work</dt>
                <dd className="font-medium">{money(data.totals.value)}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Earned so far</dt>
                <dd className="font-semibold">{money(data.totals.earned)}</dd>
              </div>
            </dl>
          ) : null}
        </CardContent>
      </Card>

      {sections.map((section, i) => (
        <Card key={`${section.title}-${i}`} role="region" aria-label={section.title}>
          <CardHeader className="pb-2"><CardTitle className="text-base">{section.title}</CardTitle></CardHeader>
          <CardContent>
            <CustomTable
              columns={columns}
              data={section.lines}
              meta={onePage(section.lines)}
              params={{}}
              onParamsChange={noop}
              searchable={false}
              pageSizes={[]}
              rowLabel={(r) => `${r.number ?? ''} ${r.description}`.trim()}
              emptyTitle="No lines in this section"
            />
          </CardContent>
        </Card>
      ))}

      {stages.length ? (
        <Card role="region" aria-labelledby="progress-stages">
          <CardHeader className="pb-2">
            <CardTitle id="progress-stages" className="flex items-center gap-2 text-base"><Milestone className="h-4 w-4 text-primary" aria-hidden /> Payment stages</CardTitle>
            <CardDescription>A milestone stage is due once the work done by value reaches its share.</CardDescription>
          </CardHeader>
          <CardContent>
            <CustomTable
              columns={STAGE_COLUMNS}
              data={stages}
              meta={onePage(stages)}
              params={{}}
              onParamsChange={noop}
              searchable={false}
              pageSizes={[]}
              rowLabel={(r) => r.label}
            />
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
