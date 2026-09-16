import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { ArrowLeft, ArrowRight, Check } from 'lucide-react';
import {
  useEstimateMutation, useGetAvailabilityQuery, useGetBootstrapQuery,
  useGetPublicServicesQuery, useSubmitLeadMutation,
} from '@/api/publicApi';
import { selectLocale } from '@/redux/slices/uiSlice';
import { useZodForm, bookingDetailsSchema, bookingDetailsDefaults } from '@/form/formKit';
import { Button } from '@/components/ui/button';
import { AnimatePresence, EASE, motion } from '@/three/motion/motionKit';
import { BookingConfirmation } from './BookingConfirmation';
import { BookingStepper } from './BookingStepper';
import { BookingSummary } from './BookingSummary';
import { buildDays, preferredAtIso } from './bookingDays';
import { StepDetails } from './steps/StepDetails';
import { StepService } from './steps/StepService';
import { StepSize } from './steps/StepSize';
import { StepWhen } from './steps/StepWhen';

const STEPS = ['Service', 'Size', 'Time', 'Details'];

/** What the API is asked for when `/public/bootstrap` has not answered yet. */
const DEFAULT_BOOKING = { slots: [], closedWeekdays: [6], maxDaysAhead: 30 };

/**
 * The booking flow: service → size → slot → details.
 *
 * It creates a Lead with `preferredAt`/`preferredSlot`, so a booking lands in
 * the same SLA queue and pipeline as every other enquiry rather than in a
 * parallel system nobody watches.
 *
 * This file holds what the four steps share — the answers so far, which step is
 * on screen, and the one submit at the end. Each step is its own file under
 * `./steps/` and receives only what it renders, which is what lets a step be
 * read, or changed, without the other three in view.
 */
export function BookingWizard({ slug }) {
  const locale = useSelector(selectLocale);
  const navigate = useNavigate();
  const { data: boot } = useGetBootstrapQuery(locale);
  const { data: catalogue, isLoading } = useGetPublicServicesQuery({ locale });
  const [runEstimate, { data: estimate, reset: resetEstimate, isLoading: estimating }] = useEstimateMutation();
  const [submitLead, { isLoading: submitting }] = useSubmitLeadMutation();
  // An availability outage must never block a booking — this is a funnel, so a
  // failed query degrades to "everything is available" rather than an empty calendar.
  const { data: availability } = useGetAvailabilityQuery({ days: 14 });

  // Memoised: a fresh `[]` every render would re-run the slug effect and the filter below each time.
  const services = useMemo(() => catalogue?.items ?? [], [catalogue]);
  const booking = boot?.booking ?? DEFAULT_BOOKING;

  const [step, setStep] = useState(slug ? 1 : 0);
  const [serviceId, setServiceId] = useState('');
  const [query, setQuery] = useState('');
  const [qty, setQty] = useState('');
  const [date, setDate] = useState(null);
  const [slot, setSlot] = useState(null);
  const [serverError, setServerError] = useState(null);
  const [done, setDone] = useState(null);
  const topRef = useRef(null);
  // When the wizard opened. The API refuses a submit that arrives faster than a
  // person could fill the form, so it must get the real figure, not a constant.
  const openedAt = useRef(0);

  const service = services.find((s) => s.id === serviceId) ?? null;
  const form = useZodForm(bookingDetailsSchema, { defaultValues: bookingDetailsDefaults });

  useEffect(() => { openedAt.current = Date.now(); }, []);

  // Changing step swaps the panel; if the visitor has scrolled past its top,
  // bring it back rather than leaving them looking at the middle of a form.
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

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return services;
    return services.filter((s) =>
      `${s.name} ${s.excerpt ?? ''} ${s.category?.name ?? ''}`.toLowerCase().includes(needle));
  }, [services, query]);

  const priceable = Boolean(service?.priceFrom);
  const canNext = [Boolean(serviceId), !priceable || Boolean(qty), Boolean(date && slot)][step] ?? true;

  const next = async () => {
    // The estimate is fetched on the way out of the size step, so the summary
    // and the next panel both already have it.
    if (step === 1 && priceable && qty) {
      await runEstimate({ serviceId, qty: Number(qty) }).unwrap().catch(() => null);
    }
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
  };

  const submit = async (values) => {
    setServerError(null);
    const startHour = booking.slots.find((s) => s.key === slot)?.startHour ?? 9;

    try {
      await submitLead({
        ...values,
        // The language they booked in is the language we write back in.
        preferredLocale: locale,
        serviceId: serviceId || undefined,
        preferredAt: preferredAtIso(date, startHour),
        preferredSlot: slot,
        sourcePage: slug ? `/book/${slug}` : '/book',
        elapsedMs: Date.now() - openedAt.current,
        website: '',
        ...(estimate ? { estimatedAmount: estimate.max / 100, estimatePayload: estimate } : {}),
      }).unwrap();
      setDone({ date, slot, service });
    } catch (err) {
      setServerError(err?.data?.error?.message ?? 'We could not save that. Please call us instead.');
    }
  };

  if (done) {
    return <BookingConfirmation booking={done} slots={booking.slots} onRestart={() => navigate('/services')} />;
  }

  return (
    <div ref={topRef} className="grid gap-8 lg:grid-cols-[1fr_340px] lg:items-start">
      <div>
        <BookingStepper steps={STEPS} step={step} onStep={setStep} />

        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, x: 16 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -16 }}
            transition={{ duration: 0.25, ease: EASE }}
            className="mt-8"
          >
            {step === 0 ? (
              <StepService
                services={filtered}
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
              <StepWhen
                days={days}
                slots={booking.slots}
                availability={availability}
                date={date}
                slot={slot}
                onDate={setDate}
                onSlot={setSlot}
              />
            ) : null}

            {step === 3 ? (
              <StepDetails form={form} onSubmit={submit} serverError={serverError} />
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
            // Outside the form, so it sits beside "Back" — see StepDetails.
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
