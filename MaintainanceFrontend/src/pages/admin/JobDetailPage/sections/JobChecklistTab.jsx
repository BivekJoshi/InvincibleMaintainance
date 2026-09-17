import { useState } from 'react';
import { useDispatch } from 'react-redux';
import { Pencil, Plus, SkipForward, Trash2, Undo2 } from 'lucide-react';
import { useAddJobTaskMutation, useDeleteJobTaskMutation, useUpdateJobTaskMutation } from '@/api/jobsApi';
import { DataTable } from '@/components/common/DataTable/DataTable';
import { FormDialog } from '@/components/common/FormDialog';
import { StateBadge } from '@/components/common/StateBadge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { useConfirm } from '@/hooks/useConfirm';
import { jobTaskSchema } from '@/form/schemas/job.schema';
import { openTasks } from '@/helpers/jobActions';
import { formatDateTime } from '@/helpers/format';
import { toastError, toastSuccess } from '@/redux/slices/uiSlice';

const TASK_FIELDS = [
  { name: 'title', type: 'text', label: 'Item', required: true, maxLength: 300 },
  { name: 'note', type: 'textarea', label: 'Note', rows: 2 },
];

/**
 * The job's checklist: tick, skip, add, edit, remove. The job cannot be completed while an item is
 * neither done nor skipped. A closed job's checklist is read-only.
 */
export function JobChecklistTab({ job, canWrite }) {
  const dispatch = useDispatch();
  const [params, setParams] = useState({});
  const [editing, setEditing] = useState(null); // {} for new, a task to edit
  const [addTask] = useAddJobTaskMutation();
  const [updateTask] = useUpdateJobTaskMutation();
  const [deleteTask] = useDeleteJobTaskMutation();
  const [confirm, confirmDialog] = useConfirm();
  const tasks = job.tasks ?? [];
  const editable = canWrite && !['VERIFIED', 'CANCELLED'].includes(job.status);
  const open = openTasks(job).length;

  const patch = async (task, body, done) => {
    try {
      await updateTask({ id: job.id, taskId: task.id, ...body }).unwrap();
      if (done) dispatch(toastSuccess(done));
    } catch (err) {
      dispatch(toastError('Could not change the checklist', err?.data?.error?.message));
    }
  };

  const remove = async (task) => {
    if (!(await confirm({ title: `Remove “${task.title}”?`, confirmLabel: 'Remove', destructive: true }))) return;
    try {
      await deleteTask({ id: job.id, taskId: task.id }).unwrap();
      dispatch(toastSuccess('Item removed'));
    } catch (err) {
      dispatch(toastError('Could not remove the item', err?.data?.error?.message));
    }
  };

  const columns = [
    {
      key: 'isDone', header: 'Done', className: 'w-14',
      cell: (t) => (
        <Checkbox
          checked={Boolean(t.isDone)}
          disabled={!editable || t.isSkipped}
          onCheckedChange={(v) => patch(t, { isDone: v === true })}
          aria-label={`Done: ${t.title}`}
        />
      ),
    },
    {
      key: 'title', header: 'Item',
      cell: (t) => (
        <div className="min-w-0">
          <p className={t.isDone || t.isSkipped ? 'text-muted-foreground line-through' : 'font-medium'}>{t.title}</p>
          {t.note ? <p className="whitespace-pre-wrap text-xs text-muted-foreground">{t.note}</p> : null}
        </div>
      ),
    },
    {
      key: 'state', header: '',
      cell: (t) => {
        if (t.isSkipped) return <StateBadge tone="warning">Skipped</StateBadge>;
        if (t.isDone) return <span className="whitespace-nowrap text-xs text-muted-foreground">{t.doneAt ? formatDateTime(t.doneAt) : 'Done'}</span>;
        return null;
      },
    },
  ];

  const rowActions = editable ? (t) => [
    { label: 'Edit', icon: Pencil, onSelect: () => setEditing(t) },
    t.isSkipped
      ? { label: 'Un-skip', icon: Undo2, onSelect: () => patch(t, { isSkipped: false }) }
      : { label: 'Skip', icon: SkipForward, disabled: t.isDone, onSelect: () => patch(t, { isSkipped: true }, 'Item skipped') },
    { label: 'Remove', icon: Trash2, destructive: true, separator: true, onSelect: () => remove(t) },
  ] : undefined;

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground" aria-live="polite">
        {tasks.length
          ? open ? `${open} of ${tasks.length} still open — the job cannot be completed until each is done or skipped.` : `All ${tasks.length} done or skipped.`
          : 'No checklist on this job.'}
      </p>
      <DataTable
        columns={columns}
        data={tasks}
        meta={{ page: 1, pages: 1, total: tasks.length, limit: tasks.length || 1 }}
        params={params}
        onParamsChange={setParams}
        searchable={false}
        pageSizes={[]}
        rowActions={rowActions}
        rowLabel={(t) => t.title}
        toolbar={editable ? <Button size="sm" onClick={() => setEditing({})}><Plus /> Add item</Button> : null}
        emptyTitle="No checklist"
        emptyDescription={editable ? 'Add the steps the technician should tick off.' : undefined}
      />
      <FormDialog
        open={Boolean(editing)}
        onOpenChange={(o) => { if (!o) setEditing(null); }}
        title={editing?.id ? 'Edit checklist item' : 'Add a checklist item'}
        schema={jobTaskSchema}
        fields={TASK_FIELDS}
        defaultValues={{ title: editing?.title ?? '', note: editing?.note ?? '' }}
        submitLabel={editing?.id ? 'Save' : 'Add'}
        onSubmit={async (body) => {
          if (editing?.id) await updateTask({ id: job.id, taskId: editing.id, ...body }).unwrap();
          else await addTask({ id: job.id, ...body, sortOrder: tasks.length }).unwrap();
          dispatch(toastSuccess(editing?.id ? 'Item saved' : 'Item added'));
        }}
      />
      {confirmDialog}
    </div>
  );
}
