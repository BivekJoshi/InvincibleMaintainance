import { useCallback, useEffect, useRef, useState } from 'react';
import { useDispatch } from 'react-redux';
import { useWatch } from 'react-hook-form';
import { CalendarCheck, Loader2, MessageSquareText } from 'lucide-react';
import { useConvertLeadMutation, useGetLeadCustomerMatchesQuery, useGetTechniciansQuery } from '@/api/leadsApi';
import { useGetBootstrapQuery, useGetAvailabilityQuery } from '@/api/publicApi';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { CustomerMatchChoice } from '@/components/leads/CustomerMatchChoice';
import { DayInput } from '@/components/common/DayInput';
import { visitBookedSms } from '@/components/leads/visitBookedCopy';
import { applyServerErrors } from '@/components/common/ResourceForm/serverErrors';
import { LANDMARK_PLACEHOLDER, SITE_CONTACT_HINT } from '@/config/admin/crmForms';
import { normalisePhone } from '@/config/locale';
import { nepaliPhone } from '@/form/schemas/fields';
import { visitBookingBody, visitBookingSchema, visitWindowIssue } from '@/form/schemas/lead.schema';
import { useZodForm } from '@/form/useZodForm';
import { displayCalendar } from '@/helpers/displayCalendar';
import { formatDate, fromKathmanduParts } from '@/helpers/format';
import { toastError, toastSuccess } from '@/redux/slices/uiSlice';
import { cn } from '@/helpers/utils';

const dayKey = (d) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kathmandu' }).format(d);
const hhmm = (hour) => `${String(hour).padStart(2, '0')}:00`;

/** A slot without an end hour gets a window this long. */
const DEFAULT_VISIT_HOURS = 2;

/** A booking slot's window as `HH:mm` start and end — the quick default the times start from. */
function slotTimes(slot) {
  if (!slot) return null;
  const end = slot.endHour ?? Math.min(slot.startHour + DEFAULT_VISIT_HOURS, 23);
  return { startTime: hhmm(slot.startHour), endTime: hhmm(end) };
}

/** The API's convert paths → this form's fields. */
const FORM_PATHS = { scheduledStart: 'startTime', scheduledEnd: 'endTime', 'site.address': 'address' };
const FIELD_NAMES = ['date', 'startTime', 'endTime', 'surveyorId', 'address', 'siteContactName', 'siteContactPhone', 'landmark'];

function FieldMessage({ id, message }) {
  return message ? <p id={id} className="text-xs text-destructive">{message}</p> : null;
}

/**
 * Turns a lead into a customer and books the free inspection. The lead page's Convert menu, the
 * outcome "Interested — book a visit" and a board drop on "Visit booked" all open it.
 *
 * When a customer already has the lead's phone, staff say "same person" or "different
 * person" first (`CustomerMatchChoice`); Book stays disabled until they do.
 *
 * The visit is a **window** (Phase L5): picking a slot fills its start and end (the slot's own hours, or
 * two hours from its start), and both times can be moved. The instants are built from the day and the
 * times at Kathmandu's +05:45 (`visitBookingBody`) — the offset is not a whole number of hours, so the
 * browser's clock would land the visit in the wrong slot. An end at or before the start is refused (Book
 * disabled, the reason under the end). The site contact (the caretaker when the owner is abroad) and a
 * landmark go with it when filled, and the SMS preview shows what `visit_booked` will say to the customer
 * (`visitBookedCopy.js`) — in their language, with en / ne to compare.
 */
