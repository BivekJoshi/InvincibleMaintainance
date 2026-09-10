import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { formatNpr } from '@/helpers/format';

/**
 * Description, quantity, rate, amount — the four columns of every priced
 * document we send.
 *
 * Figures are tabular so the amounts column reads as a stack of numbers rather
 * than as ragged text, and the table scrolls sideways inside its own box so a
 * long description never widens the page on a phone.
 */
export function LineItemsTable({ items = [], showSymbol = true }) {
  if (!items.length) return null;
  const money = (paisa) => formatNpr(paisa, { symbol: showSymbol });

  return (
    <div className="overflow-x-auto py-6">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Description</TableHead>
            <TableHead className="text-right">Qty</TableHead>
            <TableHead className="text-right">Rate</TableHead>
            <TableHead className="text-right">Amount</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((item) => (
            <TableRow key={item.id}>
              <TableCell className="font-medium">{item.description}</TableCell>
              <TableCell className="whitespace-nowrap text-right tabular-nums">
                {item.qty}{item.unit ? <span className="text-muted-foreground"> {item.unit}</span> : null}
              </TableCell>
              <TableCell className="text-right tabular-nums">{money(item.rate)}</TableCell>
              <TableCell className="text-right font-medium tabular-nums">{money(item.amount)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
