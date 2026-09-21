import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, X } from 'lucide-react';
import { useGetCustomerSummaryQuery, useGetCustomersQuery } from '@/api/customersApi';
import { useListParams } from '@/hooks/useListParams';
import { useAuth } from '@/hooks/useAuth';
import { PageHeader } from '@/components/common/PageHeader';
import { CustomTable } from '@/components/common/CustomTable/CustomTable';
import { CustomerAvatar } from '@/components/customers/CustomerAvatar';
import { CustomerBook } from '@/components/customers/CustomerBook';
import { CustomerFormSheet } from '@/components/customers/CustomerFormSheet';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { PageTransition } from '@/three/motion/motionKit';
import { CUSTOMER_TYPES, PREFERRED_LOCALE_OPTIONS } from '@/config/constants';
import { formatNpr, relativeTime, titleCase } from '@/helpers/format';

const languageOf = (code) => PREFERRED_LOCALE_OPTIONS.find((o) => o.value === code)?.label ?? code;

function columnsFor({ withBalance, onTag }) {
  return [
    {
      key: 'name', header: 'Customer', sortable: true,
      cell: (r) => (
        <div className="flex min-w-0 items-center gap-3">
          <CustomerAvatar customer={r} />
          <div className="min-w-0">
            <p className="truncate font-medium">{r.name}</p>
            {r.sites?.length ? (
              <p className="truncate text-xs text-muted-foreground">
                {(r.sites.find((site) => site.isPrimary) ?? r.sites[0]).address}
              </p>
            ) : null}
            {r.tags?.length ? (
              <div className="mt-0.5 flex flex-wrap gap-1">
                {r.tags.map((t) => (
                  <button
                    key={t} type="button"
                    onClick={(e) => { e.stopPropagation(); onTag(t); }}
                    className="rounded bg-muted px-1.5 text-[11px] text-muted-foreground hover:bg-primary/10 hover:text-primary"
                    aria-label={`Show customers tagged ${t}`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        </div>
      ),
    },
    {
      key: 'phone', header: 'Phone',
      cell: (r) => <a href={`tel:${r.phone}`} onClick={(e) => e.stopPropagation()} className="whitespace-nowrap hover:text-primary hover:underline">{r.phone}</a>,
    },
    { key: 'email', header: 'Email', className: 'max-w-[200px] truncate', cell: (r) => r.email ?? <span className="text-muted-foreground">—</span> },
    { key: 'siteCount', header: 'Sites', className: 'text-right tabular-nums', cell: (r) => r.siteCount },
    {
      key: 'createdAt', header: 'Customer since', sortable: true,
      cell: (r) => <span className="whitespace-nowrap text-muted-foreground" title={r.createdAt}>{relativeTime(r.createdAt)}</span>,
    },
    {
      key: 'openJobs', header: 'Open jobs', className: 'text-right tabular-nums',
      cell: (r) => (r.openJobs
        ? <Badge className="border-gold/30 bg-gold/15 text-foreground hover:bg-gold/15">{r.openJobs} on</Badge>
        : <span className="text-muted-foreground">—</span>),
    },
    ...(withBalance ? [{
      key: 'balanceDue', header: 'Balance due', className: 'text-right tabular-nums',
      cell: (r) => (r.balanceDue
        ? <span className="font-semibold text-destructive">{formatNpr(r.balanceDue)}</span>
        : <span className="text-muted-foreground">—</span>),
    }] : []),
    { key: 'preferredLocale', header: 'Language', cell: (r) => <span lang={r.preferredLocale}>{languageOf(r.preferredLocale)}</span> },
  ];
}

const filters = [
  { key: 'type', label: 'Type', type: 'enum', allLabel: 'All types', className: 'w-[150px]', options: CUSTOMER_TYPES.map((t) => ({ value: t, label: titleCase(t) })) },
];

/** Everyone the company has worked for or quoted. */
export default function CustomersPage() {
  const [params, setParams] = useListParams({ limit: 20 });
  const { data, isLoading, isFetching, error, refetch } = useGetCustomersQuery(params);
  const { data: summary } = useGetCustomerSummaryQuery();
  const navigate = useNavigate();
  const { can } = useAuth();
  const [creating, setCreating] = useState(false);
  const withBalance = can('invoices:read');

  const setTag = (tag) => setParams({ ...params, tag, page: 1 });
  // The book's tiles are the one-click questions: companies, who has work on, who owes us.
  const toggle = (key, value) => setParams({ ...params, [key]: params[key] === value ? undefined : value, page: 1 });
  const toolbar = (
    <>
      {params.tag ? (
        <Button type="button" variant="secondary" size="sm" onClick={() => setTag(undefined)} aria-label={`Remove the tag filter ${params.tag}`}>
          Tag: {params.tag} <X />
        </Button>
      ) : null}
    </>
  );

  return (
    <PageTransition>
      <PageHeader
        title="Customers"
        description="People and companies, their sites, and everything done for them."
        actions={can('customers:write') ? <Button size="sm" onClick={() => setCreating(true)}><Plus /> New customer</Button> : null}
      />
      <CustomerBook summary={summary} params={params} onToggle={toggle} withBalance={withBalance} />
      <CustomTable
        storageKey="customers"
        exportable
        columns={columnsFor({ withBalance, onTag: setTag })}
        data={data?.items}
        meta={data?.meta}
        isLoading={isLoading}
        isFetching={isFetching}
        error={error}
        refetch={refetch}
        params={params}
        onParamsChange={setParams}
        onRowClick={(row) => navigate(`/admin/customers/${row.id}`)}
        searchPlaceholder="Search name, phone, email, PAN…"
        filters={filters}
        toolbar={toolbar}
        emptyTitle="No customers match"
        emptyDescription="Customers are created when a lead is converted, or with New customer."
        rowLabel={(r) => r.name}
      />
      {can('customers:write') ? (
        <CustomerFormSheet open={creating} onOpenChange={setCreating} onCreated={(c) => navigate(`/admin/customers/${c.id}`)} />
      ) : null}
    </PageTransition>
  );
}
