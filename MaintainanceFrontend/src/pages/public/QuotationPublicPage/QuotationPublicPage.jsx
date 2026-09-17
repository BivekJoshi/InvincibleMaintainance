import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { FileText, MessageSquareText } from 'lucide-react';
import { useDecideQuotationMutation, useGetQuotationByTokenQuery } from '@/api/publicApi';
import { DocumentHeader } from '@/components/documents/DocumentHeader';
import { DocumentShell } from '@/components/documents/DocumentShell';
import { LineItemsTable } from '@/components/documents/LineItemsTable';
import { TotalsList } from '@/components/documents/TotalsList';
import { DocumentNotice } from '@/components/documents/DocumentNotice';
import { ErrorState } from '@/components/common/ErrorState';
import { Skeleton } from '@/components/ui/skeleton';
import { useSiteSettings } from '@/hooks/useSiteSettings';
import { formatDate, formatNpr } from '@/helpers/format';
import { QuotationDecision } from './sections/QuotationDecision';
import { QUOTATION_PAGE_COPY as COPY } from './quotationPageCopy';
import { quotationPageState } from './quotationPageState';

/**
 * The customer's view of a quotation, opened from an SMS link on a phone. No account,
 * no code, no typed name — a single-purpose token scoped to this one version. The page
 * reads the answer the API returns, so what it shows after a tap is the recorded state.
 */
export default function QuotationPublicPage() {
  const { token } = useParams();
  const { data: loaded, isLoading, error, refetch } = useGetQuotationByTokenQuery(token);
  const [decide, { isLoading: answering }] = useDecideQuotationMutation();
  const [answered, setAnswered] = useState(null); // this visit's answer, as the API returned it
  const [answerError, setAnswerError] = useState(null);
  const { phone } = useSiteSettings();

  if (error) return <ErrorState error={error} onRetry={refetch} className="min-h-[60dvh]" />;
  if (isLoading) return <div className="container max-w-3xl py-14"><Skeleton className="h-96 w-full rounded-xl" /></div>;

  // A newer token (a replaced notice's link) is a new page: forget this visit's answer.
  const data = answered?.token === token ? answered.quotation : loaded;
  const state = quotationPageState(data);
  const total = formatNpr(data.total);

  const onAnswer = async (decision, note) => {
    setAnswerError(null);
    try {
      const quotation = await decide({ token, decision, ...(note ? { note } : {}) }).unwrap();
      setAnswered({ token, quotation });
      return true;
    } catch (err) {
      const code = err?.data?.error?.code;
      setAnswerError(err?.data?.error?.message ?? COPY.error);
      // It expired, was replaced or was answered elsewhere: show what it is now.
      if (['QUOTATION_EXPIRED', 'QUOTATION_REPLACED', 'QUOTATION_ANSWERED', 'QUOTATION_NOT_OPEN'].includes(code)) {
        setAnswered(null);
        refetch();
        return true;
      }
      return false;
    }
  };

  return (
    <DocumentShell>
      <DocumentHeader
        kind={COPY.kind}
        icon={FileText}
        number={data.number}
        subject={COPY.forCustomer(data.customer.name, data.site?.address)}
        status={data.status}
        statusLabel={COPY.statusLabels[data.status]}
        meta={(
          <>
            {data.version > 1 ? <p>{COPY.version(data.version)}</p> : null}
            {data.validUntil ? <p>{COPY.validUntil(formatDate(data.validUntil))}</p> : null}
          </>
        )}
      />

      {data.requestedChanges && state.kind === 'open' ? (
        <div className="mt-6">
          <DocumentNotice tone="info" icon={MessageSquareText} animate={false} title={COPY.requestedChanges.title}>
            <span lang="ne" className="block whitespace-pre-wrap">{data.requestedChanges}</span>
            {COPY.requestedChanges.body}
          </DocumentNotice>
        </div>
      ) : null}

      <LineItemsTable items={data.items} showSymbol={false} />

      <TotalsList
        rows={[
          { label: COPY.totals.subtotal, value: formatNpr(data.subtotal) },
          data.discount > 0 && { label: COPY.totals.discount, value: `− ${formatNpr(data.discount)}`, tone: 'success' },
          data.vatApplied && { label: COPY.totals.vat(data.vatRate), value: formatNpr(data.vatAmount) },
          { label: COPY.totals.total, value: total, emphasis: true },
        ]}
      />

      {data.terms ? (
        <section className="mt-8 rounded-lg bg-muted/50 p-4">
          <h2 className="text-sm font-semibold">{COPY.terms}</h2>
          <p className="mt-2 whitespace-pre-line text-sm text-muted-foreground">{data.terms}</p>
        </section>
      ) : null}

      <div className="mt-8 border-t pt-6">
        <QuotationDecision
          state={state}
          quotation={data}
          total={total}
          phone={phone}
          onAnswer={onAnswer}
          answering={answering}
          error={answerError}
          clearError={() => setAnswerError(null)}
        />
      </div>
    </DocumentShell>
  );
}
