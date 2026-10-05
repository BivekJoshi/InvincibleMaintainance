import { useId } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { DOCUMENTS } from '@/config/i18n/documents';
import { useT } from '@/hooks/useT';
import { deductionLabel } from '@/helpers/finance';
import { formatSignedNpr } from '@/helpers/format';

/**
 * A final bill's **deductions** (Phase L8) — the earlier ADVANCE and RUNNING bills taken off it, the invoice lines of
 * `kind` DEDUCTION — as a block of their own under the billed lines: the bill ("Advance INV-2083-0077", the server's
 * "Less: …" without its "Less:") and the amount with **one** sign, "− Rs. 36,450.00" (`formatSignedNpr` of the server's
 * negative paisa) — never "Rs. -…", never a minus on a "Less". No quantity or rate, and no sum of its own: the totals
 * under it are the server's. The office's invoice page, its print, the customer's page and a locked draft all render it.
 * The block's words are the screen's language (or `locale`); each bill's own description is the server's, as written.
 *
 * @param {{ items?: object[], locale?: 'en'|'ne', showSymbol?: boolean }} props  `items`: the DEDUCTION lines
 */
export function DeductionsTable({ items = [], locale, showSymbol = true }) {
  const titleId = useId();
  const t = useT(DOCUMENTS, { locale });
  if (!items?.length) return null;
  return (
    <section aria-labelledby={titleId} data-testid="invoice-deductions" className="pb-6">
      <h3 id={titleId} className="text-sm font-semibold">{t('document.deductions.title')}</h3>
      <p className="mb-2 text-xs text-muted-foreground">{t('document.deductions.body')}</p>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t('document.deductions.bill')}</TableHead>
            <TableHead className="text-right">{t('document.deductions.amount')}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((item, i) => (
            <TableRow key={item.id ?? `deduction-${i}`} data-row-type="DEDUCTION">
              <TableCell className="font-medium">{deductionLabel(item.description)}</TableCell>
              <TableCell className="whitespace-nowrap text-right font-medium tabular-nums">
                {formatSignedNpr(item.amount, { symbol: showSymbol, locale: t.locale })}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </section>
  );
}
