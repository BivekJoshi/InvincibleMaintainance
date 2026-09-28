import { Ban, Receipt } from 'lucide-react';
import { INVOICE_STATUS_LABELS } from '@/config/constants';
import { formatBalance, formatDateAdBs, formatNpr } from '@/helpers/format';
import { invoiceStageLine, splitInvoiceItems } from '@/helpers/finance';
import { DeductionsTable } from './DeductionsTable';
import { DocumentHeader } from './DocumentHeader';
import { DocumentLetterhead } from './DocumentLetterhead';
import { DocumentNotice } from './DocumentNotice';
import { InvoicePayments } from './InvoicePayments';
import { LineItemsTable } from './LineItemsTable';
import { TotalsList } from './TotalsList';

const LETTERHEAD_COPY = { panVat: 'PAN / VAT No.', phone: 'Phone', email: 'Email' };

/**
 * An invoice as the customer reads it (Phase I): the number, whose it is (with their PAN/VAT number), the issue and
 * due dates in **AD and BS**, the lines, the totals, what has been paid (voided payments struck through), what is
 * still owed, and the terms. The public page (`/invoice/:token`), the office's invoice page and its print render
 * this one component, so all three read the same.
 *
 * **Every figure is the server's** — subtotal, discount, VAT, total, paid and `balance` (never below zero); the
 * document adds up nothing. A void invoice says so and owes nothing. `print` drops the status badge. Since Phase L6
 * an advance invoice names its stage under the dates — "Advance — on acceptance (50%)" (`helpers/finance#invoiceStageLine`).
 * Since Phase L8 a final bill's deductions — its lines of `kind` DEDUCTION, the earlier stage bills — are a block of their
 * own under the billed lines (`DeductionsTable`: "Advance INV-…  − Rs. 36,450.00"), never rows among the work.
 *
 * @param {{ invoice: object, print?: boolean, detailedPayments?: boolean }} props
 */
export function InvoiceDocument({ invoice: inv, print = false, detailedPayments = false }) {
  const isVoid = inv.status === 'VOID';
  const overdue = inv.status === 'OVERDUE';
  const customer = inv.customer ?? {};
  // Phase L6: an advance (or a later stage bill) says which stage of the payment schedule it is.
  const stage = invoiceStageLine(inv);
  // Phase L8: what it bills, then what it takes off — a final bill's earlier stage bills.
  const { items, deductions } = splitInvoiceItems(inv.items);

  return (
    <div data-testid="invoice-document">
      {inv.letterhead ? <DocumentLetterhead letterhead={inv.letterhead} copy={LETTERHEAD_COPY} /> : null}
      <DocumentHeader
        kind="Invoice"
        icon={Receipt}
        number={inv.number}
        subject={`For ${customer.name ?? ''}${customer.panVatNo ? ` · PAN/VAT ${customer.panVatNo}` : ''}`}
        status={print ? undefined : inv.status}
        statusLabel={INVOICE_STATUS_LABELS[inv.status]}
        meta={(
          <>
            {inv.issuedAt ? <p data-testid="invoice-issued" className="tabular-nums">Issued {formatDateAdBs(inv.issuedAt)}</p> : null}
            {inv.dueDate ? (
              <p data-testid="invoice-due" className={overdue ? 'font-medium tabular-nums text-destructive' : 'tabular-nums'}>
                Due {formatDateAdBs(inv.dueDate)}
              </p>
            ) : null}
            {stage ? <p data-testid="invoice-stage-line" className="font-medium">{stage}</p> : null}
            {inv.quotation?.number ? <p>Quotation {inv.quotation.number}</p> : null}
          </>
        )}
      />
      {isVoid ? (
        <div className="mt-5">
          <DocumentNotice tone="muted" icon={Ban} title="This invoice is void — nothing is owed on it" animate={false}>
            {inv.voidReason}
          </DocumentNotice>
        </div>
      ) : null}

      <LineItemsTable items={items} />
      <DeductionsTable items={deductions} />

      <TotalsList
        className="border-t pt-5"
        rows={[
          { label: 'Subtotal', value: formatNpr(inv.subtotal) },
          inv.discount > 0 && { label: 'Discount', value: `− ${formatNpr(inv.discount)}` },
          { label: inv.vatApplied ? `VAT (${inv.vatRate}%)` : 'VAT (not applied)', value: formatNpr(inv.vatAmount) },
          { label: 'Total', value: formatNpr(inv.total), emphasis: true },
          inv.paidAmount > 0 && { label: 'Paid', value: `− ${formatNpr(inv.paidAmount)}` },
          isVoid
            ? null
            : {
              label: inv.balance > 0 ? 'Amount due' : 'Settled',
              value: formatBalance(inv.balance),
              emphasis: true,
              tone: overdue ? 'destructive' : inv.balance > 0 ? undefined : 'success',
            },
        ]}
      />

      <InvoicePayments payments={inv.payments} detailed={detailedPayments} />

      {inv.terms ? (
        <p className="mt-8 whitespace-pre-wrap border-t pt-5 text-xs leading-relaxed text-muted-foreground">{inv.terms}</p>
      ) : null}
    </div>
  );
}
