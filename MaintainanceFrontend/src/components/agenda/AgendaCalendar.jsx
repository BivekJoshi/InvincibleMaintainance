import { useEffect, useMemo } from 'react';
import {
  AlertTriangle, CalendarClock, CheckCircle2, ChevronLeft, ChevronRight, Loader2, Sun, UserX,
} from 'lucide-react';
import { useGetAgendaQuery } from '@/api/leadsApi';
import { KIND_ICONS } from '@/components/agenda/agendaIcons';
import { AgendaCard } from '@/components/agenda/AgendaItem';
import { AgendaDayList } from '@/components/agenda/AgendaDayList';
import { AgendaMonthGrid } from '@/components/agenda/AgendaMonthGrid';
import { AgendaOtherDate } from '@/components/agenda/AgendaOtherDate';
import { AgendaWeekGrid } from '@/components/agenda/AgendaWeekGrid';
import { ErrorState } from '@/components/common/ErrorState';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import {
  bsMonthNameEn, cornerCell, dayHeading, isDay, ktmToday, monthDays, monthGrid, otherPeriodLabel, periodLabel,
  readsBs, weekDays,
} from '@/helpers/calendarDays';
import {
  AGENDA_KINDS, AGENDA_KIND_ORDER, AGENDA_VIEWS, agendaSummary, byTime, countByKind, itemsByDay, itemsInScope,
  kindStyle, parseHidden, serializeHidden, shiftAnchor, spanFor,
} from '@/helpers/agenda';
import { loadDevanagariFont } from '@/helpers/devanagariFont';
import { useCalendarMode } from '@/hooks/useCalendarMode';
import { cn } from '@/helpers/utils';

const TONE = { breach: '--sla-breach', warn: '--sla-warn', info: '--info', warning: '--warning' };

/** The late count over the kinds still switched on. */
const kindsShown = (byKind, hidden) => Object.entries(byKind).reduce((n, [kind, c]) => (hidden.has(kind) ? n : n + c), 0);

/** A figure over the calendar; the actionable ones are buttons. */
function Tile({ tone, icon: Icon, label, value, hint, onClick }) {
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      style={{ '--tone': `var(${TONE[tone]})` }}
      className={cn(
        'relative flex min-w-0 items-center gap-3 overflow-hidden rounded-xl border bg-card p-3 text-left shadow-[var(--elevation-1)]',
        onClick && 'transition-shadow hover:shadow-[var(--elevation-2)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transition-none',
      )}
    >
      <span aria-hidden className="absolute inset-x-0 top-0 h-0.5 bg-[hsl(var(--tone))]" />
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-[hsl(var(--tone)/0.14)] text-[hsl(var(--tone))]">
        <Icon className="h-4 w-4" aria-hidden />
      </span>
      <span className="min-w-0">
        <span className="block text-2xl font-bold tabular-nums leading-none">{value}</span>
        <span className="mt-1 block truncate text-xs font-medium">{label}</span>
        {hint ? <span className="block truncate text-[11px] text-muted-foreground">{hint}</span> : null}
      </span>
    </Tag>
  );
}

/** Everything late, oldest first — whatever month is on screen. `wide` lays it out under the week, in columns. */
function OverduePanel({ items, truncated, now, calendar, wide = false }) {
  return (
    <section id="agenda-overdue" aria-label="Overdue" className="scroll-mt-24 overflow-hidden rounded-xl border bg-card shadow-[var(--elevation-1)]">
      <header className="flex items-center gap-2 border-b bg-sla-breach/[0.06] px-3 py-2.5">
        <AlertTriangle className="h-4 w-4 text-sla-breach" aria-hidden />
        <h3 className="text-sm font-semibold">Overdue</h3>
        <span className="rounded-full bg-sla-breach/15 px-2 text-xs font-bold tabular-nums leading-5 text-sla-breach">{items.length}</span>
        <span className="ml-auto text-[11px] text-muted-foreground">oldest first</span>
      </header>
      {items.length ? (
        <div className={cn('grid max-h-[30rem] content-start gap-1.5 overflow-y-auto p-2', wide && 'sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4')}>
          {items.map((item) => <AgendaCard key={item.key} item={item} now={now} calendar={calendar} dense />)}
        </div>
      ) : (
        <p className="flex items-center gap-2 px-3 py-4 text-sm text-muted-foreground">
          <CheckCircle2 className="h-4 w-4 text-sla-ok" aria-hidden /> Nothing late. Good.
        </p>
      )}
      {truncated.length ? (
        <p className="border-t px-3 py-2 text-[11px] text-muted-foreground">
          Showing the oldest 300 of {truncated.map((k) => AGENDA_KINDS[k]?.label.toLowerCase()).join(', ')} — the lists have the rest.
        </p>
      ) : null}
    </section>
  );
}

