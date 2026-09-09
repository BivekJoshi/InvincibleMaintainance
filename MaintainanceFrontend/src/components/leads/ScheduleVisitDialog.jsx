import { useState } from 'react';
import { useDispatch } from 'react-redux';
import { CalendarCheck, Loader2 } from 'lucide-react';
import { useConvertLeadMutation, useGetTechniciansQuery } from '@/features/leads/leadsApi';
import { useGetBootstrapQuery, useGetAvailabilityQuery } from '@/features/public/publicApi';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toastError, toastSuccess } from '@/features/ui/uiSlice';
import { cn } from '@/lib/utils';

const KTM_OFFSET = '+05:45';
const dayKey = (d) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kathmandu' }).format(d);

/**
 * Turns a lead into a customer and books the free inspection.
 *
 * The instant is built from the day plus the slot's own startHour at a literal
 * +05:45 — Kathmandu's offset is not a whole number of hours, so deriving it
 * from the browser's clock would land the visit in the wrong slot.
 */
export function ScheduleVisitDialog({ lead, open, onOpenChange, onScheduled }) {
  const dispatch = useDispatch();
  const [convert, { isLoading }] = useConvertLeadMutation();
  const { data: boot } = useGetBootstrapQuery('en');
  const { data: availability } = useGetAvailabilityQuery({ days: 14 });
  // Filtered server-side: Technician carries no role, so this joins through the user.
  const { data: technicians } = useGetTechniciansQuery({ role: 'SURVEYOR', available: true });

  const slots = boot?.booking?.slots ?? [];
  const surveyors = technicians?.items ?? [];

  const [date, setDate] = useState(() => (lead.preferredAt ? dayKey(new Date(lead.preferredAt)) : dayKey(new Date())));
  const [slot, setSlot] = useState(lead.preferredSlot ?? slots[0]?.key ?? 'morning');
  const [surveyorId, setSurveyorId] = useState('');
  const [address, setAddress] = useState(lead.address ?? '');

  const dayInfo = availability?.days?.find((d) => d.date === date);
  const slotInfo = dayInfo?.slots?.find((s) => s.key === slot);

  const submit = async () => {
    const startHour = slots.find((s) => s.key === slot)?.startHour ?? 8;
    const scheduledStart = new Date(`${date}T${String(startHour).padStart(2, '0')}:00:00${KTM_OFFSET}`).toISOString();
    try {
      const result = await convert({
        id: lead.id,
        createInspectionJob: true,
        scheduledStart,
        surveyorId: surveyorId || undefined,
        ...(address ? { site: { label: 'Primary site', address } } : {}),
      }).unwrap();
      dispatch(toastSuccess(
        `Visit booked — ${result.job?.number}`,
        result.survey ? `${result.survey.number} is ready for the surveyor.` : undefined,
      ));
      onOpenChange(false);
      onScheduled?.(result);
    } catch (err) {
      dispatch(toastError(err?.data?.error?.message ?? 'Could not book the visit'));
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Book the site visit</DialogTitle>
          <DialogDescription>
            Creates the customer, the free inspection job and the survey the surveyor fills in on site.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {lead.preferredAt ? (
            <p className="flex items-center gap-2 rounded-md bg-muted px-3 py-2 text-sm">
              <CalendarCheck className="h-4 w-4 text-primary" aria-hidden />
              The customer asked for {new Date(lead.preferredAt).toLocaleDateString('en-GB', { timeZone: 'Asia/Kathmandu', day: '2-digit', month: 'short' })}
              {lead.preferredSlot ? `, ${lead.preferredSlot}` : ''}.
            </p>
          ) : null}

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="visit-date">Date</Label>
              <Input id="visit-date" type="date" value={date} min={dayKey(new Date())} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="visit-slot">Time window</Label>
              <Select value={slot} onValueChange={setSlot}>
                <SelectTrigger id="visit-slot"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {slots.map((s) => {
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

          {slotInfo?.isFull ? (
            <p className={cn('rounded-md px-3 py-2 text-xs', 'bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300')}>
              That window is already full. You can still book it — the visit will need juggling.
            </p>
          ) : null}

          <div className="space-y-1.5">
            <Label htmlFor="visit-surveyor">Surveyor</Label>
            <Select value={surveyorId || 'none'} onValueChange={(v) => setSurveyorId(v === 'none' ? '' : v)}>
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
            <Input id="visit-address" value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Where the surveyor should go" />
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={submit} disabled={isLoading || !date}>
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <CalendarCheck className="h-4 w-4" />}
            Book visit
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
