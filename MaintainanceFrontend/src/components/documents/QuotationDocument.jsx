import { FileText } from 'lucide-react';
import { DOCUMENTS } from '@/config/i18n/documents';
import { useT } from '@/hooks/useT';
import { LocaleScope } from '@/providers/LocaleProvider';
import { formatDate, formatNpr, formatSignedNpr } from '@/helpers/format';
import { DocumentHeader } from './DocumentHeader';
import { DocumentLetterhead } from './DocumentLetterhead';
import { LineItemsTable } from './LineItemsTable';
import { MeasurementsAnnex } from './MeasurementsAnnex';
import { PaymentScheduleTable } from './PaymentScheduleTable';
import { SectionSummaryTable } from './SectionSummaryTable';
import { TotalsList } from './TotalsList';

/**
 * An AD date with its BS twin from the server (`dates.*Bs`) — the SPA never converts a quotation's date to BS — and
 * the era in the document's language: "26 Sept 2026 (2083-06-10 B.S.)", "2026 सेप्टेम्बर 26 (2083-06-10 वि.सं.)".
 */
const withBs = (iso, bs, t) => {
  const ad = formatDate(iso, { locale: t.locale });
  return bs ? t('document.dates.adBs', { ad, bs }) : ad;
};

/** "For Anjali Karki · Baneshwor" — the customer and, when there is one, the site. */
const forCustomer = (t, name, address) => (address
  ? t('quotation.forCustomerAt', { name, address })
  : t('quotation.forCustomer', { name }));

/** The header's right column: the version, the quotation's date and how long it is valid, in AD and BS. */
function DocumentDates({ q, t }) {
  const bs = q.dates ?? {};
  return (
    <>
      {q.version > 1 ? <p>{t('quotation.version', { version: String(q.version) })}</p> : null}
      {q.createdAt ? <p data-testid="quotation-date">{t('document.dates.date')}: <span className="tabular-nums">{withBs(q.createdAt, bs.createdAtBs, t)}</span></p> : null}
      {q.validUntil ? (
        <p data-testid="quotation-valid-until" className="tabular-nums">
          {t('quotation.validUntil', { date: withBs(q.validUntil, bs.validUntilBs, t) })}
        </p>
      ) : null}
    </>
  );
}

