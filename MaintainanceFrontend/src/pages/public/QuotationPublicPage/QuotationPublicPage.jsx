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
import { pageCopy } from './quotationPageCopy';
import { quotationPageState } from './quotationPageState';

/**
 * The customer's view of a quotation, opened from an SMS link on a phone. No account,
 * no code, no typed name — a single-purpose token scoped to this one version. The page
 * reads the answer the API returns, so what it shows after a tap is the recorded state.
 *
 * Since Phase L4 it is the company's quotation as a document (`components/documents/QuotationDocument`): the
 * letterhead, the number with its AD and BS dates, the BOQ (or its section summary), totals and the total in
 * words, the contract wording, duration, exclusions, the payment schedule with each stage's amount, the terms and
 * the measurements annex — every figure the server's. Every word, the document's and the answer's, follows the
 * site's language (en / ne); it works at 360 px. Opening it is counted by the API (`firstViewedAt`, `viewCount`).
 */
export default function QuotationPublicPage() {
  const { token } = useParams();
  const { data: loaded, isLoading, error, refetch } = useGetQuotationByTokenQuery(token);
  const [decide, { isLoading: answering }] = useDecideQuotationMutation();
  const [answered, setAnswered] = useState(null); // this visit's answer, as the API returned it
  const [answerError, setAnswerError] = useState(null);
  const { phone } = useSiteSettings();
  const locale = useSelector(selectLocale);
  const copy = pageCopy(locale);

  if (error) return <ErrorState error={error} onRetry={refetch} className="min-h-[60dvh]" />;
  if (isLoading) return <div className="container max-w-3xl py-14"><Skeleton className="h-96 w-full rounded-xl" /></div>;

  // A newer token (a replaced notice's link) is a new page: forget this visit's answer.
  const data = answered?.token === token ? answered.quotation : loaded;
  const state = quotationPageState(data);
  const total = formatNpr(data.total);

  /** @param {'approve'|'request_changes'|'reject'} decision  @param {{ note?: string, category?: string }} [extra] */
  const onAnswer = async (decision, { note, category } = {}) => {
    setAnswerError(null);
    try {
      const body = { token, decision, ...(note ? { note } : {}), ...(category ? { category } : {}) };
      const quotation = await decide(body).unwrap();
      setAnswered({ token, quotation });
      return true;
    } catch (err) {
      const code = err?.data?.error?.code;
      setAnswerError(err?.data?.error?.message ?? copy.error);
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
            <DocumentNotice tone="info" icon={MessageSquareText} animate={false} title={copy.requestedChanges.title}>
              <span lang="ne" className="block whitespace-pre-wrap">{data.requestedChanges}</span>
              {copy.requestedChanges.body}
            </DocumentNotice>
          </div>
        ) : null}
      />

      <div className="mt-8 border-t pt-6" lang={locale}>
        <QuotationDecision
          state={state}
          quotation={data}
          total={total}
          phone={phone}
          copy={copy}
          onAnswer={onAnswer}
          answering={answering}
          error={answerError}
          clearError={() => setAnswerError(null)}
        />
      </div>
    </DocumentShell>
  );
}
