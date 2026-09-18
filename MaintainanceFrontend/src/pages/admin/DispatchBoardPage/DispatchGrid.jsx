import { useDroppable } from '@dnd-kit/core';
import { AlertTriangle, Moon, Users } from 'lucide-react';
import { StateBadge } from '@/components/common/StateBadge';
import {
  hourLabel, isDayOff, jobsInCell, ktmDay, ktmHour, personToneStyle,
} from '@/helpers/dispatchBoard';
import { initials, titleCase } from '@/helpers/format';
import { cn } from '@/helpers/utils';
import { DispatchJobCard } from './DispatchJobCard';

const dayHeading = (day) => new Date(`${day}T00:00:00Z`)
  .toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });

/** Stripes over a lane whose technician is off: still droppable, but it reads as "not today". */
const OFF_STRIPES = 'bg-[repeating-linear-gradient(135deg,hsl(var(--muted-foreground)/0.07)_0_8px,transparent_8px_16px)]';

/** One droppable cell: a technician on a day (week view) or an hour (day view). */
function Cell({ lane, day, hour, hours, dragging, pending, onSchedule, compact, now, off }) {
  const id = `cell:${lane.technician.id}:${day}:${hour ?? ''}`;
  const { setNodeRef, isOver } = useDroppable({ id, data: { technicianId: lane.technician.id, day, hour } });
  const jobs = jobsInCell(lane.jobs, day, hour, hours);
  const clashes = new Set(lane.conflicts.flatMap((c) => [c.a, c.b]));
  const full = hour == null && lane.overCapacityDays.includes(day);
  const label = `${lane.technician.name}, ${dayHeading(day)}${hour != null ? `, ${hourLabel(hour)}` : ''}`;

  return (
    <div
      ref={setNodeRef}
      role="gridcell"
      aria-label={label}
      className={cn(
        'relative min-h-24 space-y-1 border-l border-t border-dotted border-border p-1.5 transition-colors duration-150 motion-reduce:transition-none',
        now && 'bg-primary/[0.04]',
        off && 'bg-muted/40',
        !lane.technician.isAvailable && OFF_STRIPES,
        full && 'bg-destructive/[0.06]',
        dragging && !isOver && 'after:pointer-events-none after:absolute after:inset-1 after:rounded-lg after:border after:border-dashed after:border-border',
        isOver && 'bg-primary/10 after:pointer-events-none after:absolute after:inset-1 after:rounded-lg after:border-2 after:border-dashed after:border-primary',
      )}
    >
      {jobs.map((job) => (
        <DispatchJobCard
          key={job.id}
          job={job}
          laneId={lane.technician.id}
          clash={clashes.has(job.number)}
          compact={compact}
          pending={pending[job.id]}
          onSchedule={onSchedule}
        />
      ))}
    </div>
  );
}

/** A lane's load against its limit, as a meter that turns amber when full and red when over. */
function LoadMeter({ load, capacity, label }) {
  const ratio = capacity ? load / capacity : 0;
  const tone = ratio > 1 ? 'bg-destructive' : ratio === 1 ? 'bg-warning' : 'bg-success';
  return (
    <div className="space-y-1" title={`At most ${capacity} jobs a day`}>
      <div className="flex items-center justify-between text-[11px]">
        <span className="font-medium tabular-nums text-foreground">{label}</span>
        <span className="tabular-nums text-muted-foreground">{Math.round(ratio * 100)}%</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-muted">
        <div className={cn('h-full rounded-full transition-[width] duration-500 motion-reduce:transition-none', tone)} style={{ width: `${Math.min(100, ratio * 100)}%` }} />
      </div>
    </div>
  );
}

/**
 * Technicians × time: a row per technician, a column per hour (day view) or per day (week view).
 * A lane shows its load against the daily limit; an over-full day is tinted and overlapping jobs
 * are marked "Clash". The current hour (or today, in the week) is lit, and Saturdays are shaded.
 */
