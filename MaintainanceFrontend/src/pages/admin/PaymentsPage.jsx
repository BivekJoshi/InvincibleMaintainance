import { Link, useNavigate } from 'react-router-dom';
import { ExternalLink } from 'lucide-react';
import { useGetPaymentsQuery } from '@/api/financeApi';
import { useListParams } from '@/hooks/useListParams';
import { PageHeader } from '@/components/common/PageHeader';
import { CustomTable } from '@/components/common/CustomTable/CustomTable';
import { AdBsDate } from '@/components/common/AdBsDate';
import { StateBadge } from '@/components/common/StateBadge';
import { PaymentTotals } from '@/components/finance/PaymentTotals';
import { PageTransition } from '@/three/motion/motionKit';
import { PAYMENT_METHOD_LABELS } from '@/config/constants';
import { PAYMENT_METHOD_OPTIONS } from '@/config/admin/financeViews';
import { CUSTOMER_RELATION } from '@/config/admin/jobViews';
import { formatDateBs, formatNpr } from '@/helpers/format';

const columns = [
  {
    key: 'receivedAt', header: 'Received', sortable: true,
    cell: (r) => <AdBsDate iso={r.receivedAt} time />,
    exportValue: (r) => `${r.receivedAt?.slice(0, 10) ?? ''} (${formatDateBs(r.receivedAt)} BS)`,
  },
  {
    key: 'invoice', header: 'Invoice',
    cell: (r) => (
      <div className="min-w-0 max-w-[220px]">
        {r.invoice ? (
          <Link to={`/admin/invoices/${r.invoice.id}`} onClick={(e) => e.stopPropagation()} className="font-mono text-xs font-medium hover:text-primary hover:underline">
            {r.invoice.number}
          </Link>
        ) : null}
        <p className="truncate text-sm">{r.invoice?.customer?.name}</p>
      </div>
    ),
    exportValue: (r) => `${r.invoice?.number ?? ''} ${r.invoice?.customer?.name ?? ''}`.trim(),
  },
  { key: 'method', header: 'Method', cell: (r) => PAYMENT_METHOD_LABELS[r.method] ?? r.method },
  {
    key: 'reference', header: 'Reference',
    cell: (r) => (r.reference ? <span className="font-mono text-xs">{r.reference}</span> : <span className="text-muted-foreground">—</span>),
    exportValue: (r) => r.reference ?? '',
  },
  {
    key: 'amount', header: 'Amount', sortable: true, className: 'text-right',
    cell: (r) => (r.voidedAt ? (
      <div className="text-right">
        <del className="whitespace-nowrap tabular-nums text-muted-foreground">{formatNpr(r.amount)}</del>
        <StateBadge tone="warning" className="ml-2" title={r.voidReason ?? undefined}>Voided</StateBadge>
      </div>
    ) : <span className="whitespace-nowrap font-medium tabular-nums">{formatNpr(r.amount)}</span>),
    exportValue: (r) => `${formatNpr(r.amount)}${r.voidedAt ? ' (voided)' : ''}`,
  },
];

const filters = [
  { key: 'method', label: 'Method', type: 'enum', options: PAYMENT_METHOD_OPTIONS },
  { key: 'received', label: 'Received', type: 'dateRange' },
  { key: 'customerId', label: 'Customer', type: 'relation', relation: CUSTOMER_RELATION },
];

/**
 * `/admin/finance/payments` (Phase I3, `payments:read`): every payment, found by the reference a customer quotes (an
 * eSewa id, a cheque number), the invoice number or the customer; filtered by method, the days it was received
 * (Kathmandu) and customer. The footer is the server's totals by method. Voided payments stay listed, struck through.
 */
export default function PaymentsPage() {
  const navigate = useNavigate();
  const [params, setParams] = useListParams({ limit: 20, sort: '-receivedAt' });
  const { data, isLoading, isFetching, error, refetch } = useGetPaymentsQuery(params);

  return (
    <PageTransition>
      <PageHeader
        title="Payments"
        description="Money received against invoices — find one by its reference, invoice or customer."
      />
      <CustomTable
        storageKey="payments"
        exportable
        exportName="payments"
        columns={columns}
        data={data?.items}
        meta={data?.meta}
        isLoading={isLoading}
        isFetching={isFetching}
        error={error}
        refetch={refetch}
        params={params}
        onParamsChange={setParams}
        onRowClick={(r) => (r.invoice ? navigate(`/admin/invoices/${r.invoice.id}?tab=payments`) : undefined)}
        rowActions={(r) => (r.invoice ? [{ label: 'Open the invoice', icon: ExternalLink, onSelect: () => navigate(`/admin/invoices/${r.invoice.id}?tab=payments`) }] : [])}
        rowLabel={(r) => `${formatNpr(r.amount)}, ${PAYMENT_METHOD_LABELS[r.method] ?? r.method}, ${r.invoice?.number ?? ''}`}
        searchPlaceholder="Search reference, invoice number or customer…"
        filters={filters}
        emptyTitle="No payments match"
        emptyDescription="Clear the filters, or widen the dates."
      />
      <PaymentTotals totals={data?.meta?.totals} />
    </PageTransition>
  );
}
