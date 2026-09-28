import { useNavigate } from 'react-router-dom';
import { useGetCustomerStatementQuery } from '@/api/customersApi';
import { AdBsDate } from '@/components/common/AdBsDate';
import { ReportCsvButton } from '@/components/reports/ReportCsvButton';
import { ReportFigures } from '@/components/reports/ReportFigures';
import { ReportTable } from '@/components/reports/ReportTable';
import { PAYMENT_METHOD_LABELS } from '@/config/constants';
import { formatBalance, formatDateBs, formatNpr } from '@/helpers/format';

const columns = [
  {
    key: 'at', header: 'Date', cell: (r) => <AdBsDate iso={r.at} />,
    exportValue: (r) => `${r.at?.slice(0, 10) ?? ''} (${formatDateBs(r.at)} BS)`,
  },
  {
    key: 'kind', header: 'Entry',
    cell: (r) => (r.kind === 'payment'
      ? `Payment${r.method ? ` · ${PAYMENT_METHOD_LABELS[r.method] ?? r.method}` : ''}`
      : 'Invoice'),
  },
  { key: 'ref', header: 'Invoice', cell: (r) => <span className="font-mono text-xs">{r.ref}</span> },
  { key: 'debit', header: 'Charged', className: 'text-right', cell: (r) => (r.debit ? <span className="tabular-nums">{formatNpr(r.debit)}</span> : '') },
  { key: 'credit', header: 'Paid', className: 'text-right', cell: (r) => (r.credit ? <span className="tabular-nums">{formatNpr(r.credit)}</span> : '') },
  { key: 'balance', header: 'Balance', className: 'text-right', cell: (r) => <span className="font-medium tabular-nums">{formatBalance(r.balance)}</span> },
];

/**
 * A customer's account (Phase I5, `reports:finance`): every sent invoice (charged) and every payment still counted
 * (paid), oldest first, with the running balance — `GET /admin/customers/:id/statement`, figures and all the server's.
 * On the customer's page (the Statement tab) and in Finance reports › Customer statement; a line opens its invoice;
 * **CSV** is the API's.
 *
 * @param {{ customerId: string, storageKey?: string }} props
 */
export function CustomerStatement({ customerId, storageKey = 'customer-statement' }) {
  const navigate = useNavigate();
  const { data, isLoading, isFetching, error, refetch } = useGetCustomerStatementQuery(customerId, { skip: !customerId });
  const ledger = (data?.ledger ?? []).map((row, i) => ({ ...row, id: `${i}` }));
  const totals = data?.totals;

  return (
    <div className="space-y-4" data-testid="customer-statement">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          {data?.customer ? <span className="font-medium text-foreground">{data.customer.name}</span> : null}
          {data?.customer?.panVatNo ? ` · PAN/VAT ${data.customer.panVatNo}` : ''}
        </p>
        <ReportCsvButton path={`/admin/customers/${customerId}/statement`} name="statement" />
      </div>
      <ReportFigures
        isLoading={isLoading}
        label="Account totals"
        className="lg:grid-cols-3"
        items={totals ? [
          { label: 'Invoiced', value: formatNpr(totals.invoiced) },
          { label: 'Paid', value: formatNpr(totals.paid) },
          { label: 'Outstanding', value: formatBalance(totals.outstanding), tone: totals.outstanding > 0 ? 'destructive' : 'success' },
        ] : []}
      />
      <ReportTable
        storageKey={storageKey}
        columns={columns}
        rows={ledger}
        isLoading={isLoading}
        isFetching={isFetching}
        error={error}
        refetch={refetch}
        onRowClick={(r) => (r.invoiceId ? navigate(`/admin/invoices/${r.invoiceId}`) : undefined)}
        rowLabel={(r) => `${r.kind} ${r.ref}`}
        emptyTitle="Nothing billed yet"
        emptyDescription="A sent invoice and its payments show here."
      />
    </div>
  );
}
