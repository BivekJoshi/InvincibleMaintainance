import { formatDate, formatNpr } from '@/helpers/format';

/**
 * What has already been received against this invoice. Payment is settled
 * offline — cash, cheque, a bank transfer — so this is a record, not a ledger
 * the customer can act on.
 */
export function PaymentHistory({ payments }) {
  if (!payments?.length) return null;

  return (
    <section className="mt-8 border-t pt-5">
      <h2 className="text-sm font-semibold">Payments received</h2>
      <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
        {payments.map((payment, i) => (
          <li key={i} className="flex justify-between gap-4">
            <span>{formatDate(payment.receivedAt)} · {payment.method}</span>
            <span className="tabular-nums">{formatNpr(payment.amount)}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
