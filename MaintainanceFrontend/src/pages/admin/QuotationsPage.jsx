import { useNavigate } from 'react-router-dom';
import { BadgeCheck, CircleCheck, Copy, FileText, Send, Undo2, Wrench } from 'lucide-react';
import { useGetQuotationStageCountQuery, useGetQuotationsQuery } from '@/api/quotationsApi';
import { useListParams } from '@/hooks/useListParams';
import { useAuth } from '@/hooks/useAuth';
import { useQuotationActions } from '@/hooks/useQuotationActions';
import { PageHeader } from '@/components/common/PageHeader';
import { CustomTable } from '@/components/common/CustomTable/CustomTable';
import { StateBadge } from '@/components/common/StateBadge';
import { StatusBadge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PageTransition } from '@/three/motion/motionKit';
import { QUOTATION_STAGE_TABS, QUOTATION_STATUS_LABELS } from '@/config/constants';
import { quotationActions } from '@/helpers/quotationActions';
import { formatDate, formatDateTime, formatNpr } from '@/helpers/format';

const ACTION_ICONS = {
  submit: Send, approve: CircleCheck, sendBack: Undo2, pullBack: Undo2, send: Send, revise: Copy, convert: Wrench,
};

const columns = [
  {
    key: 'number', header: 'Number', sortable: true,
    cell: (r) => (
      <div className="min-w-0">
        <p className="font-mono text-xs font-medium">{r.number}</p>
        {r.version > 1 ? <p className="text-[11px] text-muted-foreground">v{r.version}</p> : null}
      </div>
    ),
  },
  {
    key: 'customer', header: 'Customer',
    cell: (r) => (
      <div className="min-w-0">
        <p className="truncate font-medium">{r.customer?.name}</p>
        <p className="truncate text-xs text-muted-foreground">{r.site?.area ?? r.site?.address ?? r.customer?.phone}</p>
      </div>
    ),
  },
  {
    key: 'status', header: 'Status', sortable: true,
    cell: (r) => (
      <div className="flex flex-wrap items-center gap-1.5">
        <StatusBadge status={r.status} label={QUOTATION_STATUS_LABELS[r.status]} />
        {r.autoApproved && ['OFFICE_APPROVED', 'SENT'].includes(r.status) ? <StateBadge tone="info">Auto-approved</StateBadge> : null}
      </div>
    ),
  },
  { key: 'total', header: 'Total', sortable: true, cell: (r) => <span className="whitespace-nowrap font-medium tabular-nums">{formatNpr(r.total)}</span> },
  {
    key: 'people', header: 'Prepared · approved',
    cell: (r) => (
      <div className="min-w-0 text-xs">
        <p className="truncate">{r.createdBy?.name ?? '—'}</p>
        <p className="truncate text-muted-foreground">{r.autoApproved ? 'Automatic' : r.approvedBy?.name ?? '—'}</p>
      </div>
    ),
  },
  { key: 'validUntil', header: 'Valid until', sortable: true, cell: (r) => <span className="whitespace-nowrap text-xs text-muted-foreground">{formatDate(r.validUntil)}</span> },
  { key: 'updatedAt', header: 'Last change', sortable: true, cell: (r) => <span className="whitespace-nowrap text-xs text-muted-foreground">{formatDateTime(r.updatedAt)}</span> },
];

function TabCount({ stage }) {
  const { data } = useGetQuotationStageCountQuery(stage);
  if (!data) return null;
  return (
    <span className="ml-1.5 rounded-full bg-primary px-1.5 text-[11px] font-semibold leading-5 text-primary-foreground tabular-nums">
      {data}
    </span>
  );
}

/**
 * The quotation queues (`?stage=`): drafts, waiting for approval, ready to send, with the
 * customer, changes asked, won, lost, all. A row's menu offers what its state allows.
 */
export default function QuotationsPage() {
  const navigate = useNavigate();
  const { can, user } = useAuth();
  const tabs = QUOTATION_STAGE_TABS;
  // An approver opens on what is waiting for them.
  const defaultStage = can('quotations:approve') ? 'approval' : 'all';
  const [params, setParams] = useListParams({ limit: 20, stage: defaultStage });
  const stage = tabs.some((t) => t.value === params.stage) ? params.stage : defaultStage;
  const { data, isLoading, isFetching, error, refetch } = useGetQuotationsQuery({ ...params, stage });
  const [runAction, actionDialogs] = useQuotationActions();
  const who = { can, userId: user?.id };

  const rowActions = (row) => {
    const moves = quotationActions(row, who).map((a) => ({
      label: a.label,
      icon: ACTION_ICONS[a.key] ?? BadgeCheck,
      disabled: Boolean(a.disabledReason),
      onSelect: () => runAction(a, row),
    }));
    return [
      { label: 'Open', icon: FileText, onSelect: () => navigate(`/admin/quotations/${row.id}`) },
      ...(moves.length ? [{ separator: true }, ...moves] : []),
    ];
  };

  return (
    <PageTransition>
      <PageHeader title="Quotations" description="Priced work: approved in the office, then answered by the customer." />
      <Tabs value={stage} onValueChange={(next) => setParams({ ...params, stage: next, page: 1 })} className="mb-4">
        <div className="-mx-1 overflow-x-auto px-1 pb-1">
          <TabsList className="h-auto w-max">
            {tabs.map((t) => (
              <TabsTrigger key={t.value} value={t.value} className="whitespace-nowrap">
                {t.label}
                {t.counted && (!t.countCapability || can(t.countCapability)) ? <TabCount stage={t.value} /> : null}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>
      </Tabs>
      <CustomTable
        storageKey="quotations"
        exportable
        columns={columns}
        data={data?.items}
        meta={data?.meta}
        isLoading={isLoading}
        isFetching={isFetching}
        error={error}
        refetch={refetch}
        params={{ ...params, stage }}
        onParamsChange={setParams}
        onRowClick={(row) => navigate(`/admin/quotations/${row.id}`)}
        rowActions={rowActions}
        rowLabel={(row) => `${row.number} for ${row.customer?.name ?? 'a customer'}`}
        searchPlaceholder="Search number or customer…"
        emptyTitle={stage === 'approval' ? 'Nothing is waiting for approval' : 'No quotations here'}
        emptyDescription="Build one from a submitted site survey, or start from a lead."
      />
      {actionDialogs}
    </PageTransition>
  );
}
