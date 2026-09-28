import { useState } from 'react';
import { Ban } from 'lucide-react';
import { CustomTable } from '@/components/common/CustomTable/CustomTable';
import { AdBsDate } from '@/components/common/AdBsDate';
import { StateBadge } from '@/components/common/StateBadge';
import { useAuth } from '@/hooks/useAuth';
import { PAYMENT_METHOD_LABELS } from '@/config/constants';
import { formatNpr } from '@/helpers/format';

const columns = [
  { key: 'receivedAt', header: 'Received', cell: (r) => <AdBsDate iso={r.receivedAt} time /> },
  { key: 'method', header: 'Method', cell: (r) => PAYMENT_METHOD_LABELS[r.method] ?? r.method },
  { key: 'reference', header: 'Reference', cell: (r) => (r.reference ? <span className="font-mono text-xs">{r.reference}</span> : <span className="text-muted-foreground">—</span>) },
  {
    key: 'amount', header: 'Amount', className: 'text-right',
    cell: (r) => (r.voidedAt
      ? <del className="whitespace-nowrap tabular-nums text-muted-foreground" data-testid="voided-amount">{formatNpr(r.amount)}</del>
      : <span className="whitespace-nowrap font-medium tabular-nums">{formatNpr(r.amount)}</span>),
  },
  {
    key: 'state', header: 'State',
    cell: (r) => (r.voidedAt ? (
      <div className="min-w-0 max-w-xs">
        <StateBadge tone="warning">Voided</StateBadge>
        {r.voidReason ? <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{r.voidReason}</p> : null}
      </div>
    ) : <StateBadge tone="success">Counted</StateBadge>),
  },
];

/**
 * An invoice's payments (Phase I2), newest first as the API sends them. A voided one stays, **struck through**, with
 * why; it no longer counts toward what is paid (the server's `paidAmount`). **Void payment…** is `payments:write`'s,
 * on a payment still counted.
 *
 * @param {{ invoice: object, onVoid: (payment: object) => void }} props
 */
export function InvoicePaymentsTab({ invoice, onVoid }) {
  const { can } = useAuth();
  const [params, setParams] = useState({});
  const rows = invoice.payments ?? [];

  return (
    <CustomTable
      columns={columns}
      data={rows}
      meta={{ page: 1, pages: 1, total: rows.length, limit: rows.length || 1 }}
      params={params}
      onParamsChange={setParams}
      searchable={false}
      pageSizes={[]}
      rowLabel={(r) => `${formatNpr(r.amount)} by ${PAYMENT_METHOD_LABELS[r.method] ?? r.method}${r.voidedAt ? ', voided' : ''}`}
      rowActions={can('payments:write') ? (r) => (r.voidedAt ? [] : [
        { label: 'Void payment…', icon: Ban, destructive: true, onSelect: () => onVoid(r) },
      ]) : undefined}
      emptyTitle={invoice.status === 'DRAFT' ? 'Send it first' : 'No payments yet'}
      emptyDescription={invoice.status === 'DRAFT' ? 'A payment is recorded against a sent invoice.' : 'Record one with Record payment.'}
    />
  );
}
