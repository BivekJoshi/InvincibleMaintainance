import { useState } from 'react';
import { ChevronDown, Ruler } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { DOCUMENTS } from '@/config/i18n/documents';
import { useT } from '@/hooks/useT';
import { formatQty, measurementRowValue } from '@/helpers/measurements';
import { cn } from '@/helpers/utils';

/** A dimension as measured, or blank. */
const dim = (v) => (v == null || v === '' ? '' : formatQty(v));

/** One measured row's sheet: where, nos × L × B × H, and each line's quantity. */
function MeasuredItem({ item }) {
  const t = useT(DOCUMENTS);
  const billed = formatQty(item.qty);
  return (
    <div className="space-y-1.5 break-inside-avoid" data-testid="measured-item">
      <p className="text-sm">
        {item.number ? <span className="mr-1.5 font-mono text-xs font-semibold">{item.number}</span> : null}
        <span className="font-medium">{item.description}</span>
      </p>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[18rem] text-xs">
          <thead>
            <tr className="border-b text-left text-muted-foreground">
              <th className="py-1 pr-2 font-medium">{t('document.measurements.area')}</th>
              <th className="px-1 py-1 text-right font-medium">{t('document.measurements.nos')}</th>
              <th className="px-1 py-1 text-right font-medium">{t('document.measurements.l')}</th>
              <th className="px-1 py-1 text-right font-medium">{t('document.measurements.b')}</th>
              <th className="px-1 py-1 text-right font-medium">{t('document.measurements.h')}</th>
              <th className="py-1 pl-2 text-right font-medium">{t('document.measurements.value')}</th>
            </tr>
          </thead>
          <tbody>
            {item.measurements.map((m, i) => {
              const value = measurementRowValue(m);
              return (
                // A sheet's rows have no ids; their order is the sheet's.
                <tr key={i} className="border-b last:border-0">
                  <td className="py-1 pr-2">
                    {[m.area, m.description].filter(Boolean).join(' — ')}
                    {m.deduct ? <span className="ml-1 text-muted-foreground">({t('document.measurements.deduct')})</span> : null}
                  </td>
                  <td className="px-1 py-1 text-right tabular-nums">{dim(m.nos)}</td>
                  <td className="px-1 py-1 text-right tabular-nums">{dim(m.l)}</td>
                  <td className="px-1 py-1 text-right tabular-nums">{dim(m.b)}</td>
                  <td className="px-1 py-1 text-right tabular-nums">{dim(m.h)}</td>
                  <td className={cn('py-1 pl-2 text-right tabular-nums', value < 0 && 'text-destructive')}>{value == null ? '' : formatQty(value)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-muted-foreground">
        {item.unit ? t('document.measurements.billedUnit', { qty: billed, unit: item.unit }) : t('document.measurements.billed', { qty: billed })}
      </p>
    </div>
  );
}

/**
 * The measurements annex (Phase L4): for each row measured on site, the lines of its measurement sheet — where,
 * nos × L × B × H, deductions — so the customer can check a quantity. Collapsed on the page (a phone shows the BOQ
 * first); always open in print. Quantities, never money: the quantity in the bill is the server's (`qty`). In the
 * screen's language (`DOCUMENTS.document.measurements`); where each row was measured is the surveyor's own text.
 *
 * @param {{ items: object[], print?: boolean }} props  items that carry `measurements`
 */
export function MeasurementsAnnex({ items, print = false }) {
  const [open, setOpen] = useState(false);
  const t = useT(DOCUMENTS);
  if (!items?.length) return null;
  const body = (
    <div className="space-y-5">
      <p className="text-xs text-muted-foreground">{t('document.measurements.intro')}</p>
      {items.map((item) => <MeasuredItem key={item.id ?? item.number ?? item.description} item={item} />)}
    </div>
  );

  if (print) {
    return (
      <section className="mt-8 break-before-page" aria-labelledby="q-annex" data-testid="measurements-annex">
        <h2 id="q-annex" className="mb-3 text-sm font-semibold">{t('document.measurements.title')}</h2>
        {body}
      </section>
    );
  }
  return (
    <section className="mt-8" aria-labelledby="q-annex" data-testid="measurements-annex">
      <h2 id="q-annex" className="text-sm font-semibold">{t('document.measurements.title')}</h2>
      <Collapsible open={open} onOpenChange={setOpen}>
        <CollapsibleTrigger asChild>
          <Button type="button" variant="outline" size="sm" className="mt-2 h-auto min-h-9 whitespace-normal text-left">
            <Ruler aria-hidden /> {open ? t('document.measurements.hide') : t('document.measurements.show', { count: items.length })}
            <ChevronDown className={cn('transition-transform', open && 'rotate-180')} aria-hidden />
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="mt-4">{body}</CollapsibleContent>
      </Collapsible>
    </section>
  );
}
