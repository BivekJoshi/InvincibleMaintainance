import { PAYMENT_METHOD_LABELS } from '@/config/constants';
import { formatDateAdBs, formatNpr } from '@/helpers/format';

/**
 * What has been received against an invoice. Payment is settled offline — cash, a cheque, eSewa, a bank transfer —
 * so this is a record, not a ledger the customer can act on.
 *
 * A voided payment (a bounced cheque, one entered twice) stays in the list, **struck through**, so the history the
 * customer saw never silently changes; it is already left out of the paid total the API sends. `detailed` (the
 * office's copy) adds each payment's reference and why a void was made.
 *
 * @param {{ payments?: object[], detailed?: boolean }} props
 */
export function InvoicePayments({ payments, detailed = false }) {
  if (!payments?.length) return null;

  return (
    <section className="mt-8 border-t pt-5" aria-labelledby="invoice-payments">
      <h2 id="invoice-payments" className="text-sm font-semibold">Payments received</h2>
      <ul className="mt-2 space-y-1.5 text-sm text-muted-foreground" data-testid="invoice-payments">
        {payments.map((payment, i) => {
          const line = (
            <>
              <span className="min-w-0">
                {formatDateAdBs(payment.receivedAt)} · {PAYMENT_METHOD_LABELS[payment.method] ?? payment.method}
                {detailed && payment.reference ? <span className="font-mono text-xs"> · {payment.reference}</span> : null}
              </span>
              <span className="shrink-0 tabular-nums">{formatNpr(payment.amount)}</span>
            </>
          );
          return payment.voidedAt ? (
            <li key={payment.id ?? i} className="opacity-70" data-voided="true">
              <div className="flex items-baseline justify-between gap-4">
                <del className="flex flex-1 justify-between gap-4">{line}</del>
                <span className="text-xs font-medium uppercase tracking-wide">Voided</span>
              </div>
              {detailed && payment.voidReason ? <p className="text-xs">Why: {payment.voidReason}</p> : null}
            </li>
          ) : (
            <li key={payment.id ?? i} className="flex justify-between gap-4">{line}</li>
          );
        })}
      </ul>
    </section>
  );
}
