import { Link } from 'react-router-dom';
import { CalendarCheck, CheckCircle2 } from 'lucide-react';
import { motion } from '@/three/motion/motionKit';
import { Button } from '@/components/ui/button';
import { SITE } from '@/config/i18n/site';
import { useT } from '@/hooks/useT';
import { formatDayKey, slotName } from './bookingDays';

/**
 * What replaces the wizard once the lead is saved.
 *
 * It repeats the day and window back, because the next thing the customer does
 * is write it down — and it promises the call within two hours, which is the
 * SLA the back office is now holding.
 */
export function BookingConfirmation({ booking, slots, onRestart }) {
  const t = useT(SITE);
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
      <h2 className="mt-5 text-2xl font-bold tracking-tight">{t('booking.done.title')}</h2>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{t('booking.done.body')}</p>

      <div className="mt-6 rounded-xl border bg-card p-5 text-left text-sm">
        <p className="flex items-center gap-2 font-semibold">
          <CalendarCheck className="h-4 w-4 shrink-0 text-primary" aria-hidden />
          {formatDayKey(booking.date, { locale: t.locale })}{slot ? ` · ${slotName(t, slot)} (${slot.window})` : ''}
        </p>
        {booking.service ? <p className="mt-2 text-muted-foreground">{booking.service.name}</p> : null}
      </div>

      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <Button asChild><Link to="/services">{t('booking.done.more')}</Link></Button>
        <Button variant="outline" onClick={onRestart}>{t('booking.done.again')}</Button>
      </div>
    </motion.div>
  );
}
