import { useState } from 'react';
import { Calculator, ArrowRight } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useEstimateMutation } from './publicApi';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';

/**
 * The cost estimator — the conversion feature the original site had no answer for.
 * It returns a range, never a single figure, so it cannot be mistaken for a quote.
 */
export function Estimator({ services = [], onEstimate }) {
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
          <h3 className="font-display text-lg font-semibold tracking-tight">Estimate your cost</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Enter the area and see the range from our published rates.
          </p>
        </div>
      </div>
      <CardContent className="p-6">
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="est-service">Service</Label>
            <Select value={serviceId || undefined} onValueChange={(v) => { setServiceId(v); reset(); }}>
              <SelectTrigger id="est-service"><SelectValue placeholder="Choose a service" /></SelectTrigger>
              <SelectContent>
                {services.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="est-qty">
              Quantity {selected?.priceUnit ? `(${selected.priceUnit})` : ''}
            </Label>
            <Input
              id="est-qty" type="number" inputMode="decimal" min="1" step="any"
              value={qty} onChange={(e) => { setQty(e.target.value); reset(); }}
              placeholder="e.g. 540"
            />
          </div>

          <Button type="submit" variant="gold" className="w-full" loading={isLoading} disabled={!serviceId || !qty}>
            Calculate <ArrowRight className="h-4 w-4" />
          </Button>
        </form>

        <AnimatePresence mode="wait">
          {error ? (
            <motion.p
              key="err"
              initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
              className="mt-4 rounded-md bg-muted p-3 text-sm text-muted-foreground"
            >
              {error?.data?.error?.message ?? 'We price this one on inspection. Book a free visit and we will quote it.'}
            </motion.p>
          ) : data ? (
            <motion.div
              key="result"
              initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
              className="mt-5 rounded-lg border border-gold/30 bg-gold/[0.06] p-5"
            >
              <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                Estimated range for {data.qty} {data.unit}
              </p>
              <p className="mt-2 font-display text-2xl font-semibold tabular-nums tracking-tight">
                {data.display.min} <span className="text-muted-foreground">–</span> {data.display.max}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">{data.display.rate}</p>
              <p className="mt-3 border-t pt-3 text-xs text-muted-foreground">{data.disclaimer}</p>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </CardContent>
    </Card>
  );
}
