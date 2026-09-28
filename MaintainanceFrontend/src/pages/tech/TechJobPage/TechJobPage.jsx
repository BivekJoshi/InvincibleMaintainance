import { useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { skipToken } from '@reduxjs/toolkit/query';
import {
  useGetMyDiaryDayQuery, useGetMyJobQuery, useGetTechMaterialsQuery, useStartJobSurveyMutation,
} from '@/api/techApi';
import { CardSkeleton } from '@/components/ui/skeleton';
import { ErrorState } from '@/components/common/ErrorState';
import { PageTransition } from '@/three/motion/motionKit';
import { useAuth } from '@/hooks/useAuth';
import { useFieldCopy } from '@/hooks/useFieldCopy';
import { useFieldQueue } from '@/hooks/useOfflineQueue';
import { applyPending, completionUpload, isClosed } from '@/helpers/fieldJob';
import { ktmDay } from '@/helpers/dispatchBoard';
import { selectFieldSync } from '@/redux/slices/fieldSyncSlice';
import { toastError, toastSuccess } from '@/redux/slices/uiSlice';
import { JobContactCard, JobHeader } from './sections/JobHeader';
import { ChecklistSection } from './sections/ChecklistSection';
import { TimerSection } from './sections/TimerSection';
import { PhotosSection } from './sections/PhotosSection';
import { MaterialsSection } from './sections/MaterialsSection';
import { CompletedSummary, FinishSection } from './sections/FinishSection';
import { HoldSheet, NextStepBar } from './sections/NextStepBar';
import { DiaryLinkCard } from './sections/DiaryLinkCard';
import { MeasureLinkCard } from './sections/MeasureLinkCard';

const online = () => navigator.onLine !== false;

/**
 * One job, on a phone — `/tech/jobs/:id`, and read only from History (`/tech/history/:id`, `readOnly`).
 *
 * Every change the technician makes here — status, a tick, the timer, a material, completion — is queued on
 * the phone and sent when there is signal (`hooks/useOfflineQueue.js`); photos and the signature wait in the
 * upload queue. The screen shows the job as the server has it with the queue applied on top
 * (`helpers/fieldJob#applyPending`), so a change shows at once, signal or not. A job that is closed, or whose
 * signature is still uploading, is read only.
 */
export default function TechJobPage({ readOnly: fromHistory = false }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const dispatch = useDispatch();
  const copy = useFieldCopy();
  const { user } = useAuth();
  const { mutations, uploads } = useSelector(selectFieldSync);
  const { queueMutation, queueUpload } = useFieldQueue();

  const { data: serverJob, isLoading, error, refetch } = useGetMyJobQuery(id);
  // Loaded while there is signal and kept for the shift, so "Log material" works in a basement.
  useGetTechMaterialsQuery(undefined, { skip: fromHistory });
  // Today's site diary page — the job's lines and trades — loaded the same way, so the diary opens with no signal.
  const diaryToday = !fromHistory && serverJob && serverJob.type !== 'INSPECTION' ? { jobId: id, day: ktmDay() } : null;
  useGetMyDiaryDayQuery(diaryToday ?? skipToken);
  const [startSurvey, { isLoading: openingSurvey }] = useStartJobSurveyMutation();
  const [holding, setHolding] = useState(false);

  const job = useMemo(
    () => applyPending(serverJob, mutations, { userId: user?.id }),
    [serverJob, mutations, user?.id],
  );
  const signing = completionUpload(uploads, id);

  // With no signal a refetch fails, but the job already on screen is still the one to work from.
  if (error && !serverJob) return <PageTransition><ErrorState error={error} onRetry={refetch} /></PageTransition>;
  if (isLoading || !job) return <PageTransition><CardSkeleton /></PageTransition>;

  const readOnly = fromHistory || isClosed(job) || Boolean(signing);

  /** Queues one change on this job. A tick is quiet; a status change says where it went. */
  const queue = async (mutation, { done, quiet = false } = {}) => {
    try {
      await queueMutation({ jobId: id, ...mutation });
      if (!online()) {
        if (!quiet) dispatch(toastSuccess(copy.savedOffline, copy.savedOfflineBody));
      } else if (done) {
        dispatch(toastSuccess(done));
      }
      return true;
    } catch (err) {
      dispatch(toastError(copy.couldNotSave, err?.message));
      return false;
    }
  };

  const advance = (status, label) => queue({ kind: 'status', payload: { status } }, { done: label });
  const hold = (note) => queue({ kind: 'status', payload: { status: 'ON_HOLD', note } }, { done: copy.status.ON_HOLD });
  const toggle = (task, isDone) => queue({ kind: 'task', taskId: task.id, payload: { isDone } }, { quiet: true });
  const startTimer = () => queue({ kind: 'time_start' }, { done: copy.job.timer.start });
  const stopTimer = () => queue({ kind: 'time_stop' }, { done: copy.job.timer.stop });

  const logMaterial = async ({ material, qty }) => {
    const ok = await queue({ kind: 'material', payload: { materialId: material.id, qty }, meta: { material } }, { quiet: true });
    if (ok) dispatch(toastSuccess(copy.materials.logged(qty, material.unit, material.name)));
  };

  /**
   * With a signature: the PNG goes in the upload queue carrying the `complete` — enqueued only once the
   * signature is on the server, because it needs the media id. Without: `complete` is queued now.
   */
  const complete = async ({ payload, signature }) => {
    if (signature) {
      await queueUpload({
        target: 'job', targetId: id, kind: 'SIGNATURE', file: signature, name: 'signature.png',
        then: { kind: 'complete', jobId: id, payload },
      });
    } else {
      await queueMutation({ kind: 'complete', jobId: id, payload });
    }
    dispatch(online()
      ? toastSuccess(copy.job.finish.completedTitle, job.number)
      : toastSuccess(copy.job.finish.completedTitle, copy.job.finish.completedOffline));
  };

  /** An inspection is surveyed, not "completed" — send them to the survey instead. */
  const openSurvey = async () => {
    try {
      const survey = job.survey ?? (await startSurvey({ jobId: id }).unwrap());
      navigate(`/tech/surveys/${survey.id}`);
    } catch (err) {
      dispatch(toastError(copy.job.survey.failed, err?.data?.error?.message));
    }
  };

  return (
    <PageTransition>
      <JobHeader job={job} copy={copy} onBack={() => navigate(fromHistory ? (location.state?.back ?? '/tech/history') : '/tech')} />

      {fromHistory || isClosed(job) ? (
        <p className="mb-4 rounded-md bg-muted px-3 py-2 text-sm text-muted-foreground">
          {fromHistory ? copy.job.historyView : copy.job.readOnly}
        </p>
      ) : null}

      <div className="space-y-4">
        <JobContactCard job={job} copy={copy} onOpenSurvey={openSurvey} openingSurvey={openingSurvey} readOnly={readOnly} />
        {job.type !== 'INSPECTION' ? <DiaryLinkCard job={job} copy={copy} /> : null}
        {/* Phase L8: a BOQ job's final measurement — its lines, measured from site. */}
        {job.type !== 'INSPECTION' && job.lines?.length > 0 && !fromHistory ? <MeasureLinkCard job={job} copy={copy} /> : null}
        <ChecklistSection job={job} copy={copy} readOnly={readOnly} onToggle={toggle} />
        <TimerSection
          job={job} copy={copy} userId={user?.id} readOnly={readOnly}
          onStart={startTimer} onStop={stopTimer} onHold={() => setHolding(true)}
        />
        <PhotosSection job={job} copy={copy} readOnly={readOnly} />
        <MaterialsSection job={job} copy={copy} readOnly={readOnly} onLog={logMaterial} />
        {!readOnly && job.type !== 'INSPECTION' ? (
          <FinishSection job={job} copy={copy} onComplete={complete} />
        ) : (
          <CompletedSummary job={job} copy={copy} signing={signing} />
        )}
      </div>

      {!readOnly ? (
        <NextStepBar job={job} copy={copy} onAdvance={advance} onHold={() => setHolding(true)} />
      ) : null}
      {!readOnly ? <HoldSheet open={holding} onOpenChange={setHolding} onConfirm={hold} copy={copy} /> : null}
    </PageTransition>
  );
}
