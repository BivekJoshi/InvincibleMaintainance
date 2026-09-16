import { useDispatch } from 'react-redux';
import { useCreateLeadMutation, useUpdateLeadMutation } from '@/api/leadsApi';
import { ResourceForm } from '@/components/common/ResourceForm/ResourceForm';
import { adminLeadDefaults, adminLeadSchema } from '@/form/schemas/lead.schema';
import { leadEditFields, leadFields } from '@/config/admin/crmForms';
import { toastSuccess } from '@/redux/slices/uiSlice';

/**
 * The New lead / Edit lead sheet. A new lead with no owner is the caller's (the API's
 * default); the owner of an existing lead changes through Assign, which notifies them.
 *
 * @param {{ lead?: object, open: boolean, onOpenChange: (open: boolean) => void, onCreated?: (lead: object) => void }} props
 */
export function LeadFormSheet({ lead, open, onOpenChange, onCreated }) {
  const dispatch = useDispatch();
  const [createLead] = useCreateLeadMutation();
  const [updateLead] = useUpdateLeadMutation();
  const editing = Boolean(lead);

  const submit = async (body) => {
    if (editing) {
      await updateLead({ id: lead.id, ...body }).unwrap();
      dispatch(toastSuccess('Lead saved'));
    } else {
      const created = await createLead(body).unwrap();
      dispatch(toastSuccess('Lead created', 'The two-hour response clock has started.'));
      onCreated?.(created);
    }
    onOpenChange(false);
  };

  return (
    <ResourceForm
      mode="sheet"
      open={open}
      onOpenChange={onOpenChange}
      title={editing ? `Edit ${lead.name}` : 'New lead'}
      description={editing ? undefined : 'A call, a walk-in or a message — anything that did not come through the website.'}
      schema={adminLeadSchema}
      fields={editing ? leadEditFields : leadFields}
      defaultValues={editing ? lead : adminLeadDefaults}
      onSubmit={submit}
      submitLabel={editing ? 'Save lead' : 'Create lead'}
      guard={false}
    />
  );
}
