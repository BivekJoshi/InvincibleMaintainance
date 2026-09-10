import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { FileText } from 'lucide-react';
import { useDecideQuotationMutation, useGetQuotationByTokenQuery } from '@/api/publicApi';
import { DocumentHeader } from '@/components/documents/DocumentHeader';
import { DocumentShell } from '@/components/documents/DocumentShell';
import { LineItemsTable } from '@/components/documents/LineItemsTable';
import { TotalsList } from '@/components/documents/TotalsList';
import { ErrorState } from '@/components/common/ErrorState';
import { Skeleton } from '@/components/ui/skeleton';
import { formatDate, formatNpr } from '@/helpers/format';
import { QuotationDecision } from './sections/QuotationDecision';

/** Statuses that mean the customer has already answered. */
const SETTLED = ['APPROVED', 'REJECTED', 'CONVERTED'];
const ACCEPTED = ['APPROVED', 'CONVERTED'];

/**
 * The customer's view of a quotation, opened from an SMS link. No account, no
 * password — a single-purpose token scoped to this one record.
 */
export default function QuotationPublicPage() {
  const { token } = useParams();
  const { data, isLoading, error, refetch } = useGetQuotationByTokenQuery(token);
  const [decide, { isLoading: deciding, error: decideError }] = useDecideQuotationMutation();
  const [note, setNote] = useState('');
  const [decision, setDecision] = useState(null);

  if (error) return <ErrorState error={error} onRetry={refetch} className="min-h-[60dvh]" />;
  if (isLoading) return <div className="container max-w-3xl py-14"><Skeleton className="h-96 w-full rounded-xl" /></div>;

  const onDecide = async (choice) => {
    const result = await decide({ token, decision: choice, note: note || undefined }).unwrap().catch(() => null);
    if (result) setDecision(choice);
  };

  // `decision` is this visit's answer; `data.status` is one recorded earlier.
  const settled = Boolean(decision) || SETTLED.includes(data.status);
  const approved = decision === 'approve' || ACCEPTED.includes(data.status);

  return (
    <DocumentShell>
      <DocumentHeader
        kind="Quotation"
        icon={FileText}
        number={data.number}
        subject={`For ${data.customer.name}${data.site ? ` · ${data.site.address}` : ''}`}
        status={data.status}
        meta={data.validUntil ? <p>Valid until {formatDate(data.validUntil)}</p> : null}
      />

      <LineItemsTable items={data.items} showSymbol={false} />

      <TotalsList
        rows={[
          { label: 'Subtotal', value: formatNpr(data.subtotal) },
          data.discount > 0 && { label: 'Discount', value: `− ${formatNpr(data.discount)}`, tone: 'success' },
          data.vatApplied && { label: `VAT ${data.vatRate}%`, value: formatNpr(data.vatAmount) },
          { label: 'Total', value: formatNpr(data.total), emphasis: true },
        ]}
      />

      {data.terms ? (
        <section className="mt-8 rounded-lg bg-muted/50 p-4">
          <h2 className="text-sm font-semibold">Terms</h2>
          <p className="mt-2 whitespace-pre-line text-sm text-muted-foreground">{data.terms}</p>
        </section>
      ) : null}

      <div className="mt-8 border-t pt-6">
        <QuotationDecision
          settled={settled}
          approved={approved}
          expired={data.status === 'EXPIRED'}
          note={note}
          onNote={setNote}
          onDecide={onDecide}
          deciding={deciding}
          error={decideError}
        />
      </div>
    </DocumentShell>
  );
}
