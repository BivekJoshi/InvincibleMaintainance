import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Banknote, Ban, ExternalLink, FilePlus2, Printer, Send, Wrench } from 'lucide-react';
import { useGetInvoicesQuery } from '@/api/financeApi';
import { useListParams } from '@/hooks/useListParams';
import { useAuth } from '@/hooks/useAuth';
import { useInvoiceActions } from '@/hooks/useInvoiceActions';
import { PageHeader } from '@/components/common/PageHeader';
import { CustomTable } from '@/components/common/CustomTable/CustomTable';
import { AdBsDate } from '@/components/common/AdBsDate';
import { InvoiceFromJobSheet } from '@/components/finance/InvoiceFromJobSheet';
import { NewInvoiceSheet } from '@/components/finance/NewInvoiceSheet';
import { StatusBadge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PageTransition } from '@/three/motion/motionKit';
import { INVOICE_STATUS_LABELS } from '@/config/constants';
import { INVOICE_TABS } from '@/config/admin/financeViews';
import { CUSTOMER_RELATION } from '@/config/admin/jobViews';
import { invoiceActions } from '@/helpers/finance';
import { formatBalance, formatDateBs, formatNpr } from '@/helpers/format';

const ACTION_ICONS = { send: Send, recordPayment: Banknote, void: Ban };

const money = (paisa, className = '') => <span className={`whitespace-nowrap tabular-nums ${className}`}>{formatNpr(paisa)}</span>;

const columns = [
  {
    key: 'number', header: 'Number', sortable: true,
    cell: (r) => (
      <div className="min-w-0">
        <p className="font-mono text-xs font-medium">{r.number}</p>
        <StatusBadge status={r.status} label={INVOICE_STATUS_LABELS[r.status]} className="mt-1" />
      </div>
    ),
    exportValue: (r) => r.number,
  },
  {
    key: 'customer', header: 'Customer',
    cell: (r) => (
      <div className="min-w-0 max-w-[220px]">
        <p className="truncate font-medium">{r.customer?.name}</p>
        {r.customer?.phone ? (
          <a href={`tel:${r.customer.phone}`} onClick={(e) => e.stopPropagation()} className="text-xs text-muted-foreground hover:text-primary hover:underline">
            {r.customer.phone}
          </a>
        ) : null}
      </div>
    ),
    exportValue: (r) => r.customer?.name ?? '',
  },
  {
    key: 'issuedAt', header: 'Issued', sortable: true,
    cell: (r) => <AdBsDate iso={r.issuedAt} />,
    exportValue: (r) => `${r.issuedAt?.slice(0, 10) ?? ''} (${formatDateBs(r.issuedAt)} BS)`,
  },
  {
    key: 'dueDate', header: 'Due', sortable: true,
    cell: (r) => <AdBsDate iso={r.dueDate} className={r.status === 'OVERDUE' ? 'text-destructive' : undefined} />,
    exportValue: (r) => (r.dueDate ? `${r.dueDate.slice(0, 10)} (${formatDateBs(r.dueDate)} BS)` : ''),
  },
  { key: 'total', header: 'Total', sortable: true, className: 'text-right', cell: (r) => money(r.total, 'font-medium') },
  { key: 'paidAmount', header: 'Paid', className: 'text-right', cell: (r) => money(r.paidAmount, 'text-muted-foreground') },
  {
    key: 'balance', header: 'Balance', className: 'text-right',
    // A void invoice owes nothing, whatever it once did.
    cell: (r) => (r.status === 'VOID'
      ? <span className="text-xs text-muted-foreground">Void</span>
      : <span className={`whitespace-nowrap font-semibold tabular-nums ${r.status === 'OVERDUE' ? 'text-destructive' : ''}`}>{formatBalance(r.balance)}</span>),
    exportValue: (r) => (r.status === 'VOID' ? '' : formatBalance(r.balance)),
  },
];

const filters = [
  { key: 'customerId', label: 'Customer', type: 'relation', relation: CUSTOMER_RELATION },
  { key: 'issued', label: 'Issued', type: 'dateRange' },
  // The API filters only for `true` (the overdue notification's link, `?overdueOnly=true`).
  { key: 'overdueOnly', label: 'Overdue', type: 'enum', allLabel: 'Due or not', options: [{ value: 'true', label: 'Overdue only', tone: 'danger' }] },
];

