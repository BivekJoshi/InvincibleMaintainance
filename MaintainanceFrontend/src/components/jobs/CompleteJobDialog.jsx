import { useDispatch } from 'react-redux';
import { useCompleteJobMutation } from '@/api/jobsApi';
import { FormDialog } from '@/components/common/FormDialog';
import { jobCompleteSchema } from '@/form/schemas/job.schema';
import { toastSuccess } from '@/redux/slices/uiSlice';

const RATINGS = [5, 4, 3, 2, 1].map((n) => ({ value: String(n), label: `${'★'.repeat(n)}${'☆'.repeat(5 - n)} (${n})` }));

/**
 * Completes a job from the office — the customer's sign-off taken on paper or by phone. The API
 * refuses while checklist items are open; completion creates the warranty (not for an inspection)
 * and tells the customer in their language.
 *
 * @param {{ job: object|null, onOpenChange: (open: boolean) => void }} props
 */
export function CompleteJobDialog({ job, onOpenChange }) {
  const dispatch = useDispatch();
  const [complete] = useCompleteJobMutation();
  const inspection = job?.type === 'INSPECTION';

  const fields = [
    { name: 'note', type: 'textarea', label: 'What was done', rows: 3 },
    { name: 'signatureMediaId', type: 'media', label: 'Customer’s signature', description: 'A photo of the signed job sheet, if there is one.' },
    { name: 'customerRating', type: 'select', label: 'Customer’s rating', span: 'half', options: RATINGS, noneLabel: 'Not given' },
    ...(inspection ? [] : [{
      name: 'warrantyDays', type: 'number', label: 'Warranty (days)', span: 'half', min: 0, max: 3650, step: 1,
      description: 'Leave empty for the usual period. 0 = no warranty.',
    }]),
    { name: 'customerFeedback', type: 'textarea', label: 'What the customer said', rows: 2 },
    ...(inspection ? [] : [{ name: 'warrantyScope', type: 'textarea', label: 'What the warranty covers', rows: 2, placeholder: 'Workmanship warranty for this job' }]),
  ];

  const submit = async (body) => {
    await complete({ id: job.id, ...body, signatureMediaId: body.signatureMediaId || undefined }).unwrap();
    dispatch(toastSuccess(`${job.number} completed`, inspection ? undefined : 'The warranty is issued and the customer has been told.'));
  };

  return (
    <FormDialog
      open={Boolean(job)}
      onOpenChange={onOpenChange}
      title={job ? `Complete ${job.number}` : 'Complete'}
      description="Every checklist item must be done or skipped first."
      schema={jobCompleteSchema}
      fields={fields}
      defaultValues={{}}
      submitLabel="Complete job"
      onSubmit={submit}
    />
  );
}
