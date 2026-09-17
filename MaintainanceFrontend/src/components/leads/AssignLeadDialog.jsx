import { useDispatch } from 'react-redux';
import { z } from 'zod';
import { useAssignLeadMutation, useBulkAssignLeadsMutation } from '@/api/leadsApi';
import { FormDialog } from '@/components/common/FormDialog';
import { assignFields } from '@/config/admin/crmForms';
import { toastSuccess } from '@/redux/slices/uiSlice';

const assignSchema = z.object({
  assignedToId: z.string().nullable(),
  note: z.string().trim().max(1000).optional(),
});

/**
 * Gives one lead — or a selection, in one request — to a salesperson or an admin.
 * The owner hears about it once, however many leads moved.
 *
 * @param {{ leads: object[], open: boolean, onOpenChange: (open: boolean) => void, onDone?: () => void }} props
 */
export function AssignLeadDialog({ leads, open, onOpenChange, onDone }) {
  const dispatch = useDispatch();
  const [assignOne] = useAssignLeadMutation();
  const [assignMany] = useBulkAssignLeadsMutation();
  const single = leads.length === 1 ? leads[0] : null;

  const submit = async ({ assignedToId, note }) => {
    const body = { assignedToId: assignedToId || null, ...(note ? { note } : {}) };
    if (single) {
      await assignOne({ id: single.id, ...body }).unwrap();
      dispatch(toastSuccess(body.assignedToId ? 'Lead assigned' : 'Lead unassigned'));
    } else {
      const { assigned, unchanged } = await assignMany({ ids: leads.map((l) => l.id), ...body }).unwrap();
      dispatch(toastSuccess(
        `${assigned} lead${assigned === 1 ? '' : 's'} ${body.assignedToId ? 'assigned' : 'unassigned'}`,
        unchanged ? `${unchanged} already had that owner.` : undefined,
      ));
    }
    onDone?.();
  };

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={single ? `Assign ${single.name}` : `Assign ${leads.length} leads`}
      description="The new owner gets a notification. Leave the owner empty to unassign."
      schema={assignSchema}
      fields={assignFields}
      defaultValues={{ assignedToId: single?.assignedToId ?? null, note: '' }}
      submitLabel="Assign"
      onSubmit={submit}
    />
  );
}
