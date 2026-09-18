import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { X } from 'lucide-react';
import { useGetAuditLogsQuery, useGetAuditModelsQuery } from '@/api/auditApi';
import { useListParams } from '@/hooks/useListParams';
import { PageHeader } from '@/components/common/PageHeader';
import { CustomTable } from '@/components/common/CustomTable/CustomTable';
import { StateBadge } from '@/components/common/StateBadge';
import { AuditRowDetails } from '@/components/platform/AuditRowDetails';
import { Button } from '@/components/ui/button';
import { PageTransition } from '@/three/motion/motionKit';
import { auditEventOptions } from '@/config/auditEvents';
import { describeHistoryEntry } from '@/helpers/history';
import { recordHref } from '@/helpers/recordLinks';
import { formatDateTime, titleCase } from '@/helpers/format';

const ACTOR_TYPES = [
  { value: 'user', label: 'Staff' },
  { value: 'public', label: 'Customer or website' },
  { value: 'system', label: 'System' },
];

function actorLabel(row) {
  if (row.actor) return `${row.actor.name} · ${titleCase(row.actor.role)}`;
  return ACTOR_TYPES.find((t) => t.value === row.actorType)?.label ?? row.actorType;
}

const columns = [
  {
    key: 'createdAt', header: 'When', sortable: true, className: 'whitespace-nowrap',
    cell: (r) => <time dateTime={r.createdAt} className="tabular-nums">{formatDateTime(r.createdAt)}</time>,
  },
  {
    key: 'event', header: 'What',
    cell: (r) => {
      const { label, detail } = describeHistoryEntry(r);
      return (
        <div className="min-w-0">
          <p className="font-medium">{label}</p>
          {r.event
            ? <p className="font-mono text-xs text-muted-foreground">{r.event}</p>
            : detail ? <p className="max-w-[280px] truncate text-xs text-muted-foreground">{detail}</p> : null}
        </div>
      );
    },
  },
  {
    key: 'model', header: 'Record',
    cell: (r) => {
      const href = recordHref(r);
      const text = <><span className="font-medium">{r.model}</span>{r.recordId ? <span className="block max-w-[180px] truncate font-mono text-xs text-muted-foreground">{r.recordId}</span> : null}</>;
      return href
        ? <Link to={href} onClick={(e) => e.stopPropagation()} className="block hover:text-primary hover:underline">{text}</Link>
        : <span className="block">{text}</span>;
    },
  },
  {
    key: 'actor', header: 'Who',
    cell: (r) => (r.actor
      ? <span>{actorLabel(r)}</span>
      : <StateBadge tone={r.actorType === 'public' ? 'info' : 'muted'}>{actorLabel(r)}</StateBadge>),
  },
  {
    key: 'requestId', header: 'Request',
    cell: (r) => <span className="font-mono text-xs text-muted-foreground" title={r.requestId ?? undefined}>{r.requestId ? r.requestId.slice(0, 8) : '—'}</span>,
  },
];

/**
 * `/admin/platform/audit` — every audited step (ADMIN). Filter by event (a single one or a
 * whole group), record, who and when; open a row for its before/after, ip and browser, and
 * jump to everything the same request did.
 */
export default function AuditLogPage() {
  const [params, setParams] = useListParams({ limit: 50, sort: '-createdAt' });
  const { data, isLoading, isFetching, error, refetch } = useGetAuditLogsQuery(params);
  const { data: models = [] } = useGetAuditModelsQuery();

  const filters = useMemo(() => [
    { key: 'event', label: 'Event', type: 'enum', allLabel: 'Every event', className: 'w-[220px]', options: auditEventOptions() },
    { key: 'model', label: 'Record type', type: 'enum', allLabel: 'Every record type', options: models.map((m) => ({ value: m, label: m })) },
    { key: 'actorId', label: 'Staff member', type: 'relation', relation: { path: '/admin/users', labelKey: (u) => `${u.name} · ${titleCase(u.role)}` } },
    { key: 'actorType', label: 'Done by', type: 'enum', allLabel: 'Anyone', options: ACTOR_TYPES },
    { key: 'recordId', label: 'Record id', type: 'text' },
    { key: 'requestId', label: 'Request id', type: 'text' },
    { key: 'created', label: 'Date', type: 'dateRange' },
  ], [models]);

  // Everything one request did, in the order it happened.
  const showRequest = (requestId) => setParams({ limit: params.limit, requestId, sort: 'createdAt' });

  const toolbar = params.requestId ? (
    <Button type="button" variant="secondary" size="sm" onClick={() => setParams({ ...params, requestId: undefined, sort: '-createdAt', page: 1 })}>
      One request: <span className="font-mono">{params.requestId.slice(0, 8)}</span> <X aria-label="Show all requests" />
    </Button>
  ) : null;

  return (
    <PageTransition>
      <PageHeader
        title="Audit log"
        description="Every change and every named step — who, when, from where, and exactly what moved."
      />
      <CustomTable
        storageKey="audit-log"
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
        searchPlaceholder="Event, record type, record or request id…"
        filters={filters}
        toolbar={toolbar}
        expandable={{ render: (row) => <AuditRowDetails row={row} onRequest={showRequest} /> }}
        rowLabel={(r) => `${describeHistoryEntry(r).label}, ${formatDateTime(r.createdAt)}`}
        emptyTitle="Nothing matches"
        emptyDescription="Try a wider date range, or clear a filter."
        pageSizes={[20, 50, 100]}
      />
    </PageTransition>
  );
}
