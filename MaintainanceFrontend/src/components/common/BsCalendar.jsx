import { useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { NE_WEEKDAY_NAMES } from '@/config/locale';
import { Button } from '@/components/ui/button';
import {
  HOLIDAY, WEEKDAY_NAMES, addDays, bsOf, dayHeading, dayNumber, ktmToday, monthGrid, monthStart, otherPeriodLabel,
  periodLabel, sameMonth, shiftMonth, weekdayOf,
} from '@/helpers/calendarDays';
import { loadDevanagariFont } from '@/helpers/devanagariFont';
import { toDevanagariDigits } from '@/helpers/format';
import { BS_MONTH_NAMES_NE, bsToAd } from '@/helpers/nepaliDate';
import { cn } from '@/helpers/utils';

/** Years either side of this one the year list offers (and the picked year, wherever it is). */
const YEARS_AROUND = 10;

const adLong = (day) => new Date(`${day}T00:00:00Z`).toLocaleDateString('en-GB', {
  weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC',
});

/** The AD day of BS `year`-`month`-1, or null past the table. */
const bsMonthDay = (year, month) => {
  try {
    return bsToAd(year, month, 1).toISOString().slice(0, 10);
  } catch {
    return null;
  }
};

/** Inside the picker's limits? */
const allowed = (day, disabled) => !(disabled?.before && day < disabled.before) && !(disabled?.after && day > disabled.after);

/**
 * A Bikram Sambat month to pick from — the Nepali calendar's twin of `ui/calendar` (react-day-picker, which only knows
 * Gregorian months), shown by `DateCalendar` while the back office's Calendar switch says Nepali. Six weeks, Sunday to
 * Saturday; each day is its BS date in Nepali script with the AD date small under it; the month and year are lists;
 * the arrow keys move a day or a week, Page Up / Page Down a month, Home / End to the week's ends.
 *
 * Days are Kathmandu `YYYY-MM-DD` strings in and out — the same as `DateCalendar`'s AD side — so a form never knows
 * which calendar was on screen.
 *
 * @param {{
 *   mode?: 'single'|'range',
 *   selected?: string|{ from?: string, to?: string },
 *   onSelect: (value: string|undefined|{ from?: string, to?: string }) => void,
 *   defaultMonth?: string,
 *   disabled?: { before?: string, after?: string },
 *   className?: string,
 * }} props
 */
export function BsCalendar({ mode = 'single', selected, onSelect, defaultMonth, disabled, className }) {
  const today = ktmToday();
  const range = mode === 'range' ? selected ?? {} : null;
  const picked = range ? range.from : selected;
  const [month, setMonth] = useState(() => monthStart(picked || defaultMonth || today, 'bs'));
  const [focusDay, setFocusDay] = useState(null);
  const gridRef = useRef(null);

  useEffect(() => { loadDevanagariFont(); }, []);
  // A key press moved the focus: put it on that day's button once the month it is in has rendered.
  useEffect(() => {
    if (focusDay) gridRef.current?.querySelector(`[data-day="${focusDay}"]`)?.focus();
  }, [focusDay, month]);

  const days = monthGrid(month, 'bs');
  const weeks = Array.from({ length: 6 }, (_, w) => days.slice(w * 7, w * 7 + 7));
  const bs = bsOf(month);
  const thisYear = bsOf(today)?.year ?? bs?.year;
  const years = Array.from(new Set([
    ...Array.from({ length: YEARS_AROUND * 2 + 1 }, (_, i) => thisYear - YEARS_AROUND + i),
    bs?.year,
  ])).filter((y) => y && bsMonthDay(y, 1)).sort((a, b) => a - b);

  const isSelected = (day) => (range ? day === range.from || day === range.to : day === selected);
  const inRange = (day) => Boolean(range?.from && range?.to && day > range.from && day < range.to);
  // The one day the Tab key lands on: the picked one if it is on screen, else today, else the 1st.
  const tabDay = [focusDay, picked, today].find((d) => d && sameMonth(d, month, 'bs')) ?? month;

  const pick = (day) => {
    if (!allowed(day, disabled)) return;
    if (!range) {
      onSelect(day === selected ? undefined : day);
      return;
    }
    if (!range.from || range.to || day < range.from) onSelect({ from: day, to: undefined });
    else onSelect({ from: range.from, to: day });
  };

  const moveFocus = (day) => {
    if (!sameMonth(day, month, 'bs')) setMonth(monthStart(day, 'bs'));
    setFocusDay(day);
  };

  const onKeyDown = (e, day) => {
    const step = {
      ArrowLeft: () => addDays(day, -1),
      ArrowRight: () => addDays(day, 1),
      ArrowUp: () => addDays(day, -7),
      ArrowDown: () => addDays(day, 7),
      Home: () => addDays(day, -weekdayOf(day)),
      End: () => addDays(day, 6 - weekdayOf(day)),
      PageUp: () => shiftMonth(day, -1, 'bs'),
      PageDown: () => shiftMonth(day, 1, 'bs'),
    }[e.key];
    if (!step) return;
    e.preventDefault();
    moveFocus(step());
  };

  const goMonth = (step) => { setFocusDay(null); setMonth(shiftMonth(month, step, 'bs')); };
  const jump = (year, monthNumber) => {
    const day = bsMonthDay(year, monthNumber);
    if (day) { setFocusDay(null); setMonth(day); }
  };

  return (
    <div className={cn('w-fit p-3', className)} data-slot="calendar" data-calendar="bs">
      <div className="flex items-center justify-between gap-1">
        <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={() => goMonth(-1)} aria-label="Previous month">
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <div className="flex min-w-0 flex-col items-center">
          <div className="flex items-center gap-1" lang="ne">
            <select
              aria-label="Month"
              value={bs?.month ?? 1}
              onChange={(e) => jump(bs.year, Number(e.target.value))}
              className="h-7 rounded-md border border-input bg-background px-1.5 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {BS_MONTH_NAMES_NE.map((name, i) => <option key={name} value={i + 1}>{name}</option>)}
            </select>
            <select
              aria-label="Year"
              value={bs?.year ?? thisYear}
              onChange={(e) => jump(Number(e.target.value), bs.month)}
              className="h-7 rounded-md border border-input bg-background px-1.5 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {years.map((y) => <option key={y} value={y}>{toDevanagariDigits(y)}</option>)}
            </select>
          </div>
          <span className="mt-0.5 text-[11px] text-muted-foreground" aria-live="polite">
            <span className="sr-only">{periodLabel('month', month, 'bs')} — </span>{otherPeriodLabel('month', month, 'bs')}
          </span>
        </div>
        <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={() => goMonth(1)} aria-label="Next month">
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      <table ref={gridRef} role="grid" aria-label={periodLabel('month', month, 'bs')} className="mt-3 border-collapse">
        <thead>
          <tr>
            {NE_WEEKDAY_NAMES.map((name, i) => (
              <th
                key={name}
                scope="col"
                abbr={WEEKDAY_NAMES[i]}
                lang="ne"
                className={cn('h-7 w-10 text-center text-[12px] font-medium text-muted-foreground', i === HOLIDAY && 'text-destructive/80')}
              >
                {name}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {weeks.map((week) => (
            <tr key={week[0]}>
              {week.map((day) => {
                const outside = !sameMonth(day, month, 'bs');
                const chosen = isSelected(day);
                const off = !allowed(day, disabled);
                return (
                  <td key={day} className="p-0.5 text-center" aria-selected={chosen || undefined}>
                    <button
                      type="button"
                      data-day={day}
                      tabIndex={day === tabDay ? 0 : -1}
                      disabled={off}
                      onClick={() => pick(day)}
                      onKeyDown={(e) => onKeyDown(e, day)}
                      aria-label={`${dayHeading(day, { calendar: 'bs', year: true })} — ${adLong(day)}`}
                      aria-pressed={chosen}
                      aria-current={day === today ? 'date' : undefined}
                      className={cn(
                        'flex h-10 w-10 flex-col items-center justify-center rounded-md leading-none transition-colors motion-reduce:transition-none',
                        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                        'hover:bg-accent hover:text-accent-foreground disabled:pointer-events-none disabled:opacity-40',
                        weekdayOf(day) === HOLIDAY && !chosen && 'text-destructive/80',
                        outside && !chosen && 'text-muted-foreground/60',
                        inRange(day) && 'rounded-none bg-accent',
                        day === today && !chosen && 'ring-1 ring-inset ring-primary/50',
                        chosen && 'bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground',
                      )}
                    >
                      <span lang="ne" className="text-[15px] font-semibold">{dayNumber(day, 'bs')}</span>
                      <span className={cn('mt-0.5 text-[9px] tabular-nums', chosen ? 'opacity-80' : 'text-muted-foreground')}>
                        {Number(day.slice(8))}
                      </span>
                    </button>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>

      {range ? null : (
        <div className="mt-2 flex justify-end border-t pt-2">
          <Button
            type="button" variant="ghost" size="sm" className="h-7 text-xs"
            disabled={!allowed(today, disabled)}
            onClick={() => { setMonth(monthStart(today, 'bs')); onSelect(today); }}
          >
            <span lang="ne">आज</span> · Today
          </Button>
        </div>
      )}
    </div>
  );
}
