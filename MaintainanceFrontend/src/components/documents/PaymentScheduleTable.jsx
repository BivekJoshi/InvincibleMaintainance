import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { formatNpr } from '@/helpers/format';
import { formatShare } from '@/helpers/paymentSchedule';

/**
 * A quotation's payment schedule as the customer reads it (L-D3, Phase L4): each stage's label, when it falls due
 * (in the customer's words), its share and its amount **from the server** — `money.js#paymentSchedule` splits the
 * taxable amount and the VAT by basis points, and the last stage absorbs the remainder, so the stages add up to the
 * total exactly. The browser adds nothing up: the footer is the quotation's own total.
 *
 * Three columns (the trigger sits under the label), so it reads on a 360 px phone without scrolling.
 *
 * @param {{ stages?: { label: string, basisPoints: number, trigger: string, vat?: number, total?: number }[],
 *   total: number, vatApplied?: boolean, copy: object, showSymbol?: boolean }} props
 */
export function PaymentScheduleTable({ stages = [], total, vatApplied, copy, showSymbol = true }) {
  if (!stages?.length) return null;
  const money = (paisa) => formatNpr(paisa, { symbol: showSymbol });
  return (
    <section className="mt-8" aria-labelledby="q-schedule" data-testid="payment-schedule">
      <h2 id="q-schedule" className="text-sm font-semibold">{copy.title}</h2>
      <Table className="mt-2">
        <TableHeader>
          <TableRow>
            <TableHead className="px-2">{copy.stage}</TableHead>
            <TableHead className="w-16 px-2 text-right">{copy.share}</TableHead>
            <TableHead className="px-2 text-right">{copy.amount}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {stages.map((st, i) => (
            <TableRow key={st.id ?? `${i}-${st.label}`} data-trigger={st.trigger}>
              <TableCell className="px-2 align-top">
                <p className="font-medium">{st.label}</p>
                <p className="text-xs text-muted-foreground">{copy.triggers[st.trigger] ?? st.trigger}</p>
              </TableCell>
              <TableCell className="px-2 text-right align-top tabular-nums">{formatShare(st.basisPoints)}</TableCell>
              <TableCell className="px-2 text-right align-top">
                <p className="whitespace-nowrap font-medium tabular-nums">{st.total != null ? money(st.total) : '—'}</p>
                {vatApplied && st.vat > 0 ? (
                  <p className="whitespace-nowrap text-xs text-muted-foreground tabular-nums">{copy.vat(money(st.vat))}</p>
                ) : null}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
        <tfoot className="border-t font-semibold">
          <TableRow className="hover:bg-transparent">
            <TableCell className="px-2">{copy.total}</TableCell>
            <TableCell className="px-2 text-right tabular-nums">100%</TableCell>
            <TableCell className="whitespace-nowrap px-2 text-right tabular-nums">{money(total)}</TableCell>
          </TableRow>
        </tfoot>
      </Table>
    </section>
  );
}
