import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { Ban, FileText, Plus, RefreshCw } from 'lucide-react';
import { useGetAmcContractsQuery, useUpdateAmcContractMutation } from '@/api/aftercareApi';
import { PageHeader } from '@/components/common/PageHeader';
import { CustomTable } from '@/components/common/CustomTable/CustomTable';
import { AftercareStatus } from '@/components/aftercare/AftercareStatus';
import { AmcContractSheet } from '@/components/aftercare/AmcContractSheet';
import { ViewTabs } from '@/components/aftercare/ViewTabs';
import { Button } from '@/components/ui/button';
import { PageTransition } from '@/three/motion/motionKit';
import { useListParams } from '@/hooks/useListParams';
import { useAuth } from '@/hooks/useAuth';
import { useConfirm } from '@/hooks/useConfirm';
import { AMC_VIEWS, RENEWALS_DAYS, selectView, viewQuery } from '@/config/admin/aftercareViews';
import { CUSTOMER_RELATION } from '@/config/admin/jobViews';
import { AMC_BILLING_CYCLE_LABELS } from '@/config/constants';
import { contractEndsIn, renewalDefaults } from '@/helpers/aftercare';
import { formatDate, formatNpr, titleCase } from '@/helpers/format';
import { toastError, toastSuccess } from '@/redux/slices/uiSlice';

const columns = [
  { key: 'number', header: 'Number', sortable: true, cell: (r) => <span className="font-mono text-xs font-medium">{r.number}</span> },
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
        {r.site ? <p className="truncate text-xs text-muted-foreground">{r.site.label}</p> : null}
      </div>
    ),
    exportValue: (r) => r.customer?.name ?? '',
  },
  {
    key: 'planName', header: 'Plan', sortable: true,
    cell: (r) => (
      <div className="min-w-0 max-w-xs">
        <p className="truncate font-medium">{r.planName}</p>
        {r.coveredServices?.length ? (
          <p className="truncate text-xs text-muted-foreground">{r.coveredServices.map((s) => titleCase(s)).join(', ')}</p>
        ) : null}
      </div>
    ),
  },
  {
    key: 'endDate', header: 'Term', sortable: true,
    cell: (r) => {
      const soon = contractEndsIn(r, RENEWALS_DAYS);
      return (
        <div className="whitespace-nowrap text-xs">
          <p>{formatDate(r.startDate)} – {formatDate(r.endDate)}</p>
          {soon ? <p className="font-medium text-warning-foreground">{soon}</p> : null}
        </div>
      );
    },
    exportValue: (r) => `${formatDate(r.startDate)} – ${formatDate(r.endDate)}`,
  },
  {
    key: 'visitsPerYear', header: 'Visits',
    cell: (r) => {
      const done = (r.visits ?? []).filter((v) => v.status === 'completed').length;
      return (
        <div className="whitespace-nowrap text-xs">
          <p>{r.visitsPerYear} a year</p>
          {r.visits?.length ? <p className="text-muted-foreground">{done} of {r.visits.length} done</p> : null}
        </div>
      );
    },
    exportValue: (r) => r.visitsPerYear,
  },
  {
    key: 'amount', header: 'Amount', sortable: true, className: 'text-right',
    cell: (r) => (
      <div className="whitespace-nowrap text-right">
        <p className="font-medium tabular-nums">{formatNpr(r.amount)}</p>
        <p className="text-xs text-muted-foreground">{AMC_BILLING_CYCLE_LABELS[r.billingCycle] ?? titleCase(r.billingCycle ?? '')}</p>
      </div>
    ),
    exportValue: (r) => formatNpr(r.amount),
  },
  { key: 'status', header: 'Status', sortable: true, cell: (r) => <AftercareStatus kind="amc" status={r.status} />, exportValue: (r) => r.status },
];

