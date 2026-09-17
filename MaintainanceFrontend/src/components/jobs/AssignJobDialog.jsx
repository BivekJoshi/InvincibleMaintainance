import { useEffect, useMemo, useState } from 'react';
import { useDispatch } from 'react-redux';
import { useAssignJobMutation, useGetDispatchTechniciansQuery } from '@/api/jobsApi';
import { FormDialog } from '@/components/common/FormDialog';
import { jobAssignSchema } from '@/form/schemas/job.schema';
import { technicianOption } from '@/config/admin/jobViews';
import { toastSuccess } from '@/redux/slices/uiSlice';

/**
 * Who works a job, without touching its window. Newly added technicians get an SMS and a
 * notification. (Scheduling can set the people too — this is for a change of crew.)
 *
 * @param {{ job: object|null, onOpenChange: (open: boolean) => void }} props
 */
export function AssignJobDialog({ job, onOpenChange }) {
  const dispatch = useDispatch();
  const [assign] = useAssignJobMutation();
  const { data: people } = useGetDispatchTechniciansQuery({ limit: 100 }, { skip: !job });
  const [values, setValues] = useState(null);
  useEffect(() => setValues(null), [job?.id]);

  const defaultValues = useMemo(() => {
    const ids = [...(job?.assignments ?? [])].sort((a, b) => Number(b.isLead) - Number(a.isLead)).map((a) => a.technicianId);
    return { technicianIds: ids, leadTechnicianId: ids[0], note: '' };
  }, [job]);

  const options = useMemo(() => (people?.items ?? []).map(technicianOption), [people]);
  const nameOf = (id) => options.find((o) => o.value === id)?.label
    ?? job?.assignments?.find((a) => a.technicianId === id)?.technician?.user?.name ?? 'Someone no longer listed';
  const chosen = values?.technicianIds ?? defaultValues.technicianIds;

  const fields = [
    { name: 'technicianIds', type: 'checklist', label: 'Who goes', required: true, options, unknownLabel: nameOf },
    {
      name: 'leadTechnicianId', type: 'select', label: 'Lead technician', noneLabel: 'The first one ticked',
      options: chosen.map((id) => ({ value: id, label: nameOf(id) })),
    },
    { name: 'note', type: 'textarea', label: 'Note for the job’s timeline', rows: 2, placeholder: 'Optional' },
  ];

  const submit = async (body) => {
    await assign({
      id: job.id,
      technicianIds: body.technicianIds,
      ...(body.leadTechnicianId && body.technicianIds.includes(body.leadTechnicianId) ? { leadTechnicianId: body.leadTechnicianId } : {}),
      ...(body.note ? { note: body.note } : {}),
    }).unwrap();
    dispatch(toastSuccess(`${job.number} assigned`, 'Anyone new on it has been told.'));
  };

  return (
    <FormDialog
      open={Boolean(job)}
      onOpenChange={onOpenChange}
      title={job ? `Technicians for ${job.number}` : 'Technicians'}
      description="The first one ticked leads unless you choose another."
      schema={jobAssignSchema}
      fields={fields}
      defaultValues={defaultValues}
      onValuesChange={setValues}
      submitLabel="Save technicians"
      onSubmit={submit}
    />
  );
}