/** The contract around the BOQ: how the final bill is worked out, how long the work takes, what the price leaves out. */
function ContractTerms({ q, t }) {
  const contract = q.contractType && t.has(`document.contract.${q.contractType}.name`) ? q.contractType : null;
  if (!contract && !q.estimatedDays && !q.exclusions) return null;
  return (
    <div className="mt-8 grid gap-4 sm:grid-cols-2">
      {contract ? (
        <section className="rounded-lg border p-4 sm:col-span-2" aria-labelledby="q-contract" data-testid="contract-type">
          <h2 id="q-contract" className="text-sm font-semibold">{t('document.contract.title')}</h2>
          <p className="mt-1 text-sm font-medium">{t(`document.contract.${contract}.name`)}</p>
          <p className="mt-0.5 text-sm text-muted-foreground">{t(`document.contract.${contract}.body`)}</p>
        </section>
      ) : null}
      {q.estimatedDays ? (
        <section aria-labelledby="q-duration">
          <h2 id="q-duration" className="text-sm font-semibold">{t('document.duration.title')}</h2>
          <p className="mt-1 text-sm text-muted-foreground" data-testid="estimated-days">
            {t('document.duration.days', { count: Number(q.estimatedDays) })}
          </p>
        </section>
      ) : null}
      {q.exclusions ? (
        <section className="sm:col-span-2" aria-labelledby="q-exclusions">
          <h2 id="q-exclusions" className="text-sm font-semibold">{t('document.exclusions.title')}</h2>
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
 * the measurements annex. In English or Nepali (Phase J1: `DOCUMENTS`): `locale` pins the document's language — the
 * builder's Customer view and the print show it in the customer's, whatever the screen's — and without it the document
 * follows the screen (the public page passes the visitor's). The pinned language reaches every part through a
 * `LocaleScope`, amounts and dates included (`रु.` and Nepali months in Nepali).
 *
 * Rendered by the public quotation page (around the customer's answer), the builder's **Customer view** tab and the
 * print route, so all three show the same document. **Never a cost**: it reads only the customer's fields — a
 * manager's record carries cost and margin, and none of it is read here. The client adds up no money: every amount,
 * subtotal, stage amount and the words are the server's.
 *
 * @param {{ quotation: object, locale?: 'en'|'ne', notice?: import('react').ReactNode, showSymbol?: boolean,
 *   print?: boolean }} props  `print` — the print layout: no status badge, the annex open
 */
export function QuotationDocument({ locale, ...props }) {
  return locale ? <LocaleScope locale={locale}><QuotationSheet {...props} /></LocaleScope> : <QuotationSheet {...props} />;
}

function QuotationSheet({ quotation: q, notice = null, showSymbol = false, print = false }) {
  const t = useT(DOCUMENTS);
  const { locale } = t;
  const money = (paisa) => formatNpr(paisa, { locale });
  const signed = (paisa) => formatSignedNpr(paisa, { locale });
  const items = q.items ?? [];
  // A variation order (Phase L7): a change to a running job — named so, with the job's number.
  const variation = q.kind === 'VARIATION';
  const summary = Boolean(q.summaryOnly);
  // The annex follows what the customer is shown: never in a summary, never when the office switched it off.
  const measured = summary || q.showMeasurements === false
    ? []
    : items.filter((i) => (i.rowType ?? 'ITEM') === 'ITEM' && i.measurements?.length);
  const words = q.totalInWords?.[locale] ?? q.totalInWords?.en;
  const whose = forCustomer(t, q.customer?.name ?? '', q.site?.address);
  // A status the customer's link never shows (a draft in the builder's Customer view) keeps the badge's own words.
  const statusKey = `quotation.status.${q.status}`;

  return (
    <div lang={locale} data-testid="quotation-document">
      <DocumentLetterhead letterhead={q.letterhead} />
      <DocumentHeader
        kind={variation ? t('quotation.variation.kind') : t('quotation.kind')}
        icon={FileText}
        number={q.number}
        subject={variation && q.job?.number ? `${t('quotation.variation.ofJob', { job: q.job.number })} · ${whose}` : whose}
        status={print ? undefined : q.status}
        statusLabel={t.has(statusKey) ? t(statusKey) : undefined}
        meta={<DocumentDates q={q} t={t} />}
      />
      {notice}
      {summary
        ? <SectionSummaryTable sections={q.boq?.sections} />
        : <LineItemsTable items={items} showSymbol={showSymbol} sections={q.boq?.sections} />}
      <TotalsList
        rows={[
          // A variation's totals may be below zero (Phase L7: an omission) — "− Rs. …".
          { label: t('document.totals.subtotal'), value: signed(q.subtotal) },
          q.discount > 0 && { label: t('document.totals.discount'), value: `− ${money(q.discount)}`, tone: 'success' },
          q.vatApplied && { label: t('document.totals.vat', { rate: q.vatRate }), value: signed(q.vatAmount) },
          { label: t('document.totals.total'), value: signed(q.total), emphasis: true },
          !summary && q.boq?.optionalTotal > 0 && { label: t('document.totals.optional'), value: `(${money(q.boq.optionalTotal)})` },
        ]}
      />
      {words ? (
        <p className="ml-auto mt-3 max-w-md text-right text-sm" data-testid="total-in-words">
          <span className="text-muted-foreground">{t('document.words.title')}: </span>
          <span className="font-medium">{words}</span>
        </p>
      ) : null}
      <ContractTerms q={q} t={t} />
      <PaymentScheduleTable stages={q.paymentStages} total={q.total} vatApplied={q.vatApplied} />
      {q.terms ? (
        <section className="mt-8 rounded-lg bg-muted/50 p-4" aria-labelledby="q-terms">
          <h2 id="q-terms" className="text-sm font-semibold">{t('document.terms')}</h2>
          <p className="mt-2 whitespace-pre-line text-sm text-muted-foreground">{q.terms}</p>
        </section>
      ) : null}
      <MeasurementsAnnex items={measured} print={print} />
    </div>
  );
}
