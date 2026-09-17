import { FormDialog } from '@/components/common/FormDialog';
import { lostReasonSchema } from '@/form/schemas/lead.schema';
import { lostReasonFields } from '@/config/admin/crmForms';

/**
 * Asks why a lead was lost — the API refuses LOST without a reason. `onSubmit(reason)`
 * returns the status change's promise; a rejection stays in the dialog.
 */
export function LostReasonDialog({ open, onOpenChange, leadName, onSubmit }) {
  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={`Mark ${leadName ?? 'this lead'} as lost`}
      description="The reason shows on the lead and in the lost-lead report."
      schema={lostReasonSchema}
      fields={lostReasonFields}
      defaultValues={{ lostReason: '' }}
      submitLabel="Mark as lost"
      onSubmit={(body) => onSubmit(body.lostReason)}
    />
  );
}
