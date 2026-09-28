import { useNavigate } from 'react-router-dom';
import { useGetCollectionsReportQuery } from '@/api/financeApi';
import { AdBsDate } from '@/components/common/AdBsDate';
import { ReportFigures } from '@/components/reports/ReportFigures';
import { ReportTable } from '@/components/reports/ReportTable';
import { ReportToolbar } from '@/components/reports/ReportToolbar';
import { reportQueryParams } from '@/hooks/useReportParams';
import { PAYMENT_METHOD_LABELS, PAYMENT_METHODS } from '@/config/constants';
import { formatNpr } from '@/helpers/format';

const columns = [
  { key: 'receivedAt', header: 'Received', cell: (r) => <AdBsDate iso={r.receivedAt} time /> },
  { key: 'invoice', header: 'Invoice', cell: (r) => <span className="font-mono text-xs font-medium">{r.invoice?.number}</span> },
  { key: 'customer', header: 'Customer', cell: (r) => <span className="line-clamp-1">{r.invoice?.customer?.name}</span> },
  { key: 'method', header: 'Method', cell: (r) => PAYMENT_METHOD_LABELS[r.method] ?? r.method },
  { key: 'reference', header: 'Reference', cell: (r) => (r.reference ? <span className="font-mono text-xs">{r.reference}</span> : '') },
  { key: 'amount', header: 'Amount', className: 'text-right', cell: (r) => <span className="whitespace-nowrap font-medium tabular-nums">{formatNpr(r.amount)}</span> },
];

/**
 * Collections (Phase I5): money received in the range (Kathmandu days), by method — the server's total, count and
 * each method's amount (a voided payment was never received) — then the payments themselves, newest first. The
 * screen lists the newest 500 and says so when there are more; the CSV has them all, up to its 10,000-row cap.
 */
export function CollectionsReport({ params, patch }) {
  const navigate = useNavigate();
  const query = reportQueryParams(params);
  const { data, isLoading, isFetching, error, refetch } = useGetCollectionsReportQuery(query);
  const total = data?.total ?? 0;
  const methods = PAYMENT_METHODS.filter((m) => data?.byMethod?.[m]);

  return (
    <>
      <ReportToolbar params={params} onChange={patch} csv={{ path: '/admin/reports/collections', params: query, name: 'collections' }} />
      <ReportFigures
        isLoading={isLoading}
        label="Collected by method"
        items={[
          { key: 'total', label: 'Collected', value: formatNpr(total), hint: `${data?.count ?? 0} payment${data?.count === 1 ? '' : 's'}`, tone: 'success' },
          ...methods.map((m) => ({
            key: m, label: PAYMENT_METHOD_LABELS[m], value: formatNpr(data.byMethod[m]), bar: total ? data.byMethod[m] / total : 0,
          })),
        ]}
      />
      {data?.truncated ? (
        <p className="mb-2 text-xs text-muted-foreground" data-testid="collections-truncated">
          Showing the newest {data.payments?.length ?? 0} payments — the totals above count every one; the CSV lists them all.
        </p>
      ) : null}
      <ReportTable
        storageKey="report-collections"
        columns={columns}
        rows={data?.payments ?? []}
        isLoading={isLoading}
        isFetching={isFetching}
        error={error}
        refetch={refetch}
        onRowClick={(r) => (r.invoice?.id ? navigate(`/admin/invoices/${r.invoice.id}?tab=payments`) : undefined)}
        rowLabel={(r) => `${formatNpr(r.amount)} ${PAYMENT_METHOD_LABELS[r.method] ?? r.method}`}
        emptyTitle="Nothing received in this range"
      />
    </>
  );
}
