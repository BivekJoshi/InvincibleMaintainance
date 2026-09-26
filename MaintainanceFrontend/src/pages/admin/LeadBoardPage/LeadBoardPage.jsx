import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import {
  DndContext, DragOverlay, KeyboardSensor, PointerSensor, pointerWithin, rectIntersection, useSensor, useSensors,
} from '@dnd-kit/core';
import { Eye, EyeOff, List, Search } from 'lucide-react';
import { PageHeader } from '@/components/common/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { PageTransition } from '@/three/motion/motionKit';
import { useAuth } from '@/hooks/useAuth';
import { useListParams } from '@/hooks/useListParams';
import { useLeadStatusChange } from '@/hooks/useLeadStatusChange';
import { useLeadFollowUp } from '@/hooks/useLeadFollowUp';
import { useLazyGetLeadQuery } from '@/api/leadsApi';
import { toastError } from '@/redux/slices/uiSlice';
import {
  BOARD_COLUMNS, FOLDABLE_COLUMNS, canDrop, cardsForColumn, dropDialogFor, funnelSummary, hasQuotation, isGoingCold, toneStyle,
} from '@/helpers/leadBoard';
import { DEFAULT_LEAD_VIEW, LEAD_VIEWS, leadQueryFor } from '@/config/admin/leadViews';
import { LEAD_STATUS_LABELS } from '@/config/constants';
import { BoardColumn } from './BoardColumn';
import { BoardCardFace } from './BoardCard';
import { FunnelStrip } from './FunnelStrip';

/** The board's search box. It applies after a pause in typing, or on Enter, not on every key. */
function BoardSearch({ value, onChange }) {
  const [draft, setDraft] = useState(value ?? '');
  useEffect(() => { setDraft(value ?? ''); }, [value]);
  useEffect(() => {
    const next = draft.trim() || undefined;
    if (next === (value || undefined)) return undefined;
    const id = setTimeout(() => onChange(next), 400);
    return () => clearTimeout(id);
  }, [draft, value, onChange]);

  return (
    <div className="relative w-full sm:w-72">
      <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" aria-hidden />
      <Input
        type="search"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); onChange(draft.trim() || undefined); } }}
        placeholder="Search name, phone, address…"
        aria-label="Search the pipeline"
        className="h-9 rounded-full pl-8"
      />
    </div>
  );
}

/**
 * The pipeline: a column per lead status. Dragging a card asks the API to move the lead
 * (`PATCH /admin/leads/:id/status`); only the columns the state machine allows accept it,
 * and a refused move puts the card back with the reason in a toast.
 *
 * A move with work behind it opens that work instead (Phase L1, `dropDialogFor`): "Visit booked" opens
 * the visit booking, "Quoted" without a quotation opens the new-quotation sheet, "Lost" asks why. The
 * card moves only when the dialog completes — to wherever the server then lists it (a draft quotation
 * leaves the lead Contacted until it is sent) — and Cancel leaves it where it was. The drop, the
 * keyboard and the "Move to" menu all run the same `move`.
 */
