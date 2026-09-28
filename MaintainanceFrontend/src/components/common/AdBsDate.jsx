import { formatDate, formatDateBs, formatDateTime } from '@/helpers/format';
import { cn } from '@/helpers/utils';

/**
 * A date as the finance screens state it (Phase I): the AD date in Kathmandu time, and its Bikram Sambat twin
 * under it — the day it was in Kathmandu, converted by `helpers/nepaliDate.js` (the API's own table). `time` adds
 * the Kathmandu time to the AD line.
 *
 * @param {{ iso?: string|null, time?: boolean, className?: string, empty?: string }} props
 */
export function AdBsDate({ iso, time = false, className, empty = '—' }) {
  if (!iso) return <span className="text-muted-foreground">{empty}</span>;
  const bs = formatDateBs(iso);
  return (
    <time dateTime={new Date(iso).toISOString()} className={cn('block whitespace-nowrap', className)}>
      <span className="block">{time ? formatDateTime(iso) : formatDate(iso)}</span>
      {bs ? <span className="block text-[11px] tabular-nums text-muted-foreground">{bs} BS</span> : null}
    </time>
  );
}
