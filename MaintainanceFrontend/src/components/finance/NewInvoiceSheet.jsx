import { useDispatch } from 'react-redux';
import { useCreateInvoiceMutation } from '@/api/financeApi';
import { ResourceForm } from '@/components/common/ResourceForm/ResourceForm';
import { invoiceCreateSchema } from '@/form/schemas/finance.schema';
import { CUSTOMER_RELATION } from '@/config/admin/jobViews';
import { toastSuccess } from '@/redux/slices/uiSlice';
import { INVOICE_LINE_FIELDS } from './invoiceFields';

const FIELDS = [
  { name: 'customerId', type: 'relation', label: 'Customer', required: true, relation: CUSTOMER_RELATION },
  ...INVOICE_LINE_FIELDS,
];

/**
 * The manual invoice (Phase I, `invoices:write` — ADMIN and ACCOUNTANT): for AMC fees and one-off work that has no
 * job to bill. Lines in rupees through the kit's `lineItems` field (the invoice variant); the server works out every
 * amount, the VAT and the total when the draft is saved, and the draft opens on its own page.
 *
 * @param {{ open: boolean, onOpenChange: (open: boolean) => void, onCreated?: (invoice: object) => void, customerId?: string }} props
 */
export function NewInvoiceSheet({ open, onOpenChange, onCreated, customerId }) {
  const dispatch = useDispatch();
  const [create] = useCreateInvoiceMutation();
  return (
    <ResourceForm
      mode="sheet"
      sheetClassName="sm:max-w-3xl"
      open={open}
      onOpenChange={onOpenChange}
      title="New invoice"
      description="A hand-made invoice — AMC fees, one-off work. To bill a finished job, use Create from job."
      schema={invoiceCreateSchema}
      fields={FIELDS}
      defaultValues={{ customerId, vatApplied: true, items: [] }}
      submitLabel="Create draft invoice"
      onSubmit={async (body) => {
        const invoice = await create(body).unwrap();
        dispatch(toastSuccess(`Draft ${invoice.number} created`, 'Its totals are the server’s — check them, then send it.'));
        onOpenChange(false);
        onCreated?.(invoice);
      }}
    />
  );
}
