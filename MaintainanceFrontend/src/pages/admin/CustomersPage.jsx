import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Building2, Plus, User, X } from 'lucide-react';
import { useGetCustomersQuery } from '@/api/customersApi';
import { useListParams } from '@/hooks/useListParams';
import { useAuth } from '@/hooks/useAuth';
import { PageHeader } from '@/components/common/PageHeader';
import { CustomTable } from '@/components/common/CustomTable/CustomTable';
import { CustomerFormSheet } from '@/components/customers/CustomerFormSheet';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { PageTransition } from '@/three/motion/motionKit';
import { CUSTOMER_TYPES, PREFERRED_LOCALE_OPTIONS } from '@/config/constants';
import { formatNpr, titleCase } from '@/helpers/format';

const languageOf = (code) => PREFERRED_LOCALE_OPTIONS.find((o) => o.value === code)?.label ?? code;

function columnsFor({ withBalance, onTag }) {
  return [
    {
      key: 'name', header: 'Customer', sortable: true,
      cell: (r) => (
        <div className="flex min-w-0 items-center gap-2">
          {r.type === 'company'
            ? <Building2 className="h-4 w-4 shrink-0 text-muted-foreground" aria-label="Company" />
            : <User className="h-4 w-4 shrink-0 text-muted-foreground" aria-label="Individual" />}
          <div className="min-w-0">
            <p className="truncate font-medium">{r.name}</p>
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
      key: 'openJobs', header: 'Open jobs', className: 'text-right tabular-nums',
      cell: (r) => (r.openJobs ? <Badge variant="secondary">{r.openJobs}</Badge> : <span className="text-muted-foreground">0</span>),
    },
    ...(withBalance ? [{
      key: 'balanceDue', header: 'Balance due', className: 'text-right tabular-nums',
      cell: (r) => (r.balanceDue ? <span className="font-medium">{formatNpr(r.balanceDue)}</span> : <span className="text-muted-foreground">—</span>),
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
  const navigate = useNavigate();
  const { can } = useAuth();
  const [creating, setCreating] = useState(false);
  const withBalance = can('invoices:read');

  const setTag = (tag) => setParams({ ...params, tag, page: 1 });
  const toolbar = params.tag ? (
    <Button type="button" variant="secondary" size="sm" onClick={() => setTag(undefined)} aria-label={`Remove the tag filter ${params.tag}`}>
      Tag: {params.tag} <X />
    </Button>
  ) : null;

  return (
    <PageTransition>
      <PageHeader
        title="Customers"
        description="People and companies, their sites, and everything done for them."
        actions={can('customers:write') ? <Button size="sm" onClick={() => setCreating(true)}><Plus /> New customer</Button> : null}
      />
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
