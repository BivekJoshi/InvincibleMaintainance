import { useDroppable } from '@dnd-kit/core';
import { StateBadge } from '@/components/common/StateBadge';
import { hourLabel, jobsInCell } from '@/helpers/dispatchBoard';
import { titleCase } from '@/helpers/format';
import { cn } from '@/helpers/utils';
import { DispatchJobCard } from './DispatchJobCard';

const dayHeading = (day) => new Date(`${day}T00:00:00Z`)
  .toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });

/** One droppable cell: a technician on a day (week view) or an hour (day view). */
function Cell({ lane, day, hour, hours, dragging, pending, onSchedule, compact }) {
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
        'min-h-20 space-y-1 border-l border-t p-1 transition-colors motion-reduce:transition-none',
        full && 'bg-destructive/5',
        dragging && 'bg-muted/30',
        isOver && 'bg-primary/10 ring-2 ring-inset ring-primary/50',
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

/**
 * Technicians × time: a row per technician, a column per hour (day view) or per day (week view).
 * A lane shows its load against the daily limit; an over-full day is tinted and overlapping jobs
 * are marked "Clash".
 */
export function DispatchGrid({ board, lanes, dragging, pending, onSchedule }) {
  const { view, days, hours } = board;
  const columns = view === 'week'
    ? days.map((day) => ({ key: day, day, label: dayHeading(day) }))
    : Array.from({ length: hours.end - hours.start }, (_, i) => hours.start + i)
      .map((hour) => ({ key: hour, day: days[0], hour, label: hourLabel(hour) }));
  const template = { gridTemplateColumns: `12rem repeat(${columns.length}, minmax(${view === 'week' ? '9rem' : '7.5rem'}, 1fr))` };

  if (!lanes.length) {
    return <p className="rounded-lg border p-6 text-center text-sm text-muted-foreground">No technicians match these filters.</p>;
  }

  return (
    <div className="overflow-x-auto rounded-lg border">
      <div className="grid min-w-max" style={template} role="grid" aria-label={view === 'week' ? 'Technicians by day' : 'Technicians by hour'}>
        <div className="sticky left-0 z-10 bg-muted/60 p-2 text-xs font-medium text-muted-foreground" role="columnheader">Technician</div>
        {columns.map((c) => (
          <div key={c.key} role="columnheader" className="border-l bg-muted/60 p-2 text-center text-xs font-medium">{c.label}</div>
        ))}
        {lanes.map((lane) => {
          const t = lane.technician;
          const load = view === 'week'
            ? `${lane.jobs.length} this week`
            : `${lane.loadByDay[days[0]] ?? 0} / ${t.dailyCapacity} today`;
          const over = view === 'week' ? lane.overCapacityDays.length > 0 : lane.overCapacityDays.includes(days[0]);
          return (
            <div key={t.id} role="row" className="contents">
              <div role="rowheader" className="sticky left-0 z-10 space-y-1 border-t bg-background p-2 text-xs">
                <p className="truncate text-sm font-medium">{t.name}</p>
                <p className="text-muted-foreground">{[t.employeeCode, t.role === 'SURVEYOR' ? 'Surveyor' : null].filter(Boolean).join(' · ') || titleCase(t.role)}</p>
                <div className="flex flex-wrap gap-1">
                  <StateBadge tone={over ? 'warning' : 'muted'} title={`At most ${t.dailyCapacity} jobs a day`}>{load}</StateBadge>
                  {t.isAvailable ? null : <StateBadge tone="warning">Unavailable</StateBadge>}
                  {lane.conflicts.length ? <StateBadge tone="warning">{lane.conflicts.length} clash{lane.conflicts.length === 1 ? '' : 'es'}</StateBadge> : null}
                </div>
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
                />
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}
