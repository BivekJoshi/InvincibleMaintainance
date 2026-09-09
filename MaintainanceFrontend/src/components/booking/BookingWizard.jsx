import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  AlertCircle, ArrowLeft, ArrowRight, CalendarCheck, Check, CheckCircle2, Clock, Phone, Search,
} from 'lucide-react';
import {
  useGetBootstrapQuery, useGetPublicServicesQuery, useGetAvailabilityQuery, useEstimateMutation, useSubmitLeadMutation,
} from '@/features/public/publicApi';
import { selectLocale } from '@/features/ui/uiSlice';
import { Button } from '@/components/ui/button';
import { Input, Textarea } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { DataIcon } from '@/components/site';
import { motion, AnimatePresence } from '@/components/motion';
import { formatNpr } from '@/lib/format';
import { cn } from '@/lib/utils';

const STEPS = ['Service', 'Size', 'Time', 'Details'];

const NEPAL_PHONE = /^(?:9[678]\d{8}|0\d{1,2}-?\d{6,7})$/;

const detailsSchema = z.object({
  name: z.string().trim().min(2, 'Please enter your name'),
  phone: z.string().trim()
    .transform((v) => v.replace(/[\s()]/g, '').replace(/^\+?977-?/, ''))
    .refine((v) => NEPAL_PHONE.test(v), 'Enter a valid Nepali number, e.g. 9808338255'),
  address: z.string().trim().min(4, 'Where should the engineer come?').max(400),
  message: z.string().trim().max(4000).optional(),
});

/** Kathmandu "today" as a YYYY-MM-DD key, so the calendar never offers yesterday. */
const KTM = 'Asia/Kathmandu';
const dayKey = (d) => new Intl.DateTimeFormat('en-CA', { timeZone: KTM }).format(d);

/**
 * The booking flow: service → size → slot → details. It creates a Lead with
 * `preferredAt`/`preferredSlot`, so a booking lands in the same SLA queue and
 * pipeline as every other enquiry rather than in a parallel system.
 */
