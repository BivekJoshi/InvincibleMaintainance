import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import {
  AlarmClock, Calculator, CalendarCheck, CalendarDays, ChevronRight, Download, Flame, Footprints, Globe, HelpCircle,
  KanbanSquare, MessageCircle, Phone, Plus, Sparkles, UserPlus, UserX, Users, Wrench,
} from 'lucide-react';
import { useGetLeadsQuery, useLazyExportLeadsCsvQuery } from '@/api/leadsApi';
import { useListParams } from '@/hooks/useListParams';
import { useAuth } from '@/hooks/useAuth';
import { toastError } from '@/redux/slices/uiSlice';
import { PageHeader } from '@/components/common/PageHeader';
import { CustomTable } from '@/components/common/CustomTable/CustomTable';
import { SlaChip } from '@/components/common/SlaChip';
import { LeadFormSheet } from '@/components/leads/LeadFormSheet';
import { AssignLeadDialog } from '@/components/leads/AssignLeadDialog';
import { PriorityBadge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { PageTransition } from '@/three/motion/motionKit';
import { LEAD_SOURCES, LEAD_SOURCE_LABELS, LEAD_STATUSES, LEAD_STATUS_LABELS, PRIORITIES } from '@/config/constants';
import { ASSIGNEE_RELATION, SERVICE_RELATION } from '@/config/admin/crmForms';
import {
  DEFAULT_LEAD_VIEW, LEAD_PRESETS, LEAD_VIEWS, activePreset, applyPreset, leadQueryFor,
} from '@/config/admin/leadViews';
import { formatDate, formatDateTime, initials, relativeTime, titleCase } from '@/helpers/format';
import { toneStyle } from '@/helpers/leadBoard';
import { cn } from '@/helpers/utils';

/** Where an enquiry came from, as an icon. */
const SOURCE_ICONS = {
  web_form: Globe,
  estimator: Calculator,
  booking: CalendarCheck,
  call: Phone,
  whatsapp: MessageCircle,
  viber: MessageCircle,
  walk_in: Footprints,
  referral: Users,
  other: HelpCircle,
};

/** A lead's status as a pill in its stage colour — the same colours as the pipeline. */
function StagePill({ status }) {
  return (
    <span
      style={toneStyle(status)}
      className="inline-flex items-center gap-1.5 rounded-full bg-[hsl(var(--tone)/0.12)] px-2.5 py-0.5 text-xs font-medium text-foreground ring-1 ring-inset ring-[hsl(var(--tone)/0.25)]"
    >
      <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-[hsl(var(--tone))]" />
      {LEAD_STATUS_LABELS[status] ?? titleCase(status)}
    </span>
  );
}

/** Someone's initials in a circle; the caller sets its size and colour. */
function Initials({ name, className }) {
  return (
    <span
      aria-hidden
      className={cn('flex shrink-0 items-center justify-center rounded-full font-bold', className)}
    >
      {initials(name)}
    </span>
  );
}

const columns = [
  {
    key: 'name', header: 'Customer', sortable: true,
    cell: (r) => (
      <div className="flex min-w-0 items-center gap-3" style={toneStyle(r.status)}>
        <Initials
          name={r.name}
          className="h-9 w-9 bg-[hsl(var(--tone)/0.14)] text-xs text-[hsl(var(--tone))] ring-2 ring-[hsl(var(--tone)/0.2)]"
        />
        <div className="min-w-0">
          <p className="truncate font-semibold">{r.name}</p>
          <a
            href={`tel:${r.phone}`} onClick={(e) => e.stopPropagation()}
            className="inline-flex items-center gap-1 text-xs tabular-nums text-muted-foreground hover:text-primary hover:underline"
          >
            <Phone className="h-3 w-3" aria-hidden />{r.phone}
          </a>
        </div>
      </div>
    ),
  },
  {
    key: 'service', header: 'Service',
    cell: (r) => (
      <span className="inline-flex max-w-[200px] items-center gap-1.5">
        <Wrench className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
        <span className="truncate">{r.service?.name ?? <span className="text-muted-foreground">General</span>}</span>
      </span>
    ),
  },
  { key: 'area', header: 'Area', cell: (r) => r.area ?? r.address ?? '—', className: 'max-w-[180px] truncate' },
  {
    key: 'status', header: 'Status', sortable: true,
    cell: (r) => (
      <div className="flex items-center gap-1.5">
        <StagePill status={r.status} />
        <PriorityBadge priority={r.priority} />
      </div>
    ),
  },
  { key: 'sla', header: 'Response', cell: (r) => <SlaChip sla={r.sla} /> },
  {
    // An online booking names a day and a window; dispatch has to see it here,
    // not only after opening the lead.
    key: 'preferredAt', header: 'Requested visit', sortable: true,
    cell: (r) => (r.preferredAt ? (
      <span className="inline-flex items-center gap-2 whitespace-nowrap rounded-lg bg-primary/5 px-2 py-1 text-xs ring-1 ring-inset ring-primary/15">
        <CalendarCheck className="h-3.5 w-3.5 text-primary" aria-hidden />
        <span>
          {formatDate(r.preferredAt)}
          {r.preferredSlot ? <span className="text-muted-foreground"> · {r.preferredSlot}</span> : null}
        </span>
      </span>
    ) : <span className="text-muted-foreground">—</span>),
  },
  {
    key: 'source', header: 'Source',
    cell: (r) => {
      const Icon = SOURCE_ICONS[r.source] ?? HelpCircle;
      return (
        <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-xs text-muted-foreground">
          <span className="flex h-6 w-6 items-center justify-center rounded-md bg-muted"><Icon className="h-3.5 w-3.5" aria-hidden /></span>
          {LEAD_SOURCE_LABELS[r.source] ?? titleCase(r.source)}
        </span>
      );
    },
  },
  {
    key: 'assignedTo', header: 'Owner',
    cell: (r) => (r.assignedTo ? (
      <span className="inline-flex items-center gap-2 whitespace-nowrap">
        <Initials name={r.assignedTo.name} className="h-6 w-6 bg-primary/10 text-[10px] text-primary" />
        {r.assignedTo.name}
      </span>
    ) : (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-dashed border-warning-border px-2 py-0.5 text-xs text-warning-foreground">
        <UserX className="h-3 w-3" aria-hidden /> Unassigned
      </span>
    )),
  },
  {
    key: 'createdAt', header: 'Received', sortable: true,
    cell: (r) => (
      <span className="whitespace-nowrap text-xs" title={formatDateTime(r.createdAt)}>
        <span className="block font-medium">{relativeTime(r.createdAt)}</span>
        <span className="text-muted-foreground">{formatDate(r.createdAt)}</span>
      </span>
    ),
  },
];

const PRIORITY_TONES = { LOW: 'muted', NORMAL: 'info', HIGH: 'warning', URGENT: 'danger' };

// Ordered by what sales checks first: is anything late, where is it in the pipeline,
// who has it — then the finer cuts. Shown in the Filters panel, as chips.
const filters = [
  {
    key: 'slaRisk', label: 'Response', type: 'enum', hint: '2-hour clock',
    options: [
      { value: 'breached', label: 'Deadline passed', tone: 'danger' },
      { value: 'at_risk', label: 'Due soon', tone: 'warning' },
      { value: 'ok', label: 'On track', tone: 'success' },
    ],
  },
  { key: 'status', label: 'Status', type: 'enum', options: LEAD_STATUSES.map((s) => ({ value: s, label: LEAD_STATUS_LABELS[s] })) },
  { key: 'priority', label: 'Priority', type: 'enum', options: PRIORITIES.map((p) => ({ value: p, label: titleCase(p), tone: PRIORITY_TONES[p] })) },
  {
    key: 'assignedToId', label: 'Owner', type: 'relation', relation: ASSIGNEE_RELATION,
    fixedOptions: [{ value: 'none', label: 'Unassigned' }],
  },
  { key: 'serviceId', label: 'Service', type: 'relation', relation: SERVICE_RELATION },
  { key: 'source', label: 'Source', type: 'enum', options: LEAD_SOURCES.map((s) => ({ value: s, label: LEAD_SOURCE_LABELS[s] })) },
  { key: 'requestedVisit', label: 'Requested visit', type: 'boolean', trueLabel: 'Asked for a visit', falseLabel: 'No visit asked' },
  { key: 'received', label: 'Received', type: 'dateRange' },
];

/** Each quick view's icon, and its colour — a theme variable, lit when the view is on. */
const PRESET_LOOK = {
  breached: { icon: AlarmClock, tone: '--sla-breach' },
  'due-soon': { icon: AlarmClock, tone: '--sla-warn' },
  unassigned: { icon: UserX, tone: '--primary' },
  urgent: { icon: Flame, tone: '--destructive' },
  'new-today': { icon: Sparkles, tone: '--info' },
  'bookings-week': { icon: CalendarDays, tone: '--success' },
};

/**
 * The funnel as a rail of stages. A stage filters the list to it; pressing it again clears it.
 * It writes the same `status` the Filters panel does, so the applied chip shows it too.
 */
function StageRail({ value, onChange }) {
  return (
    <nav aria-label="Stages" className="flex items-stretch overflow-x-auto rounded-2xl border bg-card p-1.5 shadow-[var(--elevation-1)] [scrollbar-width:none]">
      {LEAD_STATUSES.map((status, i) => {
        const on = value === status;
        return (
          <div key={status} className="flex shrink-0 items-center">
            {i ? <ChevronRight className="mx-0.5 h-4 w-4 text-muted-foreground/40" aria-hidden /> : null}
            <button
              type="button" aria-pressed={on} style={toneStyle(status)}
              onClick={() => onChange(on ? undefined : status)}
              className={cn(
                'group relative inline-flex h-9 items-center gap-2 rounded-xl px-3 text-sm font-medium transition-all motion-reduce:transition-none',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                on
                  ? 'bg-[hsl(var(--tone)/0.15)] text-foreground ring-1 ring-inset ring-[hsl(var(--tone)/0.4)]'
                  : 'text-muted-foreground hover:bg-[hsl(var(--tone)/0.08)] hover:text-foreground',
              )}
            >
              <span
                aria-hidden
                className={cn(
                  'h-2.5 w-2.5 rounded-full bg-[hsl(var(--tone))] transition-shadow',
                  on ? 'ring-4 ring-[hsl(var(--tone)/0.25)]' : 'opacity-70 group-hover:opacity-100',
                )}
              />
              {LEAD_STATUS_LABELS[status]}
            </button>
          </div>
        );
      })}
    </nav>
  );
}

/** Leads, opening on "My leads" (D6), with saved views, bulk assign and export. */
export default function LeadsPage() {
  const [params, setParams] = useListParams({ limit: 20, view: DEFAULT_LEAD_VIEW });
  const query = leadQueryFor(params);
  const { data, isLoading, isFetching, error, refetch } = useGetLeadsQuery(query);
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const { can } = useAuth();
  const canWrite = can('leads:write');
  const [fetchCsv, { isFetching: exporting }] = useLazyExportLeadsCsvQuery();
  const [creating, setCreating] = useState(false);
  const [assigning, setAssigning] = useState(null);

  const download = async (csvQuery, name) => {
    try {
      const csv = await fetchCsv(csvQuery).unwrap();
      // res.text() drops the byte-order mark the API sends. Put it back, or Excel
      // opens the file as ANSI and every Devanagari name turns to mojibake.
      const url = URL.createObjectURL(new Blob(['﻿', csv], { type: 'text/csv;charset=utf-8' }));
      const link = Object.assign(document.createElement('a'), {
        href: url, download: `${name}-${new Date().toISOString().slice(0, 10)}.csv`,
      });
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 0);
    } catch {
      dispatch(toastError('Could not export leads', 'Please try again in a moment.'));
    }
  };

  // Paging and sorting belong to the table; the export takes every row the filters match.
  const exportFiltered = () => {
    const { page: _page, limit: _limit, sort: _sort, ...rest } = query;
    return download(rest, 'leads');
  };

  const view = params.assignedToId ? '' : params.view ?? DEFAULT_LEAD_VIEW;
  const preset = activePreset(params);

  const toolbar = (
    <>
      <ToggleGroup
        type="single" variant="outline" size="sm" value={view} aria-label="Whose leads"
        onValueChange={(v) => v && setParams({ ...params, view: v, assignedToId: undefined, page: 1 })}
      >
        {LEAD_VIEWS.map((v) => <ToggleGroupItem key={v.value} value={v.value}>{v.label}</ToggleGroupItem>)}
      </ToggleGroup>
    </>
  );

  const bulkActions = [
    ...(canWrite ? [{ label: 'Assign', icon: UserPlus, onSelect: (rows) => setAssigning(rows) }] : []),
    {
      label: 'Export selected',
      icon: Download,
      onSelect: (rows) => download({ ids: rows.map((r) => r.id).join(',') }, 'leads-selected'),
    },
  ];

  return (
    <PageTransition>
      <PageHeader
        title="Leads"
        description="Every enquiry, with its response clock."
        actions={
          <>
            <Button asChild variant="outline" size="sm"><Link to="/admin/leads/board"><KanbanSquare /> Board</Link></Button>
            <Button variant="outline" size="sm" onClick={exportFiltered} loading={exporting}><Download /> Export</Button>
            {canWrite ? <Button size="sm" onClick={() => setCreating(true)}><Plus /> New lead</Button> : null}
          </>
        }
      />

      <div className="mb-4 space-y-3">
        <StageRail value={params.status} onChange={(status) => setParams({ ...params, status, page: 1 })} />

        <nav aria-label="Saved views" className="-mx-1 flex items-center gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none]">
          <span className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            <Sparkles className="h-3.5 w-3.5" aria-hidden /> Quick views
          </span>
          {LEAD_PRESETS.map((p) => {
            const look = PRESET_LOOK[p.key] ?? {};
            const Icon = look.icon;
            const on = preset === p.key;
            return (
              <button
                key={p.key} type="button" title={p.hint} aria-pressed={on}
                style={{ '--tone': `var(${look.tone ?? '--primary'})` }}
                onClick={() => setParams(on ? { limit: params.limit, sort: params.sort, view: 'all', page: 1 } : applyPreset(params, p))}
                className={cn(
                  'group inline-flex h-9 shrink-0 items-center gap-2 rounded-full border pl-1.5 pr-3.5 text-xs font-medium transition-all motion-reduce:transition-none',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  on
                    ? 'border-[hsl(var(--tone)/0.45)] bg-[hsl(var(--tone)/0.12)] text-foreground shadow-[var(--elevation-1)]'
                    : 'border-border bg-card text-muted-foreground hover:border-[hsl(var(--tone)/0.35)] hover:text-foreground',
                )}
              >
                {Icon ? (
                  <span
                    className={cn(
                      'flex h-6 w-6 items-center justify-center rounded-full transition-colors',
                      on ? 'bg-[hsl(var(--tone))] text-primary-foreground' : 'bg-[hsl(var(--tone)/0.12)] text-[hsl(var(--tone))]',
                    )}
                  >
                    <Icon className="h-3.5 w-3.5" aria-hidden />
                  </span>
                ) : null}
                {p.label}
              </button>
            );
          })}
        </nav>
      </div>

      <CustomTable
        storageKey="leads"
        columns={columns}
        data={data?.items}
        meta={data?.meta}
        isLoading={isLoading}
        isFetching={isFetching}
        error={error}
        refetch={refetch}
        params={params}
        onParamsChange={setParams}
        onRowClick={(row) => navigate(`/admin/leads/${row.id}`)}
        searchPlaceholder="Search name, phone, email, address…"
        emptyTitle={view === 'mine' ? 'No leads of yours match' : 'No leads match these filters'}
        emptyDescription={view === 'mine'
          ? 'Switch to All leads, or clear the filters.'
          : 'Clear the filters, or wait for the next enquiry from the website.'}
        filters={filters}
        filterLayout="panel"
        toolbar={toolbar}
        bulkActions={bulkActions}
        rowLabel={(r) => r.name}
      />

      {canWrite ? (
        <>
          <LeadFormSheet open={creating} onOpenChange={setCreating} onCreated={(lead) => navigate(`/admin/leads/${lead.id}`)} />
          <AssignLeadDialog
            leads={assigning ?? []}
            open={Boolean(assigning)}
            onOpenChange={(o) => { if (!o) setAssigning(null); }}
          />
        </>
      ) : null}
    </PageTransition>
  );
}
