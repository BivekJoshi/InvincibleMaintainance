import { useId } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { deductionLabel } from '@/helpers/finance';
import { formatSignedNpr } from '@/helpers/format';
import { documentCopy } from './quotationDocumentCopy';

/**
 * A final bill's **deductions** (Phase L8) — the earlier ADVANCE and RUNNING bills taken off it, the invoice lines of
 * `kind` DEDUCTION — as a block of their own under the billed lines: the bill ("Advance INV-2083-0077", the server's
 * "Less: …" without its "Less:") and the amount with **one** sign, "− Rs. 36,450.00" (`formatSignedNpr` of the server's
 * negative paisa) — never "Rs. -…", never a minus on a "Less". No quantity or rate, and no sum of its own: the totals
 * under it are the server's. The office's invoice page, its print, the customer's page and a locked draft all render it.
 *
 * @param {{ items?: object[], locale?: 'en'|'ne', showSymbol?: boolean }} props  `items`: the DEDUCTION lines
 */
export function DeductionsTable({ items = [], locale = 'en', showSymbol = true }) {
  const titleId = useId();
  if (!items?.length) return null;
  const copy = documentCopy(locale).deductions;
  return (
    <section aria-labelledby={titleId} data-testid="invoice-deductions" className="pb-6">
      <h3 id={titleId} className="text-sm font-semibold">{copy.title}</h3>
      <p className="mb-2 text-xs text-muted-foreground">{copy.body}</p>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{copy.bill}</TableHead>
            <TableHead className="text-right">{copy.amount}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((item, i) => (
            <TableRow key={item.id ?? `deduction-${i}`} data-row-type="DEDUCTION">
              <TableCell className="font-medium">{deductionLabel(item.description)}</TableCell>
              <TableCell className="whitespace-nowrap text-right font-medium tabular-nums">
                {formatSignedNpr(item.amount, { symbol: showSymbol })}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </section>
  );
}
