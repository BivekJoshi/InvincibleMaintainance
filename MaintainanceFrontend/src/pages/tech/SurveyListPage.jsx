import { Link } from 'react-router-dom';
import { ClipboardCheck, MapPin, ChevronRight } from 'lucide-react';
import { useGetMySurveysQuery } from '@/api/techApi';
import { FieldErrorState } from '@/components/tech/FieldErrorState';
import { EmptyState } from '@/components/common/EmptyState';
import { StatusBadge } from '@/components/ui/badge';
import { CardSkeleton } from '@/components/ui/skeleton';
import { PageTransition, Stagger } from '@/three/motion/motionKit';
import { formatDate, formatTime } from '@/helpers/format';
import { useT } from '@/hooks/useT';
import { FIELD } from '@/config/i18n/field';

/** Anything still in the surveyor's hands sorts above what the office has. */
const OPEN = ['DRAFT', 'RETURNED'];

/** The visit's day and window, when it has one: "02 Oct 2026, 10:00–12:00" (in Nepali, "2026 अक्टोबर 02, 10:00–12:00"). */
function visitWhen(job, locale) {
  if (!job?.scheduledStart) return null;
  const day = formatDate(job.scheduledStart, { locale });
  const from = formatTime(job.scheduledStart, { locale });
  return job.scheduledEnd ? `${day}, ${from}–${formatTime(job.scheduledEnd, { locale })}` : `${day}, ${from}`;
}

/** The surveyor's surveys: still to fill in first, then what the office has. Words in en/ne (`FIELD.survey.list`). */
export default function SurveyListPage() {
  const { data: surveys, isLoading, error, refetch } = useGetMySurveysQuery({});
  const t = useT(FIELD);

  if (isLoading) return <PageTransition><CardSkeleton /></PageTransition>;
  if (error) return <PageTransition><FieldErrorState error={error} onRetry={refetch} /></PageTransition>;

  if (!surveys?.length) {
    return (
      <PageTransition>
        <EmptyState icon={ClipboardCheck} title={t('survey.list.emptyTitle')} description={t('survey.list.emptyBody')} />
      </PageTransition>
    );
  }

  const open = surveys.filter((s) => OPEN.includes(s.status));
  const done = surveys.filter((s) => !OPEN.includes(s.status));

  return (
    <PageTransition>
      <h1 className="mb-4 text-lg font-semibold">{t('survey.list.title')}</h1>
      {open.length ? <Section title={t('survey.list.toFill')} surveys={open} /> : null}
      {done.length ? <Section title={t('survey.list.submitted')} surveys={done} muted /> : null}
    </PageTransition>
  );
}

function Section({ title, surveys, muted }) {
  const t = useT(FIELD);
  return (
    <section className="mb-6">
      <h2 className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">{title}</h2>
      <Stagger className="space-y-2">
        {surveys.map((s) => (
          <Link
            key={s.id}
            to={`/tech/surveys/${s.id}`}
            className={`flex items-center gap-3 rounded-lg border bg-background p-4 active:bg-muted ${muted ? 'opacity-70' : ''}`}
          >
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs text-muted-foreground">{s.number}</span>
                <StatusBadge status={s.status} label={t.has(`surveyStatus.${s.status}`) ? t(`surveyStatus.${s.status}`) : undefined} />
              </div>
              <p className="mt-1 truncate font-medium">{s.customer?.name}</p>
              {s.site?.address ? (
                <p className="mt-0.5 flex items-center gap-1 truncate text-xs text-muted-foreground">
                  <MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden />{s.site.address}
                </p>
              ) : null}
              <p className="mt-1 text-xs text-muted-foreground">
                {s.service?.name ?? t('survey.list.general')}{visitWhen(s.job, t.locale) ? ` · ${visitWhen(s.job, t.locale)}` : ''}
              </p>
              {s.returnedReason ? (
                <p className="mt-1.5 rounded border border-destructive/25 bg-destructive/10 px-2 py-1 text-xs text-destructive">
                  {s.returnedReason}
                </p>
              ) : null}
            </div>
            <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden />
          </Link>
        ))}
      </Stagger>
    </section>
  );
}
