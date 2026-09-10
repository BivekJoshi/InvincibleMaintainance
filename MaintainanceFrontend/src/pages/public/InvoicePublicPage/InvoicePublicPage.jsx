import { useParams } from 'react-router-dom';
import { Receipt } from 'lucide-react';
import { useGetInvoiceByTokenQuery } from '@/api/publicApi';
import { useSiteSettings } from '@/hooks/useSiteSettings';
import { DocumentHeader } from '@/components/documents/DocumentHeader';
import { DocumentShell } from '@/components/documents/DocumentShell';
import { LineItemsTable } from '@/components/documents/LineItemsTable';
import { TotalsList } from '@/components/documents/TotalsList';
import { ErrorState } from '@/components/common/ErrorState';
import { Skeleton } from '@/components/ui/skeleton';
import { formatDate, formatNpr } from '@/helpers/format';
import { InvoiceActions } from './sections/InvoiceActions';
import { PaymentHistory } from './sections/PaymentHistory';

/**
 * The customer's view of an invoice, opened from the SMS or email link that
 * `invoice.service.js` sends. Read-only: payment is settled offline, so this
 * shows what is owed and how to pay, and nothing it could get wrong.
 */
export default function InvoicePublicPage() {
  const { token } = useParams();
  const { data, isLoading, error, refetch } = useGetInvoiceByTokenQuery(token);
  const { phone } = useSiteSettings();

  if (error) return <ErrorState error={error} onRetry={refetch} className="min-h-[60dvh]" />;
  if (isLoading) return <div className="container max-w-3xl py-14"><Skeleton className="h-96 w-full rounded-xl" /></div>;

  // Both figures are integer paisa; the subtraction is exact, and clamped
  // because an overpayment is a credit to settle by hand, not a negative bill.
  const due = Math.max(0, (data.total ?? 0) - (data.paidAmount ?? 0));
  const overdue = data.dueDate && new Date(data.dueDate) < new Date() && due > 0;

  return (
    <DocumentShell>
      <DocumentHeader
        kind="Invoice"
        icon={Receipt}
        number={data.number}
        subject={`For ${data.customer?.name}${data.customer?.panVatNo ? ` · PAN/VAT ${data.customer.panVatNo}` : ''}`}
        status={data.status}
        meta={
          <>
            <p>Issued {formatDate(data.issuedAt)}</p>
            {data.dueDate ? (
              <p className={overdue ? 'font-medium text-destructive' : undefined}>Due {formatDate(data.dueDate)}</p>
            ) : null}
          </>
        }
      />

      <LineItemsTable items={data.items} />

      <TotalsList
        className="border-t pt-5"
        rows={[
          { label: 'Subtotal', value: formatNpr(data.subtotal) },
          data.discount && { label: 'Discount', value: `− ${formatNpr(data.discount)}` },
          {
            label: data.vatApplied ? `VAT (${data.vatRate}%)` : 'VAT (not applied)',
            value: formatNpr(data.vatAmount),
          },
          { label: 'Total', value: formatNpr(data.total), emphasis: true },
          data.paidAmount && { label: 'Paid', value: `− ${formatNpr(data.paidAmount)}` },
          {
            label: due > 0 ? 'Amount due' : 'Settled',
            value: formatNpr(due),
            emphasis: true,
            tone: overdue ? 'destructive' : undefined,
          },
        ]}
      />

      <PaymentHistory payments={data.payments} />

      {data.terms ? (
        <p className="mt-8 whitespace-pre-wrap border-t pt-5 text-xs leading-relaxed text-muted-foreground">
          {data.terms}
        </p>
      ) : null}

      <InvoiceActions number={data.number} phone={phone} />
    </DocumentShell>
  );
}
