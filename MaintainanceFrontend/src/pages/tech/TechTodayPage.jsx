import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { MapPin, Phone, Navigation, Clock, CheckCircle2, ClipboardList, CloudUpload } from 'lucide-react';
import { useGetMyJobsTodayQuery } from '@/api/techApi';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { StatusBadge, PriorityBadge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/common/EmptyState';
import { FieldErrorState } from '@/components/tech/FieldErrorState';
import { PageTransition, Stagger } from '@/three/motion/motionKit';
import { useFieldQueue } from '@/hooks/useOfflineQueue';
import { useT } from '@/hooks/useT';
import { FIELD } from '@/config/i18n/field';
import { useAuth } from '@/hooks/useAuth';
import { NEXT_STATUS, applyPending } from '@/helpers/fieldJob';
import { formatTime } from '@/helpers/format';
import { selectFieldMutations } from '@/redux/slices/fieldSyncSlice';
import { toastError, toastSuccess } from '@/redux/slices/uiSlice';

const ACTION_ICONS = { EN_ROUTE: Navigation, IN_PROGRESS: Clock };

function JobCard({ job }) {
  const t = useT(FIELD);
  const dispatch = useDispatch();
  const { queueMutation } = useFieldQueue();
  const next = NEXT_STATUS[job.status];
  const label = next ? t(job.status === 'ON_HOLD' ? 'actions.resume' : `actions.${next}`) : null;
  const Icon = ACTION_ICONS[next];

  /** Queued like every field change: it shows at once, and reaches the office when there is signal. */
  const advance = async () => {
    try {
      await queueMutation({ kind: 'status', jobId: job.id, payload: { status: next } });
      if (navigator.onLine) dispatch(toastSuccess(label, job.number));
      else dispatch(toastSuccess(t('savedOffline'), t('savedOfflineBody')));
    } catch (err) {
      dispatch(toastError(t('couldNotSave'), err?.message));
    }
  };

  const address = job.site?.address;
  const done = (job.tasks ?? []).filter((task) => task.isDone || task.isSkipped).length;

  return (
    <Stagger.Item>
      <Card role="article" aria-label={`${job.number} — ${job.title}`}>
        <CardContent className="p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="font-mono text-xs text-muted-foreground">{job.number}</p>
              <h2 className="mt-0.5 font-semibold leading-tight">{job.title}</h2>
            </div>
            <div className="flex shrink-0 flex-col items-end gap-1">
              <StatusBadge status={job.status} label={t(`status.${job.status}`)} />
              <PriorityBadge priority={job.priority} label={job.priority ? t(`priority.${job.priority}`) : null} />
              {job.pendingCount ? (
                <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                  <CloudUpload className="h-3 w-3" aria-hidden /> {t('job.pending')}
                </span>
              ) : null}
            </div>
          </div>

          {job.scheduledStart ? (
            <p className="mt-2 flex items-center gap-1.5 text-sm text-muted-foreground">
              <Clock className="h-3.5 w-3.5" aria-hidden /> {formatTime(job.scheduledStart, { locale: t.locale })}
            </p>
          ) : null}

          {address ? (
            <p className="mt-1 flex items-start gap-1.5 text-sm text-muted-foreground">
              <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden /> {address}
            </p>
          ) : null}

          {job.site?.accessNotes ? (
            <p className="surface-warning mt-2 rounded-md border p-2 text-xs">
              {job.site.accessNotes}
            </p>
          ) : null}

          {job.tasks?.length ? (
            <p className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
              <ClipboardList className="h-3.5 w-3.5" aria-hidden />
              {t('today.checklist', { done, total: job.tasks.length })}
            </p>
          ) : null}

          {/* Big tap targets: this is used one-handed, outdoors, in gloves. */}
          <div className="mt-4 grid grid-cols-2 gap-2">
            {job.customer?.phone ? (
              <Button asChild variant="outline" size="lg">
                <a href={`tel:${job.customer.phone}`}><Phone className="h-4 w-4" /> {t('today.call')}</a>
              </Button>
            ) : null}
            {address ? (
              <Button asChild variant="outline" size="lg">
                <a href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address)}`} target="_blank" rel="noreferrer">
                  <Navigation className="h-4 w-4" /> {t('today.navigate')}
                </a>
              </Button>
            ) : null}
          </div>

          <div className="mt-2 grid gap-2">
            {next ? (
              <Button size="xl" className="w-full" onClick={advance}>
                {Icon ? <Icon className="h-4 w-4" /> : null} {label}
              </Button>
            ) : null}
            <Button asChild variant={next ? 'ghost' : 'default'} size="lg" className="w-full">
              <Link to={`/tech/jobs/${job.id}`}>
                {job.status === 'IN_PROGRESS' ? <><CheckCircle2 className="h-4 w-4" /> {t('today.continue')}</> : t('today.open')}
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </Stagger.Item>
  );
}

export default function TechTodayPage() {
  const t = useT(FIELD);
  const { user } = useAuth();
  const mutations = useSelector(selectFieldMutations);
  const { data, isLoading, error, refetch } = useGetMyJobsTodayQuery(undefined, { pollingInterval: 120000 });
  // The list as it will be once this phone's queue reaches the office.
  const jobs = useMemo(() => (data ?? []).map((job) => applyPending(job, mutations, { userId: user?.id })), [data, mutations, user?.id]);

  // With no signal a refetch fails, but the last list is still good to work from.
  if (error && !data) return <FieldErrorState error={error} onRetry={refetch} />;

  return (
    <PageTransition>
      <h1 className="text-xl font-bold">{t('today.title')}</h1>
      <p className="mt-0.5 text-sm text-muted-foreground">
        {isLoading ? t('today.loading') : t('today.count', { count: jobs.length })}
      </p>

      {isLoading ? (
        <div className="mt-5 space-y-3">
          {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-52 rounded-xl" />)}
        </div>
      ) : !jobs.length ? (
        <EmptyState icon={CheckCircle2} title={t('today.emptyTitle')} description={t('today.emptyBody')} />
      ) : (
        <Stagger className="mt-5 space-y-3">
          {jobs.map((job) => <JobCard key={job.id} job={job} />)}
        </Stagger>
      )}
    </PageTransition>
  );
}
