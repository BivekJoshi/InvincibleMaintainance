import { useState } from 'react';
import { useGetJobCostingQuery } from '@/api/jobsApi';
import { CustomTable } from '@/components/common/CustomTable/CustomTable';
import { ErrorState } from '@/components/common/ErrorState';
import { StateBadge } from '@/components/common/StateBadge';
import { StatusBadge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { CardSkeleton } from '@/components/ui/skeleton';
import { formatDateTime, formatMinutes, formatNpr } from '@/helpers/format';
import { cn } from '@/helpers/utils';

const meta = (rows) => ({ page: 1, pages: 1, total: rows.length, limit: rows.length || 1 });

function Stat({ label, value, sub, tone }) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className={cn('mt-1 text-xl font-bold tabular-nums', tone)}>{value}</p>
        {sub ? <p className="text-xs text-muted-foreground">{sub}</p> : null}
      </CardContent>
    </Card>
  );
}

function Section({ title, total, children }) {
  return (
    <section className="space-y-2">
      <h3 className="flex items-baseline justify-between text-sm font-semibold">
        {title}
        {total != null ? <span className="tabular-nums text-muted-foreground">{total}</span> : null}
      </h3>
      {children}
    </section>
  );
}

/** Quoted cost against actual, by kind (Phase L8): the server's two figures side by side — never a difference worked here. */
const QUOTED_KINDS = [
  { key: 'materials', label: 'Materials', actual: (c) => c.cost.materials },
  { key: 'labour', label: 'Labour', actual: (c) => c.cost.labour },
  { key: 'other', label: 'Other (expenses)', actual: (c) => c.cost.expenses },
  { key: 'total', label: 'Total', actual: (c) => c.cost.total, emphasis: true },
];

/** Over or within the quote, in words — a comparison of the server's two figures, no arithmetic. */
function quoteVerdict(quoted, actual) {
  if (quoted === null || quoted === undefined) return <span className="text-xs text-muted-foreground">No quoted cost</span>;
  return actual > quoted
    ? <StateBadge tone="warning">Over the quote</StateBadge>
    : <StateBadge tone="success">Within the quote</StateBadge>;
}

/**
 * Phase L8 — **quoted vs actual**: the cost frozen in the accepted quotation's and its variations' recipes (`quoted`:
 * materials, labour, other, total, and `complete` — whether every priced row had a known cost) beside what the job
 * actually cost. `costs:read` only, like the whole tab. Nothing on a job without a quotation.
 */
function QuotedVsActual({ costing }) {
  const { quoted } = costing;
  const rows = QUOTED_KINDS.map((k) => ({ ...k, quoted: quoted[k.key], actual: k.actual(costing) }));
  return (
    <section className="space-y-2" aria-labelledby="quoted-vs-actual" data-testid="quoted-vs-actual">
      <h3 id="quoted-vs-actual" className="text-sm font-semibold">Quoted vs actual cost</h3>
      <p className="text-xs text-muted-foreground">
        Quoted: the cost the accepted quotation’s and variations’ recipes carried when they were priced. Actual: what this job has used and logged.
      </p>
      {!quoted.complete ? (
        <p role="note" className="surface-warning rounded-md border px-3 py-2 text-xs" data-testid="quoted-incomplete">
          Some quoted rows had no known cost (no recipe, or a cost missing in one) — the quoted cost is a floor, not the whole.
        </p>
      ) : null}
      <CustomTable
        columns={[
          { key: 'label', header: 'Cost', cell: (r) => <span className={r.emphasis ? 'font-semibold' : undefined}>{r.label}</span> },
          { key: 'quoted', header: 'Quoted', className: 'text-right', cell: (r) => <span className="tabular-nums" data-testid={`quoted-${r.key}`}>{r.quoted === null || r.quoted === undefined ? '—' : formatNpr(r.quoted)}</span> },
          { key: 'actual', header: 'Actual', className: 'text-right', cell: (r) => <span className={cn('tabular-nums', r.emphasis && 'font-semibold')} data-testid={`actual-${r.key}`}>{formatNpr(r.actual)}</span> },
          { key: 'verdict', header: '', label: 'Against the quote', cell: (r) => quoteVerdict(r.quoted, r.actual) },
        ]}
        data={rows}
        meta={meta(rows)}
        params={{}}
        onParamsChange={() => {}}
        searchable={false}
        pageSizes={[]}
        getRowId={(r) => r.key}
        rowLabel={(r) => r.label}
      />
    </section>
  );
}

