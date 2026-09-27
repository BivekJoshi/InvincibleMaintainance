import { FileText } from 'lucide-react';
import { formatDate, formatNpr } from '@/helpers/format';
import { DocumentHeader } from './DocumentHeader';
import { DocumentLetterhead } from './DocumentLetterhead';
import { LineItemsTable } from './LineItemsTable';
import { MeasurementsAnnex } from './MeasurementsAnnex';
import { PaymentScheduleTable } from './PaymentScheduleTable';
import { SectionSummaryTable } from './SectionSummaryTable';
import { TotalsList } from './TotalsList';
import { documentCopy } from './quotationDocumentCopy';

/** An AD date with its BS twin from the server (`dates.*Bs`) — the SPA never converts a date to BS. */
const withBs = (iso, bs, copy) => `${formatDate(iso)}${bs ? ` (${copy.dates.bs(bs)})` : ''}`;

/** The header's right column: the version, the quotation's date and how long it is valid, in AD and BS. */
function DocumentDates({ q, copy }) {
  const bs = q.dates ?? {};
  return (
    <>
      {q.version > 1 ? <p>{copy.version(q.version)}</p> : null}
      {q.createdAt ? <p data-testid="quotation-date">{copy.dates.date}: <span className="tabular-nums">{withBs(q.createdAt, bs.createdAtBs, copy)}</span></p> : null}
      {q.validUntil ? <p data-testid="quotation-valid-until" className="tabular-nums">{copy.validUntil(withBs(q.validUntil, bs.validUntilBs, copy))}</p> : null}
    </>
  );
}

/** The contract around the BOQ: how the final bill is worked out, how long the work takes, what the price leaves out. */
function ContractTerms({ q, copy }) {
  const contract = q.contractType ? copy.contract[q.contractType] : null;
  if (!contract && !q.estimatedDays && !q.exclusions) return null;
  return (
    <div className="mt-8 grid gap-4 sm:grid-cols-2">
      {contract ? (
        <section className="rounded-lg border p-4 sm:col-span-2" aria-labelledby="q-contract" data-testid="contract-type">
          <h2 id="q-contract" className="text-sm font-semibold">{copy.contract.title}</h2>
          <p className="mt-1 text-sm font-medium">{contract.name}</p>
          <p className="mt-0.5 text-sm text-muted-foreground">{contract.body}</p>
        </section>
      ) : null}
      {q.estimatedDays ? (
        <section aria-labelledby="q-duration">
          <h2 id="q-duration" className="text-sm font-semibold">{copy.duration.title}</h2>
          <p className="mt-1 text-sm text-muted-foreground" data-testid="estimated-days">{copy.duration.days(q.estimatedDays)}</p>
        </section>
      ) : null}
      {q.exclusions ? (
        <section className="sm:col-span-2" aria-labelledby="q-exclusions">
          <h2 id="q-exclusions" className="text-sm font-semibold">{copy.exclusions.title}</h2>
          <p className="mt-1 whitespace-pre-line text-sm text-muted-foreground">{q.exclusions}</p>
        </section>
      ) : null}
    </div>
  );
}

/**
 * A quotation as the customer reads it (Phases L3–L4): the letterhead, the number and its dates in AD and BS, the
 * bill of quantities (sections with their subtotals, notes, specifications, optional rows "not included") — or only
 * the section subtotals when the office chose `summaryOnly` — the server's totals, the total in words, how the final
 * bill is worked out, the duration, the exclusions, the payment schedule with each stage's amount, the terms, and
 * the measurements annex. In English or Nepali.
 *
 * Rendered by the public quotation page (around the customer's answer), the builder's **Customer view** tab and the
 * print route, so all three show the same document. **Never a cost**: it reads only the customer's fields — a
 * manager's record carries cost and margin, and none of it is read here. The client adds up no money: every amount,
 * subtotal, stage amount and the words are the server's.
 *
 * @param {{ quotation: object, locale?: 'en'|'ne', notice?: import('react').ReactNode, showSymbol?: boolean,
 *   print?: boolean }} props  `print` — the print layout: no status badge, the annex open
 */
export function QuotationDocument({ quotation: q, locale = 'en', notice = null, showSymbol = false, print = false }) {
  const copy = documentCopy(locale);
  const items = q.items ?? [];
  const summary = Boolean(q.summaryOnly);
  // The annex follows what the customer is shown: never in a summary, never when the office switched it off.
  const measured = summary || q.showMeasurements === false
    ? []
    : items.filter((i) => (i.rowType ?? 'ITEM') === 'ITEM' && i.measurements?.length);
  const words = q.totalInWords?.[locale] ?? q.totalInWords?.en;

  return (
    <div lang={locale} data-testid="quotation-document">
      <DocumentLetterhead letterhead={q.letterhead} copy={copy.letterhead} />
      <DocumentHeader
        kind={copy.kind}
        icon={FileText}
        number={q.number}
        subject={copy.forCustomer(q.customer?.name ?? '', q.site?.address)}
        status={print ? undefined : q.status}
        statusLabel={copy.statusLabels[q.status]}
        meta={<DocumentDates q={q} copy={copy} />}
      />
      {notice}
      {summary
        ? <SectionSummaryTable sections={q.boq?.sections} copy={copy.summary} />
        : <LineItemsTable items={items} showSymbol={showSymbol} locale={locale} sections={q.boq?.sections} />}
      <TotalsList
        rows={[
          { label: copy.totals.subtotal, value: formatNpr(q.subtotal) },
          q.discount > 0 && { label: copy.totals.discount, value: `− ${formatNpr(q.discount)}`, tone: 'success' },
          q.vatApplied && { label: copy.totals.vat(q.vatRate), value: formatNpr(q.vatAmount) },
          { label: copy.totals.total, value: formatNpr(q.total), emphasis: true },
          !summary && q.boq?.optionalTotal > 0 && { label: copy.totals.optional, value: `(${formatNpr(q.boq.optionalTotal)})` },
        ]}
      />
      {words ? (
        <p className="ml-auto mt-3 max-w-md text-right text-sm" data-testid="total-in-words">
          <span className="text-muted-foreground">{copy.words.title}: </span>
          <span className="font-medium">{words}</span>
        </p>
      ) : null}
      <ContractTerms q={q} copy={copy} />
      <PaymentScheduleTable stages={q.paymentStages} total={q.total} vatApplied={q.vatApplied} copy={copy.schedule} />
      {q.terms ? (
        <section className="mt-8 rounded-lg bg-muted/50 p-4" aria-labelledby="q-terms">
          <h2 id="q-terms" className="text-sm font-semibold">{copy.terms}</h2>
          <p className="mt-2 whitespace-pre-line text-sm text-muted-foreground">{q.terms}</p>
        </section>
      ) : null}
      <MeasurementsAnnex items={measured} copy={copy.measurements} print={print} />
    </div>
  );
}