/**
 * AMC contracts (Phase I, I8): tabs Active · Renewals due (60 days) · Expired · Cancelled · All — the renewals
 * notification's `?renewals=true` opens on the second. New contract (`amc:write`) opens the create sheet with its
 * live visit schedule; a row's Renew… opens the same sheet prefilled from that contract.
 */
export default function AmcContractsPage() {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const { can } = useAuth();
  const canWrite = can('amc:write');
  const [params, setParams] = useListParams({ limit: 20 });
  const { view, query } = viewQuery(AMC_VIEWS, params, 'active');
  const { data, isLoading, isFetching, error, refetch } = useGetAmcContractsQuery({
    ...query, sort: query.sort ?? (view === 'renewals' ? 'endDate' : '-startDate'),
  });
  const [update] = useUpdateAmcContractMutation();
  const [confirm, confirmDialog] = useConfirm();
  const [sheet, setSheet] = useState(null); // { defaults, title, description }

  const cancel = async (row) => {
    const ok = await confirm({
      title: `Cancel ${row.number}?`,
      description: 'No more visit jobs are made for it. Visits already booked stay on the board.',
      confirmLabel: 'Cancel contract',
      cancelLabel: 'Keep it',
      destructive: true,
    });
    if (!ok) return;
    try {
      await update({ id: row.id, status: 'cancelled' }).unwrap();
      dispatch(toastSuccess(`${row.number} cancelled`));
    } catch (err) {
      dispatch(toastError('Could not cancel the contract', err?.data?.error?.message));
    }
  };

  const renew = (row) => setSheet({
    defaults: renewalDefaults(row),
    title: `Renew ${row.number}`,
    description: `A new contract for ${row.customer?.name ?? 'the customer'}, starting the day after this one ends.`,
  });

  const rowActions = (row) => [
    { label: 'Open', icon: FileText, onSelect: () => navigate(`/admin/amc-contracts/${row.id}`) },
    ...(canWrite ? [
      { label: 'Renew…', icon: RefreshCw, onSelect: () => renew(row) },
      ...(row.status === 'active' ? [{ label: 'Cancel contract…', icon: Ban, destructive: true, onSelect: () => cancel(row) }] : []),
    ] : []),
  ];

  return (
    <PageTransition>
      <PageHeader
        title="AMC contracts"
        description="Maintenance plans: visits through the year, and the renewals coming up."
        actions={canWrite ? <Button size="sm" onClick={() => setSheet({})}><Plus aria-hidden /> New contract</Button> : null}
      />
      <ViewTabs views={AMC_VIEWS} value={view} label="Contract status" onChange={(next) => setParams(selectView(params, next))} />
      <CustomTable
        storageKey="amc-contracts"
        exportable
        exportName="amc-contracts"
        columns={columns}
        data={data?.items}
        meta={data?.meta}
        isLoading={isLoading}
        isFetching={isFetching}
        error={error}
        refetch={refetch}
        params={params}
        onParamsChange={setParams}
        onRowClick={(row) => navigate(`/admin/amc-contracts/${row.id}`)}
        rowLabel={(r) => `${r.number} for ${r.customer?.name ?? 'a customer'}`}
        rowActions={rowActions}
        filters={[{ key: 'customerId', label: 'Customer', type: 'relation', relation: CUSTOMER_RELATION }]}
        searchPlaceholder="Search number, plan or customer…"
        emptyTitle={view === 'renewals' ? `Nothing renews in the next ${RENEWALS_DAYS} days` : 'No contracts here'}
        emptyDescription={canWrite ? 'Start one with New contract.' : 'Dispatch sets up maintenance contracts.'}
      />
      {canWrite && sheet ? (
        <AmcContractSheet
          open
          onOpenChange={(o) => { if (!o) setSheet(null); }}
          defaults={sheet.defaults}
          title={sheet.title}
          description={sheet.description}
          onCreated={(contract) => navigate(`/admin/amc-contracts/${contract.id}`)}
        />
      ) : null}
      {confirmDialog}
    </PageTransition>
  );
}