/** The day picked on the month grid, in full. */
function DayPanel({ day, items, today, now, calendar }) {
  const corner = cornerCell(day, true, calendar);
  const heading = dayHeading(day, { calendar });
  return (
    <section aria-label={`On ${heading}`} className="overflow-hidden rounded-xl border bg-card shadow-[var(--elevation-1)]">
      <header className="flex items-center gap-2 border-b px-3 py-2.5">
        <h3 lang={readsBs(day, calendar) ? 'ne' : undefined} className="text-[15px] font-semibold">{day === today ? `Today · ${heading}` : heading}</h3>
        <AgendaOtherDate corner={corner} />
        <span className="ml-auto text-[11px] text-muted-foreground">{items.length} item{items.length === 1 ? '' : 's'}</span>
      </header>
      {items.length ? (
        <div className="max-h-[30rem] space-y-1.5 overflow-y-auto p-2">
          {items.map((item) => <AgendaCard key={item.key} item={item} now={now} calendar={calendar} dense />)}
        </div>
      ) : <p className="px-3 py-4 text-sm text-muted-foreground">Nothing on this day.</p>}
    </section>
  );
}

/**
 * The SLA board's Calendar tab: every dated thing still waiting — reply deadlines, follow-ups, visits, jobs,
 * quotations running out, invoices due, AMC visits and renewals (each only for a role that reads it) — as a
 * month, a week or a list, with everything late in a panel beside it whatever month is on screen. The view, the
 * day and the kinds switched off live in the URL (`cal`, `day`, `hide`) beside the board's `who`. The months are
 * AD or BS — the account menu's Calendar switch (`useCalendarMode`) — with the other calendar's date in each corner.
 *
 * @param {{ params: object, setParams: (next: object) => void, scope: 'all'|'mine'|'unassigned', userId?: string, now: number }} props
 */
