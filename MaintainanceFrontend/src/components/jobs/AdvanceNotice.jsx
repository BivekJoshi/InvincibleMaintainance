import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Hourglass, ShieldAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { advanceInvoiceOf, awaitingAdvanceOf } from '@/helpers/handoff';
import { formatBalance } from '@/helpers/format';
import { AdvanceOverrideDialog } from './AdvanceOverrideDialog';

/**
 * The advance invoice as a link to `/admin/invoices/:id` for a reader of invoices (`invoices:read` — accounts,
 * ADMIN); its number as plain text for anyone else, since the page would refuse them.
 *
 * @param {{ invoice: { id?: string|null, number?: string|null }|null, className?: string }} props
 */
export function AdvanceInvoiceLink({ invoice, className }) {
  const { can } = useAuth();
  if (!invoice?.number && !invoice?.id) return null;
  const label = invoice.number ?? 'the advance invoice';
  if (invoice.id && can('invoices:read')) {
    return (
      <Link to={`/admin/invoices/${invoice.id}`} className={className ?? 'font-mono text-xs font-medium text-primary hover:underline'}>
        {label}
      </Link>
    );
  }
  return <span className={className ?? 'font-mono text-xs font-medium'}>{label}</span>;
}

/**
 * Why a job cannot be scheduled, assigned or moved on yet (Phase L6): it waits for its advance. Shown in the Schedule
 * and Assign dialogs — up front when the job is known to be held (`awaitingAdvance`), and after a 422
 * **ADVANCE_UNPAID** (`refusal`, from `helpers/handoff#advanceRefusal`: the server's message, the invoice and what is
 * still to pay). It links the invoice (`AdvanceInvoiceLink`) and, for `jobs:advance-override` holders, offers
 * **Override…**; `onOverridden` is told once the override is recorded, so the dialog can let the dispatcher go on.
 *
 * @param {{ job: object, refusal?: { message: string, invoiceId: string|null, invoiceNumber: string|null,
 *   balance: number|null }|null, onOverridden?: (job: object) => void }} props
 */
export function AdvanceNotice({ job, refusal = null, onOverridden }) {
  const { can } = useAuth();
  const [overriding, setOverriding] = useState(false);
  if (!job || (!refusal && !awaitingAdvanceOf(job))) return null;

  const known = advanceInvoiceOf(job);
  const invoice = { id: refusal?.invoiceId ?? known?.id ?? null, number: refusal?.invoiceNumber ?? known?.number ?? null };
  const balance = refusal?.balance ?? job.advance?.invoice?.balance ?? null;
  const mayOverride = can('jobs:advance-override');

  return (
    <div role="status" data-testid="advance-notice" className="surface-warning mb-4 space-y-2 rounded-lg border p-3 text-sm">
      <p className="flex items-center gap-2 font-medium">
        <Hourglass className="h-4 w-4 shrink-0" aria-hidden />
        Waiting for the advance — scheduling is locked
      </p>
      <p className="text-xs">
        {refusal?.message ?? `${job.number} can be scheduled once the customer pays the advance. Accounts record the payment on the invoice.`}
      </p>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
        {invoice.number || invoice.id ? (
          <span className="inline-flex items-center gap-1">Invoice <AdvanceInvoiceLink invoice={invoice} /></span>
        ) : null}
        {balance != null ? <span className="tabular-nums">{formatBalance(balance)} to pay</span> : null}
        {mayOverride ? (
          <Button type="button" size="sm" variant="outline" className="ml-auto h-7" onClick={() => setOverriding(true)}>
            <ShieldAlert aria-hidden /> Override…
          </Button>
        ) : null}
      </div>
      {mayOverride ? (
        <AdvanceOverrideDialog
          job={job}
          invoiceNumber={invoice.number}
          open={overriding}
          onOpenChange={setOverriding}
          onDone={onOverridden}
        />
      ) : null}
    </div>
  );
}
