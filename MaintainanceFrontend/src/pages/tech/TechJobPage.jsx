import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import {
  ArrowLeft, MapPin, Phone, Navigation, Clock, Play, Square,
  CheckCircle2, Loader2, ClipboardCheck,
} from 'lucide-react';
import {
  useGetMyJobQuery, useSetMyJobStatusMutation, useToggleMyTaskMutation,
  useStartMyTimerMutation, useStopMyTimerMutation, useCompleteMyJobMutation,
  useStartJobSurveyMutation,
} from '@/api/techApi';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { StatusBadge, PriorityBadge } from '@/components/ui/badge';
import { CardSkeleton } from '@/components/ui/skeleton';
import { ErrorState } from '@/components/common/ErrorState';
import { PageTransition } from '@/three/motion/motionKit';
import { toastError, toastSuccess } from '@/redux/slices/uiSlice';
import { formatDateTime, formatTime } from '@/helpers/format';

const NEXT_ACTION = {
  SCHEDULED: { status: 'EN_ROUTE', label: 'On my way', icon: Navigation },
  ASSIGNED: { status: 'EN_ROUTE', label: 'On my way', icon: Navigation },
  EN_ROUTE: { status: 'IN_PROGRESS', label: 'Start work', icon: Clock },
  ON_HOLD: { status: 'IN_PROGRESS', label: 'Resume work', icon: Clock },
};

const CLOSED = ['COMPLETED', 'VERIFIED', 'CANCELLED'];

/**
 * One job, on a phone. The checklist has to be finished before the API accepts
 * completion, so it is the centre of the screen rather than a detail.
 */
