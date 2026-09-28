import { useDispatch } from 'react-redux';
import { useOverrideJobAdvanceMutation } from '@/api/jobsApi';
import { FormDialog } from '@/components/common/FormDialog';
import { jobAdvanceOverrideSchema } from '@/form/schemas/job.schema';
import { toastSuccess } from '@/redux/slices/uiSlice';

const FIELDS = [
  {
    name: 'reason', type: 'textarea', label: 'Why may it go ahead unpaid?', required: true, rows: 3, maxLength: 500,
    placeholder: 'The customer paid the site engineer in cash; accounts will record it on Monday',
    description: 'At least 5 characters. It is kept in the job’s history with your name.',
  },
];

/**
 * **Override…** (Phase L6, L-D3): a MANAGER or ADMIN (`jobs:advance-override`) lets a job be scheduled before its
 * advance is paid, with a reason — required, 5–500 characters, audited as `job.advance_overridden`. The advance
 * invoice stays owed. The callers offer it only to holders of the capability (`helpers/handoff#canOverrideAdvance`);
 * the API answers 403 to anyone else (a DISPATCHER) and 422 when there is nothing to override.
 *
 * @param {{ job: { id: string, number: string }|null, invoiceNumber?: string|null, open: boolean,
 *   onOpenChange: (open: boolean) => void, onDone?: (job: object) => void }} props
 */
export function AdvanceOverrideDialog({ job, invoiceNumber, open, onOpenChange, onDone }) {
  const dispatch = useDispatch();
  const [override] = useOverrideJobAdvanceMutation();

  return (
    <FormDialog
      open={Boolean(open && job)}
      onOpenChange={onOpenChange}
      title={job ? `Override the advance on ${job.number}` : 'Override the advance'}
      description={`The job can then be scheduled before ${invoiceNumber ?? 'the advance invoice'} is paid. The invoice stays owed.`}
      schema={jobAdvanceOverrideSchema}
      fields={FIELDS}
      defaultValues={{ reason: '' }}
      submitLabel="Override the advance"
      onSubmit={async ({ reason }) => {
        const updated = await override({ id: job.id, reason }).unwrap();
        dispatch(toastSuccess(`${job.number} may go ahead`, `The advance stays owed${invoiceNumber ? ` on ${invoiceNumber}` : ''}.`));
        onDone?.(updated);
      }}
    />
  );
}
