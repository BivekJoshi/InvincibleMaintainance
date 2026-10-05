import { Clock } from 'lucide-react';
import { SITE } from '@/config/i18n/site';
import { useT } from '@/hooks/useT';
import { cn } from '@/helpers/utils';
import { slotName } from '../bookingDays';

/**
 * Step three: when.
 *
 * Capacity is shown but never enforced in the browser: a full day is dimmed and
 * says we will call to confirm, and remains selectable. This is a funnel — a
 * customer who wants Saturday should be able to ask for Saturday, and dispatch
 * can move them. An availability outage degrades the same way, to no badges at
 * all rather than to an empty calendar.
 *
 * A day's weekday and month come worded from `buildDays`, and a day tile grows to fit them — "सेप्टेम्बर" is wider
 * than "Sept". A window is named by its key (`slotName`); its hours are shown as the API sends them.
 */
export function StepWhen({ days, slots, availability, date, slot, onDate, onSlot }) {
  const t = useT(SITE);
  const byDate = new Map((availability?.days ?? []).map((d) => [d.date, d]));
  const dayInfo = byDate.get(date);

  const remaining = (slotKey) => {
    const info = dayInfo?.slots?.find((x) => x.key === slotKey);
    return info ? { left: Math.max(0, info.capacity - info.booked), isFull: info.isFull } : null;
  };

  return (
    <div>
      <h2 className="text-xl font-bold tracking-tight">{t('booking.when.title')}</h2>
      <p className="mt-1 text-sm text-muted-foreground">{t('booking.when.description')}</p>

      <div className="no-scrollbar mt-5 flex gap-2 overflow-x-auto pb-1">
        {days.map((d) => {
          const full = byDate.get(d.key)?.isFull ?? false;
          const on = date === d.key;
          return (
            <button
              key={d.key}
              type="button"
              onClick={() => onDate(d.key)}
              aria-pressed={on}
              title={full ? t('booking.when.full') : undefined}
              className={cn(
                'flex min-w-16 shrink-0 flex-col items-center gap-0.5 rounded-lg border bg-card px-2 py-2.5 transition-all',
                on ? 'border-primary bg-primary text-primary-foreground' : 'hover:border-primary/40',
                full && !on && 'opacity-50',
              )}
            >
              <span className={cn('text-[10px] uppercase tracking-wide', on ? 'text-primary-foreground/80' : 'text-muted-foreground')}>
                {d.isToday ? t('booking.when.today') : d.weekday}
              </span>
              <span className="text-lg font-bold leading-none tabular-nums">{d.day}</span>
              <span className={cn('text-[10px]', on ? 'text-primary-foreground/80' : 'text-muted-foreground')}>{d.month}</span>
            </button>
          );
        })}
      </div>

      <div className="mt-6 grid gap-2 sm:grid-cols-3">
        {slots.map((s) => {
          const info = remaining(s.key);
          const on = slot === s.key;
          return (
            <button
              key={s.key}
              type="button"
              onClick={() => onSlot(s.key)}
              aria-pressed={on}
              className={cn(
                'flex items-center gap-3 rounded-lg border bg-card p-3.5 text-left transition-all',
                on ? 'border-primary ring-1 ring-primary/25' : 'hover:border-primary/40',
                info?.isFull && !on && 'opacity-60',
              )}
            >
              <Clock className={cn('h-4 w-4 shrink-0', on ? 'text-primary' : 'text-muted-foreground')} aria-hidden />
              <span className="min-w-0">
                <span className="block text-[14px] font-semibold tracking-tight">{slotName(t, s)}</span>
                <span className="block text-[12px] text-muted-foreground">{s.window}</span>
                {info ? (
                  <span className={cn('mt-0.5 block text-[11px]', info.isFull ? 'text-warning' : 'text-success')}>
                    {info.isFull ? t('booking.when.busy') : t('booking.when.left', { count: info.left })}
                  </span>
                ) : null}
              </span>
            </button>
          );
        })}
      </div>

      <p className="mt-4 text-xs text-muted-foreground">{t('booking.when.note')}</p>
    </div>
  );
}
