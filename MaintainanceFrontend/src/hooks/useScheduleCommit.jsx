import { useCallback } from 'react';
import { useDispatch } from 'react-redux';
import { useScheduleJobMutation } from '@/api/jobsApi';
import { useConfirm } from '@/hooks/useConfirm';
import { scheduleWarnings, warningText } from '@/helpers/dispatchBoard';
import { formatDateTime } from '@/helpers/format';
import { toastError, toastSuccess } from '@/redux/slices/uiSlice';

/**
 * The one way a screen puts a job on the calendar (`POST /admin/jobs/:id/schedule`): the board's
 * drop and the Schedule dialog both call this.
 *
 * With the board's `lanes` (and `days`) it checks for clashes, full days and unavailable people
 * **before** sending, and asks "Schedule anyway?" when it finds any. The API's own warnings come
 * back after the move; any the board could not see (a day it is not showing, no board at all)
 * are shown then.
 *
 *   const [commit, confirmDialog] = useScheduleCommit({ lanes, days });
 *   const done = await commit(job, { scheduledStart, scheduledEnd, technicianIds });
 *
 * @param {{ lanes?: object[], days?: string[] }} [board]
 * @returns {[(job: object, body: object, opts?: { quiet?: boolean }) => Promise<boolean>, import('react').ReactElement]}
 *   resolves false when the dispatcher called it off or the API refused (the refusal is toasted)
 */
export function useScheduleCommit({ lanes, days } = {}) {
  const dispatch = useDispatch();
  const [schedule] = useScheduleJobMutation();
  const [confirm, confirmDialog] = useConfirm();

  const commit = useCallback(async (job, body) => {
    const technicianIds = body.technicianIds ?? (job.assignments ?? []).map((a) => a.technicianId);
    const window = { scheduledStart: body.scheduledStart, scheduledEnd: body.scheduledEnd };
    const checked = lanes ? scheduleWarnings({ job, window, technicianIds, lanes, days }) : { warnings: [], unchecked: true };

    if (checked.warnings.length) {
      const ok = await confirm({
        title: `Schedule ${job.number} anyway?`,
        description: (
          <span className="block space-y-1">
            {checked.warnings.map((w) => <span key={`${w.kind}-${w.technicianId}-${w.with ?? w.day}`} className="block">{warningText(w)}</span>)}
          </span>
        ),
        confirmLabel: 'Schedule anyway',
        cancelLabel: 'Go back',
      });
      if (!ok) return false;
    }

    try {
      const { warnings } = await schedule({ id: job.id, ...body }).unwrap();
      dispatch(toastSuccess(`${job.number} scheduled`, formatDateTime(body.scheduledStart)));
      // What the board did not already show and the dispatcher did not already accept.
      const seen = new Set(checked.warnings.map((w) => `${w.kind}:${w.technicianId}:${w.day ?? ''}`));
      const fresh = warnings.filter((w) => !seen.has(`${w.kind}:${w.technicianId}:${w.day ?? ''}`));
      if (fresh.length) dispatch(toastError('Scheduled — but check this', fresh.map(warningText).join(' ')));
      return true;
    } catch (err) {
      dispatch(toastError(`Could not schedule ${job.number}`, err?.data?.error?.message ?? 'Please try again.'));
      return false;
    }
  }, [confirm, dispatch, schedule, lanes, days]);

  return [commit, confirmDialog];
}
