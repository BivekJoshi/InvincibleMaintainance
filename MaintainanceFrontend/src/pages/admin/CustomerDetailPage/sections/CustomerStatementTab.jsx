import { useState } from 'react';
import { useGetCustomerStatementQuery } from '@/api/customersApi';
import { CustomTable } from '@/components/common/CustomTable/CustomTable';
import { Card, CardContent } from '@/components/ui/card';
import { formatDate, formatNpr, titleCase } from '@/helpers/format';

const columns = [
  { key: 'at', header: 'Date', cell: (r) => formatDate(r.at) },
  { key: 'kind', header: 'Entry', cell: (r) => titleCase(r.kind) },
  { key: 'ref', header: 'Invoice', cell: (r) => <span className="font-mono text-xs">{r.ref}</span> },
  { key: 'debit', header: 'Charged', className: 'text-right tabular-nums', cell: (r) => (r.debit ? formatNpr(r.debit) : '') },
  { key: 'credit', header: 'Paid', className: 'text-right tabular-nums', cell: (r) => (r.credit ? formatNpr(r.credit) : '') },
  { key: 'balance', header: 'Balance', className: 'text-right tabular-nums font-medium', cell: (r) => formatNpr(r.balance) },
];

/** The account: invoices and payments in order, with the running balance (reports:finance). */
export function CustomerStatementTab({ customerId }) {
  const { data, isLoading, isFetching, error, refetch } = useGetCustomerStatementQuery(customerId);
  const [params, setParams] = useState({});
  const ledger = (data?.ledger ?? []).map((row, i) => ({ ...row, id: `${i}` }));
  const totals = data?.totals;

  return (
    <div className="space-y-4">
      {totals ? (
        <div className="grid gap-3 sm:grid-cols-3">
          {[['Invoiced', totals.invoiced], ['Paid', totals.paid], ['Outstanding', totals.outstanding]].map(([label, value]) => (
            <Card key={label}><CardContent className="p-4">
              <p className="text-xs text-muted-foreground">{label}</p>
              <p className="mt-1 text-lg font-semibold tabular-nums">{formatNpr(value)}</p>
            </CardContent></Card>
          ))}
        </div>
      ) : null}
      <CustomTable
        columns={columns}
        data={ledger}
        meta={{ page: 1, pages: 1, total: ledger.length, limit: ledger.length || 1 }}
        params={params}
        onParamsChange={setParams}
        searchable={false}
        pageSizes={[]}
        isLoading={isLoading}
        isFetching={isFetching}
        error={error}
        refetch={refetch}
        emptyTitle="Nothing billed yet"
      />
    </div>
  );
}
