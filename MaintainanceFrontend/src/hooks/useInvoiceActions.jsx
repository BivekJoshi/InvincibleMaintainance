import { useCallback, useState } from 'react';
import { useDispatch } from 'react-redux';
import { useSendInvoiceMutation, useVoidInvoiceMutation, useVoidPaymentMutation } from '@/api/financeApi';
import { FormDialog } from '@/components/common/FormDialog';
import { InvoiceLinkCard } from '@/components/finance/InvoiceLinkCard';
import { RecordPaymentSheet } from '@/components/finance/RecordPaymentSheet';
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { useConfirm } from '@/hooks/useConfirm';
import { voidReasonSchema } from '@/form/schemas/finance.schema';
import { PAYMENT_METHOD_LABELS } from '@/config/constants';
import { toastError, toastSuccess } from '@/redux/slices/uiSlice';
import { formatDate, formatNpr } from '@/helpers/format';

const reasonFields = (label, placeholder) => [{ name: 'reason', type: 'textarea', label, required: true, rows: 3, maxLength: 500, placeholder }];

/**
 * Runs an invoice action from `helpers/finance#invoiceActions` — the one way a screen sends, voids or takes money on
 * an invoice (Phase I): **Send** asks first and then shows the customer's link (copy, WhatsApp); **Record payment**
 * opens the payment sheet; **Void** and **Void payment** ask why (3–500 characters). A refusal toasts the API's reason.
 *
 *   const [runAction, invoiceDialogs] = useInvoiceActions();
 *   runAction('send', invoice);  runAction('voidPayment', invoice, payment);
 *
 * @returns {[(key: string, invoice: object, payment?: object) => Promise<boolean>, import('react').ReactElement]}
 */
export function useInvoiceActions() {
  const dispatch = useDispatch();
  const [confirm, confirmDialog] = useConfirm();
  const [open, setOpen] = useState(null); // { kind: 'pay'|'void'|'voidPayment'|'link', invoice, payment? }
  const [sendInvoice] = useSendInvoiceMutation();
  const [voidInvoice] = useVoidInvoiceMutation();
  const [voidPayment] = useVoidPaymentMutation();

  const close = useCallback((isOpen) => { if (!isOpen) setOpen(null); }, []);
  const fail = useCallback((what, err) => dispatch(toastError(what, err?.data?.error?.message ?? 'Please try again.')), [dispatch]);

  const run = useCallback(async (key, invoice, payment) => {
    switch (key) {
      case 'send': {
        const ok = await confirm({
          title: `Send ${invoice.number} to ${invoice.customer?.name ?? 'the customer'}?`,
          description: 'They get an SMS (and an email, if they have one) with a link to the invoice, in their language. '
            + 'A sent invoice can no longer be edited — to change it, void it and issue another.',
          confirmLabel: 'Send invoice',
        });
        if (!ok) return false;
        try {
          const sent = await sendInvoice(invoice.id).unwrap();
          dispatch(toastSuccess(`${invoice.number} sent`, 'The customer has the link.'));
          setOpen({ kind: 'link', invoice: sent ?? invoice });
          return true;
        } catch (err) {
          fail(`Could not send ${invoice.number}`, err);
          return false;
        }
      }
      case 'recordPayment':
        setOpen({ kind: 'pay', invoice });
        return true;
      case 'void':
        setOpen({ kind: 'void', invoice });
        return true;
      case 'voidPayment':
        setOpen({ kind: 'voidPayment', invoice, payment });
        return true;
      case 'link':
        setOpen({ kind: 'link', invoice });
        return true;
      default:
        return false;
    }
  }, [confirm, dispatch, fail, sendInvoice]);

  const target = open?.invoice;
  const dialogs = (
    <>
      {confirmDialog}
      {open?.kind === 'pay' ? <RecordPaymentSheet invoice={target} open onOpenChange={close} /> : null}
      <FormDialog
        open={open?.kind === 'void'}
        onOpenChange={close}
        title={target ? `Void ${target.number}?` : 'Void invoice'}
        description="A void invoice stays on record, marked void, and nothing is owed on it. Its job can then be invoiced again."
        schema={voidReasonSchema}
        fields={reasonFields('Why is it void?', 'Issued to the wrong customer')}
        submitLabel="Void invoice"
        onSubmit={async ({ reason }) => {
          // A refusal (it has payments) stays in the dialog, in the API's words.
          await voidInvoice({ id: target.id, reason }).unwrap();
          dispatch(toastSuccess(`${target.number} is void`));
        }}
      />
      <FormDialog
        open={open?.kind === 'voidPayment'}
        onOpenChange={close}
        title={open?.payment ? `Void the ${formatNpr(open.payment.amount)} payment?` : 'Void payment'}
        description={open?.payment
          ? `${PAYMENT_METHOD_LABELS[open.payment.method] ?? open.payment.method}, received ${formatDate(open.payment.receivedAt)}. `
            + 'It stays on the invoice, struck through, and no longer counts as paid.'
          : undefined}
        schema={voidReasonSchema}
        fields={reasonFields('Why is it void?', 'The cheque bounced')}
        submitLabel="Void payment"
        onSubmit={async ({ reason }) => {
          await voidPayment({ id: target.id, paymentId: open.payment.id, reason }).unwrap();
          dispatch(toastSuccess('Payment voided', `${target.number}’s balance is back up.`));
        }}
      />
      <Dialog open={open?.kind === 'link'} onOpenChange={close}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{target ? `${target.number} is with the customer` : 'Sent'}</DialogTitle>
            <DialogDescription>Their SMS carries this link. Share it again on WhatsApp, or copy it.</DialogDescription>
          </DialogHeader>
          {open?.kind === 'link' ? <InvoiceLinkCard invoice={target} compact /> : null}
        </DialogContent>
      </Dialog>
    </>
  );

  return [run, dialogs];
}
