import { CalendarCheck2 } from 'lucide-react';
import { AgendaCard } from '@/components/agenda/AgendaItem';
import { AgendaOtherDate } from '@/components/agenda/AgendaOtherDate';
import { EmptyState } from '@/components/common/EmptyState';
import { cornerCell, dayHeading, readsBs } from '@/helpers/agenda';
import { cn } from '@/helpers/utils';

/**
 * Days in order, each with its items in full — the List view: the month's days that have something, headed in the
 * calendar on screen with the other calendar's date beside. Each day's heading stays in view while its items scroll.
 */
export function AgendaDayList({ days, byDay, today, now, calendar = 'ad', empty = 'Nothing booked in these days.', className }) {
  const filled = days.filter((day) => byDay.get(day)?.length);
  if (!filled.length) {
    return <EmptyState icon={CalendarCheck2} title="All clear" description={empty} className="py-10" />;
  }
  return (
    <div className={cn('space-y-4', className)}>
      {filled.map((day) => {
        const items = byDay.get(day);
        const late = items.filter((i) => i.state === 'overdue').length;
        const corner = cornerCell(day, true, calendar);
        const heading = dayHeading(day, { calendar });
        return (
          <section key={day} aria-label={dayHeading(day, { calendar, year: true })}>
            <header className="sticky top-0 z-10 -mx-1 mb-1.5 flex items-center gap-2 bg-background/90 px-1 py-1 backdrop-blur">
              <h3 lang={readsBs(day, calendar) ? 'ne' : undefined} className={cn('text-[15px] font-semibold', day === today && 'text-primary')}>
                {day === today ? `Today · ${heading}` : heading}
              </h3>
              <AgendaOtherDate corner={corner} />
              <span className="ml-auto text-[11px] text-muted-foreground">
                {items.length} item{items.length === 1 ? '' : 's'}
                {late ? <span className="font-semibold text-sla-breach"> · {late} late</span> : null}
              </span>
            </header>
            <div className="grid gap-1.5">
              {items.map((item) => <AgendaCard key={item.key} item={item} now={now} calendar={calendar} />)}
            </div>
          </section>
        );
      })}
    </div>
  );
}
