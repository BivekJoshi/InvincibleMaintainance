import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { DOCUMENTS } from '@/config/i18n/documents';
import { useT } from '@/hooks/useT';
import { formatNpr } from '@/helpers/format';

/**
 * A quotation shown as its section subtotals only (`summaryOnly`, Phase L4) — the customer sees what each part of
 * the work costs, not the item rows. Every figure is the server's (`boq.sections`, L3); rows before the first
 * section form an untitled group, named "Other items". In the screen's language (`DOCUMENTS.document.summary`).
 *
 * @param {{ sections?: { index: number|null, number?: string|null, title?: string|null, subtotal: number }[],
 *   showSymbol?: boolean }} props
 */
export function SectionSummaryTable({ sections = [], showSymbol = true }) {
  const t = useT(DOCUMENTS);
  if (!sections?.length) return null;
  return (
    <section className="py-6" aria-labelledby="q-summary" data-testid="section-summary">
      <h2 id="q-summary" className="text-sm font-semibold">{t('document.summary.title')}</h2>
      <Table className="mt-2">
        <TableHeader>
          <TableRow>
            <TableHead className="w-12 px-2">#</TableHead>
            <TableHead className="px-2">{t('document.summary.section')}</TableHead>
            <TableHead className="px-2 text-right">{t('document.summary.amount')}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sections.map((s, i) => (
            <TableRow key={s.index ?? `other-${i}`} data-row-type="SECTION">
              <TableCell className="px-2 font-mono text-xs font-semibold">{s.number ?? ''}</TableCell>
              <TableCell className="px-2 font-medium">{s.title ?? t('document.summary.other')}</TableCell>
              <TableCell className="whitespace-nowrap px-2 text-right tabular-nums">{formatNpr(s.subtotal, { symbol: showSymbol, locale: t.locale })}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <p className="mt-2 text-xs text-muted-foreground">{t('document.summary.note')}</p>
    </section>
  );
}
