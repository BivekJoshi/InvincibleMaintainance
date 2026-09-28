import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Lock } from 'lucide-react';
import { useGetMyJobQuery } from '@/api/techApi';
import { ErrorState } from '@/components/common/ErrorState';
import { Button } from '@/components/ui/button';
import { CardSkeleton } from '@/components/ui/skeleton';
import { PageTransition } from '@/three/motion/motionKit';
import { useFieldCopy } from '@/hooks/useFieldCopy';
import { isOmission, measurementState } from '@/helpers/closeout';
import { MeasureLineList } from './sections/MeasureLineList';
import { MeasureSheet } from './sections/MeasureSheet';

/**
 * The final measurement from site (Phase L8) — `/tech/jobs/:id/measure`, linked from the job sheet of a BOQ job. The
 * job's lines by section (`sections/MeasureLineList`); `?line=` opens one line's sheet (`sections/MeasureSheet`): Phase
 * L5's cards, one per row at 360 px, feet-inches, deductions, room and line totals as a preview, and the office's
 * quantity once saved. English and Nepali (`fieldCopy.measure`).
 *
 * **Quantities only** (D1): the lines come from `/tech/jobs/:id` without a rate (the API's `fieldSafe`), and the save
 * sends measurement rows — never an amount. Read only once the office has closed the measurement (and an omission is
 * never opened: it keeps its quoted quantity).
 */
export default function JobMeasurePage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [search, setSearch] = useSearchParams();
  const copy = useFieldCopy();
  const t = copy.measure;
  const { data: job, isLoading, error, refetch } = useGetMyJobQuery(id);

  if (error && !job) return <PageTransition><ErrorState error={error} onRetry={refetch} /></PageTransition>;
  if (isLoading || !job) return <PageTransition><CardSkeleton /></PageTransition>;

  const lineId = search.get('line');
  const line = lineId ? (job.lines ?? []).find((l) => l.id === lineId && !isOmission(l)) ?? null : null;
  const state = measurementState(job);
  const back = () => (line ? setSearch({}, { replace: false }) : navigate(`/tech/jobs/${id}`));

  return (
    <PageTransition>
      <div className="mb-4 flex items-start gap-2">
        <Button variant="ghost" size="icon" className="h-11 w-11 shrink-0" onClick={back} aria-label={t.back}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="min-w-0 flex-1">
          <p className="truncate font-mono text-xs text-muted-foreground">{job.number}{job.title ? ` · ${job.title}` : ''}</p>
          <h1 className="font-semibold leading-tight">{t.title}</h1>
          {!line ? <p className="mt-1 text-sm text-muted-foreground">{t.body}</p> : null}
        </div>
      </div>

      {state.closed ? (
        <p role="status" data-testid="measure-closed" className="mb-4 flex items-start gap-2 rounded-md bg-muted px-3 py-2 text-sm text-muted-foreground">
          <Lock className="mt-0.5 h-4 w-4 shrink-0" aria-hidden /> {t.closed}
        </p>
      ) : null}

      {line ? (
        <MeasureSheet
          key={line.id}
          job={job}
          line={line}
          t={t}
          readOnly={state.closed}
          onRefused={(code) => { if (code === 'MEASUREMENT_CLOSED' || code === 'NOT_FOUND') refetch(); }}
        />
      ) : (
        <MeasureLineList job={job} t={t} />
      )}
    </PageTransition>
  );
}
