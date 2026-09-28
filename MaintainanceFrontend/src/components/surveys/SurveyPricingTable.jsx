import { AlertTriangle, Lock } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { formatNpr, paisaToRupees, titleCase } from '@/helpers/format';
import { formatQty } from '@/helpers/measurements';
import { cn } from '@/helpers/utils';

/**
 * The reviewer's working surface: the surveyor's quantities on the left, today's catalogue rate on the right,
 * an editable rate for anything the catalogue could not price, and whether each line counts in the total.
 *
 * A line the surveyor measured (Phase L5) says so; its quantity is the server's, worked out from the sheet, which the
 * findings show row by row.
 *
 * Since Phase L3 every line goes into the quotation: a line left out of the total (an optional one, by default)
 * becomes an **optional row** — shown to the customer, not totalled. Rates are edited in RUPEES because that is
 * what the quotation API accepts. Amounts and the subtotal are the server's (`figures` / `totals`, from the
 * quotation preview; the pricing's own figures for a reader who cannot build) — the browser adds up nothing.
 *
 * @param {{ lines: object[], missing?: object[], draft: object, onChange: Function, figures?: Map<string, object>,
 *   totals?: { subtotal: number, optionalTotal?: number }|null, readOnly?: boolean, stale?: boolean }} props
 */
export function SurveyPricingTable({ lines, missing = [], draft, onChange, figures, totals, readOnly = false, stale = false }) {
  const missingById = new Map(missing.map((m) => [m.surveyItemId, m.reason]));
  const setLine = (id, patch) => onChange({ ...draft, [id]: { ...draft[id], ...patch } });
  const rateText = (line) => draft[line.surveyItemId]?.rate ?? (line.ratePaisa != null ? String(paisaToRupees(line.ratePaisa)) : '');
  const inTotal = (line) => draft[line.surveyItemId]?.included ?? !line.isOptional;
  const unpriced = lines.filter((l) => rateText(l).trim() === '');
  const amountOf = (line) => (figures ? figures.get(line.surveyItemId)?.amount : line.amountPaisa);

  return (
    <div className="space-y-3">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-10"><span className="sr-only">In the total</span></TableHead>
            <TableHead>Line</TableHead>
            <TableHead className="text-right">Qty</TableHead>
            <TableHead className="w-[130px] text-right">Rate (Rs)</TableHead>
            <TableHead className="text-right">Amount</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {lines.map((line) => {
            const counted = inTotal(line);
            const reason = missingById.get(line.surveyItemId);
            const amount = amountOf(line);
            return (
              <TableRow key={line.surveyItemId} className={cn(!counted && 'text-muted-foreground')}>
                <TableCell>
                  <Checkbox
                    checked={counted}
                    disabled={readOnly}
                    onCheckedChange={(v) => setLine(line.surveyItemId, { included: Boolean(v) })}
                    aria-label={`Count ${line.description} in the total`}
                  />
                </TableCell>
                <TableCell>
                  <p className="font-medium leading-tight">{line.description}</p>
                  <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                    <Badge variant="outline" className="px-1 py-0 text-[10px]">{titleCase(line.kind)}</Badge>
                    {!counted ? <span className="text-warning">optional — shown, not in the total</span> : null}
                    {line.measurements?.length ? (
                      <span>measured · {line.measurements.length} row{line.measurements.length === 1 ? '' : 's'}</span>
                    ) : null}
                    {line.wastagePct > 0 ? <span>{formatQty(line.rawQty)} + {line.wastagePct}% waste</span> : null}
                    {line.note ? <span className="italic">{line.note}</span> : null}
                  </div>
                  {reason ? (
                    <p className="mt-1 flex items-center gap-1 text-xs text-warning">
                      <AlertTriangle className="h-3.5 w-3.5" aria-hidden /> {reason}
                    </p>
                  ) : null}
                </TableCell>
                <TableCell className="whitespace-nowrap text-right tabular-nums">
                  {formatQty(line.qty)} <span className="text-xs text-muted-foreground">{line.unit}</span>
                </TableCell>
                <TableCell className="text-right">
                  <Input
                    inputMode="decimal"
                    className="h-8 text-right tabular-nums"
                    value={rateText(line)}
                    disabled={readOnly}
                    onChange={(e) => setLine(line.surveyItemId, { rate: e.target.value })}
                    placeholder="Set rate"
                    aria-label={`Rate for ${line.description}`}
                  />
                </TableCell>
                <TableCell className={cn('whitespace-nowrap text-right font-medium tabular-nums transition-opacity', stale && 'opacity-50')}>
                  {amount == null ? <span className="text-muted-foreground">—</span> : counted ? formatNpr(amount) : `(${formatNpr(amount)})`}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>

      <div className="flex items-start justify-between gap-4 border-t pt-3">
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Lock className="h-3.5 w-3.5" aria-hidden />
          Amounts are the server’s. Discount and VAT are applied when the quotation is created.
        </p>
        <div className={cn('text-right transition-opacity', stale && 'opacity-50')}>
          <p className="text-xs text-muted-foreground">Subtotal</p>
          <p className="text-lg font-semibold tabular-nums" data-testid="survey-subtotal">{totals ? formatNpr(totals.subtotal) : '—'}</p>
          {totals?.optionalTotal > 0 ? <p className="text-xs text-muted-foreground">Optional: ({formatNpr(totals.optionalTotal)})</p> : null}
        </div>
      </div>

      {unpriced.length ? (
        <p className="surface-warning rounded-md border px-3 py-2 text-xs">
          {unpriced.length} line{unpriced.length === 1 ? ' has' : 's have'} no rate yet. Every line goes into the quotation
          (optional ones as optional rows), so set a rate before building it.
        </p>
      ) : null}
    </div>
  );
}
