import { Link } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { MapPin, Phone, Navigation, Clock, CheckCircle2, ClipboardList } from 'lucide-react';
import { useGetMyJobsTodayQuery, useSetMyJobStatusMutation } from '@/api/techApi';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { StatusBadge, PriorityBadge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/common/EmptyState';
import { ErrorState } from '@/components/common/ErrorState';
import { PageTransition, Stagger } from '@/three/motion';
import { toastSuccess, toastError } from '@/redux/slices/uiSlice';
import { formatTime } from '@/helpers/format';

/** The next action available from each state, so the technician never has to think. */
const NEXT_ACTION = {
  SCHEDULED: { status: 'EN_ROUTE', label: 'On my way', icon: Navigation },
  ASSIGNED: { status: 'EN_ROUTE', label: 'On my way', icon: Navigation },
  EN_ROUTE: { status: 'IN_PROGRESS', label: 'Start work', icon: Clock },
  ON_HOLD: { status: 'IN_PROGRESS', label: 'Resume work', icon: Clock },
};

function JobCard({ job }) {
  const dispatch = useDispatch();
  const [setStatus, { isLoading }] = useSetMyJobStatusMutation();
  const action = NEXT_ACTION[job.status];

  const advance = async () => {
    try {
      await setStatus({ id: job.id, status: action.status }).unwrap();
      dispatch(toastSuccess(action.label, `${job.number} updated.`));
    } catch (err) {
      dispatch(toastError('Could not update', err?.data?.error?.message));
    }
  };

  const address = job.site?.address;

  return (
    <Stagger.Item>
      <Card>
        <CardContent className="p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="font-mono text-xs text-muted-foreground">{job.number}</p>
              <h2 className="mt-0.5 font-semibold leading-tight">{job.title}</h2>
            </div>
            <div className="flex shrink-0 flex-col items-end gap-1">
              <StatusBadge status={job.status} />
              <PriorityBadge priority={job.priority} />
            </div>
          </div>

          {job.scheduledStart ? (
            <p className="mt-2 flex items-center gap-1.5 text-sm text-muted-foreground">
              <Clock className="h-3.5 w-3.5" aria-hidden /> {formatTime(job.scheduledStart)}
            </p>
          ) : null}

          {address ? (
            <p className="mt-1 flex items-start gap-1.5 text-sm text-muted-foreground">
              <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden /> {address}
            </p>
          ) : null}

          {job.site?.accessNotes ? (
            <p className="mt-2 rounded-md bg-amber-50 p-2 text-xs text-amber-900 dark:bg-amber-950 dark:text-amber-200">
              {job.site.accessNotes}
            </p>
          ) : null}

          {job.tasks?.length ? (
            <p className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
              <ClipboardList className="h-3.5 w-3.5" aria-hidden />
              {job.tasks.filter((t) => t.isDone || t.isSkipped).length} of {job.tasks.length} checklist items done
            </p>
          ) : null}

          {/* Big tap targets: this is used one-handed, outdoors, in gloves. */}
          <div className="mt-4 grid grid-cols-2 gap-2">
            {job.customer?.phone ? (
              <Button asChild variant="outline" size="lg">
                <a href={`tel:${job.customer.phone}`}><Phone className="h-4 w-4" /> Call</a>
              </Button>
            ) : null}
            {address ? (
              <Button asChild variant="outline" size="lg">
                <a href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address)}`} target="_blank" rel="noreferrer">
                  <Navigation className="h-4 w-4" /> Navigate
                </a>
              </Button>
            ) : null}
          </div>

          <div className="mt-2 grid gap-2">
            {action ? (
              <Button size="lg" className="w-full" loading={isLoading} onClick={advance}>
                <action.icon className="h-4 w-4" /> {action.label}
              </Button>
            ) : null}
            <Button asChild variant={action ? 'ghost' : 'default'} size="lg" className="w-full">
              <Link to={`/tech/jobs/${job.id}`}>
                {job.status === 'IN_PROGRESS' ? <><CheckCircle2 className="h-4 w-4" /> Continue job</> : 'Open job'}
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </Stagger.Item>
  );
}

export default function TechTodayPage() {
  const { data, isLoading, error, refetch } = useGetMyJobsTodayQuery(undefined, { pollingInterval: 120000 });

  if (error) return <ErrorState error={error} onRetry={refetch} />;

  return (
    <PageTransition>
      <h1 className="text-xl font-bold">Today</h1>
      <p className="mt-0.5 text-sm text-muted-foreground">
        {isLoading ? 'Loading your jobs…' : `${data.length} job${data.length === 1 ? '' : 's'} assigned to you`}
      </p>

      {isLoading ? (
        <div className="mt-5 space-y-3">
          {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-52 rounded-xl" />)}
        </div>
      ) : !data.length ? (
        <EmptyState
          icon={CheckCircle2}
          title="Nothing scheduled for you today"
          description="New jobs appear here as soon as dispatch assigns them. You will also get an SMS."
        />
      ) : (
        <Stagger className="mt-5 space-y-3">
          {data.map((job) => <JobCard key={job.id} job={job} />)}
        </Stagger>
      )}
    </PageTransition>
  );
}
