import { useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useParams } from 'react-router-dom';
import { useGetVisitByTokenQuery, useRespondToVisitMutation } from '@/api/publicApi';
import { DocumentShell } from '@/components/documents/DocumentShell';
import { Skeleton } from '@/components/ui/skeleton';
import { useSiteSettings } from '@/hooks/useSiteSettings';
import { selectLocale, setLocale } from '@/redux/slices/uiSlice';
import { SUPPORTED_LOCALES } from '@/config/locale';
import { VisitHeading } from './sections/VisitHeading';
import { VisitDetails } from './sections/VisitDetails';
import { VisitAnswer } from './sections/VisitAnswer';
import { VisitUnavailable } from './sections/VisitUnavailable';
import { visitCopy } from './visitPageCopy';
import { respondBody, visitPageState, visitWhen } from './visitPageState';

/**
 * The customer's booked site visit (Phase L5), opened from the `visit_booked` SMS on a phone — no account, a
 * single-purpose token. It says when (the window in Kathmandu time), where (address, area, landmark) and who (the
 * surveyor, with a call button), and takes one of two answers: **Confirm** or **Need another time** (with an
 * optional note). The answer the API returns replaces the page's copy (`respondToVisit` writes it into the query's
 * cache), so what the page shows after a tap is the recorded state; the latest answer wins while `canAnswer`.
 * No money anywhere (D1).
 *
 * Every word follows the site's language (`uiSlice` locale, en / ne). The page does not switch language by itself
 * — the store cannot tell a chosen language from the default — but when the customer's own language
 * (`customer.preferredLocale`) is not the page's, it offers a one-tap switch at the top.
 */
export default function VisitPublicPage() {
  const { token } = useParams();
  const { data: visit, isLoading, error, refetch } = useGetVisitByTokenQuery(token);
  const [respond, { isLoading: answering }] = useRespondToVisitMutation();
  // Per token: whether the API refused an answer as too late (VISIT_CLOSED), and what went wrong.
  const [answered, setAnswered] = useState({ token: null, closed: false, error: null });
  const locale = useSelector(selectLocale);
  const dispatch = useDispatch();
  const site = useSiteSettings();
  const copy = visitCopy(locale);

  if (isLoading) {
    return (
      <DocumentShell width="sm">
        <div role="status" aria-label={copy.loading} className="space-y-4">
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
          <VisitUnavailable notFound={error?.status === 404} phone={site.phone} copy={copy} onRetry={refetch} />
        </div>
      </DocumentShell>
    );
  }

  const mine = answered.token === token ? answered : { closed: false, error: null };
  const state = visitPageState(visit, { closed: mine.closed });
  const when = visitWhen(visit.window, copy);
  const officePhone = visit.company?.phone || site.phone;
  const preferred = visit.customer?.preferredLocale;
  const switchTo = preferred && preferred !== locale && SUPPORTED_LOCALES.includes(preferred)
    ? copy.otherLanguage
    : null;

  /** @param {'confirm'|'reschedule'} answer  @param {string} [note] */
  const onAnswer = async (answer, note) => {
    setAnswered({ token, closed: false, error: null });
    try {
      await respond({ token, ...respondBody(answer, note) }).unwrap();
      return true;
    } catch (err) {
      if (err?.data?.error?.code === 'VISIT_CLOSED') {
        // Past, under way or cancelled since the page loaded: show what it is now.
        setAnswered({ token, closed: true, error: 'tooLate' });
        refetch();
        return true;
      }
      setAnswered({ token, closed: false, error: 'error' });
      return false;
    }
  };

  return (
    <DocumentShell width="sm">
      <div lang={locale}>
        <VisitHeading
          company={visit.company?.name || site.name}
          number={visit.number}
          copy={copy}
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
            copy={copy}
          />
        )}

        <div className="mt-6">
          <VisitAnswer
            state={state}
            when={when}
            note={visit.answerNote}
            officePhone={officePhone}
            copy={copy}
            onAnswer={onAnswer}
            answering={answering}
            error={mine.error ? copy[mine.error] : null}
            clearError={() => setAnswered((a) => ({ ...a, error: null }))}
          />
        </div>
      </div>
    </DocumentShell>
  );
}
