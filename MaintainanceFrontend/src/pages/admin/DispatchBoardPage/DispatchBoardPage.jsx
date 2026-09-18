import { useCallback, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  DndContext, DragOverlay, KeyboardSensor, PointerSensor, pointerWithin, rectIntersection, useSensor, useSensors,
} from '@dnd-kit/core';
import {
  AlertTriangle, BriefcaseBusiness, ChevronLeft, ChevronRight, Gauge, Hand, Inbox, List, MapPin, Sparkles, Users, Wrench,
} from 'lucide-react';
import { useGetDispatchBoardQuery } from '@/api/jobsApi';
import { PageHeader } from '@/components/common/PageHeader';
import { ErrorState } from '@/components/common/ErrorState';
import { ScheduleJobDialog } from '@/components/jobs/ScheduleJobDialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { PageTransition } from '@/three/motion/motionKit';
import { cn } from '@/helpers/utils';
import { useScheduleCommit } from '@/hooks/useScheduleCommit';
import {
  boardStats, dropTechnicians, dropWindow, filterLanes, hourLabel, isSameDrop, jobToneStyle, ktmDay, laneOptions, shiftBoardDate,
} from '@/helpers/dispatchBoard';
import { DispatchGrid } from './DispatchGrid';
import { JobCardFace } from './DispatchJobCard';
import { UnassignedQueue } from './UnassignedQueue';

const ALL = '__all';
const WHO = [
  { value: ALL, label: 'Everyone' },
  { value: 'TECHNICIAN', label: 'Technicians' },
  { value: 'SURVEYOR', label: 'Surveyors' },
];

const dayWords = (day) => new Date(`${day}T00:00:00Z`)
  .toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
const datePart = (day, opts) => new Date(`${day}T00:00:00Z`).toLocaleDateString('en-GB', { ...opts, timeZone: 'UTC' });

/** One figure in the strip above the board. */
function Stat({ icon: Icon, label, value, tone, children }) {
  return (
    <div className="flex min-w-0 items-center gap-3 rounded-xl border bg-card px-3 py-2.5 shadow-[var(--elevation-1)]">
      <span className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-lg', tone)}>
        <Icon className="h-4 w-4" aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-lg font-semibold leading-none tabular-nums">{value}</p>
        <p className="mt-1 truncate text-xs text-muted-foreground">{label}</p>
        {children}
      </div>
    </div>
  );
}

/** A select in the control bar, labelled for screen readers, with an icon in place of a visible label. */
function BarSelect({ id, label, icon: Icon, value, onValueChange, children }) {
  return (
    <div>
      <Label htmlFor={id} className="sr-only">{label}</Label>
      <Select value={value} onValueChange={onValueChange}>
        <SelectTrigger id={id} className="h-9 w-[150px] gap-2 bg-background">
          <Icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
          <SelectValue />
        </SelectTrigger>
        <SelectContent>{children}</SelectContent>
      </Select>
    </div>
  );
}

/**
 * The dispatch board: technicians × the day's hours, or × the week's days, with the unassigned
 * queue beside it. Drag a job onto a technician's cell to assign and schedule it, or between cells
 * to move it; every card also has "Schedule…", the same move as a dialog. Clashes, over-full days
 * and unavailable people are shown before anything is sent (`hooks/useScheduleCommit`).
 *
 * The date, view and filters live in the URL, so a board can be shared.
 */
