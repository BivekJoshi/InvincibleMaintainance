import { FileText } from 'lucide-react';
import { formatDate, formatNpr } from '@/helpers/format';
import { DocumentHeader } from './DocumentHeader';
import { LineItemsTable } from './LineItemsTable';
import { TotalsList } from './TotalsList';
import { documentCopy } from './quotationDocumentCopy';

/**
 * A quotation as the customer reads it: its header, its bill of quantities (sections, notes, specifications,
 * optional rows), the server's totals and the terms — in English or Nepali. The public quotation page renders it
 * around the customer's answer; the builder's **Customer view** tab renders the saved quotation with it, so the
 * office sees exactly what the link shows. Never a cost: it reads only the customer's fields.
 *
 * @param {{ quotation: object, locale?: 'en'|'ne', notice?: import('react').ReactNode, showSymbol?: boolean }} props
 */
export function QuotationDocument({ quotation: q, locale = 'en', notice = null, showSymbol = false }) {
  const copy = documentCopy(locale);
  return (
    <div lang={locale}>
      <DocumentHeader
        kind={copy.kind}
        icon={FileText}
        number={q.number}
        subject={copy.forCustomer(q.customer?.name ?? '', q.site?.address)}
        status={q.status}
        statusLabel={copy.statusLabels[q.status]}
        meta={(
          <>
            {q.version > 1 ? <p>{copy.version(q.version)}</p> : null}
            {q.validUntil ? <p>{copy.validUntil(formatDate(q.validUntil))}</p> : null}
          </>
        )}
      />
      {notice}
      <LineItemsTable items={q.items ?? []} showSymbol={showSymbol} locale={locale} sections={q.boq?.sections} />
      <TotalsList
        rows={[
          { label: copy.totals.subtotal, value: formatNpr(q.subtotal) },
          q.discount > 0 && { label: copy.totals.discount, value: `− ${formatNpr(q.discount)}`, tone: 'success' },
          q.vatApplied && { label: copy.totals.vat(q.vatRate), value: formatNpr(q.vatAmount) },
          { label: copy.totals.total, value: formatNpr(q.total), emphasis: true },
          q.boq?.optionalTotal > 0 && { label: copy.totals.optional, value: `(${formatNpr(q.boq.optionalTotal)})` },
        ]}
      />
      {q.terms ? (
        <section className="mt-8 rounded-lg bg-muted/50 p-4">
          <h2 className="text-sm font-semibold">{copy.terms}</h2>
          <p className="mt-2 whitespace-pre-line text-sm text-muted-foreground">{q.terms}</p>
        </section>
      ) : null}
    </div>
  );
}
