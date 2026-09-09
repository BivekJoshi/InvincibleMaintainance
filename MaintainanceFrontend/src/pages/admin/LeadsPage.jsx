import { useNavigate } from 'react-router-dom';
import { Download, Plus, Phone, CalendarCheck } from 'lucide-react';
import { useGetLeadsQuery } from '@/api/leadsApi';
import { useListParams } from '@/hooks/useListParams';
import { API_URL } from '@/config/env';
import { PageHeader } from '@/components/common/PageHeader';
import { DataTable } from '@/components/common/DataTable';
import { SlaChip } from '@/components/common/SlaChip';
import { StatusBadge, PriorityBadge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
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

export default function LeadsPage() {
  const [params, setParams] = useListParams({ limit: 20 });
  const { data, isLoading, isFetching, error, refetch } = useGetLeadsQuery(params);
  const navigate = useNavigate();

  const exportCsv = () => {
    const qs = new URLSearchParams(
      Object.entries(params).filter(([, v]) => v !== undefined).map(([k, v]) => [k, String(v)]),
    );
    window.open(`${API_URL}/admin/leads/export.csv?${qs}`, '_blank');
  };

  return (
    <PageTransition>
      <PageHeader
        title="Leads"
        description="Every enquiry, with its response clock."
        actions={
          <>
            <Button variant="outline" size="sm" onClick={exportCsv}><Download className="h-4 w-4" /> Export</Button>
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
        toolbar={
          <>
            <Select value={params.status ?? 'all'} onValueChange={(v) => setParams({ ...params, page: 1, status: v === 'all' ? undefined : v })}>
              <SelectTrigger className="w-[160px]"><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                {LEAD_STATUSES.map((s) => <SelectItem key={s} value={s}>{titleCase(s)}</SelectItem>)}
              </SelectContent>
            </Select>

            <Select value={params.slaRisk ?? 'all'} onValueChange={(v) => setParams({ ...params, page: 1, slaRisk: v === 'all' ? undefined : v })}>
              <SelectTrigger className="w-[150px]"><SelectValue placeholder="Response" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Any response state</SelectItem>
                <SelectItem value="breached">Deadline passed</SelectItem>
                <SelectItem value="at_risk">Due soon</SelectItem>
                <SelectItem value="ok">On track</SelectItem>
              </SelectContent>
            </Select>

            <Select value={params.source ?? 'all'} onValueChange={(v) => setParams({ ...params, page: 1, source: v === 'all' ? undefined : v })}>
              <SelectTrigger className="w-[150px]"><SelectValue placeholder="Source" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All sources</SelectItem>
                {LEAD_SOURCES.map((s) => <SelectItem key={s} value={s}>{titleCase(s)}</SelectItem>)}
              </SelectContent>
            </Select>
          </>
        }
      />
    </PageTransition>
  );
}
