import { useMemo } from 'react';
import { useDispatch } from 'react-redux';
import { useRecordPaymentMutation } from '@/api/financeApi';
import { ResourceForm } from '@/components/common/ResourceForm/ResourceForm';
import { paymentFormSchema } from '@/form/schemas/finance.schema';
import { PAYMENT_METHOD_OPTIONS } from '@/config/admin/financeViews';
import { PAYMENT_METHOD_LABELS } from '@/config/constants';
import { toastSuccess } from '@/redux/slices/uiSlice';
import { formatBalance, formatNpr } from '@/helpers/format';

const FIELDS = [
  { name: 'amount', type: 'money', label: 'Amount received', required: true, span: 'half' },
  { name: 'method', type: 'select', label: 'Method', required: true, span: 'half', options: PAYMENT_METHOD_OPTIONS },
  {
    name: 'reference', type: 'text', label: 'Reference', maxLength: 120, span: 'half',
    placeholder: 'eSewa id, cheque no.', description: 'What the customer quotes to find it again.',
  },
  { name: 'receivedAt', type: 'datetime', label: 'Received', span: 'half', description: 'Nepal time. Now, when left empty.' },
  { name: 'note', type: 'textarea', label: 'Note', rows: 2, maxLength: 2000 },
];

/**
 * Records a payment against a sent invoice (Phase I): the amount in **rupees**, no more than the server's `balance`
 * — the one check the UI makes against a figure (`paymentFormSchema(balance)`; the API answers 400 for more) —
 * the method, a reference and when it was received. The invoice's status and balance then come back from the server.
 *
 * @param {{ invoice: object, open: boolean, onOpenChange: (open: boolean) => void, onRecorded?: (payment: object) => void }} props
 */
export function RecordPaymentSheet({ invoice, open, onOpenChange, onRecorded }) {
  const dispatch = useDispatch();
  const [recordPayment] = useRecordPaymentMutation();
  const schema = useMemo(() => paymentFormSchema(invoice.balance), [invoice.balance]);
  const fields = useMemo(() => FIELDS.map((f) => (f.name === 'amount'
    ? { ...f, description: `At most ${formatBalance(invoice.balance)} — what is still owed.` }
    : f)), [invoice.balance]);

  return (
    <ResourceForm
      mode="sheet"
      open={open}
      onOpenChange={onOpenChange}
      title={`Record a payment — ${invoice.number}`}
      description={`${invoice.customer?.name ?? ''} · balance ${formatBalance(invoice.balance)} of ${formatNpr(invoice.total)}`}
      schema={schema}
      fields={fields}
      defaultValues={{ method: 'CASH' }}
      submitLabel="Record payment"
      onSubmit={async (body) => {
        const payment = await recordPayment({ id: invoice.id, ...body }).unwrap();
        dispatch(toastSuccess(
          `${formatNpr(payment?.amount ?? 0)} recorded on ${invoice.number}`,
          PAYMENT_METHOD_LABELS[body.method],
        ));
        onOpenChange(false);
        onRecorded?.(payment);
      }}
    />
  );
}
