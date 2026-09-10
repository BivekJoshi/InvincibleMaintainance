import { Clock } from 'lucide-react';
import { cn } from '@/helpers/utils';

/**
 * Step three: when.
 *
 * Capacity is shown but never enforced in the browser: a full day is dimmed and
 * says we will call to confirm, and remains selectable. This is a funnel — a
 * customer who wants Saturday should be able to ask for Saturday, and dispatch
 * can move them. An availability outage degrades the same way, to no badges at
 * all rather than to an empty calendar.
 */
export function StepWhen({ days, slots, availability, date, slot, onDate, onSlot }) {
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
          const on = date === d.key;
          return (
            <button
              key={d.key}
              type="button"
              onClick={() => onDate(d.key)}
              aria-pressed={on}
              title={full ? 'Fully booked — call us and we will fit you in' : undefined}
              className={cn(
                'flex w-16 shrink-0 flex-col items-center gap-0.5 rounded-lg border bg-card py-2.5 transition-all',
                on ? 'border-primary bg-primary text-primary-foreground' : 'hover:border-primary/40',
                full && !on && 'opacity-50',
              )}
            >
              <span className={cn('text-[10px] uppercase tracking-wide', on ? 'text-primary-foreground/80' : 'text-muted-foreground')}>
                {d.weekday}
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
                <span className="block text-[14px] font-semibold tracking-tight">{s.label}</span>
                <span className="block text-[12px] text-muted-foreground">{s.window}</span>
                {info ? (
                  <span className={cn('mt-0.5 block text-[11px]', info.isFull ? 'text-warning' : 'text-success')}>
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
