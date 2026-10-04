import { useState } from 'react';
import { Calculator, ArrowRight } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useEstimateMutation } from '@/api/publicApi';
import { SITE } from '@/config/i18n/site';
import { useApiErrorText, useT } from '@/hooks/useT';
import { formatNpr } from '@/helpers/format';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';

/**
 * The cost estimator — the conversion feature the original site had no answer for.
 * It returns a range, never a single figure, so it cannot be mistaken for a quote.
 *
 * Phase J1: the API's answer carries English display strings (`display.*`, `disclaimer`); the figures are worded
 * here from its paisa instead, in the visitor's language. A refusal the API words as a bad request is the one this
 * form can meet — a service priced on inspection — so it says that; anything else (offline, too many tries) is
 * worded from its code.
 */
export function Estimator({ services = [], onEstimate }) {
  const t = useT(SITE);
  const errorText = useApiErrorText(SITE);
  const { locale } = t;
  const [serviceId, setServiceId] = useState('');
  const [qty, setQty] = useState('');
  const [estimate, { data, isLoading, error, reset }] = useEstimateMutation();

  const selected = services.find((s) => s.id === serviceId);

  const onSubmit = async (e) => {
    e.preventDefault();
    if (!serviceId || !qty) return;
    const result = await estimate({ serviceId, qty: Number(qty) }).unwrap().catch(() => null);
    if (result) onEstimate?.(result);
  };

  return (
    <Card className="overflow-hidden shadow-card">
      <div className="flex items-start gap-3 border-b bg-muted/50 px-6 py-5">
        <span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-full border border-gold/35 text-gold">
          <Calculator className="h-4 w-4" aria-hidden />
        </span>
        <div>
          <h3 className="text-lg font-semibold tracking-tight">{t('estimate.title')}</h3>
          <p className="mt-1 text-sm text-muted-foreground">{t('estimate.description')}</p>
        </div>
      </div>
      <CardContent className="p-6">
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="est-service">{t('estimate.service')}</Label>
            <Select value={serviceId || undefined} onValueChange={(v) => { setServiceId(v); reset(); }}>
              <SelectTrigger id="est-service"><SelectValue placeholder={t('estimate.choose')} /></SelectTrigger>
              <SelectContent>
                {services.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="est-qty">
              {selected?.priceUnit ? t('estimate.quantityIn', { unit: selected.priceUnit }) : t('estimate.quantity')}
            </Label>
            <Input
              id="est-qty" type="number" inputMode="decimal" min="1" step="any"
              value={qty} onChange={(e) => { setQty(e.target.value); reset(); }}
              placeholder={t('estimate.placeholder')}
            />
          </div>

          <Button type="submit" className="w-full" loading={isLoading} disabled={!serviceId || !qty}>
            {t('estimate.calculate')} <ArrowRight className="h-4 w-4" />
          </Button>
        </form>

        <AnimatePresence mode="wait">
          {error ? (
            <motion.p
              key="err"
              initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
              className="mt-4 rounded-md bg-muted p-3 text-sm text-muted-foreground"
            >
              {error?.data?.error?.code === 'BAD_REQUEST' ? t('estimate.onInspection') : errorText(error)}
            </motion.p>
          ) : data ? (
            <motion.div
              key="result"
              initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
              className="mt-5 rounded-lg border border-gold/30 bg-gold/[0.06] p-5"
            >
              <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                {t('estimate.range', { qty: data.qty, unit: data.unit })}
              </p>
              <p className="mt-2 text-2xl font-semibold tabular-nums tracking-tight">
                {formatNpr(data.min, { locale })} <span className="text-muted-foreground">–</span> {formatNpr(data.max, { locale })}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {t('estimate.rate', {
                  min: formatNpr(data.rateMin, { locale }), max: formatNpr(data.rateMax, { locale }), unit: data.unit,
                })}
              </p>
              <p className="mt-3 border-t pt-3 text-xs text-muted-foreground">{t('estimate.disclaimer')}</p>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </CardContent>
    </Card>
  );
}
