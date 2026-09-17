import { useEffect, useMemo, useState } from 'react';
import { useGetDispatchTechniciansQuery } from '@/api/jobsApi';
import { FormDialog } from '@/components/common/FormDialog';
import { jobScheduleSchema } from '@/form/schemas/job.schema';
import { useScheduleCommit } from '@/hooks/useScheduleCommit';
import { technicianOption } from '@/config/admin/jobViews';
import { dropWindow, windowAt } from '@/helpers/dispatchBoard';
import { toKathmanduParts } from '@/helpers/format';

/** A cancelled "Schedule anyway?" keeps the dialog open with this line above the form. */
const CALLED_OFF = { data: { error: { message: 'Not scheduled yet — change the time or the people, or schedule anyway.' } } };

/**
 * Schedule a job: its window, who goes, who leads, and whether the customer is texted. Every
 * card on the dispatch board opens this — the way to schedule without dragging — and so does the
 * job's own page. With the board's `lanes` it warns about clashes before it sends.
 *
 * @param {object} props
 * @param {object|null} props.job           the job (null closes the dialog)
 * @param {(open: boolean) => void} props.onOpenChange
 * @param {{ day: string, hour?: number, technicianId?: string }} [props.target] a board cell to start from
 * @param {object[]} [props.lanes]
 * @param {string[]} [props.days]
 * @param {() => void} [props.onDone]
 */
export function ScheduleJobDialog({ job, onOpenChange, target, lanes, days, onDone }) {
  const [commit, confirmDialog] = useScheduleCommit({ lanes, days });
  const { data: people } = useGetDispatchTechniciansQuery({ limit: 100 }, { skip: !job });
  const [values, setValues] = useState(null);
  useEffect(() => setValues(null), [job?.id]);

  const defaultValues = useMemo(() => {
    if (!job) return {};
    const current = [...(job.assignments ?? [])].sort((a, b) => Number(b.isLead) - Number(a.isLead)).map((a) => a.technicianId);
    const technicianIds = target?.technicianId ? [target.technicianId, ...current.filter((id) => id !== target.technicianId)] : current;
    const window = target
      ? dropWindow(job, target)
      : job.scheduledStart ? { scheduledStart: job.scheduledStart, scheduledEnd: job.scheduledEnd }
        : windowAt(toKathmanduParts(new Date().toISOString()).date, '10:00', 120);
    return {
      ...window,
      technicianIds,
      leadTechnicianId: technicianIds[0],
      notifyCustomer: true,
      note: '',
    };
  }, [job, target]);

  const chosen = values?.technicianIds ?? defaultValues.technicianIds ?? [];
  const options = useMemo(() => (people?.items ?? []).map(technicianOption), [people]);
  const nameOf = (id) => options.find((o) => o.value === id)?.label
    ?? job?.assignments?.find((a) => a.technicianId === id)?.technician?.user?.name ?? 'Someone no longer listed';

  const fields = [
    { name: 'scheduledStart', type: 'datetime', label: 'Starts', required: true, span: 'half', defaultTime: '10:00' },
    { name: 'scheduledEnd', type: 'datetime', label: 'Ends', required: true, span: 'half', defaultTime: '12:00' },
    {
      name: 'technicianIds', type: 'checklist', label: 'Who goes', required: true, options,
      unknownLabel: nameOf, emptyText: 'No technicians yet — add them under Operations › Technicians.',
    },
    {
      name: 'leadTechnicianId', type: 'select', label: 'Lead technician', noneLabel: 'The first one ticked',
      options: chosen.map((id) => ({ value: id, label: nameOf(id) })),
      description: 'Leads the job on site and gets the customer’s number first.',
    },
    { name: 'notifyCustomer', type: 'switch', label: 'Text the customer the new time', description: 'In their language. Turn off for a change they already agreed on the phone.' },
    { name: 'note', type: 'textarea', label: 'Note for the job’s timeline', rows: 2, placeholder: 'Optional' },
  ];

  const submit = async (body) => {
    const lead = body.leadTechnicianId && body.technicianIds.includes(body.leadTechnicianId) ? body.leadTechnicianId : undefined;
    const done = await commit(job, { ...body, leadTechnicianId: lead, note: body.note || undefined });
    if (!done) throw CALLED_OFF;
    onDone?.();
  };

  return (
    <>
      <FormDialog
        open={Boolean(job)}
        onOpenChange={onOpenChange}
        title={job ? `Schedule ${job.number}` : 'Schedule'}
        description={job ? `${job.title}${job.customer?.name ? ` · ${job.customer.name}` : ''}` : undefined}
        schema={jobScheduleSchema}
        fields={fields}
        defaultValues={defaultValues}
        onValuesChange={setValues}
        submitLabel="Schedule"
        onSubmit={submit}
      />
      {confirmDialog}
    </>
  );
}
