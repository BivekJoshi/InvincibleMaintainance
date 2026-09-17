import { useCallback, useRef, useState } from 'react';
import { useDispatch } from 'react-redux';
import { useSetLeadStatusMutation } from '@/api/leadsApi';
import { LostReasonDialog } from '@/components/leads/LostReasonDialog';
import { LEAD_STATUS_LABELS } from '@/config/constants';
import { needsReason } from '@/helpers/leadBoard';
import { toastError, toastSuccess } from '@/redux/slices/uiSlice';

/**
 * Moves a lead through the state machine — the one way the screens change a status
 * (`PATCH /admin/leads/:id/status`). LOST first asks why.
 *
 *   const [changeStatus, statusDialog] = useLeadStatusChange();
 *   const moved = await changeStatus(lead, 'CONTACTED');   // true, or false if refused or cancelled
 *
 * A refused move toasts the API's reason; the caller only has to undo what it showed.
 *
 * @returns {[(lead: object, to: string) => Promise<boolean>, import('react').ReactElement]}
 */
export function useLeadStatusChange() {
  const dispatch = useDispatch();
  const [setStatus] = useSetLeadStatusMutation();
  const [asking, setAsking] = useState(null);
  const settle = useRef(null);

  const send = useCallback(async (lead, to, extra = {}) => {
    try {
      await setStatus({ id: lead.id, status: to, ...extra }).unwrap();
      dispatch(toastSuccess(`${lead.name} → ${LEAD_STATUS_LABELS[to]}`));
      return true;
    } catch (err) {
      dispatch(toastError(`Could not move ${lead.name}`, err?.data?.error?.message ?? 'Please try again.'));
      return false;
    }
  }, [dispatch, setStatus]);

  const changeStatus = useCallback((lead, to) => {
    if (!needsReason(to)) return send(lead, to);
    settle.current?.(false);
    return new Promise((resolve) => {
      settle.current = resolve;
      setAsking(lead);
    });
  }, [send]);

  const close = (open) => {
    if (open) return;
    settle.current?.(false);
    settle.current = null;
    setAsking(null);
  };

  const dialog = (
    <LostReasonDialog
      open={Boolean(asking)}
      onOpenChange={close}
      leadName={asking?.name}
      onSubmit={async (lostReason) => {
        const lead = asking;
        // A refusal throws: the dialog stays open with the API's message.
        await setStatus({ id: lead.id, status: 'LOST', lostReason }).unwrap();
        dispatch(toastSuccess(`${lead.name} marked as lost`));
        settle.current?.(true);
        settle.current = null;
      }}
    />
  );

  return [changeStatus, dialog];
}
