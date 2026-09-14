import { useNavigate } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { Download, Plus, CalendarCheck } from 'lucide-react';
import { useGetLeadsQuery, useLazyExportLeadsCsvQuery } from '@/api/leadsApi';
import { useListParams } from '@/hooks/useListParams';
import { toastError } from '@/redux/slices/uiSlice';
import { PageHeader } from '@/components/common/PageHeader';
import { DataTable } from '@/components/common/DataTable/DataTable';
import { SlaChip } from '@/components/common/SlaChip';
import { StatusBadge, PriorityBadge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { PageTransition } from '@/three/motion/motionKit';
import { LEAD_STATUSES, LEAD_SOURCES } from '@/config/constants';
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
  { key: 'source', header: 'Source', cell: (r) => <span className="text-xs text-muted-foreground">{titleCase(r.source)}</span> },
  { key: 'assignedTo', header: 'Owner', cell: (r) => r.assignedTo?.name ?? <span className="text-muted-foreground">Unassigned</span> },
  { key: 'createdAt', header: 'Received', sortable: true, cell: (r) => <span className="whitespace-nowrap text-xs text-muted-foreground">{formatDateTime(r.createdAt)}</span> },
];

const filters = [
  { key: 'status', label: 'Status', type: 'enum', allLabel: 'All statuses', options: LEAD_STATUSES.map((s) => ({ value: s, label: titleCase(s) })) },
  {
    key: 'slaRisk', label: 'Response', type: 'enum', allLabel: 'Any response state', className: 'w-[180px]',
    options: [{ value: 'breached', label: 'Deadline passed' }, { value: 'at_risk', label: 'Due soon' }, { value: 'ok', label: 'On track' }],
  },
  { key: 'source', label: 'Source', type: 'enum', allLabel: 'All sources', className: 'w-[150px]', options: LEAD_SOURCES.map((s) => ({ value: s, label: titleCase(s) })) },
  { key: 'received', label: 'Received', type: 'dateRange' },
];

export default function LeadsPage() {
  const [params, setParams] = useListParams({ limit: 20 });
  const { data, isLoading, isFetching, error, refetch } = useGetLeadsQuery(params);
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const [fetchCsv, { isFetching: exporting }] = useLazyExportLeadsCsvQuery();

  const exportCsv = async () => {
    // Paging belongs to the table; the export takes every row the filters match.
    const { page: _page, limit: _limit, ...query } = params;
    try {
      const csv = await fetchCsv(query).unwrap();
      // res.text() drops the byte-order mark the API sends. Put it back, or Excel
      // opens the file as ANSI and every Devanagari name turns to mojibake.
      const url = URL.createObjectURL(new Blob(['\uFEFF', csv], { type: 'text/csv;charset=utf-8' }));
      const link = Object.assign(document.createElement('a'), {
        href: url, download: `leads-${new Date().toISOString().slice(0, 10)}.csv`,
      });
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 0);
    } catch {
      dispatch(toastError('Could not export leads', 'Please try again in a moment.'));
    }
  };

  return (
    <PageTransition>
      <PageHeader
        title="Leads"
        description="Every enquiry, with its response clock."
        actions={
          <>
            <Button variant="outline" size="sm" onClick={exportCsv} loading={exporting}><Download className="h-4 w-4" /> Export</Button>
            <Button size="sm"><Plus className="h-4 w-4" /> New lead</Button>
          </>
        }
      />

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
        searchPlaceholder="Search name, phone, address…"
        emptyTitle="No leads match these filters"
        emptyDescription="Clear the filters, or wait for the next enquiry from the website."
        filters={filters}
      />
    </PageTransition>
  );
}
