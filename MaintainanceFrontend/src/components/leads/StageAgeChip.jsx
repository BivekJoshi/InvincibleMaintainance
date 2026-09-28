import { Hourglass } from 'lucide-react';
import { LEAD_STATUS_LABELS } from '@/config/constants';
import { formatDateTime } from '@/helpers/format';
import { daysInStage, isClosedLead, stageAgeLabel } from '@/helpers/leadFollowUp';
import { cn } from '@/helpers/utils';

/** From this many days in one stage the chip turns amber — a lead that has stopped moving. */
export const STAGE_STALE_DAYS = 3;

/**
 * "4d in stage" — whole days (rounded down) since the lead entered its status (`stageEnteredAt`),
 * or "In stage today". Shown on the leads list and the board's cards; nothing for a closed lead
 * or a row without the field.
 *
 * @param {{ lead: { status: string, stageEnteredAt?: string }, now?: number, className?: string }} props
 */
export function StageAgeChip({ lead, now, className }) {
  if (isClosedLead(lead)) return null;
  const days = daysInStage(lead, now);
  if (days == null) return null;
  const stale = days >= STAGE_STALE_DAYS;
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2 py-0.5 text-[11px] font-medium tabular-nums',
        stale ? 'surface-warning' : 'border-border bg-muted/60 text-muted-foreground',
        className,
      )}
      title={`${LEAD_STATUS_LABELS[lead.status] ?? lead.status} since ${formatDateTime(lead.stageEnteredAt)}`}
    >
      <Hourglass className="h-3 w-3" aria-hidden />
      {stageAgeLabel(days)}
    </span>
  );
}
