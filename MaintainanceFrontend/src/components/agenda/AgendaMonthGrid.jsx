import { AgendaChip } from '@/components/agenda/AgendaItem';
import { AgendaOtherDate } from '@/components/agenda/AgendaOtherDate';
import {
  HOLIDAY, NE_WEEKDAY_NAMES, WEEKDAY_NAMES, cornerCell, dayHeading, dayNumber, kindStyle, readsBs, sameMonth, weekdayOf,
} from '@/helpers/agenda';
import { cn } from '@/helpers/utils';

/** Chips a cell shows before "+N more". */
const CHIPS = 3;
/** Dots a phone-width cell shows. */
const DOTS = 4;

function DayCell({ day, items, anchor, today, selected, first, onSelect, now, calendar }) {
  const outside = !sameMonth(day, anchor, calendar);
  const isToday = day === today;
  const corner = cornerCell(day, first, calendar);
  const nepali = readsBs(day, calendar);
  const late = items.filter((i) => i.state === 'overdue').length;
  const extra = items.length - CHIPS;
  const label = `${dayHeading(day, { calendar, year: true })}${items.length ? `, ${items.length} item${items.length === 1 ? '' : 's'}` : ''}${late ? `, ${late} late` : ''}`;

  return (
    <div
      role="gridcell"
      aria-selected={selected}
      onClick={() => onSelect(day)}
      className={cn(
        'group relative flex min-h-[4.25rem] min-w-0 cursor-pointer flex-col gap-1 border-r p-1 transition-colors last:border-r-0 motion-reduce:transition-none sm:min-h-[7.5rem] sm:p-1.5',
        weekdayOf(day) === HOLIDAY && 'bg-muted/40',
        outside && 'bg-muted/25',
        isToday && 'bg-primary/[0.06]',
        selected ? 'ring-2 ring-inset ring-primary' : 'hover:bg-accent/60',
      )}
    >
      <div className="flex items-start justify-between gap-1">
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onSelect(day); }}
          aria-label={label}
          aria-pressed={selected}
          lang={nepali ? 'ne' : undefined}
          className={cn(
            'grid h-8 min-w-8 place-items-center rounded-full px-1 font-bold tabular-nums transition-colors motion-reduce:transition-none',
            nepali ? 'text-base' : 'text-sm',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
            isToday ? 'bg-primary text-primary-foreground shadow-[var(--elevation-1)]' : 'group-hover:bg-background',
            outside && !isToday && 'text-muted-foreground/60',
          )}
        >
          {dayNumber(day, calendar)}
        </button>
        <div className="flex min-w-0 items-center gap-1">
          {late ? (
            <span className="rounded-full bg-destructive px-1.5 text-[10px] font-bold tabular-nums leading-4 text-destructive-foreground" title={`${late} late`}>
              {late}
            </span>
          ) : null}
          <AgendaOtherDate corner={corner} className={cn('hidden sm:inline-flex', outside && 'opacity-50')} />
        </div>
      </div>

      {/* Wide: the first few as chips. */}
      <div className="hidden min-w-0 flex-col gap-0.5 sm:flex">
        {items.slice(0, CHIPS).map((item) => <AgendaChip key={item.key} item={item} now={now} calendar={calendar} />)}
        {extra > 0 ? (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onSelect(day); }}
            className="self-start rounded px-1.5 text-[11px] font-semibold text-muted-foreground hover:bg-background hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            +{extra} more
          </button>
        ) : null}
      </div>

      {/* Phone width: a dot per item, in its kind's colour. */}
      {items.length ? (
        <div aria-hidden className="flex flex-wrap items-center gap-0.5 sm:hidden">
          {items.slice(0, DOTS).map((item) => (
            <span
              key={item.key}
              style={kindStyle(item.kind)}
              className={cn('h-1.5 w-1.5 rounded-full', item.state === 'overdue' ? 'bg-sla-breach' : 'bg-[hsl(var(--tone))]')}
            />
          ))}
          {items.length > DOTS ? <span className="text-[9px] font-semibold text-muted-foreground">+{items.length - DOTS}</span> : null}
        </div>
      ) : null}
    </div>
  );
}

/**
 * The month — AD or BS (`calendar`) — six weeks, Sunday to Saturday (the holiday shaded), each day headed with its
 * date in that calendar and the other calendar's in the corner, a red count of what on it is late, and its first few
 * items. Clicking a day opens it in the side panel; clicking an item opens its record.
 */
export function AgendaMonthGrid({ days, anchor, today, byDay, selectedDay, onSelectDay, now, label, calendar = 'ad' }) {
  const nepali = readsBs(anchor, calendar);
  const weeks = Array.from({ length: days.length / 7 }, (_, w) => days.slice(w * 7, w * 7 + 7));
  return (
    <div role="grid" aria-label={label} className="overflow-hidden rounded-xl border bg-card shadow-[var(--elevation-1)]">
      <div role="row" className="grid grid-cols-7 border-b bg-muted/50">
        {WEEKDAY_NAMES.map((name, i) => (
          <div
            key={name}
            role="columnheader"
            className={cn('flex items-baseline gap-1.5 px-2 py-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground', i === HOLIDAY && 'text-sla-breach/80')}
          >
            {nepali ? <span lang="ne" className="text-[13px] normal-case tracking-normal text-foreground/80">{NE_WEEKDAY_NAMES[i]}</span> : null}
            <span className={cn(nepali && 'hidden text-[10px] opacity-70 md:inline')}>{name}</span>
          </div>
        ))}
      </div>
      {weeks.map((week, w) => (
        <div key={week[0]} role="row" className="grid grid-cols-7 border-b last:border-b-0">
          {week.map((day, d) => (
            <DayCell
              key={day} day={day} items={byDay.get(day) ?? []} anchor={anchor} today={today} now={now}
              selected={day === selectedDay} first={w === 0 && d === 0} onSelect={onSelectDay} calendar={calendar}
            />
          ))}
        </div>
      ))}
    </div>
  );
}
