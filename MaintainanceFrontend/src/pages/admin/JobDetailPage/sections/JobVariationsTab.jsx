import { useNavigate } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { FilePlus2, FileText } from 'lucide-react';
import { useGetJobVariationsQuery } from '@/api/jobsApi';
import { useCreateQuotationMutation } from '@/api/quotationsApi';
import { CustomTable } from '@/components/common/CustomTable/CustomTable';
import { ErrorState } from '@/components/common/ErrorState';
import { StatusBadge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CardSkeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/hooks/useAuth';
import { QUOTATION_STATUS_LABELS } from '@/config/constants';
import { formatDate, formatSignedNpr } from '@/helpers/format';
import { toastError, toastSuccess } from '@/redux/slices/uiSlice';

const onePage = (rows) => ({ page: 1, pages: 1, total: rows.length, limit: rows.length || 1 });
const noop = () => {};
const dateCell = (iso) => (iso ? <span className="whitespace-nowrap text-xs text-muted-foreground">{formatDate(iso)}</span> : <span className="text-muted-foreground">—</span>);

/** A variation's status in the office's words — once the customer accepts, its lines are on the job. */
const statusLabel = (status) => (status === 'CONVERTED' ? 'Accepted · on the job' : QUOTATION_STATUS_LABELS[status] ?? status);

function columns(showTotal) {
  return [
    {
      key: 'number', header: 'Variation',
      cell: (r) => (
        <div>
          <p className="font-mono text-xs font-medium">{r.number}</p>
          {r.version > 1 ? <p className="text-[11px] text-muted-foreground">v{r.version}</p> : null}
        </div>
      ),
    },
    { key: 'status', header: 'Status', cell: (r) => <StatusBadge status={r.status} label={statusLabel(r.status)} />, exportValue: (r) => statusLabel(r.status) },
    ...(showTotal ? [{
      key: 'total', header: 'Total', className: 'text-right',
      cell: (r) => (r.total != null ? <span className="whitespace-nowrap font-medium tabular-nums">{formatSignedNpr(r.total)}</span> : '—'),
    }] : []),
    { key: 'createdAt', header: 'Raised', cell: (r) => dateCell(r.createdAt) },
    { key: 'sentAt', header: 'Sent', cell: (r) => dateCell(r.sentAt) },
    { key: 'decidedAt', header: 'Answered', cell: (r) => dateCell(r.decidedAt) },
  ];
}

/**
 * The **Variations** tab (Phase L7) — `GET /admin/jobs/:id/variations` (`jobs:read`): the job's variation orders with
 * their status (the total only for `quotations:read`, as the API sends it). **New variation** (`quotations:write`)
 * creates an empty VARIATION draft against the job — the server takes the customer and site from it and numbers it VO-
 * — and opens it in the L3 builder: the same builder, approval (maker-checker, the margin gate) and customer link as a
 * quotation. Once the customer accepts, its rows join the job's BOQ as VARIATION lines.
 */
export function JobVariationsTab({ job }) {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const { can } = useAuth();
  const { data, isLoading, error, refetch } = useGetJobVariationsQuery(job.id);
  const [create, { isLoading: creating }] = useCreateQuotationMutation();
  const canOpen = can('quotations:read');
  const canCreate = can('quotations:write') && !['CANCELLED', 'VERIFIED'].includes(job.status);

  if (isLoading) return <CardSkeleton />;
  if (error) return <ErrorState error={error} onRetry={refetch} />;
  const rows = data ?? [];

  const newVariation = async () => {
    try {
      const variation = await create({ jobId: job.id, items: [] }).unwrap();
      dispatch(toastSuccess(`${variation.number} started`, `A change to ${job.number} — add its rows (an omission is a negative quantity), then submit it for approval.`));
      navigate(`/admin/quotations/${variation.id}`);
    } catch (err) {
      dispatch(toastError('Could not start the variation', err?.data?.error?.message));
    }
  };

  return (
    <CustomTable
      columns={columns(canOpen && rows.some((r) => r.total != null))}
      data={rows}
      meta={onePage(rows)}
      params={{}}
      onParamsChange={noop}
      searchable={false}
      pageSizes={[]}
      onRowClick={canOpen ? (r) => navigate(`/admin/quotations/${r.id}`) : undefined}
      rowActions={canOpen ? (r) => [{ label: 'Open', icon: FileText, onSelect: () => navigate(`/admin/quotations/${r.id}`) }] : undefined}
      rowLabel={(r) => r.number}
      toolbar={canCreate ? (
        <Button size="sm" onClick={newVariation} loading={creating}><FilePlus2 aria-hidden /> New variation</Button>
      ) : null}
      emptyTitle="No variations on this job"
      emptyDescription={canCreate
        ? 'New variation starts a change order in the quotation builder: extra work, or an omission as a negative quantity.'
        : 'A change to the agreed work is raised by sales as a variation order.'}
    />
  );
}
