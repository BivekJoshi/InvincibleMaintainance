import { StateBadge } from '@/components/common/StateBadge';
import { INVOICE_KIND_LABELS } from '@/config/constants';

const TONES = { ADVANCE: 'warning', RUNNING: 'info', FINAL: 'info' };

/**
 * What an invoice bills, when it is not an ordinary one (Phase L6): **Advance** (the ON_ACCEPT stage a customer's
 * Accept raised — it gates the job's scheduling until paid), **Running bill**, **Final bill**. A STANDARD invoice, or
 * one from before L6 with no `kind`, shows nothing.
 *
 * @param {{ kind?: string|null, className?: string }} props
 */
export function InvoiceKindBadge({ kind, className }) {
  if (!kind || kind === 'STANDARD') return null;
  return (
    <StateBadge tone={TONES[kind] ?? 'muted'} className={className}>
      <span data-testid="invoice-kind">{INVOICE_KIND_LABELS[kind] ?? kind}</span>
    </StateBadge>
  );
}
