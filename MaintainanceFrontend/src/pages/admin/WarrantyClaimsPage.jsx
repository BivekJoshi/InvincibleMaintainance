import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { Gavel, ShieldCheck } from 'lucide-react';
import { useGetWarrantyClaimsQuery } from '@/api/aftercareApi';
import { PageHeader } from '@/components/common/PageHeader';
import { CustomTable } from '@/components/common/CustomTable/CustomTable';
import { AftercareStatus } from '@/components/aftercare/AftercareStatus';
import { ClaimDecisionSheet } from '@/components/aftercare/ClaimDecisionSheet';
import { ViewTabs } from '@/components/aftercare/ViewTabs';
import { Button } from '@/components/ui/button';
import { PageTransition } from '@/three/motion/motionKit';
import { useListParams } from '@/hooks/useListParams';
import { useAuth } from '@/hooks/useAuth';
import { CLAIM_VIEWS, selectView, viewQuery } from '@/config/admin/aftercareViews';
import { claimDecisions } from '@/helpers/aftercare';
import { formatDate, formatDateTime } from '@/helpers/format';

const columns = [
  {
    key: 'description', header: 'Claim',
    cell: (r) => (
      <div className="min-w-0 max-w-sm">
        <p className="line-clamp-2 text-sm">{r.description}</p>
        <p className="text-xs text-muted-foreground">Raised {formatDateTime(r.createdAt)}</p>
      </div>
    ),
    exportValue: (r) => r.description,
  },
  {
    key: 'job', header: 'Job', label: 'Job',
    cell: (r) => (
      <div className="min-w-0 max-w-[220px]">
        <p className="font-mono text-xs text-muted-foreground">{r.warranty?.job?.number}</p>
        <p className="truncate">{r.warranty?.job?.title}</p>
      </div>
    ),
    exportValue: (r) => r.warranty?.job?.number ?? '',
  },
  {
    key: 'customer', header: 'Customer',
    cell: (r) => (
      <div className="min-w-0 max-w-[200px]">
        <p className="truncate">{r.warranty?.customer?.name}</p>
        {r.warranty?.customer?.phone ? (
          <a href={`tel:${r.warranty.customer.phone}`} onClick={(e) => e.stopPropagation()} className="text-xs text-muted-foreground hover:text-primary hover:underline">
            {r.warranty.customer.phone}
          </a>
        ) : null}
      </div>
    ),
    exportValue: (r) => r.warranty?.customer?.name ?? '',
  },
  {
    key: 'status', header: 'Status',
    cell: (r) => <AftercareStatus kind="claim" status={r.status} />,
    exportValue: (r) => r.status,
  },
  {
    key: 'outcome', header: 'Outcome',
    cell: (r) => {
      if (r.resolvedJob) {
        return (
          <Link to={`/admin/jobs/${r.resolvedJob.id}`} onClick={(e) => e.stopPropagation()} className="font-mono text-xs text-primary hover:underline">
            {r.resolvedJob.number}
          </Link>
        );
      }
      if (r.rejectReason) return <span className="line-clamp-2 max-w-[200px] text-xs text-muted-foreground">{r.rejectReason}</span>;
      return <span className="text-xs text-muted-foreground">Covered until {formatDate(r.warranty?.endsAt)}</span>;
    },
    exportValue: (r) => r.resolvedJob?.number ?? r.rejectReason ?? '',
  },
];

/**
 * The claims queue (Phase I, I7): open claims first, then accepted ones (a free job under way), then the closed
 * — the API's order. A row opens the decision sheet, whose address is the claim's own
 * (`/admin/warranty-claims/:id`, where the claim notification links), so a claim can be shared and reopened.
 */
export default function WarrantyClaimsPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { search } = useLocation();
  const { can } = useAuth();
  const [params, setParams] = useListParams({ limit: 20 });
  const { view, query } = viewQuery(CLAIM_VIEWS, params, 'all');
  const { data, isLoading, isFetching, error, refetch } = useGetWarrantyClaimsQuery(query);

  const openClaim = (row) => navigate(`/admin/warranty-claims/${row.id}${search}`);
  const close = () => navigate(`/admin/warranty-claims${search}`);

  const rowActions = (row) => {
    const may = claimDecisions(row, can);
    return [{ label: may.accept || may.resolve ? 'Decide…' : 'Open', icon: Gavel, onSelect: () => openClaim(row) }];
  };

  return (
    <PageTransition>
      <PageHeader
        title="Warranty claims"
        description="What customers reported from their certificate — open ones first."
        actions={<Button asChild variant="outline" size="sm"><Link to="/admin/warranties"><ShieldCheck aria-hidden /> Warranties</Link></Button>}
      />
      <ViewTabs views={CLAIM_VIEWS} value={view} label="Claim status" onChange={(next) => setParams(selectView(params, next))} />
      <CustomTable
        storageKey="warranty-claims"
        exportable
        exportName="warranty-claims"
        columns={columns}
        data={data?.items}
        meta={data?.meta}
        isLoading={isLoading}
        isFetching={isFetching}
        error={error}
        refetch={refetch}
        params={params}
        onParamsChange={setParams}
        onRowClick={openClaim}
        rowLabel={(r) => `Claim on ${r.warranty?.job?.number ?? 'a job'} by ${r.warranty?.customer?.name ?? 'a customer'}`}
        rowActions={rowActions}
        searchPlaceholder="Search customer, phone or job number…"
        emptyTitle={view === 'open' || view === 'all' ? 'No claims waiting' : 'No claims here'}
        emptyDescription="A customer raises a claim from the warranty certificate link."
      />
      <ClaimDecisionSheet claimId={id ?? null} open={Boolean(id)} onOpenChange={(o) => { if (!o) close(); }} />
    </PageTransition>
  );
}