export default function TechJobPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const dispatch = useDispatch();

  const { data: job, isLoading, error, refetch } = useGetMyJobQuery(id);
  const [setStatus, { isLoading: advancing }] = useSetMyJobStatusMutation();
  const [toggleTask] = useToggleMyTaskMutation();
  const [startTimer, { isLoading: starting }] = useStartMyTimerMutation();
  const [stopTimer, { isLoading: stopping }] = useStopMyTimerMutation();
  const [complete, { isLoading: completing }] = useCompleteMyJobMutation();
  const [startSurvey, { isLoading: startingSurvey }] = useStartJobSurveyMutation();
  const [note, setNote] = useState('');

  if (error) return <PageTransition><ErrorState error={error} onRetry={refetch} /></PageTransition>;
  if (isLoading || !job) return <PageTransition><CardSkeleton /></PageTransition>;

  const action = NEXT_ACTION[job.status];
  const openTasks = (job.tasks ?? []).filter((t) => !t.isDone && !t.isSkipped);
  const running = (job.timeLogs ?? []).find((t) => !t.endedAt);
  const closed = CLOSED.includes(job.status);

  const run = async (fn, ok, fail) => {
    try {
      await fn().unwrap();
      dispatch(toastSuccess(ok));
    } catch (err) {
      dispatch(toastError(fail, err?.data?.error?.message));
    }
  };

  /** An inspection is surveyed, not "completed" — send them to the survey instead. */
  const openSurvey = async () => {
    try {
      const survey = job.survey ?? (await startSurvey({ jobId: id }).unwrap());
      navigate(`/tech/surveys/${survey.id}`);
    } catch (err) {
      dispatch(toastError('Could not open the survey', err?.data?.error?.message));
    }
  };

  return (
    <PageTransition>
      <div className="mb-4 flex items-start gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate('/tech')} aria-label="Back to today">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="min-w-0 flex-1">
          <p className="font-mono text-xs text-muted-foreground">{job.number}</p>
          <h1 className="truncate font-semibold leading-tight">{job.title}</h1>
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            <StatusBadge status={job.status} />
            <PriorityBadge priority={job.priority} />
            {job.scheduledStart ? (
              <span className="text-xs text-muted-foreground">{formatTime(job.scheduledStart)}</span>
            ) : null}
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <Card>
          <CardContent className="space-y-3 p-4 text-sm">
            {job.customer?.name ? <p className="font-medium">{job.customer.name}</p> : null}
            <div className="flex flex-wrap gap-3">
              {job.customer?.phone ? (
                <a href={`tel:${job.customer.phone}`} className="inline-flex items-center gap-1.5 text-muted-foreground hover:text-primary">
                  <Phone className="h-4 w-4" aria-hidden />{job.customer.phone}
                </a>
              ) : null}
              {job.site?.address ? (
                <a
                  href={`https://maps.google.com/?q=${encodeURIComponent(job.site.address)}`}
                  target="_blank" rel="noreferrer"
                  className="inline-flex items-center gap-1.5 text-muted-foreground hover:text-primary"
                >
                  <MapPin className="h-4 w-4" aria-hidden />{job.site.address}
                </a>
              ) : null}
            </div>
            {job.description ? <p className="whitespace-pre-wrap text-muted-foreground">{job.description}</p> : null}
            {job.site?.accessNotes ? (
              <p className="rounded-md bg-muted px-3 py-2 text-xs">Access: {job.site.accessNotes}</p>
            ) : null}
          </CardContent>
        </Card>

        {job.type === 'INSPECTION' ? (
          <Card>
            <CardContent className="p-4">
              <p className="text-sm text-muted-foreground">
                This visit is a survey. Record the readings and what the job needs, then submit it.
              </p>
              <Button className="mt-3 w-full" onClick={openSurvey} disabled={startingSurvey}>
                {startingSurvey ? <Loader2 className="h-4 w-4 animate-spin" /> : <ClipboardCheck className="h-4 w-4" />}
                Open the survey
              </Button>
            </CardContent>
          </Card>
        ) : null}

        {(job.tasks ?? []).length ? (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">
                Checklist
                <span className="ml-2 text-xs font-normal text-muted-foreground">
                  {job.tasks.length - openTasks.length}/{job.tasks.length} done
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-1 pb-4">
              {job.tasks.map((task) => (
                <label key={task.id} className="flex items-start gap-3 rounded-md px-1 py-2 active:bg-muted">
                  <Checkbox
                    checked={task.isDone}
                    disabled={closed}
                    onCheckedChange={(v) => run(
                      () => toggleTask({ id, taskId: task.id, isDone: Boolean(v) }),
                      v ? 'Ticked off' : 'Unticked',
                      'Could not update the checklist',
                    )}
                    className="mt-0.5"
                  />
                  <span className={task.isDone ? 'text-sm text-muted-foreground line-through' : 'text-sm'}>
                    {task.title}
                    {task.note ? <span className="block text-xs text-muted-foreground">{task.note}</span> : null}
                  </span>
                </label>
              ))}
            </CardContent>
          </Card>
        ) : null}

        {!closed ? (
          <Card>
            <CardContent className="space-y-3 p-4">
              {running ? (
                <>
                  <p className="text-sm text-muted-foreground">
                    Working since {formatDateTime(running.startedAt)}
                  </p>
                  <Button
                    variant="outline" className="w-full"
                    onClick={() => run(() => stopTimer({ id }), 'Timer stopped', 'Could not stop the timer')}
                    disabled={stopping}
                  >
                    {stopping ? <Loader2 className="h-4 w-4 animate-spin" /> : <Square className="h-4 w-4" />} Stop timer
                  </Button>
                </>
              ) : (
                <Button
                  variant="outline" className="w-full"
                  onClick={() => run(() => startTimer({ id }), 'Timer started', 'Could not start the timer')}
                  disabled={starting}
                >
                  {starting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />} Start timer
                </Button>
              )}
            </CardContent>
          </Card>
        ) : null}

        {!closed && job.type !== 'INSPECTION' ? (
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-base">Finish up</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <Textarea
                value={note} onChange={(e) => setNote(e.target.value)} rows={3}
                placeholder="What you did, and anything the customer should know."
                aria-label="Completion note"
              />
              {openTasks.length ? (
                <p className="surface-warning rounded-md border px-3 py-2 text-xs">
                  {openTasks.length} checklist item{openTasks.length === 1 ? '' : 's'} still open — finish
                  {openTasks.length === 1 ? ' it' : ' them'} before completing.
                </p>
              ) : null}
              <Button
                className="w-full"
                disabled={completing || openTasks.length > 0}
                onClick={() => run(
                  () => complete({ id, note: note || undefined }),
                  'Job completed',
                  'Could not complete the job',
                )}
              >
                {completing ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                Mark complete
              </Button>
            </CardContent>
          </Card>
        ) : null}
      </div>

      {action && !closed ? (
        <div
          className="sticky bottom-20 mt-4 rounded-lg border bg-background/95 p-3 backdrop-blur"
          style={{ marginBottom: 'env(safe-area-inset-bottom)' }}
        >
          <Button
            className="w-full" size="lg" disabled={advancing}
            onClick={() => run(
              () => setStatus({ id, status: action.status }),
              action.label,
              'Could not update the job',
            )}
          >
            {advancing ? <Loader2 className="h-5 w-5 animate-spin" /> : <action.icon className="h-5 w-5" />}
            {action.label}
          </Button>
        </div>
      ) : null}
    </PageTransition>
  );
}