export default function LeadBoardPage() {
  const { can } = useAuth();
  const canWrite = can('leads:write');
  const [params, setParams] = useListParams({ view: DEFAULT_LEAD_VIEW });
  const query = useMemo(() => {
    const { page: _p, limit: _l, sort: _s, status: _st, closed: _c, ...rest } = leadQueryFor(params);
    return rest;
  }, [params]);
  const [changeStatus, statusDialog] = useLeadStatusChange();
  const [openFollowUp, followUpDialogs] = useLeadFollowUp();
  const [fetchLead] = useLazyGetLeadQuery();
  const dispatch = useDispatch();

  const [byColumn, setByColumn] = useState({});
  const [pending, setPending] = useState({});
  const [active, setActive] = useState(null);

  const [totals, setTotals] = useState({});

  const onLoaded = useCallback((status, items, total) => {
    setByColumn((prev) => ({ ...prev, [status]: items }));
    setTotals((prev) => (prev[status] === total ? prev : { ...prev, [status]: total }));
    // A move is settled once the server lists the lead under its new status.
    setPending((prev) => {
      const done = Object.keys(prev).filter((id) => prev[id] === status && items.some((l) => l.id === id));
      if (!done.length) return prev;
      const next = { ...prev };
      for (const id of done) delete next[id];
      return next;
    });
  }, []);

  // Every lead the columns hold, once — a lead mid-move may briefly be in two.
  const leads = useMemo(() => {
    const seen = new Map();
    for (const status of BOARD_COLUMNS) {
      for (const lead of byColumn[status] ?? []) {
        const kept = seen.get(lead.id);
        if (!kept || lead.status === pending[lead.id]) seen.set(lead.id, lead);
      }
    }
    return [...seen.values()];
  }, [byColumn, pending]);

  const settle = useCallback((id) => setPending((p) => {
    if (!(id in p)) return p;
    const next = { ...p };
    delete next[id];
    return next;
  }), []);

  const move = useCallback(async (lead, to) => {
    if (!canDrop(lead.status, to)) return;
    let record = lead;
    let quoted = to === 'QUOTED' ? hasQuotation(lead) : null;
    if (to === 'QUOTED' && quoted == null) {
      // A list row does not say whether a quotation exists; the lead's own record does.
      try {
        record = await fetchLead(lead.id, true).unwrap();
        quoted = hasQuotation(record);
      } catch (err) {
        dispatch(toastError(`Could not move ${lead.name}`, err?.data?.error?.message ?? 'Please try again.'));
        return;
      }
    }

    const dialog = dropDialogFor(to, quoted);
    if (dialog === 'visit' || dialog === 'quotation') {
      // The card stays put while the dialog is open. Done: the columns refetch and it shows where the
      // server moved it. Cancel: nothing changed.
      await openFollowUp({ ...lead, ...record }, dialog);
      return;
    }
    if (dialog === 'lost') {
      if (await changeStatus(lead, to)) setPending((p) => ({ ...p, [lead.id]: to }));
      return;
    }
    setPending((p) => ({ ...p, [lead.id]: to }));
    if (!(await changeStatus(lead, to))) settle(lead.id);
  }, [changeStatus, dispatch, fetchLead, openFollowUp, settle]);

  // A column is where the pointer is; the keyboard (no pointer) falls back to overlap.
  const collisionDetection = useCallback((args) => {
    const hits = pointerWithin(args);
    return hits.length ? hits : rectIntersection(args);
  }, []);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor),
  );

  const view = params.assignedToId ? '' : params.view ?? DEFAULT_LEAD_VIEW;
  // Won and Lost fold to a strip unless `?closed=show`, so the working columns get the width.
  const showClosed = params.closed === 'show';
  const setShowClosed = (show) => setParams({ ...params, closed: show ? 'show' : undefined });
  const onSearch = useCallback((q) => setParams({ ...params, q }), [params, setParams]);
  const summary = useMemo(() => funnelSummary(totals), [totals]);
  const cold = useMemo(() => leads.filter((lead) => isGoingCold(lead)).length, [leads]);

  return (
    <PageTransition>
      <PageHeader
        title="Pipeline"
        description="Drag a lead to move it along. Only the moves the process allows are open; booking a visit or starting a quotation opens its dialog."
        actions={<Button asChild variant="outline" size="sm"><Link to={`/admin/leads?view=${view || 'all'}`}><List /> Table</Link></Button>}
      />
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <ToggleGroup
          type="single" variant="outline" size="sm" value={view} aria-label="Whose leads"
          onValueChange={(v) => v && setParams({ view: v, q: params.q, closed: params.closed })}
          className="justify-start rounded-full bg-muted/50 p-1"
        >
          {LEAD_VIEWS.map((v) => (
            <ToggleGroupItem key={v.value} value={v.value} className="rounded-full border-0 px-4 data-[state=on]:bg-background data-[state=on]:shadow-[var(--elevation-1)]">
              {v.label}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
        <BoardSearch value={params.q} onChange={onSearch} />
        <Button variant="outline" size="sm" className="rounded-full" onClick={() => setShowClosed(!showClosed)} aria-pressed={showClosed}>
          {showClosed ? <EyeOff /> : <Eye />} {showClosed ? 'Fold won and lost' : 'Show won and lost'}
        </Button>
      </div>

      <FunnelStrip totals={totals} cold={cold} />

      <DndContext
        sensors={sensors}
        collisionDetection={collisionDetection}
        onDragStart={({ active: a }) => setActive(a.data.current?.lead ?? null)}
        onDragCancel={() => setActive(null)}
        onDragEnd={({ active: a, over }) => {
          setActive(null);
          const lead = a.data.current?.lead;
          const to = over?.data.current?.status;
          if (lead && to) move(lead, to);
        }}
        accessibility={{
          announcements: {
            onDragStart: ({ active: a }) => `Picked up ${a.data.current?.lead?.name}.`,
            onDragOver: ({ over }) => (over ? `Over ${LEAD_STATUS_LABELS[over.id]}.` : 'Not over a column.'),
            onDragEnd: ({ active: a, over }) => {
              const lead = a.data.current?.lead;
              if (!over || !canDrop(lead?.status, over.id)) return `${lead?.name} stays where it was.`;
              if (over.id === 'INSPECTION_SCHEDULED') return `Book the visit to move ${lead?.name}.`;
              return `Moving ${lead?.name} to ${LEAD_STATUS_LABELS[over.id]}.`;
            },
            onDragCancel: ({ active: a }) => `${a.data.current?.lead?.name} stays where it was.`,
          },
        }}
      >
        <div className="overflow-x-auto rounded-2xl border bg-card shadow-[var(--elevation-1)] [scrollbar-width:thin]">
          <div className="flex min-w-full items-stretch divide-x-2 divide-dotted divide-border">
            {BOARD_COLUMNS.map((status) => (
              <BoardColumn
                key={status}
                status={status}
                query={query}
                cards={cardsForColumn(leads, pending, status)}
                onLoaded={onLoaded}
                dropState={active ? (canDrop(active.status, status) ? 'allowed' : status === active.status ? null : 'refused') : null}
                canWrite={canWrite}
                onMove={move}
                pending={pending}
                folded={!showClosed && FOLDABLE_COLUMNS.includes(status)}
                share={summary.total ? summary.shares[status] : null}
                first={status === BOARD_COLUMNS[0]}
                onUnfold={() => setShowClosed(true)}
              />
            ))}
          </div>
        </div>
        <DragOverlay dropAnimation={null}>
          {active ? (
            <BoardCardFace
              lead={active}
              style={toneStyle(active.status)}
              className="w-72 rotate-2 scale-[1.03] cursor-grabbing shadow-[var(--elevation-3)] ring-2 ring-[hsl(var(--tone)/0.35)] motion-reduce:rotate-0 motion-reduce:scale-100"
            />
          ) : null}
        </DragOverlay>
      </DndContext>
      {statusDialog}
      {followUpDialogs}
    </PageTransition>
  );
}
