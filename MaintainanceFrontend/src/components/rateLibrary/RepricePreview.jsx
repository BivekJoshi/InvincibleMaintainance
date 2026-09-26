import { formatNpr } from '@/helpers/format';
import { cn } from '@/helpers/utils';

/** `+Rs. 5.00` / `−Rs. 5.00` — the server's delta, signed for reading. */
const signed = (delta) => `${delta > 0 ? '+' : delta < 0 ? '−' : ''}${formatNpr(Math.abs(delta))}`;

/**
 * What "Update to derived rate" would change, from the reprice preview (`apply: false`): each rate now,
 * its derived rate at today's prices, and the difference — all as the server sent them. Shown inside the
 * confirmation, before anything is written.
 *
 * @param {{ items: { id: string, code: string, name: string, rate: number, derivedRate: number, delta: number }[], unchanged?: number }} props
 */
export function RepricePreview({ items, unchanged = 0 }) {
  return (
    <div className="space-y-2 text-sm">
      <p>At today’s prices these rates move. Quotations already sent keep their price.</p>
      <div className="max-h-64 overflow-y-auto rounded-md border">
        <table className="w-full text-left text-xs">
          <caption className="sr-only">Rates before and after</caption>
          <thead className="sticky top-0 bg-muted text-muted-foreground">
            <tr>
              <th scope="col" className="px-2 py-1.5 font-medium">Rate</th>
              <th scope="col" className="px-2 py-1.5 text-right font-medium">Now</th>
              <th scope="col" className="px-2 py-1.5 text-right font-medium">Derived</th>
              <th scope="col" className="px-2 py-1.5 text-right font-medium">Change</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id} className="border-t">
                <th scope="row" className="px-2 py-1.5 font-normal text-foreground">
                  <span className="font-mono font-semibold">{item.code}</span> <span className="text-muted-foreground">{item.name}</span>
                </th>
                <td className="whitespace-nowrap px-2 py-1.5 text-right tabular-nums">{formatNpr(item.rate)}</td>
                <td className="whitespace-nowrap px-2 py-1.5 text-right tabular-nums text-foreground">{formatNpr(item.derivedRate)}</td>
                <td className={cn('whitespace-nowrap px-2 py-1.5 text-right tabular-nums', item.delta < 0 ? 'text-destructive' : 'text-success')}>
                  {signed(item.delta)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {unchanged ? (
        <p className="text-xs">
          {unchanged === 1
            ? '1 other selected rate is left as it is — typed by hand, already at its derived rate, or missing a price.'
            : `${unchanged} other selected rates are left as they are — typed by hand, already at their derived rates, or missing a price.`}
        </p>
      ) : null}
    </div>
  );
}
