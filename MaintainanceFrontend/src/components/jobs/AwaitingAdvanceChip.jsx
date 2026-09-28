import { Hourglass } from 'lucide-react';
import { StateBadge } from '@/components/common/StateBadge';
import { advanceInvoiceOf, awaitingAdvanceOf } from '@/helpers/handoff';
import { cn } from '@/helpers/utils';

/**
 * "Awaiting advance" (Phase L6): the job cannot be scheduled until the customer pays the advance invoice their Accept
 * raised (L-D3) — or a manager overrides it. On the job page's header, the jobs list's status column, the dispatch
 * card and the unassigned queue. It reads a detail (`advance.awaitingAdvance`) or a list row (`awaitingAdvance`) and
 * renders nothing when the job is not held. The invoice number is in its hover text.
 *
 * @param {{ job: object, className?: string }} props
 */
export function AwaitingAdvanceChip({ job, className }) {
  if (!awaitingAdvanceOf(job)) return null;
  const invoice = advanceInvoiceOf(job);
  return (
    <StateBadge
      tone="warning"
      title={`Scheduling is locked until the advance${invoice?.number ? ` (${invoice.number})` : ''} is paid`}
      className={cn('gap-1', className)}
    >
      <Hourglass className="h-3 w-3 shrink-0" aria-hidden />
      <span data-testid="awaiting-advance">Awaiting advance</span>
    </StateBadge>
  );
}
