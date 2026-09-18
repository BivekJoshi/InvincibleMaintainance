import { useState } from 'react';
import { useDispatch } from 'react-redux';
import { Plus, Trash2 } from 'lucide-react';
import { useAddJobTimeLogMutation, useDeleteJobTimeLogMutation } from '@/api/jobsApi';
import { CustomTable } from '@/components/common/CustomTable/CustomTable';
import { FormDialog } from '@/components/common/FormDialog';
import { StateBadge } from '@/components/common/StateBadge';
import { Button } from '@/components/ui/button';
import { useConfirm } from '@/hooks/useConfirm';
import { timeLogSchema } from '@/form/schemas/job.schema';
import { formatDateTime, formatMinutes, formatTime } from '@/helpers/format';
import { toastError, toastSuccess } from '@/redux/slices/uiSlice';

/**
 * Labour on the job: the technicians' own timers, and time the office records by hand (a timer
 * never started, a paper timesheet). Only a technician on the job can be credited. Costing reads
 * these at each technician's hourly rate.
 */
export function JobTimeTab({ job, canWrite }) {
  const dispatch = useDispatch();
  const [params, setParams] = useState({});
  const [adding, setAdding] = useState(false);
  const [addLog] = useAddJobTimeLogMutation();
  const [deleteLog] = useDeleteJobTimeLogMutation();
  const [confirm, confirmDialog] = useConfirm();
  const logs = job.timeLogs ?? [];
  const crew = job.assignments ?? [];
  const editable = canWrite && !['VERIFIED', 'CANCELLED'].includes(job.status);
  const total = logs.reduce((sum, l) => sum + (l.minutes ?? 0), 0);

  const remove = async (log) => {
    const ok = await confirm({
      title: 'Delete this time entry?',
      description: `${log.technician?.user?.name} · ${formatMinutes(log.minutes)}. The job's labour cost falls with it.`,
      confirmLabel: 'Delete',
      destructive: true,
    });
    if (!ok) return;
    try {
      await deleteLog({ id: job.id, logId: log.id }).unwrap();
      dispatch(toastSuccess('Time entry deleted'));
    } catch (err) {
      dispatch(toastError('Could not delete the entry', err?.data?.error?.message));
    }
  };

  const columns = [
    { key: 'technician', header: 'Technician', cell: (l) => <span className="font-medium">{l.technician?.user?.name}</span> },
    {
      key: 'startedAt', header: 'When',
      cell: (l) => (
        <span className="whitespace-nowrap text-xs">
          {formatDateTime(l.startedAt)}{l.endedAt ? `–${formatTime(l.endedAt)}` : ''}
          {!l.endedAt ? <StateBadge tone="info" className="ml-2">Timer running</StateBadge> : null}
        </span>
      ),
    },
    { key: 'minutes', header: 'Time', className: 'text-right', cell: (l) => <span className="whitespace-nowrap tabular-nums">{l.minutes ? formatMinutes(l.minutes) : '—'}</span> },
    { key: 'note', header: 'Note', cell: (l) => <span className="line-clamp-2 text-xs text-muted-foreground">{l.note ?? ''}</span> },
  ];

  const fields = [
    {
      name: 'technicianId', type: 'select', label: 'Technician', required: true,
      options: crew.map((a) => ({ value: a.technicianId, label: a.technician?.user?.name ?? a.technicianId })),
    },
    { name: 'startedAt', type: 'datetime', label: 'Started', required: true, defaultTime: '09:00' },
    { name: 'minutes', type: 'number', label: 'Minutes worked', span: 'half', min: 1, max: 1440, step: 5, description: 'Or give the end time.' },
    { name: 'endedAt', type: 'datetime', label: 'Ended', span: 'half', defaultTime: '17:00' },
    { name: 'note', type: 'textarea', label: 'Note', rows: 2, placeholder: 'From the paper timesheet' },
  ];

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">Total recorded: <span className="font-medium text-foreground">{formatMinutes(total)}</span></p>
      <CustomTable
        columns={columns}
        data={logs}
        meta={{ page: 1, pages: 1, total: logs.length, limit: logs.length || 1 }}
        params={params}
        onParamsChange={setParams}
        searchable={false}
        pageSizes={[]}
        rowActions={editable ? (l) => [{ label: 'Delete', icon: Trash2, destructive: true, onSelect: () => remove(l) }] : undefined}
        rowLabel={(l) => `${l.technician?.user?.name} ${formatDateTime(l.startedAt)}`}
        toolbar={editable ? (
          <Button size="sm" onClick={() => setAdding(true)} disabled={!crew.length} title={crew.length ? undefined : 'Assign a technician first'}>
            <Plus /> Add time
          </Button>
        ) : null}
        emptyTitle="No time recorded"
        emptyDescription={crew.length ? undefined : 'Assign a technician first — time is recorded against the people on the job.'}
      />
      <FormDialog
        open={adding}
        onOpenChange={setAdding}
        title={`Record time on ${job.number}`}
        description="For work the timer did not catch."
        schema={timeLogSchema}
        fields={fields}
        defaultValues={{ technicianId: crew.find((a) => a.isLead)?.technicianId ?? crew[0]?.technicianId, startedAt: job.actualStart ?? job.scheduledStart ?? undefined }}
        submitLabel="Record time"
        onSubmit={async (body) => {
          const log = await addLog({ id: job.id, ...body, endedAt: body.endedAt || undefined }).unwrap();
          dispatch(toastSuccess(`${formatMinutes(log.minutes)} recorded for ${log.technician?.user?.name}`));
        }}
      />
      {confirmDialog}
    </div>
  );
}
