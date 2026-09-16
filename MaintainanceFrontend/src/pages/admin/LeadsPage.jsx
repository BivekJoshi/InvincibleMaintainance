import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { CalendarCheck, Download, KanbanSquare, Plus, UserPlus } from 'lucide-react';
import { useGetLeadsQuery, useLazyExportLeadsCsvQuery } from '@/api/leadsApi';
import { useListParams } from '@/hooks/useListParams';
import { useAuth } from '@/hooks/useAuth';
import { toastError } from '@/redux/slices/uiSlice';
import { PageHeader } from '@/components/common/PageHeader';
import { DataTable } from '@/components/common/DataTable/DataTable';
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

const filters = [
  { key: 'status', label: 'Status', type: 'enum', allLabel: 'All statuses', options: LEAD_STATUSES.map((s) => ({ value: s, label: LEAD_STATUS_LABELS[s] })) },
  { key: 'priority', label: 'Priority', type: 'enum', allLabel: 'Any priority', className: 'w-[140px]', options: PRIORITIES.map((p) => ({ value: p, label: titleCase(p) })) },
  { key: 'source', label: 'Source', type: 'enum', allLabel: 'All sources', className: 'w-[160px]', options: LEAD_SOURCES.map((s) => ({ value: s, label: LEAD_SOURCE_LABELS[s] })) },
  { key: 'serviceId', label: 'Service', type: 'relation', relation: SERVICE_RELATION },
  {
    key: 'assignedToId', label: 'Owner', type: 'relation', relation: ASSIGNEE_RELATION,
    fixedOptions: [{ value: 'none', label: 'Unassigned' }],
  },
  {
    key: 'slaRisk', label: 'Response', type: 'enum', allLabel: 'Any response state', className: 'w-[180px]',
    options: [{ value: 'breached', label: 'Deadline passed' }, { value: 'at_risk', label: 'Due soon' }, { value: 'ok', label: 'On track' }],
  },
  { key: 'requestedVisit', label: 'Requested visit', type: 'boolean', trueLabel: 'Asked for a visit', falseLabel: 'No visit asked', className: 'w-[170px]' },
  { key: 'received', label: 'Received', type: 'dateRange' },
];

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

      <nav aria-label="Saved views" className="mb-4 flex flex-wrap items-center gap-2">
        <span className="text-xs font-medium text-muted-foreground">Views:</span>
        {LEAD_PRESETS.map((p) => (
          <Button
            key={p.key} type="button" size="sm" variant={preset === p.key ? 'secondary' : 'ghost'}
            aria-pressed={preset === p.key}
            onClick={() => setParams(applyPreset(params, p))}
          >
            {p.label}
          </Button>
        ))}
      </nav>

      <DataTable
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
