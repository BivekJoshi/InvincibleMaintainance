import { useController } from 'react-hook-form';
import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { formatNpr, paisaToRupees, parseRupees, rupeesToPaisa } from '@/helpers/format';
import { UNITS } from '@/config/constants';
import { FormField } from '../FormField';

const blankLine = () => ({ rateCardItemId: null, description: '', unit: 'lump', qty: 1, rate: '' });

/**
 * `{ type: 'lineItems', rateCard?, maxItems? }` — a priced document's lines: description, a
 * rate-card item, unit, quantity and a rate in **rupees**. The record's paisa rates are
 * converted on the way in (`formValues.js`); requests send rupees and the API computes every
 * total, so the amounts here are a preview until it saves. `rateCard` is the rate-card rows
 * (paisa); picking one fills the line and leaves every cell editable. A row left completely
 * empty is dropped by the schema.
 */
export function LineItemsField({ field, id }) {
  const { field: input, fieldState } = useController({ name: field.name });
  const rows = Array.isArray(input.value) ? input.value : [];
  const rateCard = field.rateCard ?? [];
  const disabled = field.disabled;
  const full = field.maxItems != null && rows.length >= field.maxItems;

  const update = (next) => { input.onChange(next); input.onBlur(); };
  const setCell = (i, patch) => input.onChange(rows.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  const move = (from, to) => {
    const next = [...rows];
    const [row] = next.splice(from, 1);
    next.splice(to, 0, row);
    update(next);
  };
  const applyRateCard = (i, itemId) => {
    const item = rateCard.find((r) => r.id === itemId);
    if (!item) return setCell(i, { rateCardItemId: null });
    return setCell(i, {
      rateCardItemId: item.id,
      description: rows[i].description || item.name,
      unit: item.unit,
      rate: paisaToRupees(item.rate),
    });
  };

  const amount = (l) => Math.round(Number(l.qty || 0) * rupeesToPaisa(parseRupees(String(l.rate ?? '')) ?? 0));
  const subtotal = rows.reduce((t, l) => t + amount(l), 0);
  const errorOf = (i, name) => fieldState.error?.[i]?.[name]?.message;
  const listError = fieldState.error?.message ?? fieldState.error?.root?.message;

  return (
    <FormField id={id} field={field} error={listError ? { message: listError } : undefined} as="fieldset">
      {() => (
        <div className="space-y-3">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-[220px]">Description</TableHead>
                  <TableHead className="w-[160px]">Rate card</TableHead>
                  <TableHead className="w-[110px]">Unit</TableHead>
                  <TableHead className="w-[100px] text-right">Qty</TableHead>
                  <TableHead className="w-[130px] text-right">Rate (Rs)</TableHead>
                  <TableHead className="w-[130px] text-right">Amount</TableHead>
                  {disabled ? null : <TableHead className="w-[108px]"><span className="sr-only">Move or remove</span></TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((line, i) => (
                  <TableRow key={i}>
                    <TableCell className="align-top">
                      <Input
                        ref={i === 0 ? input.ref : undefined}
                        value={line.description ?? ''}
                        onChange={(e) => setCell(i, { description: e.target.value })}
                        onBlur={input.onBlur}
                        placeholder="What the customer is paying for"
                        className="h-8"
                        disabled={disabled}
                        maxLength={500}
                        aria-label={`Description for line ${i + 1}`}
                        aria-invalid={errorOf(i, 'description') ? true : undefined}
                      />
                      {errorOf(i, 'description') ? <p className="mt-1 text-xs font-medium text-destructive">{errorOf(i, 'description')}</p> : null}
                    </TableCell>
                    <TableCell className="align-top">
                      <Select value={line.rateCardItemId ?? 'none'} onValueChange={(v) => applyRateCard(i, v === 'none' ? null : v)} disabled={disabled}>
                        <SelectTrigger className="h-8" aria-label={`Rate card item for line ${i + 1}`}><SelectValue placeholder="—" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Custom line</SelectItem>
                          {/* A retired rate is not offered again, but a line that already uses it still shows it. */}
                          {rateCard.filter((r) => r.isActive !== false || r.id === line.rateCardItemId).map((r) => (
                            <SelectItem key={r.id} value={r.id}>{r.code} · {r.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell className="align-top">
                      <Select value={line.unit || 'lump'} onValueChange={(v) => setCell(i, { unit: v })} disabled={disabled}>
                        <SelectTrigger className="h-8" aria-label={`Unit for line ${i + 1}`}><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {[...new Set([...UNITS, line.unit || 'lump'])].map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell className="align-top">
                      <Input
                        type="number" min="0" step="0.001" inputMode="decimal"
                        value={line.qty ?? ''}
                        onChange={(e) => setCell(i, { qty: e.target.value })}
                        onBlur={input.onBlur}
                        className="h-8 text-right tabular-nums"
                        disabled={disabled}
                        aria-label={`Quantity for line ${i + 1}`}
                        aria-invalid={errorOf(i, 'qty') ? true : undefined}
                      />
                      {errorOf(i, 'qty') ? <p className="mt-1 text-xs font-medium text-destructive">{errorOf(i, 'qty')}</p> : null}
                    </TableCell>
                    <TableCell className="align-top">
                      <Input
                        inputMode="decimal"
                        value={line.rate ?? ''}
                        onChange={(e) => setCell(i, { rate: e.target.value })}
                        onBlur={input.onBlur}
                        className="h-8 text-right tabular-nums"
                        disabled={disabled}
                        aria-label={`Rate for line ${i + 1}`}
                        aria-invalid={errorOf(i, 'rate') ? true : undefined}
                      />
                      {errorOf(i, 'rate') ? <p className="mt-1 text-xs font-medium text-destructive">{errorOf(i, 'rate')}</p> : null}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-right align-top font-medium tabular-nums">
                      <span className="inline-block pt-1.5">{formatNpr(amount(line))}</span>
                    </TableCell>
                    {disabled ? null : (
                      <TableCell className="align-top">
                        <div className="flex">
                          <Button type="button" variant="ghost" size="icon" className="h-8 w-8" disabled={i === 0} onClick={() => move(i, i - 1)} aria-label={`Move line ${i + 1} up`}>
                            <ArrowUp aria-hidden />
                          </Button>
                          <Button type="button" variant="ghost" size="icon" className="h-8 w-8" disabled={i === rows.length - 1} onClick={() => move(i, i + 1)} aria-label={`Move line ${i + 1} down`}>
                            <ArrowDown aria-hidden />
                          </Button>
                          <Button type="button" variant="ghost" size="icon" className="h-8 w-8" disabled={rows.length === 1} onClick={() => update(rows.filter((_, j) => j !== i))} aria-label={`Remove line ${i + 1}`}>
                            <Trash2 aria-hidden />
                          </Button>
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            {disabled ? <span /> : (
              <Button type="button" variant="outline" size="sm" disabled={full} onClick={() => update([...rows, blankLine()])}>
                <Plus aria-hidden /> Add line
              </Button>
            )}
            <div className="text-right">
              <p className="text-xs text-muted-foreground">Subtotal (preview)</p>
              <p className="text-lg font-semibold tabular-nums">{formatNpr(subtotal)}</p>
            </div>
          </div>
        </div>
      )}
    </FormField>
  );
}
