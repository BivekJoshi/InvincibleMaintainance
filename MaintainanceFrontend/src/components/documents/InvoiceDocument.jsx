import { Ban, Receipt } from 'lucide-react';
import { DOCUMENTS } from '@/config/i18n/documents';
import { useT } from '@/hooks/useT';
import { createT } from '@/helpers/i18n';
import { formatBalance, formatDateAdBs, formatNpr } from '@/helpers/format';
import { splitInvoiceItems } from '@/helpers/finance';
import { DeductionsTable } from './DeductionsTable';
import { DocumentHeader } from './DocumentHeader';
import { DocumentLetterhead } from './DocumentLetterhead';
import { DocumentNotice } from './DocumentNotice';
import { InvoicePayments } from './InvoicePayments';
import { LineItemsTable } from './LineItemsTable';
import { TotalsList } from './TotalsList';

/** The kinds in English — an office's stage label ("Advance") is compared with them, whatever the document's language. */
const ENGLISH = createT(DOCUMENTS, 'en');

/**
 * The payment stage an invoice bills, as one line in the document's words (Phase L6) — `helpers/finance#invoiceStageLine`
 * for a customer: "Advance — on acceptance (50%)", "Advance — Mobilisation (40%)", in Nepali "अग्रिम — स्वीकृत गर्दा (50%)".
 * The stage's own label is the office's text; it is left out when it only repeats the kind (the default schedule's
 * first stage is called "Advance"), and when it falls due says it instead. Null for an ordinary invoice.
 *
 * @param {{ kind?: string, paymentStage?: { label?: string, basisPoints?: number, trigger?: string }|null }} inv
 * @param {ReturnType<typeof createT>} t
 */
function stageLine(inv, t) {
  const stage = inv?.paymentStage ?? null;
  const kind = inv?.kind && inv.kind !== 'STANDARD' && t.has(`invoice.kinds.${inv.kind}`) ? inv.kind : null;
  if (!stage && !kind) return null;
  const headingKey = kind ? `invoice.kinds.${kind}` : 'invoice.stage.heading';
  const heading = t(headingKey);
  const own = stage?.label?.trim();
  const repeats = own && [heading, ENGLISH(headingKey)].some((w) => w.toLowerCase() === own.toLowerCase());
  const trigger = stage?.trigger ?? (kind === 'ADVANCE' ? 'ON_ACCEPT' : null);
  const label = own && !repeats
    ? own
    : trigger && t.has(`invoice.stage.when.${trigger}`) ? t(`invoice.stage.when.${trigger}`) : null;
  // A share, not money: the stage's basis points as a percentage, "33.33".
  const share = stage?.basisPoints != null ? String(Number((stage.basisPoints / 100).toFixed(2))) : null;
  if (label) return share ? t('invoice.stage.labelShare', { heading, label, share }) : t('invoice.stage.label', { heading, label });
  return share ? t('invoice.stage.share', { heading, share }) : heading;
}

/**
 * An invoice as the customer reads it (Phase I): the number, whose it is (with their PAN/VAT number), the issue and
 * due dates in **AD and BS**, the lines, the totals, what has been paid (voided payments struck through), what is
 * still owed, and the terms. The public page (`/invoice/:token`), the office's invoice page and its print render
 * this one component, so all three read the same.
 *
 * **Every figure is the server's** — subtotal, discount, VAT, total, paid and `balance` (never below zero); the
 * document adds up nothing. A void invoice says so and owes nothing. `print` drops the status badge. Since Phase L6
 * an advance invoice names its stage under the dates — "Advance — on acceptance (50%)" (`stageLine`).
 * Since Phase L8 a final bill's deductions — its lines of `kind` DEDUCTION, the earlier stage bills — are a block of their
 * own under the billed lines (`DeductionsTable`: "Advance INV-…  − Rs. 36,450.00"), never rows among the work.
 *
 * Phase J1: every word is `DOCUMENTS` in the screen's language — the customer's choice on the public page, English in
 * the office (`LocaleProvider`) — the amounts `रु.` and the dates Nepali in Nepali; the office's own text (the lines,
 * the terms, a void's reason) is shown as written.
 *
 * @param {{ invoice: object, print?: boolean, detailedPayments?: boolean }} props
 */
export function InvoiceDocument({ invoice: inv, print = false, detailedPayments = false }) {
  const t = useT(DOCUMENTS);
  const { locale } = t;
  const money = (paisa) => formatNpr(paisa, { locale });
  const isVoid = inv.status === 'VOID';
  const overdue = inv.status === 'OVERDUE';
  const customer = inv.customer ?? {};
  // Phase L6: an advance (or a later stage bill) says which stage of the payment schedule it is.
  const stage = stageLine(inv, t);
  // Phase L8: what it bills, then what it takes off — a final bill's earlier stage bills.
  const { items, deductions } = splitInvoiceItems(inv.items);
  const statusKey = `invoice.status.${inv.status}`;

  return (
    <div lang={locale} data-testid="invoice-document">
      {inv.letterhead ? <DocumentLetterhead letterhead={inv.letterhead} /> : null}
      <DocumentHeader
        kind={t('invoice.kind')}
        icon={Receipt}
        number={inv.number}
        subject={customer.panVatNo
          ? t('invoice.forCustomerPan', { name: customer.name ?? '', pan: customer.panVatNo })
          : t('invoice.forCustomer', { name: customer.name ?? '' })}
        status={print ? undefined : inv.status}
        statusLabel={t.has(statusKey) ? t(statusKey) : undefined}
        meta={(
          <>
            {inv.issuedAt ? (
              <p data-testid="invoice-issued" className="tabular-nums">
                {t('invoice.issued', { date: formatDateAdBs(inv.issuedAt, { locale }) })}
              </p>
            ) : null}
            {inv.dueDate ? (
              <p data-testid="invoice-due" className={overdue ? 'font-medium tabular-nums text-destructive' : 'tabular-nums'}>
                {t('invoice.due', { date: formatDateAdBs(inv.dueDate, { locale }) })}
              </p>
            ) : null}
            {stage ? <p data-testid="invoice-stage-line" className="font-medium">{stage}</p> : null}
            {inv.quotation?.number ? <p>{t('invoice.quotation', { number: inv.quotation.number })}</p> : null}
          </>
        )}
      />
      {isVoid ? (
        <div className="mt-5">
          <DocumentNotice tone="muted" icon={Ban} title={t('invoice.void')} animate={false}>
            {inv.voidReason}
          </DocumentNotice>
        </div>
      ) : null}

      <LineItemsTable items={items} />
      <DeductionsTable items={deductions} />

      <TotalsList
        className="border-t pt-5"
        rows={[
          { label: t('document.totals.subtotal'), value: money(inv.subtotal) },
          inv.discount > 0 && { label: t('document.totals.discount'), value: `− ${money(inv.discount)}` },
          {
            label: inv.vatApplied ? t('invoice.totals.vat', { rate: inv.vatRate }) : t('invoice.totals.vatNotApplied'),
            value: money(inv.vatAmount),
          },
          { label: t('document.totals.total'), value: money(inv.total), emphasis: true },
          inv.paidAmount > 0 && { label: t('invoice.totals.paid'), value: `− ${money(inv.paidAmount)}` },
          isVoid
            ? null
            : {
              label: inv.balance > 0 ? t('invoice.totals.due') : t('invoice.totals.settled'),
              value: formatBalance(inv.balance, { locale }),
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
