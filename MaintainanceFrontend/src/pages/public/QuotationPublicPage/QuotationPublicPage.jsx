import { useState } from 'react';
import { useSelector } from 'react-redux';
import { useParams } from 'react-router-dom';
import { MessageSquareText } from 'lucide-react';
import { useDecideQuotationMutation, useGetQuotationByTokenQuery } from '@/api/publicApi';
import { DocumentShell } from '@/components/documents/DocumentShell';
import { DocumentNotice } from '@/components/documents/DocumentNotice';
import { QuotationDocument } from '@/components/documents/QuotationDocument';
import { ErrorState } from '@/components/common/ErrorState';
import { Skeleton } from '@/components/ui/skeleton';
import { useSiteSettings } from '@/hooks/useSiteSettings';
import { selectLocale } from '@/redux/slices/uiSlice';
import { formatNpr } from '@/helpers/format';
import { QuotationDecision } from './sections/QuotationDecision';
import { QUOTATION_PAGE_COPY as COPY } from './quotationPageCopy';
import { quotationPageState } from './quotationPageState';

/**
 * The customer's view of a quotation, opened from an SMS link on a phone. No account,
 * no code, no typed name — a single-purpose token scoped to this one version. The page
 * reads the answer the API returns, so what it shows after a tap is the recorded state.
 *
 * The document itself (`components/documents/QuotationDocument`) follows the site's language
 * (en / ne): its sections as headings with their number, notes as text, a row's specification
 * under it, and optional rows marked "not included in the total" (Phase L3).
 */
export default function QuotationPublicPage() {
  const { token } = useParams();
  const { data: loaded, isLoading, error, refetch } = useGetQuotationByTokenQuery(token);
  const [decide, { isLoading: answering }] = useDecideQuotationMutation();
  const [answered, setAnswered] = useState(null); // this visit's answer, as the API returned it
  const [answerError, setAnswerError] = useState(null);
  const { phone } = useSiteSettings();
  const locale = useSelector(selectLocale);

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
      <QuotationDocument
        quotation={data}
        locale={locale}
        notice={data.requestedChanges && state.kind === 'open' ? (
          <div className="mt-6">
            <DocumentNotice tone="info" icon={MessageSquareText} animate={false} title={COPY.requestedChanges.title}>
              <span lang="ne" className="block whitespace-pre-wrap">{data.requestedChanges}</span>
              {COPY.requestedChanges.body}
            </DocumentNotice>
          </div>
        ) : null}
      />

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
