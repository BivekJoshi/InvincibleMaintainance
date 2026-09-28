import { useMemo } from 'react';
import { useDispatch } from 'react-redux';
import { useUpdateInvoiceMutation } from '@/api/financeApi';
import { ResourceForm } from '@/components/common/ResourceForm/ResourceForm';
import { INVOICE_LINE_FIELDS } from '@/components/finance/invoiceFields';
import { invoiceEditSchema } from '@/form/schemas/finance.schema';
import { toastSuccess } from '@/redux/slices/uiSlice';

/** The words for the API's 422 INVOICE_LOCKED — someone sent it while this form was open. */
export const INVOICE_LOCKED_MESSAGE = 'This invoice has been sent, so it can no longer be edited. To change it, void it and issue another.';

/**
 * A DRAFT's edit form (Phase I2): the lines (the kit's `lineItems` field, invoice variant — each saved line shows the
 * server's amount), discount, VAT, due date, note and terms, saved with `PUT /admin/invoices/:id`. The server
 * re-prices the draft; the totals above come back from it. A 422 INVOICE_LOCKED (it was sent meanwhile) is told
 * in words over the form.
 *
 * @param {{ invoice: object }} props
 */
export function InvoiceEditForm({ invoice }) {
  const dispatch = useDispatch();
  const [update] = useUpdateInvoiceMutation();
  const fields = useMemo(() => {
    const figures = new Map((invoice.items ?? []).map((item) => [item.id, { amount: item.amount }]));
    return INVOICE_LINE_FIELDS.map((f) => (f.name === 'items' ? { ...f, figures } : f));
  }, [invoice.items]);

  return (
    <ResourceForm
      schema={invoiceEditSchema}
      fields={fields}
      defaultValues={invoice}
      submitLabel="Save draft"
      stickyActions
      onSubmit={async (body) => {
        try {
          await update({ id: invoice.id, ...body }).unwrap();
        } catch (err) {
          if (err?.data?.error?.code === 'INVOICE_LOCKED') {
            throw { ...err, data: { ...err.data, error: { ...err.data.error, message: INVOICE_LOCKED_MESSAGE, details: [] } } };
          }
          throw err;
        }
        dispatch(toastSuccess(`${invoice.number} saved`, 'The totals are the server’s.'));
      }}
    />
  );
}
