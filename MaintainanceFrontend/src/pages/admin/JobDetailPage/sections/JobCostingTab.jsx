import { useState } from 'react';
import { useGetJobCostingQuery } from '@/api/jobsApi';
import { DataTable } from '@/components/common/DataTable/DataTable';
import { ErrorState } from '@/components/common/ErrorState';
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

/**
 * What the job cost against what it was invoiced for, all in paisa from the API. Every total is
 * the sum of the lines under it — the API rounds each line once — so the page reconciles to the
 * paisa. Labour is time × each technician's hourly rate; materials are costed at purchase rate.
 */
export function JobCostingTab({ job }) {
  const { data: c, isLoading, error, refetch } = useGetJobCostingQuery(job.id);
  const [params, setParams] = useState({});
  if (isLoading) return <CardSkeleton />;
  if (error) return <ErrorState error={error} onRetry={refetch} />;

  const { materials, labour, expenses, invoices } = c.breakdown;
  const table = (columns, rows, empty, label) => (
    <DataTable
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
        <Stat label="Invoiced" value={formatNpr(c.billable.invoiced)} sub={c.billable.invoiced ? undefined : 'Not invoiced yet'} />
        <Stat
          label="Margin"
          value={formatNpr(c.margin)}
          sub={c.marginPct != null ? `${c.marginPct}% of invoiced` : undefined}
          tone={c.margin < 0 ? 'text-destructive' : 'text-success'}
        />
      </div>

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
