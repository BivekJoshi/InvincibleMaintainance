import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import {
  BadgeIndianRupee, ClipboardList, Flag, Milestone, ReceiptText, Ruler,
} from 'lucide-react';
import { useGetJobProgressQuery } from '@/api/jobsApi';
import { useRaiseStageInvoiceMutation } from '@/api/financeApi';
import { CustomTable } from '@/components/common/CustomTable/CustomTable';
import { EmptyState } from '@/components/common/EmptyState';
import { ErrorState } from '@/components/common/ErrorState';
import { StateBadge } from '@/components/common/StateBadge';
import { InvoiceFromJobSheet } from '@/components/finance/InvoiceFromJobSheet';
import { MeasureLineSheet } from '@/components/jobs/MeasureLineSheet';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { CardSkeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/hooks/useAuth';
import { useConfirm } from '@/hooks/useConfirm';
import { PAYMENT_TRIGGER_LABELS } from '@/config/constants';
import {
  apiRefusal, finalBillAction, isMeasured, measureLock, measurementState, mustMeasure, stageRaisable,
} from '@/helpers/closeout';
import { nextBillPrompt, pctText, qtyWithUnit, seesEarnedValue } from '@/helpers/execution';
import { formatSignedNpr } from '@/helpers/format';
import { formatShare } from '@/helpers/paymentSchedule';
import { cn } from '@/helpers/utils';
import { toastError, toastSuccess } from '@/redux/slices/uiSlice';
import { JobMeasurementCard } from './JobMeasurementCard';

const onePage = (rows) => ({ page: 1, pages: 1, total: rows.length, limit: rows.length || 1 });
const noop = () => {};

const money = (paisa) => <span className="whitespace-nowrap tabular-nums">{formatSignedNpr(paisa)}</span>;

/**
 * @param {boolean} showMoney  rate, value and earned value (the server sends them only to `quotations:read` /
 *   `invoices:read`)
 * @param {string|null} contractType  which lines the final measurement covers (Phase L8)
 */
function lineColumns(showMoney, contractType) {
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
      // Phase L8: the final measurement — the server's quantity, or "To measure" on a line the contract measures.
      key: 'measuredQty', header: 'Measured', className: 'text-right',
      cell: (r) => (isMeasured(r)
        ? <span className="whitespace-nowrap font-medium tabular-nums" data-testid={`line-measured-${r.id}`}>{qtyWithUnit(r.measuredQty, r.unit)}</span>
        : mustMeasure(r, contractType)
          ? <StateBadge tone="warning" className="text-[10px]">To measure</StateBadge>
          : <span className="text-muted-foreground">—</span>),
      exportValue: (r) => (isMeasured(r) ? qtyWithUnit(r.measuredQty, r.unit) : ''),
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
 * stage that is not billed — the prompt for the next running bill.
 *
 * **Money only for those who may see it**: a line's rate, value and earned value, and the totals, are the server's paisa
 * — sent only to `quotations:read` / `invoices:read` holders — and shown only to them (a dispatcher sees progress and
 * quantities). Nothing is added up here.
 *
 * Phase L8 — close-out:
 * - **Raise running bill** on the prompt and on each unbilled MILESTONE stage (`invoices:write`) — `POST
 *   /admin/jobs/:id/invoices/stage`, then the new DRAFT opens. A stage not yet reached asks first; the server's refusals
 *   (STAGE_BILLED, STAGE_NOT_MILESTONE, FINAL_ALREADY_BILLED) are toasted in its words.
 * - **The final measurement**: each line's measured quantity (the server's, from the job detail's lines), "To measure" on
 *   a line the contract measures, a row's **Measure…** (`jobs:write`, the kit's `measurements` field in
 *   `components/jobs/MeasureLineSheet`), and `JobMeasurementCard` — close and reopen.
 * - **Raise final bill…** (`invoices:write`, a finished job) opens Phase I's from-job sheet on this job, with the server's
 *   final-bill preview.
 */
export function JobProgressTab({ job }) {
  const { can } = useAuth();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const [confirm, confirmDialog] = useConfirm();
  const { data, isLoading, error, refetch } = useGetJobProgressQuery(job.id);
  const [raiseStage, { isLoading: raising }] = useRaiseStageInvoiceMutation();
  const [measuring, setMeasuring] = useState(null); // a line id
  const [billing, setBilling] = useState(false);
  const canMeasure = can('jobs:write');
  const canBill = can('invoices:write');

  // The progress answer's lines, with the job detail's final measurement (rows and the server's quantity) on each.
  const detailLines = useMemo(() => new Map((job.lines ?? []).map((l) => [l.id, l])), [job.lines]);
  const sections = useMemo(() => (data?.sections ?? []).map((section) => ({
    ...section,
    lines: (section.lines ?? []).map((l) => {
      const detail = detailLines.get(l.id);
      return detail ? { ...l, measurements: detail.measurements ?? [], measuredQty: detail.measuredQty ?? null } : l;
    }),
  })), [data?.sections, detailLines]);

  if (isLoading) return <CardSkeleton />;
  if (error) return <ErrorState error={error} onRetry={refetch} />;
  if (!sections.some((s) => s.lines?.length)) {
    return <EmptyState title="No bill of quantities on this job" description="A job made from an accepted quotation carries its lines here." />;
  }

  const state = measurementState(job);
  const showMoney = seesEarnedValue(can) && data.totals?.value != null;
  const columns = lineColumns(showMoney, state.contractType);
  const prompt = nextBillPrompt(data.nextBill);
  const stages = data.stages ?? [];
  const earnedPct = Number(data.totals?.earnedPct) || 0;
  const finalBill = finalBillAction(job, can);
  const measuringLine = measuring ? sections.flatMap((s) => s.lines).find((l) => l.id === measuring) ?? detailLines.get(measuring) : null;

  /** A MILESTONE stage → its RUNNING bill; the new draft opens. One not reached yet is confirmed first. */
  const raiseBill = async (stage) => {
    if (!stage.due) {
      const ok = await confirm({
        title: `Raise the running bill for ${stage.label}?`,
        description: `The work done by value (${pctText(earnedPct)}) has not reached this stage (${formatShare(stage.cumulativeBp ?? stage.basisPoints)}) yet. Bill it anyway?`,
        confirmLabel: 'Raise running bill',
      });
      if (!ok) return;
    }
    try {
      const invoice = await raiseStage({ jobId: job.id, paymentStageId: stage.id }).unwrap();
      dispatch(toastSuccess(`Running bill ${invoice.number} drafted`, 'Check it, then send it to the customer.'));
      navigate(`/admin/invoices/${invoice.id}`);
    } catch (err) {
      const refusal = apiRefusal(err);
      dispatch(toastError('Could not raise the running bill', refusal?.message));
      if (refusal?.code === 'STAGE_BILLED') refetch();
    }
  };

  const lineActions = canMeasure ? (r) => [{
    label: 'Measure…',
    icon: Ruler,
    disabled: Boolean(measureLock(r, state)),
    onSelect: () => setMeasuring(r.id),
  }] : undefined;

  const stageActions = canBill ? (r) => (stageRaisable(r) ? [{
    label: 'Raise running bill',
    icon: ReceiptText,
    disabled: raising,
    onSelect: () => raiseBill(r),
  }] : []) : undefined;

  return (
    <div className="space-y-4" data-testid="job-progress">
      {prompt ? (
        <div role="status" data-testid="next-bill" className="surface-warning flex flex-wrap items-center gap-3 rounded-lg border p-3 text-sm">
          <Flag className="h-4 w-4 shrink-0" aria-hidden />
          <p className="min-w-0 flex-1 font-medium">{prompt}</p>
          {canBill ? (
            <Button
              type="button"
              size="sm"
              disabled={raising}
              onClick={() => raiseBill({ id: data.nextBill.stageId, label: data.nextBill.label, basisPoints: data.nextBill.basisPoints, due: true })}
            >
              <ReceiptText aria-hidden /> Raise running bill
            </Button>
          ) : null}
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

      <JobMeasurementCard job={job} canWrite={canMeasure} onMeasure={setMeasuring} />

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
              rowActions={lineActions}
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
            <CardDescription>
              A milestone stage is due once the work done by value reaches its share; each is billed once, as a running bill.
              The rest comes with the final bill.
            </CardDescription>
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
              rowActions={stageActions}
              rowLabel={(r) => r.label}
            />
          </CardContent>
        </Card>
      ) : null}

      {finalBill.show ? (
        <Card role="region" aria-labelledby="final-bill-title" data-testid="final-bill-card">
          <CardHeader className="pb-2">
            <CardTitle id="final-bill-title" className="flex items-center gap-2 text-base"><ReceiptText className="h-4 w-4 text-primary" aria-hidden /> Final bill</CardTitle>
            <CardDescription>
              The contract by its type, less every advance and running bill — the server works it out and shows it before it is raised.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap items-center gap-3">
            <Button type="button" onClick={() => setBilling(true)} disabled={Boolean(finalBill.disabledReason)}>
              <ReceiptText aria-hidden /> Raise final bill…
            </Button>
            {finalBill.disabledReason ? <p className="text-xs text-muted-foreground">{finalBill.disabledReason}</p> : null}
          </CardContent>
        </Card>
      ) : null}

      {measuringLine ? <MeasureLineSheet job={job} line={measuringLine} onClose={() => setMeasuring(null)} /> : null}
      {billing ? (
        <InvoiceFromJobSheet
          open
          job={job}
          onOpenChange={(open) => { if (!open) setBilling(false); }}
          onCreated={(invoice) => navigate(`/admin/invoices/${invoice.id}`)}
        />
      ) : null}
      {confirmDialog}
    </div>
  );
}
