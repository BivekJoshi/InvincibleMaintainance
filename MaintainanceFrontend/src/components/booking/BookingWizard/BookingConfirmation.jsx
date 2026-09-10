import { Link } from 'react-router-dom';
import { CalendarCheck, CheckCircle2 } from 'lucide-react';
import { motion } from '@/three/motion/motionKit';
import { Button } from '@/components/ui/button';
import { formatDayKey } from './bookingDays';

/**
 * What replaces the wizard once the lead is saved.
 *
 * It repeats the day and window back, because the next thing the customer does
 * is write it down — and it promises the call within two hours, which is the
 * SLA the back office is now holding.
 */
export function BookingConfirmation({ booking, slots, onRestart }) {
  const slot = slots.find((s) => s.key === booking.slot);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
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
        {booking.service ? <p className="mt-2 text-muted-foreground">{booking.service.name}</p> : null}
      </div>

      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <Button asChild><Link to="/services">Browse more services</Link></Button>
        <Button variant="outline" onClick={onRestart}>Book something else</Button>
      </div>
    </motion.div>
  );
}