export function ScheduleVisitDialog({ lead, open, onOpenChange, onScheduled }) {
  const dispatch = useDispatch();
  const [convert, { isLoading }] = useConvertLeadMutation();
  const { data: boot, isLoading: bootLoading } = useGetBootstrapQuery('en');
  const { data: availability } = useGetAvailabilityQuery({ days: 14 });
  // Filtered server-side: Technician carries no role, so this joins through the user.
  const { data: technicians } = useGetTechniciansQuery({ role: 'SURVEYOR', available: true });
  // The same request CustomerMatchChoice makes (one cache entry): whose name and language the SMS takes.
  const { data: matches } = useGetLeadCustomerMatchesQuery(lead.id, { skip: Boolean(lead.customerId) });

  const slots = boot?.booking?.slots;
  const surveyors = technicians?.items ?? [];
  const slotFor = useCallback((key) => slots?.find((s) => s.key === key) ?? slots?.[0], [slots]);

  const [slot, setSlot] = useState(lead.preferredSlot ?? slots?.[0]?.key ?? 'morning');
  const [choice, setChoice] = useState({ ready: false, body: {}, loading: true });
  const onChoice = useCallback((state) => setChoice(state), []);
  const [error, setError] = useState(null);
  const [pickedLocale, setPickedLocale] = useState(null);
  // Once staff move a time themselves, a late bootstrap no longer overwrites it.
  const timesEdited = useRef(false);

  const {
    register, control, setValue, handleSubmit, setError: setFieldError, formState: { errors },
  } = useZodForm(visitBookingSchema, {
    mode: 'onTouched',
    defaultValues: {
      date: lead.preferredAt ? dayKey(new Date(lead.preferredAt)) : dayKey(new Date()),
      startTime: '',
      endTime: '',
      ...slotTimes(slotFor(slot)),
      surveyorId: '',
      address: lead.address ?? '',
      siteContactName: '',
      siteContactPhone: '',
      landmark: '',
    },
  });
  const values = useWatch({ control });

  const applySlot = useCallback((key) => {
    const times = slotTimes(slotFor(key));
    if (!times) return;
    setValue('startTime', times.startTime, { shouldValidate: Boolean(errors.startTime) });
    setValue('endTime', times.endTime, { shouldValidate: Boolean(errors.endTime) });
  }, [slotFor, setValue, errors.startTime, errors.endTime]);

  // The bootstrap may land after the dialog opened: its slot's window fills the times still untouched.
  useEffect(() => {
    if (slots && !timesEdited.current) applySlot(slot);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only when the slots arrive
  }, [slots]);

  const pickSlot = (key) => {
    setSlot(key);
    timesEdited.current = false;
    applySlot(key);
  };
  const timeField = (name) => register(name, {
    onChange: () => { timesEdited.current = true; },
    ...(name === 'startTime' ? { deps: ['endTime'] } : {}),
  });

  const dayInfo = availability?.days?.find((d) => d.date === values.date);
  const slotInfo = dayInfo?.slots?.find((s) => s.key === slot);
  const windowIssue = visitWindowIssue(values.startTime, values.endTime);
  // The window's order is shown live; the schema's own copy of it (a `custom` issue) would only repeat it.
  const endError = windowIssue ?? (errors.endTime?.type === 'custom' ? null : errors.endTime?.message);

  // Who the SMS greets, in which language: the customer the convert lands on (convert.service#resolveCustomer).
  const match = matches?.find((c) => c.id === choice.body?.customerId);
  const customerLocale = choice.body?.preferredLocale ?? match?.preferredLocale ?? lead.customer?.preferredLocale
    ?? lead.preferredLocale ?? 'en';
  const smsLocale = pickedLocale ?? customerLocale;
  const customerName = match?.name ?? lead.customer?.name ?? lead.name;
  const customerPhone = normalisePhone(match?.phone ?? lead.customer?.phone ?? lead.phone ?? '');

  const picked = surveyors.find((t) => t.id === values.surveyorId);
  const surveyor = picked ? { name: picked.user?.name, phone: picked.user?.phone ?? picked.phone ?? null } : null;
  const start = values.date && /^\d{2}:\d{2}$/.test(values.startTime ?? '') ? fromKathmanduParts(values.date, values.startTime) : null;
  const end = start && !windowIssue && /^\d{2}:\d{2}$/.test(values.endTime ?? '') ? fromKathmanduParts(values.date, values.endTime) : null;
  const sms = start ? visitBookedSms({
    locale: smsLocale, name: customerName, start, end, surveyor, appName: boot?.settings?.['contact.companyName'] ?? '',
  }) : null;
  const contactPhone = nepaliPhone.safeParse(values.siteContactPhone ?? '');
  const alsoTo = contactPhone.success && contactPhone.data !== customerPhone
    ? { name: values.siteContactName?.trim() || 'the site contact', phone: contactPhone.data }
    : null;

  const submit = handleSubmit(async (parsed) => {
    setError(null);
    try {
      const result = await convert({ id: lead.id, ...choice.body, ...visitBookingBody(parsed) }).unwrap();
      dispatch(toastSuccess(
        `Visit booked — ${result.job?.number}`,
        result.survey ? `${result.survey.number} is ready for the surveyor.` : undefined,
      ));
      // Done before closed: a caller waiting on the dialog (the board's drop) tells completion from Cancel.
      onScheduled?.(result);
      onOpenChange(false);
    } catch (err) {
      const apiError = err?.data?.error;
      // A customer with this phone appeared since the dialog opened: the choice above reloads.
      if (apiError?.code === 'CUSTOMER_MATCH') {
        setError(apiError.message);
        return;
      }
      const alert = applyServerErrors(err, setFieldError, FIELD_NAMES, { mapPath: (p) => FORM_PATHS[p] ?? p });
      if (!alert.firstField) dispatch(toastError(apiError?.message ?? 'Could not book the visit', alert.details.join(' · ') || undefined));
    }
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Book the site visit</DialogTitle>
          <DialogDescription>
            Creates the customer, the free inspection job and the survey the surveyor fills in on site.
          </DialogDescription>
        </DialogHeader>

        <form id="book-visit" noValidate onSubmit={submit} className="space-y-4">
          {open ? <CustomerMatchChoice lead={lead} onChange={onChoice} /> : null}
          {error ? <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p> : null}

          {lead.preferredAt ? (
            <p className="flex items-center gap-2 rounded-md bg-muted px-3 py-2 text-sm">
              <CalendarCheck className="h-4 w-4 text-primary" aria-hidden />
              The customer asked for {formatDate(lead.preferredAt, { year: undefined })}
              {lead.preferredSlot ? `, ${lead.preferredSlot}` : ''}.
            </p>
          ) : null}

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="visit-date">Date</Label>
              {/* The Nepali calendar's picker while the account menu says so; the browser's own date box otherwise. */}
              {displayCalendar() === 'bs' ? (
                <DayInput
                  id="visit-date" value={values.date} min={dayKey(new Date())}
                  onChange={(day) => setValue('date', day, { shouldDirty: true, shouldValidate: Boolean(errors.date) })}
                  aria-invalid={errors.date ? true : undefined} aria-describedby={errors.date ? 'visit-date-error' : undefined}
                />
              ) : (
                <Input
                  id="visit-date" type="date" min={dayKey(new Date())} {...register('date')}
                  aria-invalid={errors.date ? true : undefined} aria-describedby={errors.date ? 'visit-date-error' : undefined}
                />
              )}
              <FieldMessage id="visit-date-error" message={errors.date?.message} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="visit-slot">Slot</Label>
              <Select value={slot} onValueChange={pickSlot}>
                <SelectTrigger id="visit-slot"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(slots ?? []).map((s) => {
                    const info = dayInfo?.slots?.find((x) => x.key === s.key);
                    return (
                      <SelectItem key={s.key} value={s.key}>
                        {s.label} · {s.window}
                        {info ? ` (${Math.max(0, info.capacity - info.booked)} left)` : ''}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>
          </div>

          <fieldset className="space-y-1.5">
            <legend className="text-sm font-medium leading-none">Time window <span className="font-normal text-muted-foreground">(Nepal time)</span></legend>
            <div className="grid grid-cols-2 gap-3 pt-1.5">
              <div className="space-y-1.5">
                <Label htmlFor="visit-start" className="text-xs text-muted-foreground">From</Label>
                <Input
                  id="visit-start" type="time" step={900} className="tabular-nums" {...timeField('startTime')}
                  aria-invalid={errors.startTime ? true : undefined}
                  aria-describedby={errors.startTime ? 'visit-start-error' : undefined}
                />
                <FieldMessage id="visit-start-error" message={errors.startTime?.message} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="visit-end" className="text-xs text-muted-foreground">Until</Label>
                <Input
                  id="visit-end" type="time" step={900} className="tabular-nums" {...timeField('endTime')}
                  aria-invalid={endError ? true : undefined} aria-describedby={endError ? 'visit-end-error' : undefined}
                />
                <FieldMessage id="visit-end-error" message={endError} />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">The customer is told to expect the surveyor between these times.</p>
          </fieldset>

          {slotInfo?.isFull ? (
            <p className={cn('rounded-md px-3 py-2 text-xs', 'surface-warning border')}>
              That slot is already full. You can still book it — the visit will need juggling.
            </p>
          ) : null}

          <div className="space-y-1.5">
            <Label htmlFor="visit-surveyor">Surveyor</Label>
            <Select
              value={values.surveyorId || 'none'}
              onValueChange={(v) => setValue('surveyorId', v === 'none' ? '' : v)}
            >
              <SelectTrigger id="visit-surveyor"><SelectValue placeholder="Assign later" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Assign later</SelectItem>
                {surveyors.map((t) => (
                  <SelectItem key={t.id} value={t.id}>{t.user?.name} · {t.employeeCode}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              They get an SMS with the address as soon as you book.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="visit-address">Site address</Label>
            <Input
              id="visit-address" maxLength={400} placeholder="Where the surveyor should go" {...register('address')}
              aria-invalid={errors.address ? true : undefined} aria-describedby={errors.address ? 'visit-address-error' : undefined}
            />
            <FieldMessage id="visit-address-error" message={errors.address?.message} />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="visit-contact-name">Site contact <span className="font-normal text-muted-foreground">(optional)</span></Label>
              <Input
                id="visit-contact-name" maxLength={120} placeholder="Name" {...register('siteContactName')}
                aria-invalid={errors.siteContactName ? true : undefined}
                aria-describedby={errors.siteContactName ? 'visit-contact-name-error visit-contact-hint' : 'visit-contact-hint'}
              />
              <FieldMessage id="visit-contact-name-error" message={errors.siteContactName?.message} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="visit-contact-phone">Site contact phone</Label>
              <Input
                id="visit-contact-phone" type="tel" inputMode="tel" placeholder="98XXXXXXXX"
                {...register('siteContactPhone', { deps: ['siteContactName'] })}
                aria-invalid={errors.siteContactPhone ? true : undefined}
                aria-describedby={errors.siteContactPhone ? 'visit-contact-phone-error visit-contact-hint' : 'visit-contact-hint'}
              />
              <FieldMessage id="visit-contact-phone-error" message={errors.siteContactPhone?.message} />
            </div>
            <p id="visit-contact-hint" className="text-xs text-muted-foreground sm:col-span-2">
              {SITE_CONTACT_HINT} — they get the SMS too.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="visit-landmark">Landmark <span className="font-normal text-muted-foreground">(optional)</span></Label>
            <Input
              id="visit-landmark" maxLength={200} placeholder={LANDMARK_PLACEHOLDER} {...register('landmark')}
              aria-invalid={errors.landmark ? true : undefined} aria-describedby={errors.landmark ? 'visit-landmark-error' : undefined}
            />
            <FieldMessage id="visit-landmark-error" message={errors.landmark?.message} />
          </div>

          <section aria-labelledby="visit-sms-title" className="space-y-2 rounded-lg border surface-info p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 id="visit-sms-title" className="flex items-center gap-2 text-sm font-medium">
                <MessageSquareText className="h-4 w-4" aria-hidden /> SMS to the customer
              </h3>
              <ToggleGroup
                type="single" size="sm" value={smsLocale} aria-label="SMS language"
                onValueChange={(v) => { if (v) setPickedLocale(v); }}
              >
                <ToggleGroupItem value="en">English</ToggleGroupItem>
                <ToggleGroupItem value="ne"><span lang="ne">नेपाली</span></ToggleGroupItem>
              </ToggleGroup>
            </div>
            {sms ? (
              <p lang={smsLocale} data-testid="visit-sms" className="whitespace-pre-wrap rounded-md bg-background p-2 text-sm">{sms}</p>
            ) : (
              <p className="text-sm text-muted-foreground">Pick the day and the window to see the message.</p>
            )}
            {alsoTo ? (
              <p className="text-xs">Also sent to {alsoTo.name} ({alsoTo.phone}).</p>
            ) : null}
            <p className="text-xs text-muted-foreground">
              Sent when you book. The link lets them confirm or ask for another time; the job number and link are made then.
            </p>
          </section>
        </form>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button type="submit" form="book-visit" disabled={isLoading || bootLoading || !values.date || !choice.ready || Boolean(windowIssue)}>
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <CalendarCheck className="h-4 w-4" />}
            Book visit
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