export function AgendaCalendar({ params, setParams, scope, userId, now }) {
  const { calendar } = useCalendarMode();
  // Every cell carries a Nepali date in Nepali script: the face for it, which the English back office never loads.
  useEffect(() => { loadDevanagariFont(); }, []);
  const today = ktmToday(now);
  const view = AGENDA_VIEWS.some((v) => v.value === params.cal) ? params.cal : 'month';
  const day = isDay(params.day) ? params.day : today;
  const hidden = useMemo(() => parseHidden(params.hide), [params.hide]);
  const span = spanFor(view, day, calendar);
  const { data, isLoading, isFetching, error, refetch } = useGetAgendaQuery(span, { pollingInterval: 60000 });

  const set = (patch) => setParams({ ...params, ...patch });
  const goTo = (next) => set({ day: next === today ? undefined : next });
  const toggleKind = (kind) => {
    const next = new Set(hidden);
    if (next.has(kind)) next.delete(kind); else next.add(kind);
    set({ hide: serializeHidden(next) });
  };

  const scoped = useMemo(() => itemsInScope(data?.items ?? [], scope, userId), [data, scope, userId]);
  const visible = useMemo(() => scoped.filter((i) => !hidden.has(i.kind)), [scoped, hidden]);
  const byDay = useMemo(() => itemsByDay(visible), [visible]);
  const counts = countByKind(scoped);
  const overdue = visible.filter((i) => i.state === 'overdue').sort(byTime);
  const days = view === 'week' ? weekDays(day) : monthGrid(day, calendar);
  const inMonth = monthDays(day, calendar);
  // The tiles count the week, or the month itself — not the grid's spill into its neighbours.
  const focus = view === 'week' ? span : { from: inMonth[0], to: inMonth[inMonth.length - 1] };
  const summary = agendaSummary(visible, focus, today);
  // Everyone's late count is the server's — past the 300 a kind sends; a narrower scope counts what it has.
  const lateTotal = scope === 'all' && data?.overdue
    ? kindsShown(data.overdue.byKind, hidden)
    : summary.overdue;
  const kinds = AGENDA_KIND_ORDER.filter((k) => data?.kinds?.includes(k));

  const label = periodLabel(view, day, calendar);
  const otherLabel = otherPeriodLabel(view, day, calendar);
  const nepali = readsBs(day, calendar);
  // Under a Nepali month's name, its name in Latin letters — for whoever does not read Devanagari.
  const latinMonth = nepali && view !== 'week' ? bsMonthNameEn(day) : null;
  const unit = view === 'week' ? 'week' : 'month';

  if (error) return <ErrorState error={error} onRetry={refetch} />;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
        <Tile
          tone="breach" icon={AlertTriangle} label="Overdue" value={lateTotal}
          hint={lateTotal ? 'Oldest first, in the panel' : 'Nothing late'}
          onClick={lateTotal ? () => document.getElementById('agenda-overdue')?.scrollIntoView({ behavior: 'smooth', block: 'start' }) : undefined}
        />
        <Tile
          tone="warn" icon={Sun} label="Due today" value={summary.todayInView ? summary.today : '—'}
          hint={summary.todayInView ? dayHeading(today, { calendar }) : 'Go to today'}
          onClick={summary.todayInView ? undefined : () => goTo(today)}
        />
        <Tile tone="info" icon={CalendarClock} label={`Still to come this ${unit}`} value={summary.upcoming} hint={label} />
        <Tile tone="warning" icon={UserX} label="Nobody owns these" value={summary.unowned} hint="Leads and quotations" />
      </div>

      {/* Where we are, and how to look. */}
      <div className="flex flex-wrap items-center gap-2 rounded-xl border bg-card p-2 shadow-[var(--elevation-1)]">
        <div className="flex items-center gap-1">
          <Button variant="outline" size="icon" className="h-8 w-8 rounded-full" onClick={() => goTo(shiftAnchor(day, view, -1, calendar))} aria-label={`Previous ${unit}`}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" className="h-8 rounded-full" onClick={() => goTo(today)} disabled={day === today}>Today</Button>
          <Button variant="outline" size="icon" className="h-8 w-8 rounded-full" onClick={() => goTo(shiftAnchor(day, view, 1, calendar))} aria-label={`Next ${unit}`}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        <div className="min-w-0 px-1">
          <h2 className="flex items-baseline gap-2 truncate text-lg font-bold leading-tight" aria-live="polite">
            <span lang={nepali ? 'ne' : undefined}>{label}</span>
            {latinMonth ? <span className="text-sm font-medium text-muted-foreground">{latinMonth}</span> : null}
          </h2>
          {otherLabel ? (
            <p className="mt-1">
              <AgendaOtherDate corner={{ day: otherLabel, month: null, lang: nepali ? 'en' : 'ne', title: nepali ? 'English dates (AD)' : 'Nepali dates (BS)' }} />
            </p>
          ) : null}
        </div>
        <div className="ml-auto flex items-center gap-2">
          {isFetching && !isLoading ? <Loader2 className="h-4 w-4 animate-spin text-muted-foreground motion-reduce:animate-none" aria-label="Updating" /> : null}
          <ToggleGroup
            type="single" variant="outline" size="sm" value={view} aria-label="Calendar view"
            onValueChange={(v) => v && set({ cal: v === 'month' ? undefined : v })} className="rounded-full bg-muted/50 p-1"
          >
            {AGENDA_VIEWS.map((v) => (
              <ToggleGroupItem key={v.value} value={v.value} className="h-7 rounded-full border-0 px-3 data-[state=on]:bg-background data-[state=on]:shadow-[var(--elevation-1)]">
                {v.label}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </div>
      </div>

      {/* The legend is the filter: each kind on or off, with how many there are. */}
      {kinds.length ? (
        <div role="group" aria-label="Show on the calendar" className="flex flex-wrap items-center gap-1.5">
          {kinds.map((kind) => {
            const Icon = KIND_ICONS[kind];
            const on = !hidden.has(kind);
            return (
              <button
                key={kind}
                type="button"
                aria-pressed={on}
                onClick={() => toggleKind(kind)}
                style={kindStyle(kind)}
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors motion-reduce:transition-none',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  on
                    ? 'border-[hsl(var(--tone)/0.45)] bg-[hsl(var(--tone)/0.12)] hover:bg-[hsl(var(--tone)/0.2)]'
                    : 'border-dashed bg-transparent text-muted-foreground line-through decoration-muted-foreground/60 hover:bg-muted',
                )}
              >
                <Icon className={cn('h-3.5 w-3.5', on ? 'text-[hsl(var(--tone))]' : 'opacity-60')} aria-hidden />
                {AGENDA_KINDS[kind].label}
                <span className="rounded-full bg-background/80 px-1.5 text-[10px] font-bold tabular-nums">{counts[kind] ?? 0}</span>
              </button>
            );
          })}
          {hidden.size ? (
            <Button variant="ghost" size="sm" className="h-7 rounded-full text-xs" onClick={() => set({ hide: undefined })}>Show all</Button>
          ) : null}
        </div>
      ) : null}

      {/* The week needs the full width for its seven columns: its late items go underneath. */}
      <div className={cn('grid gap-4', view !== 'week' && 'xl:grid-cols-[minmax(0,1fr)_21rem]')}>
        <div className="min-w-0">
          {isLoading ? (
            <Skeleton className="h-[34rem] rounded-xl" />
          ) : view === 'month' ? (
            <AgendaMonthGrid
              days={days} anchor={day} today={today} byDay={byDay} selectedDay={day} onSelectDay={goTo} now={now} label={label}
              calendar={calendar}
            />
          ) : view === 'week' ? (
            <AgendaWeekGrid
              days={days} today={today} byDay={byDay} selectedDay={day} onSelectDay={goTo} now={now} label={label} calendar={calendar}
            />
          ) : (
            <AgendaDayList days={inMonth} byDay={byDay} today={today} now={now} calendar={calendar} empty={`Nothing booked in ${label}.`} />
          )}
        </div>
        <aside className="space-y-4" aria-label="Late and selected day">
          {isLoading ? <Skeleton className="h-64 rounded-xl" /> : (
            <OverduePanel items={overdue} truncated={data?.truncated ?? []} now={now} calendar={calendar} wide={view === 'week'} />
          )}
          {!isLoading && view === 'month' ? <DayPanel day={day} items={byDay.get(day) ?? []} today={today} now={now} calendar={calendar} /> : null}
        </aside>
      </div>
    </div>
  );
}