export function BookingWizard({ slug }) {
  const locale = useSelector(selectLocale);
  const navigate = useNavigate();
  const { data: boot } = useGetBootstrapQuery(locale);
  const { data: catalogue, isLoading } = useGetPublicServicesQuery({ locale });
  const [runEstimate, { data: estimate, reset: resetEstimate, isLoading: estimating }] = useEstimateMutation();
  const [submitLead, { isLoading: submitting }] = useSubmitLeadMutation();

  const services = catalogue?.items ?? [];
  const booking = boot?.booking ?? { slots: [], closedWeekdays: [6], maxDaysAhead: 30 };

  const [step, setStep] = useState(slug ? 1 : 0);
  const [serviceId, setServiceId] = useState('');
  const [query, setQuery] = useState('');
  const [qty, setQty] = useState('');
  const [date, setDate] = useState(null);
  const [slot, setSlot] = useState(null);
  const [serverError, setServerError] = useState(null);
  const [done, setDone] = useState(null);
  const topRef = useRef(null);

  const service = services.find((s) => s.id === serviceId) ?? null;

  useEffect(() => {
    const el = topRef.current;
    if (!el) return;
    const top = el.getBoundingClientRect().top + window.scrollY - 140;
    if (window.scrollY > top) {
      const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      window.scrollTo({ top, behavior: reduced ? 'auto' : 'smooth' });
    }
  }, [step, done]);

  // A slug in the URL preselects the service, once the catalogue arrives.
  useEffect(() => {
    if (!slug || serviceId || !services.length) return;
    const match = services.find((s) => s.slug === slug);
    if (match) setServiceId(match.id);
  }, [slug, services, serviceId]);

  const days = useMemo(() => buildDays(booking), [booking]);
  // An availability outage must never block a booking — this is a funnel, so a
  // failed query degrades to "everything is available" rather than an empty calendar.
  const { data: availability } = useGetAvailabilityQuery({ days: 14 });

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return services;
    return services.filter((s) => `${s.name} ${s.excerpt ?? ''} ${s.category?.name ?? ''}`.toLowerCase().includes(needle));
  }, [services, query]);

  const form = useForm({
    resolver: zodResolver(detailsSchema),
    defaultValues: { name: '', phone: '', address: '', message: '' },
  });

  const priceable = Boolean(service?.priceFrom);
  const canNext = [Boolean(serviceId), !priceable || Boolean(qty), Boolean(date && slot)][step] ?? true;

  const next = async () => {
    if (step === 1 && priceable && qty) {
      await runEstimate({ serviceId, qty: Number(qty) }).unwrap().catch(() => null);
    }
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
  };

  const submit = async (values) => {
    setServerError(null);
    // The slot's start hour in Kathmandu, expressed as the UTC instant the API stores.
    const startHour = booking.slots.find((s) => s.key === slot)?.startHour ?? 9;
    const preferredAt = new Date(`${date}T${String(startHour).padStart(2, '0')}:00:00+05:45`).toISOString();

    try {
      await submitLead({
        ...values,
        serviceId: serviceId || undefined,
        preferredAt,
        preferredSlot: slot,
        sourcePage: slug ? `/book/${slug}` : '/book',
        elapsedMs: 60_000,
        website: '',
        ...(estimate ? { estimatedAmount: estimate.max / 100, estimatePayload: estimate } : {}),
      }).unwrap();
      setDone({ date, slot, service });
    } catch (err) {
      setServerError(err?.data?.error?.message ?? 'We could not save that. Please call us instead.');
    }
  };

  if (done) return <BookingConfirmation booking={done} slots={booking.slots} onRestart={() => navigate('/services')} />;

  return (
    <div ref={topRef} className="grid gap-8 lg:grid-cols-[1fr_340px] lg:items-start">
      <div>
        <Stepper step={step} onStep={setStep} />

        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, x: 16 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -16 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            className="mt-8"
          >
            {step === 0 ? (
              <StepService
                services={filtered}
                media={catalogue?.media}
                loading={isLoading}
                query={query}
                onQuery={setQuery}
                value={serviceId}
                onChange={(id) => { setServiceId(id); resetEstimate(); setQty(''); }}
              />
            ) : null}

            {step === 1 ? (
              <StepSize
                service={service}
                qty={qty}
                onQty={(v) => { setQty(v); resetEstimate(); }}
                estimate={estimate}
                estimating={estimating}
              />
            ) : null}

            {step === 2 ? (
              <StepWhen days={days} slots={booking.slots} availability={availability} date={date} slot={slot} onDate={setDate} onSlot={setSlot} />
            ) : null}

            {step === 3 ? (
              <StepDetails form={form} onSubmit={submit} submitting={submitting} serverError={serverError} />
            ) : null}
          </motion.div>
        </AnimatePresence>

        <div className="mt-8 flex items-center justify-between gap-3 border-t pt-5">
          <Button
            type="button" variant="ghost"
            onClick={() => setStep((s) => Math.max(s - 1, 0))}
            disabled={step === 0}
          >
            <ArrowLeft className="h-4 w-4" /> Back
          </Button>

          {step < STEPS.length - 1 ? (
            <Button type="button" onClick={next} disabled={!canNext} loading={estimating}>
              Continue <ArrowRight className="h-4 w-4" />
            </Button>
          ) : (
            <Button type="submit" form="booking-details" loading={submitting}>
              Confirm booking <Check className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      <BookingSummary
        service={service}
        qty={qty}
        estimate={estimate}
        date={date}
        slot={slot}
        slots={booking.slots}
      />
    </div>
  );
}

// ── steps ──────────────────────────────────────────────────────────────────────

function Stepper({ step, onStep }) {
  return (
    <ol className="flex items-center gap-2">
      {STEPS.map((label, i) => {
        const state = i === step ? 'current' : i < step ? 'done' : 'todo';
        return (
          <li key={label} className="flex flex-1 items-center gap-2">
            <button
              type="button"
              onClick={() => i < step && onStep(i)}
              disabled={i > step}
              className={cn(
                'flex items-center gap-2 rounded-full px-1 text-left text-xs font-medium transition-colors',
                state === 'todo' && 'text-muted-foreground',
                i < step && 'hover:text-primary',
              )}
            >
              <span className={cn(
                'grid h-6 w-6 shrink-0 place-items-center rounded-full border text-[11px] font-bold transition-colors',
                state === 'current' && 'border-primary bg-primary text-primary-foreground',
                state === 'done' && 'border-primary bg-primary/10 text-primary',
                state === 'todo' && 'border-border text-muted-foreground',
              )}>
                {state === 'done' ? <Check className="h-3 w-3" aria-hidden /> : i + 1}
              </span>
              <span className="hidden sm:block">{label}</span>
            </button>
            {i < STEPS.length - 1 ? (
              <span className={cn('h-px flex-1 transition-colors', i < step ? 'bg-primary' : 'bg-border')} aria-hidden />
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}

function StepService({ services, media, loading, query, onQuery, value, onChange }) {
  return (
    <div>
      <h2 className="text-xl font-bold tracking-tight">What do you need done?</h2>
      <p className="mt-1 text-sm text-muted-foreground">Pick the closest match. The engineer confirms the scope on site.</p>

      <div className="relative mt-5">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
        <input
          type="search"
          value={query}
          onChange={(e) => onQuery(e.target.value)}
          placeholder="Search services"
          aria-label="Search services"
          className="h-10 w-full rounded-md border bg-card pl-10 pr-3 text-sm outline-none focus:border-primary"
        />
      </div>

      {loading ? (
        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-lg" />)}
        </div>
      ) : (
        <div className="mt-4 grid max-h-[420px] gap-2 overflow-y-auto pr-1 sm:grid-cols-2">
          {services.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => onChange(s.id)}
              aria-pressed={value === s.id}
              className={cn(
                'flex items-start gap-3 rounded-lg border bg-card p-3.5 text-left transition-all',
                value === s.id ? 'border-primary ring-1 ring-primary/25' : 'hover:border-primary/40',
              )}
            >
              <span className={cn(
                'mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-full transition-colors',
                value === s.id ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground',
              )}>
                <DataIcon name={s.icon} className="h-4 w-4" />
              </span>
              <span className="min-w-0">
                <span className="block truncate text-[14px] font-semibold tracking-tight">{s.name}</span>
                <span className="mt-0.5 block text-[12px] text-muted-foreground">
                  {s.priceFrom
                    ? `From ${formatNpr(s.priceFrom, { compact: true })}${s.priceUnit ? ` / ${s.priceUnit}` : ''}`
                    : 'Priced after inspection'}
                </span>
              </span>
            </button>
          ))}
          {services.length ? null : (
            <p className="col-span-full rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
              Nothing matched. Clear the search, or continue and describe the job in your own words.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function StepSize({ service, qty, onQty, estimate, estimating }) {
  if (!service) return null;
  if (!service.priceFrom) {
    return (
      <div>
        <h2 className="text-xl font-bold tracking-tight">This one is priced on inspection</h2>
        <p className="mt-2 max-w-lg text-sm leading-relaxed text-muted-foreground">
          {service.name} varies too much to publish a rate. The free visit produces a written,
          itemised quotation before anything starts — you are not committing to a figure now.
        </p>
      </div>
    );
  }

  return (
    <div>
      <h2 className="text-xl font-bold tracking-tight">How big is the job?</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        A rough number is fine — it only sets the indicative range. The engineer measures on site.
      </p>

      <div className="mt-5 max-w-xs space-y-1.5">
        <Label htmlFor="booking-qty">Approximate {service.priceUnit ?? 'quantity'}</Label>
        <Input
          id="booking-qty" type="number" inputMode="decimal" min="1" step="any"
          value={qty} onChange={(e) => onQty(e.target.value)} placeholder="e.g. 540"
        />
        <p className="text-xs text-muted-foreground">
          Published rate: {formatNpr(service.priceFrom, { compact: true })}
          {service.priceTo ? ` – ${formatNpr(service.priceTo, { compact: true, symbol: false })}` : ''}
          {service.priceUnit ? ` per ${service.priceUnit}` : ''}
        </p>
      </div>

      <AnimatePresence>
        {estimate && !estimating ? (
          <motion.div
            initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="mt-6 max-w-md rounded-xl border border-gold/40 bg-gold/[0.07] p-5"
          >
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Indicative range for {estimate.qty} {estimate.unit}
            </p>
            <p className="mt-1.5 text-2xl font-bold tabular-nums">
              {formatNpr(estimate.min, { compact: true })}
              <span className="text-muted-foreground"> – </span>
              {formatNpr(estimate.max, { compact: true, symbol: false })}
            </p>
            <p className="mt-2 border-t border-gold/25 pt-2 text-xs text-muted-foreground">{estimate.disclaimer}</p>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

function StepWhen({ days, slots, availability, date, slot, onDate, onSlot }) {
  const byDate = new Map((availability?.days ?? []).map((d) => [d.date, d]));
  const dayInfo = byDate.get(date);
  const remaining = (slotKey) => {
    const info = dayInfo?.slots?.find((x) => x.key === slotKey);
    return info ? { left: Math.max(0, info.capacity - info.booked), isFull: info.isFull } : null;
  };

  return (
    <div>
      <h2 className="text-xl font-bold tracking-tight">When suits you?</h2>
      <p className="mt-1 text-sm text-muted-foreground">Pick a day and a window. We confirm the exact time when we call.</p>

      <div className="no-scrollbar mt-5 flex gap-2 overflow-x-auto pb-1">
        {days.map((d) => {
          const full = byDate.get(d.key)?.isFull ?? false;
          return (
          <button
            key={d.key}
            type="button"
            onClick={() => onDate(d.key)}
            aria-pressed={date === d.key}
            title={full ? 'Fully booked — call us and we will fit you in' : undefined}
            className={cn(
              'flex w-16 shrink-0 flex-col items-center gap-0.5 rounded-lg border bg-card py-2.5 transition-all',
              date === d.key ? 'border-primary bg-primary text-primary-foreground' : 'hover:border-primary/40',
              full && date !== d.key && 'opacity-50',
            )}
          >
            <span className={cn('text-[10px] uppercase tracking-wide', date === d.key ? 'text-primary-foreground/80' : 'text-muted-foreground')}>
              {d.weekday}
            </span>
            <span className="text-lg font-bold leading-none tabular-nums">{d.day}</span>
            <span className={cn('text-[10px]', date === d.key ? 'text-primary-foreground/80' : 'text-muted-foreground')}>{d.month}</span>
          </button>
          );
        })}
      </div>

      <div className="mt-6 grid gap-2 sm:grid-cols-3">
        {slots.map((s) => {
          const info = remaining(s.key);
          return (
          <button
            key={s.key}
            type="button"
            onClick={() => onSlot(s.key)}
            aria-pressed={slot === s.key}
            className={cn(
              'flex items-center gap-3 rounded-lg border bg-card p-3.5 text-left transition-all',
              slot === s.key ? 'border-primary ring-1 ring-primary/25' : 'hover:border-primary/40',
              info?.isFull && slot !== s.key && 'opacity-60',
            )}
          >
            <Clock className={cn('h-4 w-4 shrink-0', slot === s.key ? 'text-primary' : 'text-muted-foreground')} aria-hidden />
            <span className="min-w-0">
              <span className="block text-[14px] font-semibold tracking-tight">{s.label}</span>
              <span className="block text-[12px] text-muted-foreground">{s.window}</span>
              {info ? (
                <span className={cn('mt-0.5 block text-[11px]', info.isFull ? 'text-amber-600 dark:text-amber-500' : 'text-emerald-600 dark:text-emerald-500')}>
                  {info.isFull ? 'Busy — we will call to confirm' : `${info.left} visit${info.left === 1 ? '' : 's'} left`}
                </span>
              ) : null}
            </span>
          </button>
          );
        })}
      </div>

      <p className="mt-4 text-xs text-muted-foreground">
        Times are Kathmandu local. We call to confirm within two hours of your booking.
      </p>
    </div>
  );
}

function StepDetails({ form, onSubmit, submitting, serverError }) {
  const { register, handleSubmit, formState: { errors } } = form;
  return (
    <form id="booking-details" onSubmit={handleSubmit(onSubmit)} className="max-w-lg space-y-4" noValidate>
      <div>
        <h2 className="text-xl font-bold tracking-tight">Where should we come?</h2>
        <p className="mt-1 text-sm text-muted-foreground">The visit is free, and nothing is charged before you approve a quotation.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="book-name" required>Your name</Label>
          <Input id="book-name" aria-invalid={Boolean(errors.name)} {...register('name')} />
          {errors.name ? <p className="text-xs text-destructive">{errors.name.message}</p> : null}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="book-phone" required>Phone number</Label>
          <Input id="book-phone" type="tel" inputMode="tel" placeholder="9808338255" aria-invalid={Boolean(errors.phone)} {...register('phone')} />
          {errors.phone ? <p className="text-xs text-destructive">{errors.phone.message}</p> : null}
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="book-address" required>Address</Label>
        <Input id="book-address" placeholder="Area, street, landmark" aria-invalid={Boolean(errors.address)} {...register('address')} />
        {errors.address ? <p className="text-xs text-destructive">{errors.address.message}</p> : null}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="book-message">Anything we should know?</Label>
        <Textarea id="book-message" rows={3} placeholder="Where is the problem, and when did it start?" {...register('message')} />
      </div>

      {serverError ? (
        <p role="alert" className="flex items-start gap-2 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden /> {serverError}
        </p>
      ) : null}

    </form>
  );
}

// ── summary and confirmation ───────────────────────────────────────────────────

function BookingSummary({ service, qty, estimate, date, slot, slots }) {
  const slotLabel = slots.find((s) => s.key === slot);
  return (
    <aside className="lg:sticky lg:top-40">
      <div className="overflow-hidden rounded-xl border bg-card">
        <p className="border-b bg-muted/50 px-5 py-3 text-sm font-semibold">Your booking</p>
        <dl className="divide-y text-sm">
          <Row label="Service" value={service?.name ?? 'Not chosen yet'} />
          {service?.priceFrom ? (
            <Row label={`Size (${service.priceUnit ?? 'qty'})`} value={qty || '—'} />
          ) : null}
          <Row
            label="Estimate"
            value={estimate
              ? `${formatNpr(estimate.min, { compact: true })} – ${formatNpr(estimate.max, { compact: true, symbol: false })}`
              : (service && !service.priceFrom ? 'After inspection' : '—')}
          />
          <Row label="Date" value={date ? formatDayKey(date) : '—'} />
          <Row label="Window" value={slotLabel ? `${slotLabel.label} · ${slotLabel.window}` : '—'} />
        </dl>
        <div className="border-t bg-muted/30 px-5 py-4">
          <ul className="space-y-1.5 text-xs text-muted-foreground">
            {['No visiting charge', 'Written estimate before any work', '1-month warranty on the work'].map((p) => (
              <li key={p} className="flex gap-2"><Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-gold" aria-hidden /> {p}</li>
            ))}
          </ul>
        </div>
      </div>
    </aside>
  );
}

function Row({ label, value }) {
  return (
    <div className="flex items-start justify-between gap-4 px-5 py-3">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="max-w-[60%] text-right font-medium">{value}</dd>
    </div>
  );
}

function BookingConfirmation({ booking, slots, onRestart }) {
  const slot = slots.find((s) => s.key === booking.slot);
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
      className="mx-auto max-w-xl text-center"
    >
      <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-primary/10">
        <CheckCircle2 className="h-7 w-7 text-primary" aria-hidden />
      </span>
      <h2 className="mt-5 text-2xl font-bold tracking-tight">Booking received</h2>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
        We will call within two hours to confirm the visit. There is no charge for the inspection.
      </p>

      <div className="mt-6 rounded-xl border bg-card p-5 text-left text-sm">
        <p className="flex items-center gap-2 font-semibold">
          <CalendarCheck className="h-4 w-4 text-primary" aria-hidden />
          {formatDayKey(booking.date)}{slot ? ` · ${slot.label} (${slot.window})` : ''}
        </p>
        {booking.service ? (
          <p className="mt-2 text-muted-foreground">{booking.service.name}</p>
        ) : null}
      </div>

      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <Button asChild><Link to="/services">Browse more services</Link></Button>
        <Button variant="outline" onClick={onRestart}>Book something else</Button>
      </div>
    </motion.div>
  );
}

// ── dates ──────────────────────────────────────────────────────────────────────

/** The next N open days, skipping the weekdays the business is closed. */
function buildDays({ closedWeekdays = [6], maxDaysAhead = 30 }) {
  const out = [];
  const now = new Date();
  for (let i = 0; i < maxDaysAhead && out.length < 14; i += 1) {
    const d = new Date(now.getTime() + i * 86400000);
    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone: KTM, weekday: 'short', day: '2-digit', month: 'short',
    }).formatToParts(d);
    const get = (t) => parts.find((p) => p.type === t)?.value ?? '';
    const weekdayIndex = new Date(`${dayKey(d)}T12:00:00+05:45`).getUTCDay();
    if (closedWeekdays.includes(weekdayIndex)) continue;
    out.push({ key: dayKey(d), weekday: i === 0 ? 'Today' : get('weekday'), day: get('day'), month: get('month') });
  }
  return out;
}

function formatDayKey(key) {
  if (!key) return '—';
  return new Date(`${key}T12:00:00+05:45`).toLocaleDateString('en-GB', {
    weekday: 'short', day: '2-digit', month: 'short', year: 'numeric', timeZone: KTM,
  });
}
