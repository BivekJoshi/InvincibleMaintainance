import { useCallback, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  DndContext, DragOverlay, KeyboardSensor, PointerSensor, pointerWithin, rectIntersection, useSensor, useSensors,
} from '@dnd-kit/core';
import { ChevronLeft, ChevronRight, List } from 'lucide-react';
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
import { useScheduleCommit } from '@/hooks/useScheduleCommit';
import {
  dropTechnicians, dropWindow, filterLanes, hourLabel, isSameDrop, ktmDay, laneOptions, shiftBoardDate,
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

      <div className="mb-4 flex flex-wrap items-end gap-3">
        <div className="flex items-center gap-1">
          <Button variant="outline" size="icon" aria-label={view === 'week' ? 'Previous week' : 'Previous day'} onClick={() => setParam({ date: shiftBoardDate(date, view, -1) })}>
            <ChevronLeft />
          </Button>
          <Button variant="outline" size="sm" onClick={() => setParam({ date: '' })}>Today</Button>
          <Button variant="outline" size="icon" aria-label={view === 'week' ? 'Next week' : 'Next day'} onClick={() => setParam({ date: shiftBoardDate(date, view, 1) })}>
            <ChevronRight />
          </Button>
        </div>
        <div className="space-y-1">
          <Label htmlFor="board-date" className="text-xs">Date</Label>
          <Input id="board-date" type="date" value={date} onChange={(e) => setParam({ date: e.target.value })} className="h-9 w-[160px]" />
        </div>
        <ToggleGroup type="single" variant="outline" size="sm" value={view} aria-label="View" onValueChange={(v) => v && setParam({ view: v === 'day' ? '' : v })}>
          <ToggleGroupItem value="day">Day</ToggleGroupItem>
          <ToggleGroupItem value="week">Week</ToggleGroupItem>
        </ToggleGroup>
        <div className="space-y-1">
          <Label htmlFor="board-role" className="text-xs">Who</Label>
          <Select value={role || ALL} onValueChange={(v) => setParam({ role: v === ALL ? '' : v })}>
            <SelectTrigger id="board-role" className="h-9 w-[140px]"><SelectValue /></SelectTrigger>
            <SelectContent>{WHO.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label htmlFor="board-skill" className="text-xs">Skill</Label>
          <Select value={skill || ALL} onValueChange={(v) => setParam({ skill: v === ALL ? '' : v })}>
            <SelectTrigger id="board-skill" className="h-9 w-[160px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Any skill</SelectItem>
              {options.skills.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label htmlFor="board-area" className="text-xs">Area</Label>
          <Select value={area || ALL} onValueChange={(v) => setParam({ area: v === ALL ? '' : v })}>
            <SelectTrigger id="board-area" className="h-9 w-[160px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Any area</SelectItem>
              {options.areas.map((a) => <SelectItem key={a} value={a}>{a}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        {isFetching && !isLoading ? <span className="pb-2 text-xs text-muted-foreground" aria-live="polite">Updating…</span> : null}
      </div>

      <p className="mb-3 text-xs text-muted-foreground">
        Drag a job by its handle onto a technician’s {view === 'week' ? 'day' : 'hour'}, or press “Schedule…” on the card.
        You are warned before a clash or an over-full day is saved.
      </p>

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
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_18rem]">
          <div className="min-w-0">
            {error ? <ErrorState error={error} onRetry={refetch} /> : null}
            {isLoading ? <Skeleton className="h-96" /> : null}
            {board ? (
              <DispatchGrid board={board} lanes={lanes} dragging={Boolean(active)} pending={pending} onSchedule={setScheduling} />
            ) : null}
          </div>
          <UnassignedQueue unscheduledAssigned={board?.unscheduledAssigned} onSchedule={setScheduling} pending={pending} />
        </div>
        <DragOverlay dropAnimation={null}>
          {active ? <JobCardFace job={active} className="w-56 rotate-1 shadow-lg" /> : null}
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
