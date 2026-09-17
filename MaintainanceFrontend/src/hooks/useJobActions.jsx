import { useCallback, useState } from 'react';
import { useDispatch } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import {
  useDeleteJobMutation, usePublishCaseStudyMutation, useSetJobStatusMutation, useVerifyJobMutation,
} from '@/api/jobsApi';
import { FormDialog } from '@/components/common/FormDialog';
import { ScheduleJobDialog } from '@/components/jobs/ScheduleJobDialog';
import { AssignJobDialog } from '@/components/jobs/AssignJobDialog';
import { CompleteJobDialog } from '@/components/jobs/CompleteJobDialog';
import { useConfirm } from '@/hooks/useConfirm';
import { caseStudyStartSchema, jobNoteSchema, jobRequiredNoteSchema } from '@/form/schemas/job.schema';
import { JOB_STATUS_LABELS } from '@/config/constants';
import { toastError, toastSuccess } from '@/redux/slices/uiSlice';

const NOTE_COPY = {
  ON_HOLD: { title: 'Put on hold', label: 'Why is it on hold?', placeholder: 'Waiting for the customer to clear the terrace', submit: 'Put on hold' },
  CANCELLED: { title: 'Cancel', label: 'Why is it cancelled?', placeholder: 'The customer found someone else', submit: 'Cancel job' },
  IN_PROGRESS: { title: 'Reopen', label: 'What still needs doing?', placeholder: 'Optional', submit: 'Reopen' },
};

const CASE_STUDY_FIELDS = [
  { name: 'title', type: 'text', label: 'Title', maxLength: 200, placeholder: 'Leave empty for “<service> — <area>”' },
  {
    name: 'includeClientName', type: 'switch', label: 'Name the customer',
    description: 'Off unless the customer has agreed to be named. The price is always shown as a band, never their amount.',
  },
];

/**
 * Runs an action from `helpers/jobActions` — the one way a screen moves a job. Scheduling,
 * assigning and completing open their dialogs; hold, cancel and reopen ask why; verify and
 * delete confirm; "Publish case study" makes the unpublished draft and opens it in the project
 * editor. A refusal toasts the API's reason.
 *
 *   const [runAction, actionDialogs] = useJobActions({ onDeleted });
 *   runAction(action, job);
 *
 * @param {{ onDeleted?: (job: object) => void }} [options]
 * @returns {[(action: import('@/helpers/jobActions').JobAction, job: object) => Promise<boolean>, import('react').ReactElement]}
 */
export function useJobActions({ onDeleted } = {}) {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const [confirm, confirmDialog] = useConfirm();
  const [open, setOpen] = useState(null); // { kind, job, action }
  const [setStatus] = useSetJobStatusMutation();
  const [verify] = useVerifyJobMutation();
  const [remove] = useDeleteJobMutation();
  const [publish] = usePublishCaseStudyMutation();

  const close = useCallback((isOpen) => { if (!isOpen) setOpen(null); }, []);
  const fail = useCallback((what, err) => dispatch(toastError(what, err?.data?.error?.message ?? 'Please try again.')), [dispatch]);

  const run = useCallback(async (action, job) => {
    if (action.disabledReason) return false;
    switch (action.key) {
      case 'schedule':
      case 'assign':
      case 'complete':
      case 'publish':
        setOpen({ kind: action.key, job, action });
        return true;
      case 'openCaseStudy':
        navigate(`/admin/content/projects/${job.project.id}`);
        return true;
      case 'status': {
        if (action.note) {
          setOpen({ kind: 'note', job, action });
          return true;
        }
        try {
          await setStatus({ id: job.id, status: action.to }).unwrap();
          dispatch(toastSuccess(`${job.number}: ${JOB_STATUS_LABELS[action.to].toLowerCase()}`));
          return true;
        } catch (err) {
          fail(`Could not move ${job.number}`, err);
          return false;
        }
      }
      case 'verify': {
        const ok = await confirm({
          title: `Verify ${job.number}?`,
          description: 'Verified means the office has checked the work, the photos and the sign-off. It closes the job.',
          confirmLabel: 'Verify',
        });
        if (!ok) return false;
        try {
          await verify({ id: job.id }).unwrap();
          dispatch(toastSuccess(`${job.number} verified`));
          return true;
        } catch (err) {
          fail(`Could not verify ${job.number}`, err);
          return false;
        }
      }
      case 'delete': {
        const ok = await confirm({
          title: `Delete ${job.number}?`,
          description: 'It leaves every list and the board. Its history stays in the audit log.',
          confirmLabel: 'Delete job',
          destructive: true,
        });
        if (!ok) return false;
        try {
          await remove(job.id).unwrap();
          dispatch(toastSuccess(`${job.number} deleted`));
          onDeleted?.(job);
          return true;
        } catch (err) {
          fail(`Could not delete ${job.number}`, err);
          return false;
        }
      }
      default:
        return false;
    }
  }, [confirm, dispatch, fail, navigate, onDeleted, remove, setStatus, verify]);

  const noteCopy = open?.kind === 'note' ? NOTE_COPY[open.action.to] : null;

  const dialogs = (
    <>
      <ScheduleJobDialog job={open?.kind === 'schedule' ? open.job : null} onOpenChange={close} />
      <AssignJobDialog job={open?.kind === 'assign' ? open.job : null} onOpenChange={close} />
      <CompleteJobDialog job={open?.kind === 'complete' ? open.job : null} onOpenChange={close} />
      <FormDialog
        open={open?.kind === 'note'}
        onOpenChange={close}
        title={noteCopy ? `${noteCopy.title} ${open.job.number}` : ''}
        schema={open?.action?.noteRequired ? jobRequiredNoteSchema : jobNoteSchema}
        fields={noteCopy ? [{
          name: 'note', type: 'textarea', label: noteCopy.label, rows: 3, required: Boolean(open.action.noteRequired),
          placeholder: noteCopy.placeholder,
        }] : []}
        defaultValues={{ note: '' }}
        submitLabel={noteCopy?.submit ?? 'Save'}
        onSubmit={async ({ note }) => {
          await setStatus({ id: open.job.id, status: open.action.to, ...(note ? { note } : {}) }).unwrap();
          dispatch(toastSuccess(`${open.job.number}: ${JOB_STATUS_LABELS[open.action.to].toLowerCase()}`));
        }}
      />
      <FormDialog
        open={open?.kind === 'publish'}
        onOpenChange={close}
        title={open?.kind === 'publish' ? `Publish ${open.job.number} as a case study` : ''}
        description="Makes an unpublished project from the job — its survey, duration and before/after photos — and opens it for you to finish."
        schema={caseStudyStartSchema}
        fields={CASE_STUDY_FIELDS}
        defaultValues={{ title: '', includeClientName: false }}
        submitLabel="Create the draft"
        onSubmit={async (body) => {
          const project = await publish({ id: open.job.id, ...body, title: body.title || undefined }).unwrap();
          dispatch(toastSuccess('Case study drafted', 'It stays off the website until you switch it on.'));
          navigate(`/admin/content/projects/${project.id}`);
        }}
      />
      {confirmDialog}
    </>
  );

  return [run, dialogs];
}
