import { useEffect, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { CheckCircle2, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useSubmitLeadMutation } from './publicApi';
import { Button } from '@/components/ui/button';
import { Input, Textarea } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const NEPAL_PHONE = /^(?:9[678]\d{8}|0\d{1,2}-?\d{6,7})$/;

const schema = z.object({
  name: z.string().trim().min(2, 'Please enter your name'),
  phone: z.string().trim()
    .transform((v) => v.replace(/[\s()]/g, '').replace(/^\+?977-?/, ''))
    .refine((v) => NEPAL_PHONE.test(v), 'Enter a valid Nepali number, e.g. 9808338255'),
  address: z.string().trim().max(400).optional(),
  serviceId: z.string().optional(),
  message: z.string().trim().max(4000).optional(),
});

/**
 * The public enquiry form. Three spam defences run before the API is touched:
 * a hidden honeypot, a minimum time-on-form, and (in production) Turnstile.
 */
export function LeadForm({ services = [], defaultServiceId, estimate, sourcePage, compact = false }) {
  const [submitLead, { isLoading }] = useSubmitLeadMutation();
  const [done, setDone] = useState(false);
  const [serverError, setServerError] = useState(null);
  const mountedAt = useRef(Date.now());
  const honeypot = useRef(null);

  const { register, handleSubmit, setValue, watch, reset, formState: { errors } } = useForm({
    resolver: zodResolver(schema),
    defaultValues: { name: '', phone: '', address: '', serviceId: defaultServiceId ?? '', message: '' },
  });

  useEffect(() => {
    if (defaultServiceId) setValue('serviceId', defaultServiceId);
  }, [defaultServiceId, setValue]);

  const onSubmit = async (values) => {
    setServerError(null);
    try {
      await submitLead({
        ...values,
        serviceId: values.serviceId || undefined,
        sourcePage: sourcePage ?? window.location.pathname,
        elapsedMs: Date.now() - mountedAt.current,
        website: honeypot.current?.value ?? '',
        ...(estimate ? { estimatedAmount: estimate.max / 100, estimatePayload: estimate } : {}),
      }).unwrap();
      setDone(true);
      reset();
    } catch (err) {
      setServerError(err?.data?.error?.message ?? 'We could not send that. Please call us instead.');
    }
  };

  if (done) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }}
        className="rounded-xl border border-emerald-500/30 bg-emerald-50 p-6 text-center dark:bg-emerald-950"
        role="status"
      >
        <CheckCircle2 className="mx-auto h-8 w-8 text-emerald-600 dark:text-emerald-400" />
        <h3 className="mt-3 font-semibold">Request received</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Our engineer will call you within two hours. There is no charge for the visit.
        </p>
        <Button variant="outline" size="sm" className="mt-4" onClick={() => setDone(false)}>
          Send another request
        </Button>
      </motion.div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
      {/* Honeypot: invisible to people, irresistible to bots. Not `display:none`,
          which some bots skip — off-screen and aria-hidden instead. */}
      <div className="absolute left-[-9999px]" aria-hidden>
        <label htmlFor="website">Website</label>
        <input id="website" ref={honeypot} type="text" tabIndex={-1} autoComplete="off" />
      </div>

      <div className={compact ? 'grid gap-4 sm:grid-cols-2' : 'space-y-4'}>
        <div className="space-y-1.5">
          <Label htmlFor="lead-name" required>Your name</Label>
          <Input id="lead-name" aria-invalid={Boolean(errors.name)} {...register('name')} />
          {errors.name ? <p className="text-xs text-destructive">{errors.name.message}</p> : null}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="lead-phone" required>Phone number</Label>
          <Input id="lead-phone" type="tel" inputMode="tel" placeholder="9808338255" aria-invalid={Boolean(errors.phone)} {...register('phone')} />
          {errors.phone ? <p className="text-xs text-destructive">{errors.phone.message}</p> : null}
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="lead-address">Address</Label>
        <Input id="lead-address" placeholder="Area, city" {...register('address')} />
      </div>

      {services.length ? (
        <div className="space-y-1.5">
          <Label htmlFor="lead-service">What do you need?</Label>
          <Select value={watch('serviceId') || undefined} onValueChange={(v) => setValue('serviceId', v)}>
            <SelectTrigger id="lead-service"><SelectValue placeholder="Choose a service (optional)" /></SelectTrigger>
            <SelectContent>
              {services.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      ) : null}

      <div className="space-y-1.5">
        <Label htmlFor="lead-message">Describe the problem</Label>
        <Textarea id="lead-message" rows={3} placeholder="Where is the problem, and when did it start?" {...register('message')} />
      </div>

      <AnimatePresence>
        {serverError ? (
          <motion.p
            initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            role="alert"
            className="flex items-start gap-2 rounded-md bg-destructive/10 p-3 text-sm text-destructive"
          >
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /> {serverError}
          </motion.p>
        ) : null}
      </AnimatePresence>

      <Button type="submit" variant="gold" size="lg" className="w-full" loading={isLoading}>
        Request a free inspection
      </Button>
      <p className="text-center text-xs text-muted-foreground">
        Free consultation · No visiting charge · We call back within two hours
      </p>
    </form>
  );
}
