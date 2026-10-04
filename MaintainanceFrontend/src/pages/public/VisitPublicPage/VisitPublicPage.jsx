import { useState } from 'react';
import { useDispatch } from 'react-redux';
import { useParams } from 'react-router-dom';
import { useGetVisitByTokenQuery, useRespondToVisitMutation } from '@/api/publicApi';
import { DocumentShell } from '@/components/documents/DocumentShell';
import { Skeleton } from '@/components/ui/skeleton';
import { useSiteSettings } from '@/hooks/useSiteSettings';
import { useApiErrorText, useLocale, useT } from '@/hooks/useT';
import { setLocale } from '@/redux/slices/uiSlice';
import { SUPPORTED_LOCALES } from '@/config/locale';
import { COMMON } from '@/config/i18n/common';
import { DOCUMENTS } from '@/config/i18n/documents';
import { VisitHeading } from './sections/VisitHeading';
import { VisitDetails } from './sections/VisitDetails';
import { VisitAnswer } from './sections/VisitAnswer';
import { VisitUnavailable } from './sections/VisitUnavailable';
import { respondBody, visitPageState, visitWhen } from './visitPageState';

const NO_CONNECTION = ['FETCH_ERROR', 'TIMEOUT_ERROR'];

/**
 * The customer's booked site visit (Phase L5), opened from the `visit_booked` SMS on a phone — no account, a
 * single-purpose token. It says when (the window in Kathmandu time), where (address, area, landmark) and who (the
 * surveyor, with a call button), and takes one of two answers: **Confirm** or **Need another time** (with an
 * optional note). The answer the API returns replaces the page's copy (`respondToVisit` writes it into the query's
 * cache), so what the page shows after a tap is the recorded state; the latest answer wins while `canAnswer`.
 * No money anywhere (D1).
 *
 * Every word follows the site's language (`useLocale()`, en / ne — `DOCUMENTS.visit`). The page does not switch
 * language by itself — the store cannot tell a chosen language from the default — but when the customer's own language
 * (`customer.preferredLocale`) is not the page's, it offers a one-tap switch at the top. A refused answer is told in the
 * page's language: VISIT_CLOSED ("did not reach us in time") and the codes `common.js` words (no connection, too many
 * tries); anything else is the page's own "We could not record your answer", never the server's English.
 */
export default function VisitPublicPage() {
  const { token } = useParams();
  const { data: visit, isLoading, error, refetch } = useGetVisitByTokenQuery(token);
  const [respond, { isLoading: answering }] = useRespondToVisitMutation();
  // Per token: whether the API refused an answer as too late (VISIT_CLOSED), and the refusal itself.
  const [answered, setAnswered] = useState({ token: null, closed: false, error: null });
  const locale = useLocale();
  const t = useT(DOCUMENTS);
  const common = useT(COMMON);
  const errorText = useApiErrorText(DOCUMENTS);
  const dispatch = useDispatch();
  const site = useSiteSettings();

  if (isLoading) {
    return (
      <DocumentShell width="sm">
        <div role="status" aria-label={t('visit.loading')} className="space-y-4">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-8 w-3/4" />
          <Skeleton className="h-56 w-full rounded-lg" />
          <Skeleton className="h-14 w-full" />
        </div>
      </DocumentShell>
    );
  }

  if (!visit) {
    return (
      <DocumentShell width="sm">
        <div lang={locale}>
          <VisitUnavailable notFound={error?.status === 404} phone={site.phone} onRetry={refetch} />
        </div>
      </DocumentShell>
    );
  }

  const mine = answered.token === token ? answered : { closed: false, error: null };
  const state = visitPageState(visit, { closed: mine.closed });
  const when = visitWhen(visit.window, t);
  const officePhone = visit.company?.phone || site.phone;
  const preferred = visit.customer?.preferredLocale;
  // The other language, offered in that language ("नेपालीमा पढ्नुहोस्" on the English page).
  const switchTo = preferred && preferred !== locale && SUPPORTED_LOCALES.includes(preferred)
    ? { locale: preferred, label: t('visit.otherLanguage') }
    : null;

  /** A refusal in the page's words — a code DOCUMENTS or COMMON words, else the page's own sentence. */
  const refusal = (err) => {
    const code = err?.data?.error?.code;
    const worded = NO_CONNECTION.includes(err?.status) || (code && (t.has(`errors.${code}`) || common.has(`errors.${code}`)));
    return worded ? errorText(err) : t('visit.error');
  };

  /** @param {'confirm'|'reschedule'} answer  @param {string} [note] */
  const onAnswer = async (answer, note) => {
    setAnswered({ token, closed: false, error: null });
    try {
      await respond({ token, ...respondBody(answer, note) }).unwrap();
      return true;
    } catch (err) {
      if (err?.data?.error?.code === 'VISIT_CLOSED') {
        // Past, under way or cancelled since the page loaded: show what it is now.
        setAnswered({ token, closed: true, error: err });
        refetch();
        return true;
      }
      setAnswered({ token, closed: false, error: err });
      return false;
    }
  };

  return (
    <DocumentShell width="sm">
      <div lang={locale}>
        <VisitHeading
          company={visit.company?.name || site.name}
          number={visit.number}
          showLead={state.kind === 'open'}
          switchTo={switchTo}
          onSwitch={(l) => dispatch(setLocale(l))}
        />

        {state.kind === 'cancelled' ? null : (
          <VisitDetails
            when={when}
            site={visit.site}
            surveyor={visit.surveyor}
            officePhone={officePhone}
          />
        )}

        <div className="mt-6">
          <VisitAnswer
            state={state}
            when={when}
            note={visit.answerNote}
            officePhone={officePhone}
            onAnswer={onAnswer}
            answering={answering}
            error={mine.error ? refusal(mine.error) : null}
            clearError={() => setAnswered((a) => ({ ...a, error: null }))}
          />
        </div>
      </div>
    </DocumentShell>
  );
}
