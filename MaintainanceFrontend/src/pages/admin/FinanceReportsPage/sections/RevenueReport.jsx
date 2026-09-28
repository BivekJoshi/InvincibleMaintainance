import { useGetRevenueReportQuery } from '@/api/financeApi';
import { ChartCard, ChartTable } from '@/components/charts/ChartCard';
import { ColumnChart } from '@/components/charts/ColumnChart';
import { ReportFigures } from '@/components/reports/ReportFigures';
import { ReportTable } from '@/components/reports/ReportTable';
import { ReportToolbar } from '@/components/reports/ReportToolbar';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { reportQueryParams } from '@/hooks/useReportParams';
import { REVENUE_GROUPINGS } from '@/config/admin/financeViews';
import { formatNpr, formatNprShort } from '@/helpers/format';

const money = (paisa, strong = false) => <span className={`whitespace-nowrap tabular-nums ${strong ? 'font-semibold' : ''}`}>{formatNpr(paisa)}</span>;

const GROUP_HEADERS = { month: 'Month', service: 'Service', technician: 'Technician', day: 'Day' };

const columnsFor = (groupBy) => [
  { key: 'label', header: GROUP_HEADERS[groupBy] ?? 'Group', cell: (r) => <span className="font-medium">{r.label ?? r.key}</span> },
  { key: 'count', header: 'Invoices', className: 'text-right', cell: (r) => <span className="tabular-nums">{r.count}</span> },
  { key: 'taxable', header: 'Taxable', className: 'text-right', cell: (r) => money(r.taxable) },
  { key: 'vat', header: 'VAT', className: 'text-right', cell: (r) => money(r.vat) },
  { key: 'invoiced', header: 'Invoiced', className: 'text-right', cell: (r) => money(r.invoiced, true) },
  { key: 'collected', header: 'Collected', className: 'text-right', cell: (r) => money(r.collected) },
  { key: 'outstanding', header: 'Outstanding', className: 'text-right', cell: (r) => money(r.outstanding) },
];

/**
 * Revenue (Phase I5): invoices issued in the range (Kathmandu days; drafts and void ones are not revenue), grouped by
 * month, service or technician — each row's taxable amount, VAT, invoiced, collected and outstanding, and the totals,
 * all the server's sums of the stored documents (the VAT reconciles to the paisa). By month the invoiced amounts are
 * also a column chart, with its table twin: a trend is what a chart shows better.
 */
export function RevenueReport({ params, patch }) {
  const groupBy = REVENUE_GROUPINGS.some((g) => g.value === params.groupBy) ? params.groupBy : 'month';
  const query = reportQueryParams({ ...params, groupBy });
  const { data, isLoading, isFetching, error, refetch } = useGetRevenueReportQuery(query);
  const rows = (data?.rows ?? []).map((r) => ({ ...r, id: String(r.key) }));
  const totals = data?.totals;

  return (
    <>
      <ReportToolbar params={params} onChange={patch} csv={{ path: '/admin/reports/revenue', params: query, name: 'revenue' }}>
        <Select value={groupBy} onValueChange={(next) => patch({ groupBy: next })}>
          <SelectTrigger className="h-9 w-[160px]" aria-label="Group revenue"><SelectValue /></SelectTrigger>
          <SelectContent>
            {REVENUE_GROUPINGS.map((g) => <SelectItem key={g.value} value={g.value}>{g.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </ReportToolbar>
      <ReportFigures
        isLoading={isLoading}
        label="Revenue totals"
        className="lg:grid-cols-5"
        items={totals ? [
          { label: 'Invoiced', value: formatNpr(totals.invoiced), hint: `${totals.count} invoice${totals.count === 1 ? '' : 's'}` },
          { label: 'Taxable', value: formatNpr(totals.taxable) },
          { label: 'VAT', value: formatNpr(totals.vat) },
          { label: 'Collected', value: formatNpr(totals.collected), tone: 'success' },
          { label: 'Outstanding', value: formatNpr(totals.outstanding), tone: totals.outstanding > 0 ? 'destructive' : undefined },
        ] : []}
      />
      {groupBy === 'month' && rows.length > 1 ? (
        <ChartCard
          className="mb-4"
          title="Invoiced by month"
          subtitle="Kathmandu months, VAT included"
          table={<ChartTable columns={['Month', 'Invoiced']} rows={rows.map((r) => [r.label ?? r.key, formatNpr(r.invoiced)])} />}
        >
          <ColumnChart
            data={rows}
            valueKey="invoiced"
            renderLabel={(d) => [String(d.label ?? d.key).split(' ')[0], String(d.label ?? d.key).split(' ')[1] ?? '']}
            highlight={rows.length - 1}
            color="hsl(var(--chart-1) / 0.45)"
            accent="hsl(var(--chart-1))"
            label="Invoiced by month"
            describe={(d) => `${d.label ?? d.key}: ${formatNpr(d.invoiced)} invoiced, ${formatNpr(d.collected)} collected`}
            formatValue={formatNprShort}
          />
        </ChartCard>
      ) : null}
      <ReportTable
        storageKey={`report-revenue-${groupBy}`}
        columns={columnsFor(groupBy)}
        rows={rows}
        isLoading={isLoading}
        isFetching={isFetching}
        error={error}
        refetch={refetch}
        rowLabel={(r) => String(r.label ?? r.key)}
        emptyTitle="Nothing invoiced in this range"
      />
    </>
  );
}
