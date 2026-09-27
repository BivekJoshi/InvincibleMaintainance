import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { formatNpr } from '@/helpers/format';
import { formatQty } from '@/helpers/measurements';
import { cn } from '@/helpers/utils';
import { documentCopy } from './quotationDocumentCopy';

/**
 * Description, quantity, rate, amount — the columns of every priced document we send.
 *
 * Since Phase L3 a quotation's rows are a bill of quantities: a **SECTION** row is a heading with its number
 * (and its subtotal, when `sections` gives it), a **NOTE** row is a line of text, a row's `spec` prints under
 * it, an **optional** row says it is not in the total, a **provisional** one that it is settled by measurement.
 * An invoice's lines have no row type and read as they always did.
 *
 * Figures are tabular so the amounts column reads as a stack of numbers rather than as ragged text, and the
 * table scrolls sideways inside its own box so a long description never widens the page on a phone.
 *
 * @param {{ items?: object[], showSymbol?: boolean, locale?: 'en'|'ne', sections?: { index: number, subtotal: number }[] }} props
 */
export function LineItemsTable({ items = [], showSymbol = true, locale = 'en', sections = [] }) {
  if (!items.length) return null;
  const copy = documentCopy(locale).rows;
  const money = (paisa) => formatNpr(paisa, { symbol: showSymbol });
  const numbered = items.some((item) => item.number);
  const subtotalAt = new Map((sections ?? []).filter((s) => s.index != null).map((s) => [s.index, s.subtotal]));
  const columns = numbered ? 5 : 4;

  return (
    <div className="py-6">
      {/* On a phone the rates and amounts sit to the right: the table scrolls in its own box, never the page. */}
      <p className="mb-2 text-xs text-muted-foreground sm:hidden print:hidden" data-testid="swipe-hint">{copy.swipe}</p>
      <Table>
        <TableHeader>
          <TableRow>
            {numbered ? <TableHead className="w-12">{copy.number}</TableHead> : null}
            <TableHead className="min-w-[9rem]">{copy.description}</TableHead>
            <TableHead className="text-right">{copy.qty}</TableHead>
            <TableHead className="text-right">{copy.rate}</TableHead>
            <TableHead className="text-right">{copy.amount}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((item, i) => {
            const type = item.rowType ?? 'ITEM';
            const key = item.id ?? `row-${i}`;
            if (type === 'SECTION') {
              const subtotal = subtotalAt.get(i);
              return (
                <TableRow key={key} className="bg-muted/50 hover:bg-muted/50" data-row-type="SECTION">
                  {numbered ? <TableCell className="font-mono text-xs font-semibold">{item.number}</TableCell> : null}
                  <TableCell colSpan={3} className="font-semibold uppercase tracking-wide">
                    <h3 className="text-sm">{item.description}</h3>
                    {item.spec ? <p className="mt-0.5 whitespace-pre-line text-xs font-normal normal-case tracking-normal text-muted-foreground">{item.spec}</p> : null}
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-right text-xs font-semibold tabular-nums">
                    {subtotal != null ? <span title={copy.sectionTotal(item.number ?? '')}>{money(subtotal)}</span> : null}
                  </TableCell>
                </TableRow>
              );
            }
            if (type === 'NOTE') {
              return (
                <TableRow key={key} data-row-type="NOTE" className="hover:bg-transparent">
                  <TableCell colSpan={columns} className="whitespace-pre-line text-sm italic text-muted-foreground">{item.description}</TableCell>
                </TableRow>
              );
            }
            return (
              <TableRow key={key} data-row-type="ITEM" data-optional={item.isOptional || undefined} className={cn(item.isOptional && 'text-muted-foreground')}>
                {numbered ? <TableCell className="align-top font-mono text-xs">{item.number}</TableCell> : null}
                <TableCell className="align-top">
                  <p className="font-medium">{item.description}</p>
                  {item.spec ? <p className="mt-0.5 whitespace-pre-line text-xs text-muted-foreground">{item.spec}</p> : null}
                  {item.isOptional ? <p className="mt-1 text-xs font-semibold text-warning">{copy.optional}</p> : null}
                  {item.isProvisional ? <p className="mt-1 text-xs font-semibold text-muted-foreground">{copy.provisional}</p> : null}
                </TableCell>
                <TableCell className="whitespace-nowrap text-right align-top tabular-nums">
                  {formatQty(item.qty)}{item.unit ? <span className="text-muted-foreground"> {item.unit}</span> : null}
                </TableCell>
                <TableCell className="whitespace-nowrap text-right align-top tabular-nums">{money(item.rate)}</TableCell>
                <TableCell className="whitespace-nowrap text-right align-top font-medium tabular-nums">
                  {item.isOptional ? `(${money(item.amount)})` : money(item.amount)}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
