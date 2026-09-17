import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { CalendarDays, ExternalLink, MapPin, Plus } from 'lucide-react';
import { useGetJobsQuery } from '@/api/jobsApi';
import { useListParams } from '@/hooks/useListParams';
import { useAuth } from '@/hooks/useAuth';
import { useJobActions } from '@/hooks/useJobActions';
import { PageHeader } from '@/components/common/PageHeader';
import { DataTable } from '@/components/common/DataTable/DataTable';
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

const filters = [
  { key: 'status', label: 'Status', type: 'enum', allLabel: 'All statuses', options: JOB_STATUSES.map((s) => ({ value: s, label: JOB_STATUS_LABELS[s] })) },
  { key: 'type', label: 'Type', type: 'enum', allLabel: 'All types', className: 'w-[160px]', options: JOB_TYPES.map((t) => ({ value: t, label: JOB_TYPE_LABELS[t] })) },
  { key: 'priority', label: 'Priority', type: 'enum', allLabel: 'Any priority', className: 'w-[140px]', options: PRIORITIES.map((p) => ({ value: p, label: titleCase(p) })) },
  { key: 'technicianId', label: 'Technician', type: 'relation', relation: TECHNICIAN_RELATION },
  { key: 'customerId', label: 'Customer', type: 'relation', relation: CUSTOMER_RELATION },
  // The API filters only for `true`; there is no "has technicians" query.
  { key: 'unassigned', label: 'People', type: 'enum', allLabel: 'Anyone', className: 'w-[150px]', options: [{ value: 'true', label: 'Nobody on it' }] },
  { key: 'invoiced', label: 'Invoiced', type: 'boolean', trueLabel: 'Invoiced', falseLabel: 'Finished, not invoiced', className: 'w-[190px]' },
  { key: 'scheduled', label: 'Scheduled', type: 'dateRange' },
];

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

      <nav aria-label="Saved views" className="mb-4 flex flex-wrap items-center gap-2">
        <span className="text-xs font-medium text-muted-foreground">Views:</span>
        <Button
          type="button" size="sm" variant={!preset && !params.q ? 'secondary' : 'ghost'}
          onClick={() => setParams({ limit: params.limit, sort: params.sort })}
        >
          All jobs
        </Button>
        {JOB_PRESETS.map((p) => (
          <Button
            key={p.key} type="button" size="sm" variant={preset === p.key ? 'secondary' : 'ghost'}
            aria-pressed={preset === p.key}
            onClick={() => setParams(applyJobPreset(params, p))}
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
        onRowClick={(row) => navigate(`/admin/jobs/${row.id}`)}
        rowLabel={(r) => `${r.number} ${r.title}`}
        searchPlaceholder="Search number, title or customer…"
        emptyTitle="No jobs match"
        emptyDescription="Clear the filters — or wait for a customer to accept a quotation."
        filters={filters}
        rowActions={rowActions}
      />

      {can('jobs:write') ? (
        <JobFormSheet open={creating} onOpenChange={setCreating} onCreated={(job) => navigate(`/admin/jobs/${job.id}`)} />
      ) : null}
      {actionDialogs}
    </PageTransition>
  );
}
