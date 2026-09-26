import { useCallback, useMemo, useState } from 'react';
import { useDispatch } from 'react-redux';
import { AlertTriangle, CalendarClock, CheckCircle2 } from 'lucide-react';
import { useAddLeadActivityMutation } from '@/api/leadsApi';
import { ResourceForm } from '@/components/common/ResourceForm/ResourceForm';
import { activityBody, activityFormSchema } from '@/form/schemas/lead.schema';
import { activityFieldsFor } from '@/config/admin/crmForms';
import { ACTIVITY_LABELS, LEAD_OUTCOME_LABELS, LEAD_STATUS_LABELS, NEXT_ACTION_LABELS } from '@/config/constants';
import { responseResult } from '@/helpers/leadBoard';
import { formatWhen, isClosedLead } from '@/helpers/leadFollowUp';
import { useLeadFollowUp } from '@/hooks/useLeadFollowUp';
import { toastSuccess } from '@/redux/slices/uiSlice';
import { cn } from '@/helpers/utils';

/**
 * Every value the composer can hold, blank. The fields come and go with the outcome, so the form
 * starts with all of them: ResourceForm resets a clean form whenever its starting values change,
 * and a starting point that grew with each field shown would wipe the outcome just picked.
 */
const BLANK = {
  summary: '', outcome: undefined, overrideNext: false, resolution: undefined,
  nextActionAt: undefined, nextActionType: undefined, nextActionNote: '', lostCategory: undefined, lostReason: '',
};

/** The values that decide which fields show; everything else is typed text. */
const PICKED = ['type', 'outcome', 'overrideNext', 'resolution', 'lostCategory'];
const pickOf = (values) => Object.fromEntries(PICKED.map((k) => [k, values?.[k] ?? undefined]));
const samePick = (a, b) => PICKED.every((k) => a[k] === b[k]);

/** What the answer did to the lead, in one line: its next action, or that it closed. */
function afterLine(lead) {
  if (!lead) return null;
  if (lead.status === 'LOST') return 'The lead is marked lost.';
  if (lead.nextActionAt) {
    return `Next: ${NEXT_ACTION_LABELS[lead.nextActionType] ?? 'Follow up'} · ${formatWhen(lead.nextActionAt)}`;
  }
  return null;
}

/**
 * Logs what happened with a lead — a call, an SMS, a WhatsApp message, an email, a visit or a note —
 * and, for a contact on an open lead, **what came of it** (Phase L1). The outcome decides what else
 * the form asks: a time for "Call back at…" and "Not now", why it was lost for "Not interested", a
 * next action or the lead closed for "Wrong number", and an optional different next action for the
 * rest (the API sets its default). It refuses what the API would (`activityFormSchema` mirrors the rules).
 *
 * After the save the lead's next step opens where the answer says (`dialog`): "Interested — book a
 * visit" opens the visit booking, "Interested — quote without a visit" the new-quotation sheet.
 * `onLogged(activity, followUp)` is called once that step is done or cancelled (`followUp` is the
 * convert's result, or null). The first contact stops the two-hour clock, and the composer says how
 * that went ("Responded in 34 min — within the promise").
 *
 * @param {{ lead: object, defaultType?: string, onLogged?: (activity: object, followUp: object|null) => void, guard?: boolean }} props
 */
export function ActivityComposer({ lead, defaultType = 'call', onLogged, guard = false }) {
  const dispatch = useDispatch();
  const [logActivity] = useAddLeadActivityMutation();
  const [openFollowUp, followUpDialogs] = useLeadFollowUp();
  const [result, setResult] = useState(null);
  const [picked, setPicked] = useState(() => pickOf({ type: defaultType }));
  const open = !isClosedLead(lead);

  const fields = useMemo(
    () => activityFieldsFor(picked, { open }),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- the pick is compared by value
    [picked.type, picked.outcome, picked.overrideNext, picked.resolution, picked.lostCategory, open],
  );
  const onValuesChange = useCallback((values) => {
    const next = pickOf(values);
    setPicked((prev) => (samePick(prev, next) ? prev : next));
  }, []);

  const submit = async (values, { form }) => {
    const body = activityBody(values);
    const activity = await logActivity({ id: lead.id, ...body }).unwrap();
    const responded = activity.firstResponse ? responseResult(activity.sla, lead.createdAt) : null;
    const after = afterLine(activity.lead);
    const moved = activity.lead?.status && activity.lead.status !== lead.status && activity.lead.status !== 'LOST'
      ? `Now ${LEAD_STATUS_LABELS[activity.lead.status]}.` : null;
    setResult(responded || after ? { responded, met: activity.sla?.state === 'met', after } : null);
    dispatch(toastSuccess(
      body.outcome ? `${ACTIVITY_LABELS[body.type]} logged — ${LEAD_OUTCOME_LABELS[body.outcome]}` : `${ACTIVITY_LABELS[body.type]} logged`,
      [responded, moved, after].filter(Boolean).join(' ') || undefined,
    ));
    form.reset({ ...BLANK, type: body.type });
    setPicked(pickOf({ type: body.type }));

    // The next step opens after the form is free again; the caller hears once it is done or cancelled.
    if (activity.dialog === 'visit' || activity.dialog === 'quotation') {
      openFollowUp(lead, activity.dialog).then((followUp) => onLogged?.(activity, followUp));
    } else {
      onLogged?.(activity, null);
    }
  };

  const defaults = useMemo(() => ({ ...BLANK, type: defaultType }), [defaultType]);

  return (
    <div className="space-y-3">
      <ResourceForm
        schema={activityFormSchema}
        fields={fields}
        defaultValues={defaults}
        onSubmit={submit}
        onValuesChange={onValuesChange}
        submitLabel="Log it"
        guard={guard}
      />
      {result ? (
        <div role="status" className="space-y-1.5">
          {result.responded ? (
            <p className={cn('flex items-center gap-2 rounded-md border px-3 py-2 text-sm', result.met ? 'surface-success' : 'surface-warning')}>
              {result.met ? <CheckCircle2 className="h-4 w-4" aria-hidden /> : <AlertTriangle className="h-4 w-4" aria-hidden />}
              {result.responded}
            </p>
          ) : null}
          {result.after ? (
            <p className="flex items-center gap-2 rounded-md border bg-muted/40 px-3 py-2 text-sm">
              <CalendarClock className="h-4 w-4 text-primary" aria-hidden />
              {result.after}
            </p>
          ) : null}
        </div>
      ) : null}
      {followUpDialogs}
    </div>
  );
}
