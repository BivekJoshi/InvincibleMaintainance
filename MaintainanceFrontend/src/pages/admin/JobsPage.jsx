import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  BadgeCheck, CalendarClock, CalendarDays, ExternalLink, LayoutList, MapPin, PauseCircle, Plus, ReceiptText, UserX,
} from 'lucide-react';
import { useGetJobsQuery } from '@/api/jobsApi';
import { useListParams } from '@/hooks/useListParams';
import { useAuth } from '@/hooks/useAuth';
import { useJobActions } from '@/hooks/useJobActions';
import { PageHeader } from '@/components/common/PageHeader';
import { CustomTable } from '@/components/common/CustomTable/CustomTable';
import { JobFormSheet } from '@/components/jobs/JobFormSheet';
import { PriorityBadge, StatusBadge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { PageTransition } from '@/three/motion/motionKit';
import {
  JOB_STATUSES, JOB_STATUS_LABELS, JOB_TYPES, JOB_TYPE_LABELS, PRIORITIES,
} from '@/config/constants';
import {
  CUSTOMER_RELATION, JOB_PRESETS, TECHNICIAN_RELATION, activeJobPreset, applyJobPreset,
} from '@/config/admin/jobViews';
import { jobActions } from '@/helpers/jobActions';
import { formatDate, formatTime, titleCase } from '@/helpers/format';
import { cn } from '@/helpers/utils';

/** The people on a job, lead first. */
const crew = (job) => [...(job.assignments ?? [])]
  .sort((a, b) => Number(b.isLead) - Number(a.isLead))
  .map((a) => a.technician?.user?.name)
  .filter(Boolean);

const columns = [
  {
    key: 'number', header: 'Job', sortable: true,
    cell: (r) => (
      <div className="min-w-0 max-w-sm">
        <p className="font-mono text-xs text-muted-foreground">{r.number}</p>
        <p className="truncate font-medium">{r.title}</p>
        <p className="text-xs text-muted-foreground">{JOB_TYPE_LABELS[r.type] ?? titleCase(r.type)}</p>
      </div>
    ),
  },
  {
    key: 'customer', header: 'Customer',
    cell: (r) => (
      <div className="min-w-0 max-w-[220px]">
        <p className="truncate">{r.customer?.name}</p>
        {r.customer?.phone ? (
          <a href={`tel:${r.customer.phone}`} onClick={(e) => e.stopPropagation()} className="text-xs text-muted-foreground hover:text-primary hover:underline">
            {r.customer.phone}
          </a>
        ) : null}
        {r.site?.area ? <p className="flex items-center gap-1 truncate text-xs text-muted-foreground"><MapPin className="h-3 w-3" aria-hidden />{r.site.area}</p> : null}
      </div>
    ),
  },
  {
    key: 'status', header: 'Status', sortable: true,
    cell: (r) => (
      <div className="flex flex-wrap items-center gap-1.5">
        <StatusBadge status={r.status} label={JOB_STATUS_LABELS[r.status]} />
        <PriorityBadge priority={r.priority} />
      </div>
    ),
  },
  {
    key: 'scheduledStart', header: 'When', sortable: true,
    cell: (r) => (r.scheduledStart ? (
      <span className="whitespace-nowrap text-xs">
        {formatDate(r.scheduledStart)}
        <span className="block text-muted-foreground">{formatTime(r.scheduledStart)}{r.scheduledEnd ? `–${formatTime(r.scheduledEnd)}` : ''}</span>
      </span>
    ) : <span className="text-xs text-muted-foreground">No date yet</span>),
  },
  {
    key: 'crew', header: 'Technicians',
    cell: (r) => {
      const names = crew(r);
      return names.length
        ? <span className="line-clamp-2 max-w-[180px] text-xs">{names.join(', ')}</span>
        : <span className="text-xs text-muted-foreground">Nobody yet</span>;
    },
  },
];

/** A dot colour per status and priority in the filter panel (`CustomTableFilterPanel` tones). */
const STATUS_TONE = {
  DRAFT: 'muted', SCHEDULED: 'info', ASSIGNED: 'info', EN_ROUTE: 'warning', IN_PROGRESS: 'warning',
  ON_HOLD: 'danger', COMPLETED: 'success', VERIFIED: 'success', CANCELLED: 'muted',
};
const PRIORITY_TONE = { LOW: 'muted', NORMAL: 'info', HIGH: 'warning', URGENT: 'danger' };

const filters = [
  { key: 'status', label: 'Status', type: 'enum', options: JOB_STATUSES.map((s) => ({ value: s, label: JOB_STATUS_LABELS[s], tone: STATUS_TONE[s] })) },
  { key: 'priority', label: 'Priority', type: 'enum', options: PRIORITIES.map((p) => ({ value: p, label: titleCase(p), tone: PRIORITY_TONE[p] })) },
  { key: 'type', label: 'Type of work', type: 'enum', options: JOB_TYPES.map((t) => ({ value: t, label: JOB_TYPE_LABELS[t] })) },
  { key: 'scheduled', label: 'Scheduled', type: 'dateRange' },
  { key: 'technicianId', label: 'Technician', type: 'relation', relation: TECHNICIAN_RELATION },
  { key: 'customerId', label: 'Customer', type: 'relation', relation: CUSTOMER_RELATION },
  // The API filters only for `true`; there is no "has technicians" query.
  { key: 'unassigned', label: 'People', type: 'enum', options: [{ value: 'true', label: 'Nobody on it', tone: 'danger' }] },
  { key: 'invoiced', label: 'Invoiced', type: 'boolean', trueLabel: 'Invoiced', falseLabel: 'Finished, not invoiced' },
];

/** Each saved view's icon and colour. */
const VIEW_LOOK = {
  all: { icon: LayoutList, tone: 'text-primary' },
  today: { icon: CalendarClock, tone: 'text-info' },
  unassigned: { icon: UserX, tone: 'text-destructive' },
  'on-hold': { icon: PauseCircle, tone: 'text-warning' },
  'to-verify': { icon: BadgeCheck, tone: 'text-success' },
  'not-invoiced': { icon: ReceiptText, tone: 'text-gold' },
};

/** One tab in the saved-views bar. */
function ViewTab({ view, active, onClick, children }) {
  const { icon: Icon, tone } = VIEW_LOOK[view];
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        'inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg px-3 text-sm font-medium transition-all motion-reduce:transition-none',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        active
          ? 'bg-background text-foreground shadow-[var(--elevation-1)] ring-1 ring-border'
          : 'text-muted-foreground hover:bg-background/60 hover:text-foreground',
      )}
    >
      <Icon className={cn('h-4 w-4', active ? tone : 'opacity-70')} aria-hidden />
      {children}
    </button>
  );
}

