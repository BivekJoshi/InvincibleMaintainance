import { Eyebrow } from '@/components/site/Eyebrow';
import { Card } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { formatNpr } from '@/helpers/format';

/**
 * The full rate card — the same rows a quotation is built from.
 *
 * Publishing it is the point of the page: a customer who can check the line
 * rate on a quote against the public one does not have to take the total on
 * trust. A zero rate is "Free", not "Rs 0" — a free inspection is a promise,
 * not a price of nothing.
 */
export function RateCard({ items }) {
  if (!items?.length) return null;

  return (
    <section>
      <Eyebrow>No hidden lines</Eyebrow>
      <h2 className="mt-3 text-2xl font-bold tracking-tight">Full rate card</h2>
      <p className="mt-2 text-sm text-muted-foreground">The same rates our quotations are built from.</p>

      <Card className="mt-6 overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40 hover:bg-muted/40">
                <TableHead>Item</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Unit</TableHead>
                <TableHead className="text-right">Rate</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="font-medium">{item.name}</TableCell>
                  <TableCell className="text-muted-foreground">{item.category ?? '—'}</TableCell>
                  <TableCell className="text-muted-foreground">{item.unit}</TableCell>
                  <TableCell className="text-right font-semibold tabular-nums">
                    {item.rate ? formatNpr(item.rate) : 'Free'}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Card>

      <p className="mt-3 text-xs text-muted-foreground">
        Rates exclude 13% VAT unless stated. Final pricing is confirmed after inspection.
      </p>
    </section>
  );
}
