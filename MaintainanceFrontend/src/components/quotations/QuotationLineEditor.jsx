import { Plus, Trash2 } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { formatNpr, paisaToRupees } from '@/helpers/format';
import { UNITS } from '@/config/constants';

const blankLine = () => ({ description: '', unit: 'lump', qty: 1, rate: '', rateCardItemId: null });

/**
 * Editable quotation lines. Rates are entered and sent in RUPEES because that is
 * what the API's schema accepts; the server converts to paisa and computes every
 * total, so the figures here are a preview until it saves.
 */
export function QuotationLineEditor({ lines, onChange, rateCard = [], disabled }) {
  const setLine = (i, patch) => onChange(lines.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  const remove = (i) => onChange(lines.filter((_, idx) => idx !== i));

  /** Picking a rate-card item fills the line but leaves every field editable. */
  const applyRateCard = (i, itemId) => {
    const item = rateCard.find((r) => r.id === itemId);
    if (!item) return setLine(i, { rateCardItemId: null });
    return setLine(i, {
      rateCardItemId: item.id,
      description: lines[i].description || item.name,
      unit: item.unit,
      rate: paisaToRupees(item.rate),
    });
  };

  const amount = (l) => Math.round(Number(l.qty || 0) * Number(l.rate || 0) * 100);
  const subtotal = lines.reduce((t, l) => t + amount(l), 0);

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="min-w-[240px]">Description</TableHead>
              <TableHead className="w-[160px]">Rate card</TableHead>
              <TableHead className="w-[110px]">Unit</TableHead>
              <TableHead className="w-[100px] text-right">Qty</TableHead>
              <TableHead className="w-[130px] text-right">Rate (Rs)</TableHead>
              <TableHead className="w-[130px] text-right">Amount</TableHead>
              <TableHead className="w-10"><span className="sr-only">Remove</span></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {lines.map((line, i) => (
              <TableRow key={i}>
                <TableCell>
                  <Input
                    value={line.description}
                    onChange={(e) => setLine(i, { description: e.target.value })}
                    placeholder="What the customer is paying for"
                    className="h-8"
                    disabled={disabled}
                    aria-label={`Description for line ${i + 1}`}
                  />
                </TableCell>
                <TableCell>
                  <Select
                    value={line.rateCardItemId ?? 'none'}
                    onValueChange={(v) => applyRateCard(i, v === 'none' ? null : v)}
                    disabled={disabled}
                  >
                    <SelectTrigger className="h-8"><SelectValue placeholder="—" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Custom line</SelectItem>
                      {rateCard.map((r) => (
                        <SelectItem key={r.id} value={r.id}>{r.code} · {r.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </TableCell>
                <TableCell>
                  <Select value={line.unit ?? 'lump'} onValueChange={(v) => setLine(i, { unit: v })} disabled={disabled}>
                    <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {UNITS.map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </TableCell>
                <TableCell>
                  <Input
                    type="number" min="0" step="0.001" inputMode="decimal"
                    value={line.qty}
                    onChange={(e) => setLine(i, { qty: e.target.value })}
                    className="h-8 text-right tabular-nums"
                    disabled={disabled}
                    aria-label={`Quantity for line ${i + 1}`}
                  />
                </TableCell>
                <TableCell>
                  <Input
                    type="number" min="0" step="0.01" inputMode="decimal"
                    value={line.rate}
                    onChange={(e) => setLine(i, { rate: e.target.value })}
                    className="h-8 text-right tabular-nums"
                    disabled={disabled}
                    aria-label={`Rate for line ${i + 1}`}
                  />
                </TableCell>
                <TableCell className="whitespace-nowrap text-right font-medium tabular-nums">
                  {formatNpr(amount(line))}
                </TableCell>
                <TableCell>
                  <Button
                    variant="ghost" size="icon" className="h-8 w-8"
                    onClick={() => remove(i)}
                    disabled={disabled || lines.length === 1}
                    aria-label={`Remove line ${i + 1}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-between">
        <Button variant="outline" size="sm" onClick={() => onChange([...lines, blankLine()])} disabled={disabled}>
          <Plus className="h-4 w-4" /> Add line
        </Button>
        <div className="text-right">
          <p className="text-xs text-muted-foreground">Subtotal (preview)</p>
          <p className="text-lg font-semibold tabular-nums">{formatNpr(subtotal)}</p>
        </div>
      </div>
    </div>
  );
}

export { blankLine };
