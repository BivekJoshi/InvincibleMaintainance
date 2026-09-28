import { useMemo } from 'react';
import { useDispatch } from 'react-redux';
import { Lock } from 'lucide-react';
import { useUpdateInvoiceMutation } from '@/api/financeApi';
import { ResourceForm } from '@/components/common/ResourceForm/ResourceForm';
import { LineItemsTable } from '@/components/documents/LineItemsTable';
import { TotalsList } from '@/components/documents/TotalsList';
import { INVOICE_HEADER_FIELDS, INVOICE_LINE_FIELDS } from '@/components/finance/invoiceFields';
import { invoiceEditSchema, invoiceHeaderEditSchema } from '@/form/schemas/finance.schema';
import { invoiceLinesLocked } from '@/helpers/finance';
import { formatNpr } from '@/helpers/format';
import { toastSuccess } from '@/redux/slices/uiSlice';

/** The words for the API's 422 INVOICE_LOCKED — someone sent it while this form was open. */
export const INVOICE_LOCKED_MESSAGE = 'This invoice has been sent, so it can no longer be edited. To change it, void it and issue another.';

/** The words for the API's 422 INVOICE_LINES_LOCKED (Phase L6) — a stage or closing bill's money was sent. */
export const INVOICE_LINES_LOCKED_MESSAGE = 'The lines, discount and VAT of this invoice come from the quotation and its payment stages, so they cannot be changed here. Change the due date, note or terms — or void it and invoice the job again.';

/** Why a stage or closing bill's money is fixed, by kind. */
const WHY_LOCKED = {
  ADVANCE: 'An advance invoice bills the “on acceptance” stage of the quotation’s payment schedule.',
  RUNNING: 'A running bill bills a stage of the quotation’s payment schedule.',
  FINAL: 'A final bill is the quotation less the advance and running bills already billed.',
};

/** The API's refusals, in words the office can act on. */
const PLAIN = { INVOICE_LOCKED: INVOICE_LOCKED_MESSAGE, INVOICE_LINES_LOCKED: INVOICE_LINES_LOCKED_MESSAGE };

/**
 * A stage or closing bill's money, read-only above its header form: the lines as the document shows them (a final
 * bill's "Less: advance …" as "− Rs. …"), then subtotal, discount, VAT and total — every figure the server's.
 */
function LockedLines({ invoice }) {
  return (
    <section aria-label="Lines, discount and VAT (fixed)" data-testid="locked-lines" className="space-y-3">
      <p className="flex gap-2 rounded-lg border bg-muted/40 p-3 text-xs text-muted-foreground">
        <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
        <span>
          {WHY_LOCKED[invoice.kind] ?? 'This invoice bills a stage of the quotation’s payment schedule.'} Its lines, discount
          and VAT are fixed. Change the due date, note or terms here; to change the money, void it and invoice the job again.
        </span>
      </p>
      <LineItemsTable items={invoice.items ?? []} />
      <TotalsList
        rows={[
          { label: 'Subtotal', value: formatNpr(invoice.subtotal) },
          invoice.discount > 0 && { label: 'Discount', value: `− ${formatNpr(invoice.discount)}` },
          { label: invoice.vatApplied ? `VAT (${invoice.vatRate}%)` : 'VAT (not applied)', value: formatNpr(invoice.vatAmount) },
          { label: 'Total', value: formatNpr(invoice.total), emphasis: true },
        ]}
      />
    </section>
  );
}

/**
 * A DRAFT's edit form (Phase I2): the lines (the kit's `lineItems` field, invoice variant — each saved line shows the
 * server's amount), discount, VAT, due date, note and terms, saved with `PUT /admin/invoices/:id`. The server
 * re-prices the draft; the totals above come back from it. A 422 INVOICE_LOCKED (it was sent meanwhile) is told
 * in words over the form.
 *
 * Phase L6: a stage or closing bill (`kind` ADVANCE, RUNNING or FINAL) has **locked lines** — they, the discount and
 * the VAT come from the quotation and its stage bills. Its draft shows them read-only and edits only the due date,
 * note and terms (`invoiceHeaderEditSchema`); a 422 INVOICE_LINES_LOCKED is told in words too. A STANDARD draft is
 * edited as before.
 *
 * @param {{ invoice: object }} props
 */
export function InvoiceEditForm({ invoice }) {
  const dispatch = useDispatch();
  const [update] = useUpdateInvoiceMutation();
  const locked = invoiceLinesLocked(invoice);
  const fields = useMemo(() => {
    if (locked) return INVOICE_HEADER_FIELDS;
    const figures = new Map((invoice.items ?? []).map((item) => [item.id, { amount: item.amount }]));
    return INVOICE_LINE_FIELDS.map((f) => (f.name === 'items' ? { ...f, figures } : f));
  }, [invoice.items, locked]);

  return (
    <ResourceForm
      schema={locked ? invoiceHeaderEditSchema : invoiceEditSchema}
      fields={fields}
      defaultValues={invoice}
      intro={locked ? <LockedLines invoice={invoice} /> : undefined}
      submitLabel="Save draft"
      stickyActions
      onSubmit={async (body) => {
        // A locked draft sends its header only — never the lines, discount or VAT.
        const changes = locked ? { dueDate: body.dueDate, note: body.note, terms: body.terms } : body;
        try {
          await update({ id: invoice.id, ...changes }).unwrap();
        } catch (err) {
          const plain = PLAIN[err?.data?.error?.code];
          if (plain) throw { ...err, data: { ...err.data, error: { ...err.data.error, message: plain, details: [] } } };
          throw err;
        }
        dispatch(toastSuccess(`${invoice.number} saved`, 'The totals are the server’s.'));
      }}
    />
  );
}