export function DispatchGrid({ board, lanes, dragging, pending, onSchedule }) {
  const { view, days, hours } = board;
  const today = ktmDay();
  const hourNow = ktmHour();
  const columns = view === 'week'
    ? days.map((day) => ({ key: day, day, label: dayHeading(day), now: day === today, off: isDayOff(day) }))
    : Array.from({ length: hours.end - hours.start }, (_, i) => hours.start + i)
      .map((hour) => ({ key: hour, day: days[0], hour, label: hourLabel(hour), now: days[0] === today && hour === hourNow, off: false }));
  const template = { gridTemplateColumns: `14rem repeat(${columns.length}, minmax(${view === 'week' ? '10rem' : '8rem'}, 1fr))` };

  if (!lanes.length) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-2xl border-2 border-dotted p-10 text-center text-sm text-muted-foreground">
        <Users className="h-6 w-6 opacity-60" aria-hidden />
        No technicians match these filters.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-2xl border bg-card shadow-[var(--elevation-1)] [scrollbar-width:thin]">
      <div className="grid min-w-max" style={template} role="grid" aria-label={view === 'week' ? 'Technicians by day' : 'Technicians by hour'}>
        <div role="columnheader" className="sticky left-0 z-20 flex items-center gap-2 border-r border-dotted bg-muted/70 px-3 py-2.5 text-xs font-semibold text-muted-foreground backdrop-blur">
          <Users className="h-3.5 w-3.5" aria-hidden /> Team · {lanes.length}
        </div>
        {columns.map((c) => (
          <div
            key={c.key}
            role="columnheader"
            className={cn(
              'relative flex items-center justify-center gap-1.5 border-l border-dotted bg-muted/70 px-2 py-2.5 text-center text-xs font-semibold tabular-nums',
              c.off && 'text-muted-foreground',
              c.now && 'bg-primary/10 text-primary',
            )}
          >
            {c.now ? <span aria-hidden className="absolute inset-x-0 top-0 h-0.5 bg-primary" /> : null}
            {c.label}
            {c.now ? (
              <span className="rounded-full bg-primary px-1.5 py-px text-[10px] font-bold uppercase tracking-wide text-primary-foreground">
                {view === 'week' ? 'Today' : 'Now'}
              </span>
            ) : null}
            {c.off ? <Moon className="h-3 w-3" aria-label="Day off" /> : null}
          </div>
        ))}
        {lanes.map((lane) => {
          const t = lane.technician;
          const load = view === 'week' ? lane.jobs.length : lane.loadByDay[days[0]] ?? 0;
          const capacity = view === 'week' ? t.dailyCapacity * days.length : t.dailyCapacity;
          const loadLabel = view === 'week' ? `${lane.jobs.length} this week` : `${load} / ${t.dailyCapacity} today`;
          const over = view === 'week' ? lane.overCapacityDays.length > 0 : lane.overCapacityDays.includes(days[0]);
          return (
            <div key={t.id} role="row" className="contents">
              <div
                role="rowheader"
                className="sticky left-0 z-10 space-y-2 border-r border-t border-dotted bg-card px-3 py-2.5 text-xs shadow-[4px_0_12px_-10px_hsl(var(--ink)/0.4)]"
              >
                <div className="flex items-center gap-2.5">
                  <span
                    aria-hidden
                    style={personToneStyle(t.id)}
                    className={cn(
                      'relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[hsl(var(--tone)/0.16)] text-xs font-bold text-[hsl(var(--tone))] ring-2 ring-[hsl(var(--tone)/0.3)]',
                      !t.isAvailable && 'grayscale',
                    )}
                  >
                    {initials(t.name)}
                    <span className={cn('absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full ring-2 ring-card', t.isAvailable ? 'bg-success' : 'bg-muted-foreground')} />
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{t.name}</p>
                    <p className="truncate text-muted-foreground">
                      {[t.employeeCode, t.role === 'SURVEYOR' ? 'Surveyor' : null].filter(Boolean).join(' · ') || titleCase(t.role)}
                    </p>
                  </div>
                </div>
                <LoadMeter load={load} capacity={capacity} label={loadLabel} />
                {!t.isAvailable || lane.conflicts.length || over ? (
                  <div className="flex flex-wrap gap-1">
                    {t.isAvailable ? null : <StateBadge tone="warning">Unavailable</StateBadge>}
                    {over ? <StateBadge tone="warning">Over the limit</StateBadge> : null}
                    {lane.conflicts.length ? (
                      <StateBadge tone="warning">
                        <AlertTriangle className="h-3 w-3" aria-hidden /> {lane.conflicts.length} clash{lane.conflicts.length === 1 ? '' : 'es'}
                      </StateBadge>
                    ) : null}
                  </div>
                ) : null}
              </div>
              {columns.map((c) => (
                <Cell
                  key={c.key}
                  lane={lane}
                  day={c.day}
                  hour={c.hour}
                  hours={hours}
                  dragging={dragging}
                  pending={pending}
                  onSchedule={onSchedule}
                  compact={view === 'day'}
                  now={c.now}
                  off={c.off}
                />
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}
