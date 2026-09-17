import { useState } from 'react';
import { useDispatch } from 'react-redux';
import { CheckCircle2, AlertTriangle } from 'lucide-react';
import { useAddLeadActivityMutation } from '@/api/leadsApi';
import { ResourceForm } from '@/components/common/ResourceForm/ResourceForm';
import { leadActivitySchema } from '@/form/schemas/lead.schema';
import { activityFields } from '@/config/admin/crmForms';
import { ACTIVITY_LABELS } from '@/config/constants';
import { responseResult } from '@/helpers/leadBoard';
import { toastSuccess } from '@/redux/slices/uiSlice';
import { cn } from '@/helpers/utils';

/**
 * Logs what happened with a lead — a call, an SMS, a WhatsApp message, an email, a visit
 * or a note. The first contact stops the two-hour clock, and the composer says how that
 * went ("Responded in 34 min — within the promise").
 *
 * @param {{ lead: object, defaultType?: string, onLogged?: (activity: object) => void, guard?: boolean }} props
 */
export function ActivityComposer({ lead, defaultType = 'call', onLogged, guard = false }) {
  const dispatch = useDispatch();
  const [logActivity] = useAddLeadActivityMutation();
  const [result, setResult] = useState(null);

  const submit = async (body, { form }) => {
    const activity = await logActivity({ id: lead.id, ...body }).unwrap();
    const outcome = activity.firstResponse ? responseResult(activity.sla, lead.createdAt) : null;
    setResult(outcome ? { text: outcome, met: activity.sla?.state === 'met' } : null);
    dispatch(toastSuccess(`${ACTIVITY_LABELS[body.type]} logged`, outcome ?? undefined));
    form.reset({ type: body.type, summary: '' });
    onLogged?.(activity);
  };

  return (
    <div className="space-y-3">
      <ResourceForm
        schema={leadActivitySchema}
        fields={activityFields}
        defaultValues={{ type: defaultType, summary: '' }}
        onSubmit={submit}
        submitLabel="Log it"
        guard={guard}
      />
      {result ? (
        <p
          role="status"
          className={cn('flex items-center gap-2 rounded-md border px-3 py-2 text-sm', result.met ? 'surface-success' : 'surface-warning')}
        >
          {result.met ? <CheckCircle2 className="h-4 w-4" aria-hidden /> : <AlertTriangle className="h-4 w-4" aria-hidden />}
          {result.text}
        </p>
      ) : null}
    </div>
  );
}
