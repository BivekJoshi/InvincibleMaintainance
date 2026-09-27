import { FormDialog } from '@/components/common/FormDialog';
import { lostReasonSchema } from '@/form/schemas/lead.schema';
import { lostReasonFields } from '@/config/admin/crmForms';

/**
 * Asks why a lead was lost: a category — required, the lost-lead report groups by it — and the
 * customer's words beside it (required only for "Other"). `onSubmit({ lostCategory, lostReason? })`
 * returns the status change's promise; a rejection stays in the dialog. `defaultCategory` starts it on a
 * category (the reason a customer gave when declining a quotation — Phase L4).
 */
export function LostReasonDialog({ open, onOpenChange, leadName, defaultCategory, onSubmit }) {
  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={`Mark ${leadName ?? 'this lead'} as lost`}
      description="The category feeds the lost-lead report; the words stay on the lead."
      schema={lostReasonSchema}
      fields={lostReasonFields}
      defaultValues={{ lostReason: '', ...(defaultCategory ? { lostCategory: defaultCategory } : {}) }}
      submitLabel="Mark as lost"
      onSubmit={({ lostCategory, lostReason }) => onSubmit({ lostCategory, ...(lostReason ? { lostReason } : {}) })}
    />
  );
}
