import { useNavigate } from 'react-router-dom';
import { useGetAgingReportQuery } from '@/api/financeApi';
import { AdBsDate } from '@/components/common/AdBsDate';
import { ReportFigures } from '@/components/reports/ReportFigures';
import { ReportTable } from '@/components/reports/ReportTable';
import { ReportToolbar } from '@/components/reports/ReportToolbar';
import { Button } from '@/components/ui/button';
import { AGING_BUCKETS } from '@/config/admin/financeViews';
import { formatDateTime, formatNpr } from '@/helpers/format';

const money = (paisa) => <span className="whitespace-nowrap tabular-nums">{formatNpr(paisa)}</span>;
const bucketLabel = (key) => AGING_BUCKETS.find((b) => b.key === key)?.label ?? key;

const INVOICE_COLUMNS = [
  { key: 'number', header: 'Invoice', cell: (r) => <span className="font-mono text-xs font-medium">{r.number}</span> },
  { key: 'customer', header: 'Customer', cell: (r) => <span className="line-clamp-1">{r.customer?.name}</span>, exportValue: (r) => r.customer?.name ?? '' },
  { key: 'issuedAt', header: 'Issued', cell: (r) => <AdBsDate iso={r.issuedAt} /> },
  { key: 'dueDate', header: 'Due', cell: (r) => <AdBsDate iso={r.dueDate} /> },
  {
    key: 'daysOverdue', header: 'Days overdue', className: 'text-right',
    cell: (r) => (r.daysOverdue > 0 ? <span className="tabular-nums text-destructive">{r.daysOverdue}</span> : <span className="text-muted-foreground">Not due</span>),
  },
  { key: 'bucket', header: 'Bucket', cell: (r) => r.bucketLabel ?? bucketLabel(r.bucket) },
  { key: 'total', header: 'Total', className: 'text-right', cell: (r) => money(r.total) },
  { key: 'paid', header: 'Paid', className: 'text-right', cell: (r) => money(r.paid) },
  { key: 'outstanding', header: 'Owed', className: 'text-right', cell: (r) => <span className="font-semibold">{money(r.outstanding)}</span> },
];

const CUSTOMER_COLUMNS = [
  { key: 'customer', header: 'Customer', cell: (r) => <span className="font-medium">{r.customer?.name}</span> },
  ...AGING_BUCKETS.map((b) => ({ key: b.key, header: b.short, className: 'text-right', cell: (r) => (r[b.key] ? money(r[b.key]) : '') })),
  { key: 'total', header: 'Total owed', className: 'text-right', cell: (r) => <span className="font-semibold">{money(r.total)}</span> },
];

/**
 * Aging (Phase I5): what is owed **as of now**, by Kathmandu days past due — not yet due, 1–30, 31–60, 61–90, over 90
 * (the API's buckets and sums). A bucket is a button: it narrows the invoice list below to its invoices (`?bucket=` in
 * the URL); the same again clears it. Then the same money by customer. The date range does not apply.
 */
export function AgingReport({ params, patch }) {
  const navigate = useNavigate();
  const { data, isLoading, isFetching, error, refetch } = useGetAgingReportQuery();
  const bucket = AGING_BUCKETS.some((b) => b.key === params.bucket) ? params.bucket : null;
  const invoices = (data?.invoices ?? []).filter((i) => !bucket || i.bucket === bucket);
  const total = data?.total ?? 0;

  return (
    <>
      <ReportToolbar
        params={params}
        onChange={patch}
        dated={false}
        note={data?.asOf ? `As of ${formatDateTime(data.asOf)} — every sent invoice with money still owed. Dates do not apply.` : 'As of now — every sent invoice with money still owed.'}
        csv={{ path: '/admin/reports/aging', params: {}, name: 'aging' }}
      />
      <ReportFigures
        isLoading={isLoading}
        label="Owed by days past due"
        className="lg:grid-cols-6"
        items={[
          { key: 'total', label: 'Total owed', value: formatNpr(total), onClick: () => patch({ bucket: undefined }), active: !bucket },
          ...AGING_BUCKETS.map((b) => ({
            key: b.key,
            label: b.label,
            value: formatNpr(data?.buckets?.[b.key] ?? 0),
            tone: b.key !== 'current' && data?.buckets?.[b.key] > 0 ? 'destructive' : undefined,
            bar: total ? (data?.buckets?.[b.key] ?? 0) / total : 0,
            active: bucket === b.key,
            onClick: () => patch({ bucket: bucket === b.key ? undefined : b.key }),
          })),
        ]}
      />
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold" data-testid="aging-drilldown">
          {bucket ? `Invoices ${bucketLabel(bucket).toLowerCase()}` : 'Every invoice with money owed'} · {invoices.length}
        </h2>
        {bucket ? <Button type="button" variant="ghost" size="sm" onClick={() => patch({ bucket: undefined })}>Show every bucket</Button> : null}
      </div>
      <ReportTable
        storageKey="report-aging-invoices"
        columns={INVOICE_COLUMNS}
        rows={invoices}
        isLoading={isLoading}
        isFetching={isFetching}
        error={error}
        refetch={refetch}
        onRowClick={(r) => navigate(`/admin/invoices/${r.id}`)}
        rowLabel={(r) => `${r.number}, ${r.customer?.name ?? ''}`}
        emptyTitle={bucket ? 'Nothing in this bucket' : 'Nothing is owed'}
        emptyDescription="Every sent invoice is paid up."
      />
      <h2 className="mb-2 mt-6 text-sm font-semibold">By customer</h2>
      <ReportTable
        storageKey="report-aging-customers"
        columns={CUSTOMER_COLUMNS}
        rows={data?.byCustomer ?? []}
        getRowId={(r, i) => r.customer?.id ?? `c${i}`}
        isLoading={isLoading}
        onRowClick={(r) => (r.customer?.id ? navigate(`/admin/customers/${r.customer.id}?tab=statement`) : undefined)}
        rowLabel={(r) => r.customer?.name ?? 'Customer'}
        emptyTitle="Nothing is owed"
        emptyDescription="Every sent invoice is paid up."
      />
    </>
  );
}
