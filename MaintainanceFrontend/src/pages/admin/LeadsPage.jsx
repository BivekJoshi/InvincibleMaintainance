import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import {
  AlarmClock, CalendarCheck, CalendarDays, Download, Flame, KanbanSquare, Plus, Sparkles, UserPlus, UserX,
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
import { StatusBadge, PriorityBadge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { PageTransition } from '@/three/motion/motionKit';
import { LEAD_SOURCES, LEAD_SOURCE_LABELS, LEAD_STATUSES, LEAD_STATUS_LABELS, PRIORITIES } from '@/config/constants';
import { ASSIGNEE_RELATION, SERVICE_RELATION } from '@/config/admin/crmForms';
import {
  DEFAULT_LEAD_VIEW, LEAD_PRESETS, LEAD_VIEWS, activePreset, applyPreset, leadQueryFor,
} from '@/config/admin/leadViews';
import { formatDate, formatDateTime, titleCase } from '@/helpers/format';
import { cn } from '@/helpers/utils';

const columns = [
  {
    key: 'name', header: 'Customer', sortable: true,
    cell: (r) => (
      <div className="min-w-0">
        <p className="truncate font-medium">{r.name}</p>
        <a href={`tel:${r.phone}`} onClick={(e) => e.stopPropagation()} className="text-xs text-muted-foreground hover:text-primary hover:underline">
          {r.phone}
        </a>
      </div>
    ),
  },
  { key: 'service', header: 'Service', cell: (r) => r.service?.name ?? <span className="text-muted-foreground">General</span> },
  { key: 'area', header: 'Area', cell: (r) => r.area ?? r.address ?? '—', className: 'max-w-[180px] truncate' },
  {
    key: 'status', header: 'Status', sortable: true,
    cell: (r) => (
      <div className="flex items-center gap-1.5">
        <StatusBadge status={r.status} />
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
      <span className="whitespace-nowrap text-xs">
        <CalendarCheck className="mr-1 inline h-3.5 w-3.5 text-primary" aria-hidden />
        {formatDate(r.preferredAt)}
        {r.preferredSlot ? <span className="text-muted-foreground"> · {r.preferredSlot}</span> : null}
      </span>
    ) : <span className="text-muted-foreground">—</span>),
  },
  { key: 'source', header: 'Source', cell: (r) => <span className="text-xs text-muted-foreground">{LEAD_SOURCE_LABELS[r.source] ?? titleCase(r.source)}</span> },
  { key: 'assignedTo', header: 'Owner', cell: (r) => r.assignedTo?.name ?? <span className="text-muted-foreground">Unassigned</span> },
  { key: 'createdAt', header: 'Received', sortable: true, cell: (r) => <span className="whitespace-nowrap text-xs text-muted-foreground">{formatDateTime(r.createdAt)}</span> },
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

/** Each quick view's icon, and the colour it takes when on. */
const PRESET_LOOK = {
  breached: { icon: AlarmClock, active: 'border-destructive/40 bg-destructive/10 text-destructive' },
  'due-soon': { icon: AlarmClock, active: 'border-warning-border bg-warning-surface text-warning-foreground' },
  unassigned: { icon: UserX, active: 'border-primary/40 bg-primary/10 text-primary' },
  urgent: { icon: Flame, active: 'border-destructive/40 bg-destructive/10 text-destructive' },
  'new-today': { icon: Sparkles, active: 'border-primary/40 bg-primary/10 text-primary' },
  'bookings-week': { icon: CalendarDays, active: 'border-success-border bg-success-surface text-success-foreground' },
};

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

      <nav aria-label="Saved views" className="-mx-1 mb-4 flex items-center gap-2 overflow-x-auto px-1 pb-1">
        <span className="shrink-0 text-xs font-medium uppercase tracking-wide text-muted-foreground">Quick views</span>
        {LEAD_PRESETS.map((p) => {
          const look = PRESET_LOOK[p.key] ?? {};
          const Icon = look.icon;
          const on = preset === p.key;
          return (
            <button
              key={p.key} type="button" title={p.hint} aria-pressed={on}
              onClick={() => setParams(on ? { limit: params.limit, sort: params.sort, view: 'all', page: 1 } : applyPreset(params, p))}
              className={cn(
                'inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full border px-3 text-xs font-medium transition-colors',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                on ? look.active : 'border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground',
              )}
            >
              {Icon ? <Icon className="h-3.5 w-3.5" aria-hidden /> : null}
              {p.label}
            </button>
          );
        })}
      </nav>

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
