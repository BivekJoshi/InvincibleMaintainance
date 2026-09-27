import { useCallback, useRef, useState } from 'react';
import { useDispatch } from 'react-redux';
import { ScheduleVisitDialog } from '@/components/leads/ScheduleVisitDialog';
import { NewQuotationSheet } from '@/components/quotations/NewQuotationSheet';
import { toastSuccess } from '@/redux/slices/uiSlice';

/**
 * Opens the step a lead's next move needs, and says how it ended (Phase L1):
 *
 *   const [openFollowUp, followUpDialogs] = useLeadFollowUp();
 *   const result = await openFollowUp(lead, 'visit');   // the convert's result, or null on Cancel
 *
 * - `'visit'` — `ScheduleVisitDialog`: the customer, the inspection job and its survey. It toasts itself.
 * - `'quotation'` — the **New quotation** sheet (Phase L3: blank, from a survey, or a copy; for a lead that is not a
 *   customer yet, blank is the convert with a draft). Drafting does not move the lead (QUOTED means *sent*), so the
 *   toast says when it will. The result is the convert's (with `customer`) or `{ quotation }`.
 *
 * The outcome composer uses it for the `dialog` an activity's answer names; the board for a drop on
 * "Visit booked" or "Quoted". The caller renders `followUpDialogs`.
 *
 * @returns {[(lead: object, kind: 'visit'|'quotation') => Promise<object|null>, import('react').ReactElement|null]}
 */
export function useLeadFollowUp() {
  const dispatch = useDispatch();
  const [asking, setAsking] = useState(null);
  const settle = useRef(null);

  const openFollowUp = useCallback((lead, kind) => {
    settle.current?.(null);
    return new Promise((resolve) => {
      settle.current = resolve;
      setAsking({ lead, kind });
    });
  }, []);

  // The dialogs report completion before they close, so a close after a result settles nothing.
  const finish = useCallback((result) => {
    settle.current?.(result);
    settle.current = null;
    setAsking(null);
  }, []);
  const onOpenChange = useCallback((open) => { if (!open) finish(null); }, [finish]);

  const onQuoted = useCallback((result) => {
    const number = result?.quotation?.number;
    dispatch(toastSuccess(
      number ? `Draft ${number} created` : 'Draft quotation created',
      'The lead moves to Quoted when the quotation is sent.',
    ));
    finish(result);
  }, [dispatch, finish]);

  let dialogs = null;
  if (asking?.kind === 'visit') {
    dialogs = <ScheduleVisitDialog lead={asking.lead} open onOpenChange={onOpenChange} onScheduled={finish} />;
  } else if (asking?.kind === 'quotation') {
    dialogs = <NewQuotationSheet lead={asking.lead} open onOpenChange={onOpenChange} onCreated={onQuoted} />;
  }

  return [openFollowUp, dialogs];
}
