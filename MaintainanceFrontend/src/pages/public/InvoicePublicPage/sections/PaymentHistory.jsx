import { formatDate, formatNpr } from '@/helpers/format';

/**
 * What has already been received against this invoice. Payment is settled
 * offline — cash, cheque, a bank transfer — so this is a record, not a ledger
 * the customer can act on.
 *
 * A voided payment (a bounced cheque, one entered twice) stays in the list,
 * struck through, so the history the customer saw never silently changes. It is
 * already left out of the paid total the API sends.
 */
export function PaymentHistory({ payments }) {
  if (!payments?.length) return null;

  return (
    <section className="mt-8 border-t pt-5">
      <h2 className="text-sm font-semibold">Payments received</h2>
      <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
        {payments.map((payment, i) => {
          const line = (
            <>
              <span>{formatDate(payment.receivedAt)} · {payment.method}</span>
              <span className="tabular-nums">{formatNpr(payment.amount)}</span>
            </>
          );
          return payment.voidedAt ? (
            <li key={i} className="flex items-baseline justify-between gap-4 opacity-70">
              <del className="flex flex-1 justify-between gap-4">{line}</del>
              <span className="text-xs font-medium uppercase tracking-wide">Voided</span>
            </li>
          ) : (
            <li key={i} className="flex justify-between gap-4">{line}</li>
          );
        })}
      </ul>
    </section>
  );
}
