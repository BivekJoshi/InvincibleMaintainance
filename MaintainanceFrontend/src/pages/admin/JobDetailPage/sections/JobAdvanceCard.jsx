import { useState } from 'react';
import { CheckCircle2, ExternalLink, Hourglass, ShieldAlert, ShieldCheck, WalletCards } from 'lucide-react';
import { AdBsDate } from '@/components/common/AdBsDate';
import { StateBadge } from '@/components/common/StateBadge';
import { AdvanceInvoiceLink } from '@/components/jobs/AdvanceNotice';
import { AdvanceOverrideDialog } from '@/components/jobs/AdvanceOverrideDialog';
import { Button } from '@/components/ui/button';
import { INVOICE_STATUS_LABELS } from '@/config/constants';
import { advanceState, canOverrideAdvance } from '@/helpers/handoff';
import { formatBalance, formatDateTime, formatNpr } from '@/helpers/format';
import { cn } from '@/helpers/utils';

const LOOK = {
  awaiting: { icon: Hourglass, surface: 'surface-warning' },
  paid: { icon: CheckCircle2, surface: 'surface-success' },
  overridden: { icon: ShieldCheck, surface: 'surface-info' },
  void: { icon: WalletCards, surface: 'border-border bg-muted/40' },
  unpaid: { icon: WalletCards, surface: 'border-border bg-muted/40' },
};

function Figure({ label, children, testId }) {
  return (
    <div className="min-w-0">
      <dt className="text-[11px] uppercase tracking-wide opacity-80">{label}</dt>
      <dd className="mt-0.5 font-semibold tabular-nums" data-testid={testId}>{children}</dd>
    </div>
  );
}

/**
 * The job's advance (Phase L6, L-D3), above its tabs: the customer's Accept raised an ADVANCE invoice for the ON_ACCEPT
 * stage of the payment schedule, and the job cannot be scheduled until it is paid. The card says which it is —
 * **waiting** ("scheduling is locked"), **paid**, or **overridden by** someone with their reason — with the invoice's
 * status, amount, what is paid and still owed (the server's paisa), the due date in AD and BS, a link to the invoice
 * (`invoices:read`) and the customer's payment page. `jobs:advance-override` holders get **Override…** while it holds.
 * Nothing renders for a job without an advance.
 *
 * @param {{ job: object, can: (capability: string) => boolean }} props
 */
export function JobAdvanceCard({ job, can }) {
  const [overriding, setOverriding] = useState(false);
  const { advance } = job;
  const state = advanceState(advance);
  if (!state) return null;
  const { invoice, override } = advance;
  const { icon: Icon, surface } = LOOK[state.kind];

  return (
    <section
      aria-label="The advance"
      data-testid="advance-card"
      data-state={state.kind}
      className={cn('mb-4 rounded-xl border p-4 text-sm', surface)}
    >
      <div className="flex flex-wrap items-start gap-3">
        <Icon className="mt-0.5 h-5 w-5 shrink-0" aria-hidden />
        <div className="min-w-0 flex-1 space-y-1">
          <p className="font-semibold" data-testid="advance-title">{state.title}</p>
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
            {invoice ? (
              <>
                <span>Advance invoice</span>
                <AdvanceInvoiceLink invoice={invoice} />
                <StateBadge tone={invoice.status === 'PAID' ? 'success' : invoice.status === 'OVERDUE' ? 'warning' : 'muted'}>
                  {INVOICE_STATUS_LABELS[invoice.status] ?? invoice.status}
                </StateBadge>
                {invoice.publicUrl ? (
                  <a href={invoice.publicUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 underline-offset-2 hover:underline">
                    The customer’s payment page <ExternalLink className="h-3 w-3" aria-hidden />
                  </a>
                ) : null}
              </>
            ) : 'The advance invoice is not on this job any more.'}
          </p>
          {override ? (
            <p className="text-xs" data-testid="advance-override">
              Overridden by {override.by?.name ?? 'someone no longer listed'}{override.at ? ` on ${formatDateTime(override.at)}` : ''}: “{override.reason}”
            </p>
          ) : null}
        </div>
        {canOverrideAdvance(job, can) ? (
          <Button type="button" size="sm" variant="outline" className="shrink-0 bg-background" onClick={() => setOverriding(true)}>
            <ShieldAlert aria-hidden /> Override…
          </Button>
        ) : null}
      </div>

      {invoice && state.kind !== 'void' ? (
        <dl className="mt-3 grid grid-cols-2 gap-3 border-t border-dotted pt-3 sm:grid-cols-4">
          <Figure label="Advance" testId="advance-total">{formatNpr(invoice.total)}</Figure>
          <Figure label="Paid">{formatNpr(invoice.paidAmount)}</Figure>
          <Figure label="Still to pay" testId="advance-balance">{formatBalance(invoice.balance)}</Figure>
          <Figure label="Due"><AdBsDate iso={invoice.dueDate} /></Figure>
        </dl>
      ) : null}

      <AdvanceOverrideDialog job={job} invoiceNumber={invoice?.number} open={overriding} onOpenChange={setOverriding} />
    </section>
  );
}
