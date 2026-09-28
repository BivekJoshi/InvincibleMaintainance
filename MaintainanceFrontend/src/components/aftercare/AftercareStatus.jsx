import { StateBadge } from '@/components/common/StateBadge';
import {
  AMC_STATUS_LABELS, AMC_VISIT_STATUS_LABELS, CLAIM_STATUS_LABELS, REMINDER_STATUS_LABELS, WARRANTY_STATUS_LABELS,
} from '@/config/constants';
import {
  AMC_TONE, AMC_VISIT_TONE, CLAIM_TONE, REMINDER_TONE, WARRANTY_TONE,
} from '@/config/admin/aftercareViews';
import { titleCase } from '@/helpers/format';
import { cn } from '@/helpers/utils';

const KINDS = {
  warranty: [WARRANTY_STATUS_LABELS, WARRANTY_TONE],
  claim: [CLAIM_STATUS_LABELS, CLAIM_TONE],
  amc: [AMC_STATUS_LABELS, AMC_TONE],
  visit: [AMC_VISIT_STATUS_LABELS, AMC_VISIT_TONE],
  reminder: [REMINDER_STATUS_LABELS, REMINDER_TONE],
};

/** StateBadge has no danger tone; a void warranty or a failed reminder sits on the destructive surface. */
const DANGER = 'border-destructive/30 bg-destructive/10 text-destructive';

/**
 * An aftercare record's state in the office's words, on the theme's semantic surfaces — a warranty, a claim,
 * an AMC contract or visit, a service reminder.
 *
 * @param {{ kind: keyof KINDS, status: string, className?: string }} props
 */
export function AftercareStatus({ kind, status, className }) {
  if (!status) return null;
  const [labels, tones] = KINDS[kind];
  const tone = tones[status] ?? 'muted';
  return (
    <StateBadge tone={tone === 'danger' ? 'muted' : tone} className={cn(tone === 'danger' && DANGER, className)}>
      {labels[status] ?? titleCase(status)}
    </StateBadge>
  );
}