/**
 * What the job cost against what it was invoiced for, all in paisa from the API. Every total is
 * the sum of the lines under it — the API rounds each line once — so the page reconciles to the
 * paisa. Labour is time × each technician's hourly rate; materials are costed at purchase rate.
 *
 * Since Phase L8 **Invoiced** is what was billed net of discount and VAT (void invoices left out; a final bill's
 * deductions are negative lines, so stage bills never count twice) — on a fully billed BOQ job, the contract's taxable
 * value — and the tab opens with quoted vs actual cost (`QuotedVsActual`).
 */
export function JobCostingTab({ job }) {
  const { data: c, isLoading, error, refetch } = useGetJobCostingQuery(job.id);
  const [params, setParams] = useState({});
  if (isLoading) return <CardSkeleton />;
  if (error) return <ErrorState error={error} onRetry={refetch} />;

  const { materials, labour, expenses, invoices } = c.breakdown;
  const table = (columns, rows, empty, label) => (
    <CustomTable
      columns={columns} data={rows} meta={meta(rows)} params={params} onParamsChange={setParams}
      searchable={false} pageSizes={[]} emptyTitle={empty} rowLabel={label}
    />
  );

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Labour" value={formatNpr(c.cost.labour)} sub={formatMinutes(c.labourMinutes)} />
        <Stat label="Materials at cost" value={formatNpr(c.cost.materials)} sub={`Billable ${formatNpr(c.billable.materials)}`} />
        <Stat label="Expenses" value={formatNpr(c.cost.expenses)} />
        <Stat label="Total cost" value={formatNpr(c.cost.total)} />
        <Stat label="Invoiced" value={formatNpr(c.billable.invoiced)} sub={c.billable.invoiced ? 'Before VAT, net of discount' : 'Not invoiced yet'} />
        <Stat
          label="Margin"
          value={formatNpr(c.margin)}
          sub={c.marginPct != null ? `${c.marginPct}% of invoiced` : undefined}
          tone={c.margin < 0 ? 'text-destructive' : 'text-success'}
        />
      </div>

      {c.quoted ? <QuotedVsActual costing={c} /> : null}

      <Section title="Materials" total={formatNpr(c.cost.materials)}>
        {table([
          { key: 'name', header: 'Material', cell: (m) => <span>{m.name} <span className="font-mono text-xs text-muted-foreground">{m.code}</span></span> },
          { key: 'qty', header: 'Quantity', className: 'text-right', cell: (m) => <span className="tabular-nums">{Number(m.qty.toFixed(3))} {m.unit}</span> },
          { key: 'cost', header: 'Cost', className: 'text-right', cell: (m) => <span className="tabular-nums">{formatNpr(m.cost)}</span> },
          { key: 'amount', header: 'Billable', className: 'text-right', cell: (m) => <span className="tabular-nums">{m.isBillable ? formatNpr(m.amount) : '—'}</span> },
        ], materials, 'No material issued', (m) => m.name)}
      </Section>

      <Section title="Labour" total={formatNpr(c.cost.labour)}>
        {table([
          { key: 'technician', header: 'Technician', cell: (l) => l.technician },
          { key: 'startedAt', header: 'When', cell: (l) => <span className="text-xs">{formatDateTime(l.startedAt)}</span> },
          { key: 'minutes', header: 'Time', className: 'text-right', cell: (l) => formatMinutes(l.minutes) },
          { key: 'cost', header: 'Cost', className: 'text-right', cell: (l) => <span className="tabular-nums">{formatNpr(l.cost)}</span> },
        ], labour, 'No time recorded', (l) => l.technician)}
      </Section>

      <Section title="Expenses" total={formatNpr(c.cost.expenses)}>
        {table([
          { key: 'category', header: 'Expense', cell: (e) => e.category },
          { key: 'vendor', header: 'Paid to', cell: (e) => e.vendor ?? '—' },
          { key: 'amount', header: 'Amount', className: 'text-right', cell: (e) => <span className="tabular-nums">{formatNpr(e.amount)}</span> },
        ], expenses, 'No expenses on this job', (e) => e.category)}
      </Section>

      <Section title="Invoices" total={formatNpr(c.billable.invoiced)}>
        {table([
          { key: 'number', header: 'Invoice', cell: (i) => <span className="font-mono text-xs">{i.number}</span> },
          { key: 'status', header: 'Status', cell: (i) => <StatusBadge status={i.status} /> },
        ], invoices, 'Not invoiced yet', (i) => i.number)}
      </Section>
    </div>
  );
}
