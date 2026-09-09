import { useEffect, useState } from 'react';
import { Clock, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { cn } from '@/helpers/utils';
import { SLA_STYLES } from '@/config/constants';
import { formatCountdown } from '@/helpers/format';

const ICONS = { ok: Clock, at_risk: Clock, breached: AlertTriangle, met: CheckCircle2, none: Clock };
const LABELS = { met: 'Responded', none: 'No SLA' };

/**
 * The two-hour promise, made visible. Ticks every 30 seconds so a lead sitting on
 * screen keeps counting down without a refetch.
 */
export function SlaChip({ sla, className, showLabel = true }) {
  const [, tick] = useState(0);

  useEffect(() => {
    if (!sla || sla.state === 'met' || sla.state === 'none') return undefined;
    const id = setInterval(() => tick((n) => n + 1), 30000);
    return () => clearInterval(id);
  }, [sla]);

  if (!sla) return null;
  const { state, dueAt, respondedAt } = sla;
  const Icon = ICONS[state] ?? Clock;

  // Recompute locally so the countdown stays honest between refetches.
  const minutes = dueAt && !respondedAt
    ? Math.round((new Date(dueAt).getTime() - Date.now()) / 60000)
    : null;

  // A lead answered after the deadline still counts as breached, but "—" reads as
  // missing data. Say what actually happened.
  const label = respondedAt && state === 'breached'
    ? 'Answered late'
    : LABELS[state] ?? formatCountdown(minutes);

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium tabular-nums',
        SLA_STYLES[state] ?? SLA_STYLES.none,
        state === 'breached' && !respondedAt && 'animate-pulse',
        className,
      )}
      title={dueAt ? `Response due ${new Date(dueAt).toLocaleString()}` : undefined}
    >
      <Icon className="h-3 w-3" aria-hidden />
      {showLabel ? label : null}
    </span>
  );
}