/** A tab's count from the server (`meta.counts`, under the other filters). */
function TabCount({ n }) {
  if (n == null) return null;
  return <span className="ml-1.5 rounded-full bg-muted px-1.5 text-[11px] font-semibold leading-5 tabular-nums text-muted-foreground">{n}</span>;
}

/**
 * `/admin/invoices` (Phase I1, `invoices:read`): status tabs with the server's counts, filters customer · issued between
 * (Kathmandu days) · overdue only (`?overdueOnly=true` — the overdue notification's link), and every invoice's number,
 * customer, issue and due dates in AD and BS, total, paid and balance — each the server's figure. **Create from job**
 * (a finished, billable, not-yet-invoiced job, billed by its one rule) and **New invoice** (the manual one — AMC fees,
 * one-off work) for `invoices:write`, i.e. ADMIN and ACCOUNTANT. A row's menu: open, print, and what its state allows.
 */
export default function InvoicesPage() {
  const navigate = useNavigate();
  const { can } = useAuth();
  const [params, setParams] = useListParams({ limit: 20, sort: '-issuedAt' });
  const { data, isLoading, isFetching, error, refetch } = useGetInvoicesQuery(params);
  const [runAction, invoiceDialogs] = useInvoiceActions();
  const [creating, setCreating] = useState(null); // 'job' | 'manual'
  const tab = INVOICE_TABS.some((t) => t.status === params.status) ? params.status : 'all';
  const counts = data?.meta?.counts;
  const opened = (invoice) => navigate(`/admin/invoices/${invoice.id}`);

  const rowActions = (row) => {
    const allowed = invoiceActions(row, { can }).filter((a) => a.key !== 'edit' && !a.disabledReason);
    return [
      { label: 'Open', icon: ExternalLink, onSelect: () => opened(row) },
      { label: 'Print', icon: Printer, onSelect: () => navigate(`/admin/invoices/${row.id}/print`) },
      ...(allowed.length ? [{ separator: true }] : []),
      ...allowed.map((a) => ({
        label: a.key === 'void' ? 'Void…' : a.key === 'recordPayment' ? 'Record payment…' : `${a.label}…`,
        icon: ACTION_ICONS[a.key],
        destructive: a.key === 'void',
        onSelect: () => runAction(a.key, row),
      })),
    ];
  };

  return (
    <PageTransition>
      <PageHeader
        title="Invoices"
        description="What customers owe: drafted from finished jobs, sent with a link, settled by payments."
        actions={can('invoices:write') ? (
          <>
            <Button size="sm" variant="outline" onClick={() => setCreating('manual')}><FilePlus2 aria-hidden /> New invoice</Button>
            <Button size="sm" onClick={() => setCreating('job')}><Wrench aria-hidden /> Create from job</Button>
          </>
        ) : null}
      />
      <Tabs
        value={tab}
        onValueChange={(next) => setParams({ ...params, status: next === 'all' ? undefined : next, page: 1 })}
        className="mb-4"
      >
        <div className="-mx-1 overflow-x-auto px-1 pb-1">
          <TabsList className="h-auto w-max" aria-label="Invoice status">
            {INVOICE_TABS.map((t) => (
              <TabsTrigger key={t.value} value={t.status ?? 'all'} className="whitespace-nowrap">
                {t.label}
                <TabCount n={counts?.[t.count]} />
              </TabsTrigger>
            ))}
          </TabsList>
        </div>
      </Tabs>
      <CustomTable
        storageKey="invoices"
        exportable
        exportName="invoices"
        columns={columns}
        data={data?.items}
        meta={data?.meta}
        isLoading={isLoading}
        isFetching={isFetching}
        error={error}
        refetch={refetch}
        params={params}
        onParamsChange={setParams}
        onRowClick={opened}
        rowActions={rowActions}
        rowLabel={(r) => `${r.number} for ${r.customer?.name ?? 'a customer'}`}
        searchPlaceholder="Search number or customer…"
        filters={filters}
        emptyTitle={params.overdueOnly === 'true' ? 'Nothing overdue' : 'No invoices here'}
        emptyDescription={can('invoices:write') ? 'Create one from a finished job, or by hand for AMC and one-off work.' : 'Invoices appear here once the office drafts them.'}
      />
      {invoiceDialogs}
      {creating === 'job' ? <InvoiceFromJobSheet open onOpenChange={(o) => { if (!o) setCreating(null); }} onCreated={opened} /> : null}
      {creating === 'manual' ? <NewInvoiceSheet open onOpenChange={(o) => { if (!o) setCreating(null); }} onCreated={opened} /> : null}
    </PageTransition>
  );
}
