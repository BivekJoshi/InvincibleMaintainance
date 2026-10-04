import { AgendaCard } from '@/components/agenda/AgendaItem';
import { AgendaOtherDate } from '@/components/agenda/AgendaOtherDate';
import { HOLIDAY, NE_WEEKDAY_NAMES, WEEKDAY_NAMES, cornerCell, dayNumber, readsBs, weekdayOf } from '@/helpers/agenda';
import { cn } from '@/helpers/utils';

/**
 * The week: a column a day, every item in full, in the order of the day. On a phone the days stack. A day's
 * heading picks it — the Month view then opens on that day.
 */
export function AgendaWeekGrid({ days, today, byDay, selectedDay, onSelectDay, now, label, calendar = 'ad' }) {
  return (
    <div role="group" aria-label={label} className="grid gap-2 sm:grid-cols-2 lg:grid-cols-7">
      {days.map((day) => {
        const items = byDay.get(day) ?? [];
        const isToday = day === today;
        const late = items.filter((i) => i.state === 'overdue').length;
        const corner = cornerCell(day, true, calendar);
        const nepali = readsBs(day, calendar);
        const weekday = weekdayOf(day);
        return (
          <section
            key={day}
            aria-label={`${WEEKDAY_NAMES[weekday]} ${dayNumber(day, calendar)}`}
            className={cn(
              'flex min-w-0 flex-col rounded-xl border bg-card shadow-[var(--elevation-1)] lg:min-h-[26rem]',
              weekday === HOLIDAY && 'bg-muted/40',
              isToday && 'border-primary/50 ring-1 ring-primary/30',
              day === selectedDay && 'ring-2 ring-primary',
            )}
          >
            <button
              type="button"
              onClick={() => onSelectDay(day)}
              aria-pressed={day === selectedDay}
              className="flex items-center gap-2 rounded-t-xl border-b px-2.5 py-2 text-left hover:bg-accent/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
            >
              <span
                lang={nepali ? 'ne' : undefined}
                className={cn(
                  'grid h-9 w-9 shrink-0 place-items-center rounded-full font-bold tabular-nums',
                  nepali ? 'text-base' : 'text-sm',
                  isToday ? 'bg-primary text-primary-foreground' : 'bg-muted',
                )}
              >
                {dayNumber(day, calendar)}
              </span>
              <span className="flex min-w-0 flex-col items-start gap-0.5 leading-tight">
                <span
                  lang={nepali && !isToday ? 'ne' : undefined}
                  className={cn(
                    'block font-semibold',
                    nepali && !isToday ? 'text-[13px]' : 'text-xs uppercase tracking-wide',
                    weekday === HOLIDAY ? 'text-sla-breach/80' : 'text-muted-foreground',
                  )}
                >
                  {isToday ? 'Today' : (nepali ? NE_WEEKDAY_NAMES : WEEKDAY_NAMES)[weekday]}
                </span>
                <AgendaOtherDate corner={corner} />
              </span>
              <span className="ml-auto flex items-center gap-1">
                {late ? <span className="rounded-full bg-destructive px-1.5 text-[10px] font-bold leading-4 text-destructive-foreground">{late}</span> : null}
                {items.length ? <span className="rounded-full bg-muted px-1.5 text-[10px] font-bold tabular-nums leading-4 text-muted-foreground">{items.length}</span> : null}
              </span>
            </button>
            <div className="flex flex-1 flex-col gap-1.5 p-1.5">
              {items.length
                ? items.map((item) => <AgendaCard key={item.key} item={item} now={now} calendar={calendar} dense />)
                : <p className="px-1 py-3 text-center text-xs text-muted-foreground/70">Nothing booked</p>}
            </div>
          </section>
        );
      })}
    </div>
  );
}
