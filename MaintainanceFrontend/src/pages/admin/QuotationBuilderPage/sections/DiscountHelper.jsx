import { useState } from 'react';
import { useFormContext } from 'react-hook-form';
import { Percent, Target } from 'lucide-react';
import { useLazyPreviewQuotationQuery } from '@/api/quotationsApi';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { previewRequest } from '@/helpers/boq';
import { formatNpr, paisaToRupees, parseRupees } from '@/helpers/format';
import { useFormMode } from '@/components/common/ResourceForm/formMode';

/**
 * The discount helpers beside the Discount field (a `preview` field in the builder's form): **"%"** and
 * **"target total"**. Neither works anything out here — each asks the server's preview for the discount
 * (`discountPct`, or `targetTotal` in rupees with VAT) on the rows as they stand, and fills the Discount field
 * (rupees) with its answer. The discount stays one amount; the server still computes every total on save.
 *
 * @param {{ field: { quotationId: string } }} props
 */
export function DiscountHelper({ field }) {
  const { getValues, setValue } = useFormContext();
  const { readOnly } = useFormMode();
  const [pct, setPct] = useState('');
  const [target, setTarget] = useState('');
  const [note, setNote] = useState(null);
  const [preview, { isFetching }] = useLazyPreviewQuotationQuery();

  const ask = async (extra, describe) => {
    setNote(null);
    const { body } = previewRequest(getValues(), { quotationId: field.quotationId });
    const { discount: _typed, ...rest } = body;
    try {
      const answer = await preview({ ...rest, ...extra }).unwrap();
      const discount = answer?.totals?.discount ?? 0;
      setValue('discount', paisaToRupees(discount), { shouldDirty: true, shouldTouch: true, shouldValidate: true });
      setNote({ tone: 'ok', text: `${describe}: discount set to ${formatNpr(discount)} — total ${formatNpr(answer?.totals?.total)}.` });
    } catch (err) {
      setNote({ tone: 'error', text: err?.data?.error?.message ?? 'The discount could not be worked out.' });
    }
  };

  const applyPct = () => {
    const n = Number(pct);
    if (pct === '' || !Number.isFinite(n) || n < 0 || n > 100) {
      setNote({ tone: 'error', text: 'Give a percentage from 0 to 100.' });
      return;
    }
    ask({ discountPct: n }, `${n}% off`);
  };
  const applyTarget = () => {
    const rupees = parseRupees(target);
    if (rupees == null) {
      setNote({ tone: 'error', text: 'Give the total in rupees.' });
      return;
    }
    ask({ targetTotal: rupees }, `A total of Rs. ${target}`);
  };
  const onEnter = (apply) => (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      apply();
    }
  };

  return (
    <div className="space-y-2 rounded-md border border-dashed p-3">
      <p className="text-xs font-medium text-muted-foreground">Work the discount out for me</p>
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-28">
          <Input value={pct} onChange={(e) => setPct(e.target.value)} onKeyDown={onEnter(applyPct)} inputMode="decimal" placeholder="5" aria-label="Discount %" disabled={readOnly} className="h-8 pr-7 text-right tabular-nums" />
          <Percent className="pointer-events-none absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" aria-hidden />
        </div>
        <Button type="button" size="sm" variant="outline" onClick={applyPct} disabled={readOnly || isFetching}>Apply %</Button>
        <div className="relative w-40">
          <Input value={target} onChange={(e) => setTarget(e.target.value)} onKeyDown={onEnter(applyTarget)} inputMode="decimal" placeholder="1,00,000" aria-label="Target total (Rs, with VAT)" disabled={readOnly} className="h-8 pr-7 text-right tabular-nums" />
          <Target className="pointer-events-none absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" aria-hidden />
        </div>
        <Button type="button" size="sm" variant="outline" onClick={applyTarget} disabled={readOnly || isFetching}>Apply target total</Button>
      </div>
      {note ? (
        <p role={note.tone === 'error' ? 'alert' : undefined} className={note.tone === 'error' ? 'text-xs text-destructive' : 'text-xs text-muted-foreground'} data-testid="discount-helper-note">
          {note.text}
        </p>
      ) : null}
    </div>
  );
}