export default function DispatchBoardPage() {
  const [search, setSearch] = useSearchParams();
  const date = /^\d{4}-\d{2}-\d{2}$/.test(search.get('date') ?? '') ? search.get('date') : ktmDay();
  const view = search.get('view') === 'week' ? 'week' : 'day';
  const role = search.get('role') ?? '';
  const skill = search.get('skill') ?? '';
  const area = search.get('area') ?? '';
  const setParam = (changes) => {
    const next = new URLSearchParams(search);
    for (const [k, v] of Object.entries(changes)) {
      if (v) next.set(k, v); else next.delete(k);
    }
    setSearch(next, { replace: true });
  };

  const { data: board, isLoading, isFetching, error, refetch } = useGetDispatchBoardQuery({ date, view, ...(role ? { role } : {}) });
  const lanes = useMemo(() => filterLanes(board?.lanes, { skill, area }), [board, skill, area]);
  const options = useMemo(() => laneOptions(board?.lanes), [board]);
  const stats = useMemo(() => (board ? boardStats(board, lanes) : null), [board, lanes]);
  const [commit, confirmDialog] = useScheduleCommit({ lanes: board?.lanes, days: board?.days });

  const [active, setActive] = useState(null);
  const [pending, setPending] = useState({});
  const [scheduling, setScheduling] = useState(null);

  const onDrop = useCallback(async (job, fromLane, target) => {
    const window = dropWindow(job, target);
    const technicianIds = dropTechnicians(job, target.technicianId, fromLane);
    if (!window || isSameDrop(job, window, technicianIds)) return;
    setPending((p) => ({ ...p, [job.id]: true }));
    try {
      await commit(job, { ...window, technicianIds });
    } finally {
      setPending((p) => {
        const next = { ...p };
        delete next[job.id];
        return next;
      });
    }
  }, [commit]);

  // A cell is where the pointer is; the keyboard (no pointer) falls back to overlap.
  const collisionDetection = useCallback((args) => {
    const hits = pointerWithin(args);
    return hits.length ? hits : rectIntersection(args);
  }, []);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor),
  );

  const cellWords = (data) => (data ? `${lanes.find((l) => l.technician.id === data.technicianId)?.technician.name ?? ''}, ${data.day}${data.hour != null ? ` ${hourLabel(data.hour)}` : ''}` : '');

  return (
    <PageTransition>
      <PageHeader
        title="Dispatch board"
        description={dayWords(date) + (view === 'week' ? ' and the six days after' : '')}
        actions={<Button asChild variant="outline" size="sm"><Link to="/admin/jobs"><List /> Jobs</Link></Button>}
      />

      <div className="mb-4 grid gap-3 lg:grid-cols-[auto_minmax(0,1fr)]">
        <div className="flex items-center gap-3 rounded-2xl border bg-gradient-to-br from-primary/10 via-card to-card p-3 shadow-[var(--elevation-1)]">
          <Button variant="ghost" size="icon" className="rounded-full" aria-label={view === 'week' ? 'Previous week' : 'Previous day'} onClick={() => setParam({ date: shiftBoardDate(date, view, -1) })}>
            <ChevronLeft />
          </Button>
          <div className="flex items-center gap-3">
            <div className="flex h-14 w-14 flex-col items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-[var(--elevation-2)]">
              <span className="text-[10px] font-semibold uppercase tracking-wider opacity-80">{datePart(date, { month: 'short' })}</span>
              <span className="text-xl font-bold leading-none tabular-nums">{datePart(date, { day: 'numeric' })}</span>
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold">{datePart(date, { weekday: 'long' })}</p>
              <p className="text-xs text-muted-foreground">{view === 'week' ? 'and the six days after' : datePart(date, { year: 'numeric' })}</p>
              <div className="mt-1 flex items-center gap-1.5">
                <Button variant={date === ktmDay() ? 'secondary' : 'outline'} size="sm" className="h-6 rounded-full px-2.5 text-xs" onClick={() => setParam({ date: '' })}>Today</Button>
                <Label htmlFor="board-date" className="sr-only">Date</Label>
                <Input id="board-date" type="date" value={date} onChange={(e) => setParam({ date: e.target.value })} className="h-6 w-[120px] rounded-full px-2 text-xs" />
              </div>
            </div>
          </div>
          <Button variant="ghost" size="icon" className="rounded-full" aria-label={view === 'week' ? 'Next week' : 'Next day'} onClick={() => setParam({ date: shiftBoardDate(date, view, 1) })}>
            <ChevronRight />
          </Button>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
          {stats ? (
            <>
              <Stat icon={Users} label="On the board" value={stats.people} tone="bg-info/15 text-info" />
              <Stat icon={BriefcaseBusiness} label={view === 'week' ? 'Jobs this week' : 'Jobs today'} value={stats.jobs} tone="bg-primary/10 text-primary" />
              <Stat icon={Inbox} label="Waiting for people" value={stats.unassigned} tone="bg-warning/15 text-warning" />
              <Stat
                icon={AlertTriangle} label={stats.clashes === 1 ? 'Clash' : 'Clashes'} value={stats.clashes}
                tone={stats.clashes ? 'bg-destructive/15 text-destructive' : 'bg-success/15 text-success'}
              />
              <Stat icon={Gauge} label="Capacity used" value={`${stats.utilisation}%`} tone="bg-gold/15 text-gold">
                <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-muted" aria-hidden>
                  <div
                    className={cn('h-full rounded-full', stats.utilisation > 100 ? 'bg-destructive' : stats.utilisation >= 80 ? 'bg-warning' : 'bg-success')}
                    style={{ width: `${Math.min(100, stats.utilisation)}%` }}
                  />
                </div>
              </Stat>
            </>
          ) : Array.from({ length: 5 }, (_, i) => <Skeleton key={i} className="h-[62px] rounded-xl" />)}
        </div>
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-2 rounded-xl border bg-muted/40 p-2">
        <ToggleGroup type="single" variant="outline" size="sm" value={view} aria-label="View" onValueChange={(v) => v && setParam({ view: v === 'day' ? '' : v })} className="rounded-lg bg-background">
          <ToggleGroupItem value="day">Day</ToggleGroupItem>
          <ToggleGroupItem value="week">Week</ToggleGroupItem>
        </ToggleGroup>
        <span aria-hidden className="mx-1 h-6 border-l border-dotted border-border" />
        <BarSelect id="board-role" label="Who" icon={Users} value={role || ALL} onValueChange={(v) => setParam({ role: v === ALL ? '' : v })}>
          {WHO.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
        </BarSelect>
        <BarSelect id="board-skill" label="Skill" icon={Wrench} value={skill || ALL} onValueChange={(v) => setParam({ skill: v === ALL ? '' : v })}>
          <SelectItem value={ALL}>Any skill</SelectItem>
          {options.skills.map((sk) => <SelectItem key={sk} value={sk}>{sk}</SelectItem>)}
        </BarSelect>
        <BarSelect id="board-area" label="Area" icon={MapPin} value={area || ALL} onValueChange={(v) => setParam({ area: v === ALL ? '' : v })}>
          <SelectItem value={ALL}>Any area</SelectItem>
          {options.areas.map((a) => <SelectItem key={a} value={a}>{a}</SelectItem>)}
        </BarSelect>
        {isFetching && !isLoading ? (
          <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground" aria-live="polite">
            <Sparkles className="h-3.5 w-3.5 animate-pulse text-primary motion-reduce:animate-none" aria-hidden /> Updating…
          </span>
        ) : null}
        <p className="ml-auto hidden items-center gap-1.5 text-xs text-muted-foreground md:flex">
          <Hand className="h-3.5 w-3.5" aria-hidden />
          Grab a job onto a technician’s {view === 'week' ? 'day' : 'hour'}, or press “Schedule…”. Clashes are flagged before saving.
        </p>
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={collisionDetection}
        // A job dragged in from the queue crosses the grid's right edge; a wide edge zone would
        // scroll the hours away under the pointer. Scroll only right at the edges.
        autoScroll={{ threshold: { x: 0.04, y: 0.1 } }}
        onDragStart={({ active: a }) => setActive(a.data.current?.job ?? null)}
        onDragCancel={() => setActive(null)}
        onDragEnd={({ active: a, over }) => {
          setActive(null);
          const job = a.data.current?.job;
          const target = over?.data.current;
          if (job && target?.technicianId) onDrop(job, a.data.current.laneId ?? null, target);
        }}
        accessibility={{
          announcements: {
            onDragStart: ({ active: a }) => `Picked up ${a.data.current?.job?.number}.`,
            onDragOver: ({ over }) => (over ? `Over ${cellWords(over.data.current)}.` : 'Not over a technician.'),
            onDragEnd: ({ active: a, over }) => (over?.data.current?.technicianId
              ? `Scheduling ${a.data.current?.job?.number} for ${cellWords(over.data.current)}.`
              : `${a.data.current?.job?.number} stays where it was.`),
            onDragCancel: ({ active: a }) => `${a.data.current?.job?.number} stays where it was.`,
          },
        }}
      >
        <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_19rem]">
          <div className="min-w-0">
            {error ? <ErrorState error={error} onRetry={refetch} /> : null}
            {isLoading ? <Skeleton className="h-96 rounded-2xl" /> : null}
            {board ? (
              <DispatchGrid board={board} lanes={lanes} dragging={Boolean(active)} pending={pending} onSchedule={setScheduling} />
            ) : null}
          </div>
          <UnassignedQueue unscheduledAssigned={board?.unscheduledAssigned} onSchedule={setScheduling} pending={pending} />
        </div>
        <DragOverlay dropAnimation={null}>
          {active ? (
            <JobCardFace
              job={active}
              style={jobToneStyle(active.status)}
              className="w-60 rotate-2 scale-[1.03] cursor-grabbing shadow-[var(--elevation-3)] ring-2 ring-[hsl(var(--tone)/0.4)] motion-reduce:rotate-0 motion-reduce:scale-100"
            />
          ) : null}
        </DragOverlay>
      </DndContext>

      <ScheduleJobDialog
        job={scheduling}
        onOpenChange={(open) => { if (!open) setScheduling(null); }}
        lanes={board?.lanes}
        days={board?.days}
      />
      {confirmDialog}
    </PageTransition>
  );
}
