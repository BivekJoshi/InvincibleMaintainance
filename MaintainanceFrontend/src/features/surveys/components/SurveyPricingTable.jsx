import { AlertTriangle, Lock } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { formatNpr, paisaToRupees, titleCase } from '@/lib/format';
import { cn } from '@/lib/utils';

/**
 * The reviewer's working surface: the surveyor's quantities on the left, today's
 * catalogue rate on the right, and an editable rate for anything the catalogue
 * could not price.
 *
 * Rates are edited in RUPEES because that is what the quotation API accepts.
 * The running total here is a preview only — the server recomputes it, and
 * discount and VAT are never calculated in the browser.
 */
export function SurveyPricingTable({ lines, missing = [], draft, onChange }) {
  const missingById = new Map(missing.map((m) => [m.surveyItemId, m.reason]));

  const setLine = (id, patch) => onChange({ ...draft, [id]: { ...draft[id], ...patch } });

  const rateFor = (line) => {
    const override = draft[line.surveyItemId]?.rate;
    if (override !== undefined && override !== '') return Number(override);
    return line.ratePaisa != null ? paisaToRupees(line.ratePaisa) : null;
  };

  const included = (line) => draft[line.surveyItemId]?.included ?? !line.isOptional;

  const subtotal = lines.reduce((total, line) => {
    if (!included(line)) return total;
    const rate = rateFor(line);
    return rate == null ? total : total + Math.round(line.qty * rate * 100);
  }, 0);

  const unpriced = lines.filter((l) => included(l) && rateFor(l) == null);

  return (
    <div className="space-y-3">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-10"><span className="sr-only">Include</span></TableHead>
            <TableHead>Line</TableHead>
            <TableHead className="text-right">Qty</TableHead>
            <TableHead className="w-[130px] text-right">Rate (Rs)</TableHead>
            <TableHead className="text-right">Amount</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {lines.map((line) => {
            const rate = rateFor(line);
            const isIncluded = included(line);
            const reason = missingById.get(line.surveyItemId);
            return (
              <TableRow key={line.surveyItemId} className={cn(!isIncluded && 'opacity-45')}>
                <TableCell>
                  <Checkbox
                    checked={isIncluded}
                    onCheckedChange={(v) => setLine(line.surveyItemId, { included: Boolean(v) })}
                    aria-label={`Include ${line.description}`}
                  />
                </TableCell>
                <TableCell>
                  <p className="font-medium leading-tight">{line.description}</p>
                  <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                    <Badge variant="outline" className="px-1 py-0 text-[10px]">{titleCase(line.kind)}</Badge>
                    {line.isOptional ? <span className="text-amber-600 dark:text-amber-500">optional</span> : null}
                    {line.wastagePct > 0 ? <span>{line.rawQty} + {line.wastagePct}% waste</span> : null}
                    {line.note ? <span className="italic">{line.note}</span> : null}
                  </p>
                  {reason ? (
                    <p className="mt-1 flex items-center gap-1 text-xs text-amber-600 dark:text-amber-500">
                      <AlertTriangle className="h-3.5 w-3.5" aria-hidden /> {reason}
                    </p>
                  ) : null}
                </TableCell>
                <TableCell className="whitespace-nowrap text-right tabular-nums">
                  {line.qty} <span className="text-xs text-muted-foreground">{line.unit}</span>
                </TableCell>
                <TableCell className="text-right">
                  <Input
                    type="number" min="0" step="0.01" inputMode="decimal"
                    className="h-8 text-right tabular-nums"
                    value={draft[line.surveyItemId]?.rate ?? (line.ratePaisa != null ? paisaToRupees(line.ratePaisa) : '')}
                    onChange={(e) => setLine(line.surveyItemId, { rate: e.target.value })}
                    placeholder="Set rate"
                    aria-label={`Rate for ${line.description}`}
                  />
                </TableCell>
                <TableCell className="whitespace-nowrap text-right font-medium tabular-nums">
                  {rate == null ? <span className="text-muted-foreground">—</span> : formatNpr(Math.round(line.qty * rate * 100))}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>

      <div className="flex items-start justify-between gap-4 border-t pt-3">
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Lock className="h-3.5 w-3.5" aria-hidden />
          Discount and VAT are applied by the server when the quotation is created.
        </p>
        <div className="text-right">
          <p className="text-xs text-muted-foreground">Subtotal</p>
          <p className="text-lg font-semibold tabular-nums">{formatNpr(subtotal)}</p>
        </div>
      </div>

      {unpriced.length ? (
        <p className="rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
          {unpriced.length} included line{unpriced.length === 1 ? ' has' : 's have'} no rate yet. Set a rate or exclude
          {unpriced.length === 1 ? ' it' : ' them'} before building the quotation.
        </p>
      ) : null}
    </div>
  );
}

/** Turns the reviewer's edits into the rupee-denominated payload the API expects. */
export function toQuotationItems(lines, draft) {
  return lines
    .filter((line) => (draft[line.surveyItemId]?.included ?? !line.isOptional))
    .map((line, i) => {
      const override = draft[line.surveyItemId]?.rate;
      const rate = override !== undefined && override !== ''
        ? Number(override)
        : paisaToRupees(line.ratePaisa ?? 0);
      return {
        rateCardItemId: line.rateCardItemId ?? null,
        description: line.description,
        unit: line.unit ?? undefined,
        qty: line.qty,
        rate,
        sortOrder: i,
      };
    })
    .filter((item) => Number.isFinite(item.rate));
}