/**
 * Every job, with the presets dispatch works from (Today, Unassigned, On hold, Completed not
 * verified, Not invoiced), a New job sheet, and each row's allowed actions.
 */
export default function JobsPage() {
  const [params, setParams] = useListParams({ limit: 20, sort: '-createdAt' });
  const { data, isLoading, isFetching, error, refetch } = useGetJobsQuery(params);
  const navigate = useNavigate();
  const { can } = useAuth();
  const [creating, setCreating] = useState(false);
  const [runAction, actionDialogs] = useJobActions();
  const preset = activeJobPreset(params);

  const rowActions = (row) => [
    { label: 'Open', icon: ExternalLink, onSelect: () => navigate(`/admin/jobs/${row.id}`) },
    ...jobActions(row, { can })
      // Completing takes a sign-off, and the case study a draft: both start on the job's own page.
      .filter((a) => ['schedule', 'assign', 'verify'].includes(a.key) && !a.disabledReason)
      .map((a) => ({ label: `${a.label}…`, onSelect: () => runAction(a, row) })),
  ];

  return (
    <PageTransition>
      <PageHeader
        title="Jobs"
        description="Work orders, from the first booking to the verified finish."
        actions={(
          <>
            {can('jobs:dispatch') ? (
              <Button asChild variant="outline" size="sm"><Link to="/admin/dispatch"><CalendarDays /> Board</Link></Button>
            ) : null}
            {can('jobs:write') ? <Button size="sm" onClick={() => setCreating(true)}><Plus /> New job</Button> : null}
          </>
        )}
      />

      <nav
        aria-label="Saved views"
        className="mb-4 flex max-w-full gap-1 overflow-x-auto rounded-xl border bg-muted/50 p-1 [scrollbar-width:none] sm:inline-flex"
      >
        <ViewTab view="all" active={!preset && !params.q} onClick={() => setParams({ limit: params.limit, sort: params.sort })}>
          All jobs
        </ViewTab>
        {JOB_PRESETS.map((p) => (
          <ViewTab key={p.key} view={p.key} active={preset === p.key} onClick={() => setParams(applyJobPreset(params, p))}>
            {p.label}
          </ViewTab>
        ))}
      </nav>

      <CustomTable
        storageKey="jobs"
        exportable
        columns={columns}
        data={data?.items}
        meta={data?.meta}
        isLoading={isLoading}
        isFetching={isFetching}
        error={error}
        refetch={refetch}
        params={params}
        onParamsChange={setParams}
        onRowClick={(row) => navigate(`/admin/jobs/${row.id}`)}
        rowLabel={(r) => `${r.number} ${r.title}`}
        searchPlaceholder="Search number, title or customer…"
        emptyTitle="No jobs match"
        emptyDescription="Clear the filters — or wait for a customer to accept a quotation."
        filters={filters}
        filterLayout="panel"
        rowActions={rowActions}
      />

      {can('jobs:write') ? (
        <JobFormSheet open={creating} onOpenChange={setCreating} onCreated={(job) => navigate(`/admin/jobs/${job.id}`)} />
      ) : null}
      {actionDialogs}
    </PageTransition>
  );
}
