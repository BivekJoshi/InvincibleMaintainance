import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BadgeCheck, CircleCheck, Clock, Copy, FilePlus2, FileText, Send, Undo2, Wrench } from 'lucide-react';
import { useGetQuotationStageCountQuery, useGetQuotationsQuery } from '@/api/quotationsApi';
import { useListParams } from '@/hooks/useListParams';
import { useAuth } from '@/hooks/useAuth';
import { useQuotationActions } from '@/hooks/useQuotationActions';
import { PageHeader } from '@/components/common/PageHeader';
import { CustomTable } from '@/components/common/CustomTable/CustomTable';
import { StateBadge } from '@/components/common/StateBadge';
import { StatusBadge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { NewQuotationSheet } from '@/components/quotations/NewQuotationSheet';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PageTransition } from '@/three/motion/motionKit';
import { QUOTATION_KINDS, QUOTATION_KIND_LABELS, QUOTATION_STAGE_TABS, QUOTATION_STATUS_LABELS } from '@/config/constants';
import { marginOf, quotationActions, sentAge, validityWarning } from '@/helpers/quotationActions';
import { formatDate, formatDateTime, formatNpr, formatSignedNpr } from '@/helpers/format';
import { cn } from '@/helpers/utils';

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
        {/* A variation order (Phase L7) says so, and which job it changes. */}
        {r.kind === 'VARIATION' ? (
          <p className="mt-0.5 flex flex-wrap items-center gap-1">
            <StateBadge tone="info" className="text-[10px]"><span data-testid="row-kind">Variation</span></StateBadge>
            {r.job?.number ? <span className="font-mono text-[11px] text-muted-foreground">{r.job.number}</span> : null}
          </p>
        ) : null}
      </div>
    ),
    exportValue: (r) => `${r.number}${r.kind === 'VARIATION' ? ' (variation)' : ''}`,
  },
  {
    key: 'customer', header: 'Customer',
    cell: (r) => (
      <div className="min-w-0">
        <p className="truncate font-medium">{r.customer?.name}</p>
        <p className="truncate text-xs text-muted-foreground">
          {r.customer?.phone ? (
            <a href={`tel:${r.customer.phone}`} onClick={(e) => e.stopPropagation()} className="hover:text-primary hover:underline">{r.customer.phone}</a>
          ) : null}
          {r.site?.area ?? r.site?.address ? ` · ${r.site?.area ?? r.site?.address}` : null}
        </p>
      </div>
    ),
  },
  {
    key: 'status', header: 'Status', sortable: true,
    cell: (r) => (
      <div className="flex flex-wrap items-center gap-1.5">
        <StatusBadge status={r.status} label={QUOTATION_STATUS_LABELS[r.status]} />
        {r.autoApproved && ['OFFICE_APPROVED', 'SENT'].includes(r.status) ? <StateBadge tone="info">Auto-approved</StateBadge> : null}
        {/* How long the customer has had it: the cue to call and follow up. */}
        {sentAge(r) ? <span className="w-full text-[11px] text-muted-foreground">{sentAge(r)}</span> : null}
      </div>
    ),
  },
  // A variation's total may be below zero (an omission): "− Rs. …".
  { key: 'total', header: 'Total', sortable: true, cell: (r) => <span className="whitespace-nowrap font-medium tabular-nums">{formatSignedNpr(r.total)}</span> },
  {
    key: 'people', header: 'Prepared · approved',
    cell: (r) => (
      <div className="min-w-0 text-xs">
        <p className="truncate">{r.createdBy?.name ?? '—'}</p>
        <p className="truncate text-muted-foreground">{r.autoApproved ? 'Automatic' : r.approvedBy?.name ?? '—'}</p>
      </div>
    ),
  },
  {
    key: 'validUntil', header: 'Valid until', sortable: true,
    cell: (r) => {
      const warning = validityWarning(r);
      return (
        <div className="min-w-0">
          <p className="whitespace-nowrap text-xs text-muted-foreground">{formatDate(r.validUntil)}</p>
          {warning ? (
            <StateBadge tone="warning" className={warning.tone === 'expired' ? 'mt-1 text-destructive' : 'mt-1'}>
              <Clock className="mr-1 h-3 w-3" aria-hidden />{warning.label}
            </StateBadge>
          ) : null}
        </div>
      );
    },
  },
  { key: 'updatedAt', header: 'Last change', sortable: true, cell: (r) => <span className="whitespace-nowrap text-xs text-muted-foreground">{formatDateTime(r.updatedAt)}</span> },
];

/**
 * The Margin column (Phase L4) — only for `costs:read`: the server's margin on each row (the list sends it to those
 * holders only), "Unknown" while a row's cost is unknown. Most useful on Needs approval, where it is the approver's
 * first look at what they are signing.
 */
const marginColumn = {
  key: 'margin', header: 'Margin', label: 'Margin', className: 'text-right',
  cell: (r) => {
    const m = marginOf(r);
    if (m.known === null) return <span className="text-xs text-muted-foreground">—</span>;
    if (!m.known) return <StateBadge tone="warning">Unknown</StateBadge>;
    return (
      <div className="whitespace-nowrap text-right" data-testid="row-margin">
        <p className={cn('font-medium tabular-nums', m.margin.amount < 0 && 'text-destructive')}>{m.margin.pct}%</p>
        <p className="text-[11px] tabular-nums text-muted-foreground">{formatNpr(m.margin.amount)}</p>
      </div>
    );
  },
  exportValue: (r) => {
    const m = marginOf(r);
    return m.known ? `${m.margin.pct}%` : m.known === false ? 'Unknown' : '';
  },
};
const COST_COLUMNS = (() => {
  const at = columns.findIndex((c) => c.key === 'total') + 1;
  return [...columns.slice(0, at), marginColumn, ...columns.slice(at)];
})();

/** Quotations and variation orders (Phase L7) — `?kind=`, all of them to start with. */
const FILTERS = [{
  key: 'kind', label: 'Kind', type: 'enum', allLabel: 'Quotations and variations',
  options: QUOTATION_KINDS.map((value) => ({ value, label: QUOTATION_KIND_LABELS[value] })),
}];

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
 * A holder of `costs:read` also sees each row's margin (Phase L4). Phase L7: a variation order wears a
 * "Variation" badge with its job, and the Kind filter (`?kind=`) shows quotations or variations only.
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
  const [creating, setCreating] = useState(false);
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
      <PageHeader
        title="Quotations"
        description="Priced work: approved in the office, then answered by the customer."
        actions={can('quotations:write') ? (
          <Button size="sm" onClick={() => setCreating(true)}><FilePlus2 aria-hidden /> New quotation</Button>
        ) : null}
      />
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
        columns={can('costs:read') ? COST_COLUMNS : columns}
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
        filters={FILTERS}
        rowLabel={(row) => `${row.number} for ${row.customer?.name ?? 'a customer'}`}
        searchPlaceholder="Search number or customer…"
        emptyTitle={stage === 'approval' ? 'Nothing is waiting for approval' : 'No quotations here'}
        emptyDescription="Start one with New quotation — blank, from a site survey, or a copy of another."
      />
      {actionDialogs}
      {creating ? <NewQuotationSheet open onOpenChange={setCreating} /> : null}
    </PageTransition>
  );
}
