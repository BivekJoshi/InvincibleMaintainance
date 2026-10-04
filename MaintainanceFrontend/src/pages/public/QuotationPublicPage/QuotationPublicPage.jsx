import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { FileDiff, MessageSquareText } from 'lucide-react';
import { useDecideQuotationMutation, useGetQuotationByTokenQuery } from '@/api/publicApi';
import { DocumentShell } from '@/components/documents/DocumentShell';
import { DocumentNotice } from '@/components/documents/DocumentNotice';
import { QuotationDocument } from '@/components/documents/QuotationDocument';
import { ErrorState } from '@/components/common/ErrorState';
import { Skeleton } from '@/components/ui/skeleton';
import { COMMON } from '@/config/i18n/common';
import { DOCUMENTS } from '@/config/i18n/documents';
import { useSiteSettings } from '@/hooks/useSiteSettings';
import { useApiErrorText, useLocale, useT } from '@/hooks/useT';
import { formatSignedNpr } from '@/helpers/format';
import { QuotationDecision } from './sections/QuotationDecision';
import { quotationPageState } from './quotationPageState';

/** It expired, was replaced or was answered elsewhere: the page shows what it is now. */
const CLOSED_CODES = ['QUOTATION_EXPIRED', 'QUOTATION_REPLACED', 'QUOTATION_ANSWERED', 'QUOTATION_NOT_OPEN'];
const NO_CONNECTION = ['FETCH_ERROR', 'TIMEOUT_ERROR'];

/**
 * The customer's view of a quotation, opened from an SMS link on a phone. No account,
 * no code, no typed name — a single-purpose token scoped to this one version. The page
 * reads the answer the API returns, so what it shows after a tap is the recorded state.
 *
 * Since Phase L4 it is the company's quotation as a document (`components/documents/QuotationDocument`): the
 * letterhead, the number with its AD and BS dates, the BOQ (or its section summary), totals and the total in
 * words, the contract wording, duration, exclusions, the payment schedule with each stage's amount, the terms and
 * the measurements annex — every figure the server's. Every word, the document's and the answer's, follows the
 * site's language (en / ne — Phase J1: `DOCUMENTS`, the amounts `रु.` in Nepali); it works at 360 px. Opening it is
 * counted by the API (`firstViewedAt`, `viewCount`).
 *
 * A **variation order** (Phase L7, `kind: 'VARIATION'`, with `job { number }`) reads as a change to that job: "Change to
 * your job JOB-…" above the document, and "Accept this change" / "यो परिवर्तन स्वीकार्नुहोस्" — accepting it adds it to
 * the job, with no new job and no advance. Its total may be below zero (an omission), written "− Rs. …".
 *
 * A refused answer is told in the page's language: the QUOTATION_* codes (`DOCUMENTS.errors`) and the ones `common.js`
 * words (no connection, too many tries); anything else is the page's own "We could not record your answer".
 */
export default function QuotationPublicPage() {
  const { token } = useParams();
  const { data: loaded, isLoading, error, refetch } = useGetQuotationByTokenQuery(token);
  const [decide, { isLoading: answering }] = useDecideQuotationMutation();
  const [answered, setAnswered] = useState(null); // this visit's answer, as the API returned it
  const [answerError, setAnswerError] = useState(null); // the API's refusal, worded when shown
  const { phone } = useSiteSettings();
  const locale = useLocale();
  const t = useT(DOCUMENTS);
  const common = useT(COMMON);
  const errorText = useApiErrorText(DOCUMENTS);

  if (error) {
    return (
      <ErrorState error={error} message={errorText(error)} retryLabel={t('document.retry')} onRetry={refetch} className="min-h-[60dvh]" />
    );
  }
  if (isLoading) return <div className="container max-w-3xl py-14"><Skeleton className="h-96 w-full rounded-xl" /></div>;

  // A newer token (a replaced notice's link) is a new page: forget this visit's answer.
  const data = answered?.token === token ? answered.quotation : loaded;
  const state = quotationPageState(data);
  const variation = data.kind === 'VARIATION';
  const jobNumber = data.job?.number ?? '';
  const total = formatSignedNpr(data.total, { locale });

  /** A refusal in the page's words — a code DOCUMENTS or COMMON words, else the page's own sentence. */
  const refusal = (err) => {
    const code = err?.data?.error?.code;
    const worded = NO_CONNECTION.includes(err?.status) || (code && (t.has(`errors.${code}`) || common.has(`errors.${code}`)));
    return worded ? errorText(err) : t('quotationPage.error');
  };

  /** @param {'approve'|'request_changes'|'reject'} decision  @param {{ note?: string, category?: string }} [extra] */
  const onAnswer = async (decision, { note, category } = {}) => {
    setAnswerError(null);
    try {
      const body = { token, decision, ...(note ? { note } : {}), ...(category ? { category } : {}) };
      const quotation = await decide(body).unwrap();
      setAnswered({ token, quotation });
      return true;
    } catch (err) {
      setAnswerError(err);
      if (CLOSED_CODES.includes(err?.data?.error?.code)) {
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
        notice={(variation || (data.requestedChanges && state.kind === 'open')) ? (
          <div className="mt-6 space-y-3">
            {variation ? (
              <div data-testid="variation-notice">
                <DocumentNotice
                  tone="info"
                  icon={FileDiff}
                  animate={false}
                  title={t('quotationPage.variation.notice.title', { job: jobNumber })}
                >
                  {t('quotationPage.variation.notice.body')}
                </DocumentNotice>
              </div>
            ) : null}
            {data.requestedChanges && state.kind === 'open' ? (
              <DocumentNotice tone="info" icon={MessageSquareText} animate={false} title={t('quotationPage.requestedChanges.title')}>
                <span lang="ne" className="block whitespace-pre-wrap">{data.requestedChanges}</span>
                {t('quotationPage.requestedChanges.body')}
              </DocumentNotice>
            ) : null}
          </div>
        ) : null}
      />

      <div className="mt-8 border-t pt-6" lang={locale}>
        <QuotationDecision
          state={state}
          quotation={data}
          total={total}
          phone={phone}
          onAnswer={onAnswer}
          answering={answering}
          error={answerError ? refusal(answerError) : null}
          clearError={() => setAnswerError(null)}
        />
      </div>
    </DocumentShell>
  );
}
