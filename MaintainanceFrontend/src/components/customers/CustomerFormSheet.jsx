import { useDispatch } from 'react-redux';
import { useCreateCustomerMutation } from '@/api/customersApi';
import { ResourceForm } from '@/components/common/ResourceForm/ResourceForm';
import { customerDefaults, customerSchema } from '@/form/schemas/customer.schema';
import { customerFields } from '@/config/admin/crmForms';
import { toastSuccess } from '@/redux/slices/uiSlice';

/**
 * New customer. A phone another customer already has is allowed — families and tenants
 * share one — so the sheet says so rather than refusing.
 */
export function CustomerFormSheet({ open, onOpenChange, onCreated }) {
  const dispatch = useDispatch();
  const [createCustomer] = useCreateCustomerMutation();

  return (
    <ResourceForm
      mode="sheet"
      open={open}
      onOpenChange={onOpenChange}
      title="New customer"
      description="Most customers arrive by converting a lead. Add one here for a walk-in or a referral."
      schema={customerSchema}
      fields={customerFields}
      defaultValues={customerDefaults}
      submitLabel="Create customer"
      guard={false}
      onSubmit={async (body) => {
        const customer = await createCustomer(body).unwrap();
        dispatch(toastSuccess('Customer created'));
        onOpenChange(false);
        onCreated?.(customer);
      }}
    />
  );
}
