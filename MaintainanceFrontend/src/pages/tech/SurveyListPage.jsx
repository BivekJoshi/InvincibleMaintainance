import { Link } from 'react-router-dom';
import { ClipboardCheck, MapPin, ChevronRight } from 'lucide-react';
import { useGetMySurveysQuery } from '@/api/techApi';
import { ErrorState } from '@/components/common/ErrorState';
import { EmptyState } from '@/components/common/EmptyState';
import { StatusBadge } from '@/components/ui/badge';
import { CardSkeleton } from '@/components/ui/skeleton';
import { PageTransition, Stagger } from '@/three/motion/motionKit';
import { formatDate } from '@/helpers/format';

/** Anything still in the surveyor's hands sorts above what the office has. */
const OPEN = ['DRAFT', 'RETURNED'];

export default function SurveyListPage() {
  const { data: surveys, isLoading, error, refetch } = useGetMySurveysQuery({});

  if (isLoading) return <PageTransition><CardSkeleton /></PageTransition>;
  if (error) return <PageTransition><ErrorState error={error} onRetry={refetch} /></PageTransition>;

  if (!surveys?.length) {
    return (
      <PageTransition>
        <EmptyState
          icon={ClipboardCheck}
          title="No surveys yet"
          description="A survey appears here once a visit is booked and assigned to you."
        />
      </PageTransition>
    );
  }

  const open = surveys.filter((s) => OPEN.includes(s.status));
  const done = surveys.filter((s) => !OPEN.includes(s.status));

  return (
    <PageTransition>
      <h1 className="mb-4 text-lg font-semibold">Your surveys</h1>
      {open.length ? <Section title="To fill in" surveys={open} /> : null}
      {done.length ? <Section title="Submitted" surveys={done} muted /> : null}
    </PageTransition>
  );
}

function Section({ title, surveys, muted }) {
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
                <StatusBadge status={s.status} />
              </div>
              <p className="mt-1 truncate font-medium">{s.customer?.name}</p>
              {s.site?.address ? (
                <p className="mt-0.5 flex items-center gap-1 truncate text-xs text-muted-foreground">
                  <MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden />{s.site.address}
                </p>
              ) : null}
              <p className="mt-1 text-xs text-muted-foreground">
                {s.service?.name ?? 'General'} · {formatDate(s.job?.scheduledStart)}
              </p>
              {s.returnedReason ? (
                <p className="mt-1.5 rounded bg-rose-50 px-2 py-1 text-xs text-rose-800 dark:bg-rose-950/40 dark:text-rose-300">
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
