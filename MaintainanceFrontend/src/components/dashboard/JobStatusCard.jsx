import { Link } from 'react-router-dom';
import { Activity } from 'lucide-react';
import { motion, useReducedMotion } from '@/three/motion/motionKit';
import { ChartCard } from '@/components/charts/ChartCard';
import { JOB_STATUS_LABELS } from '@/config/constants';
import { cn } from '@/helpers/utils';

/**
 * An open job's lifecycle is ordered, so its stages are steps of one colour,
 * lightest first. On hold is the exception: it is a warning, and says so.
 */
const STAGES = [
  { key: 'DRAFT', fill: 'hsl(var(--chart-1) / 0.22)' },
  { key: 'SCHEDULED', fill: 'hsl(var(--chart-1) / 0.4)' },
  { key: 'ASSIGNED', fill: 'hsl(var(--chart-1) / 0.58)' },
  { key: 'EN_ROUTE', fill: 'hsl(var(--chart-1) / 0.78)' },
  { key: 'IN_PROGRESS', fill: 'hsl(var(--chart-1))' },
  { key: 'ON_HOLD', fill: 'hsl(var(--warning))', warn: true },
];

/** Where every open job is — one bar split by stage, with the counts listed beneath as its key. */
export function JobStatusCard({ counts, className }) {
  const reduced = useReducedMotion();
  const total = STAGES.reduce((n, s) => n + (counts[s.key] ?? 0), 0);
  const present = STAGES.filter((s) => counts[s.key]);

  return (
    <ChartCard
      title="Open jobs by stage"
      subtitle={total ? `${total} job${total === 1 ? '' : 's'} not yet finished` : 'No open jobs'}
      icon={Activity}
      to="/admin/jobs"
      linkLabel="Open jobs"
      className={className}
    >
      <div
        className="flex h-3 w-full gap-0.5 overflow-hidden rounded-full bg-muted"
        role="img"
        aria-label={present.map((s) => `${JOB_STATUS_LABELS[s.key]} ${counts[s.key]}`).join(', ') || 'No open jobs'}
      >
        {present.map((s, i) => (
          <motion.div
            key={s.key}
            className="h-full first:rounded-l-full last:rounded-r-full"
            style={{ background: s.fill, width: `${(counts[s.key] / total) * 100}%`, transformOrigin: 'left' }}
            initial={reduced ? false : { scaleX: 0 }}
            animate={{ scaleX: 1 }}
            transition={{ duration: 0.6, delay: 0.1 + i * 0.08, ease: [0.16, 1, 0.3, 1] }}
            title={`${JOB_STATUS_LABELS[s.key]}: ${counts[s.key]}`}
          />
        ))}
      </div>

      <ul className="mt-3 grid grid-cols-2 gap-x-3">
        {STAGES.map((s) => {
          const n = counts[s.key] ?? 0;
          return (
            <li key={s.key}>
              <Link
                to={`/admin/jobs?status=${s.key}`}
                className={cn(
                  'flex items-center justify-between gap-2 rounded-md px-1.5 py-1 text-xs transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  !n && 'text-muted-foreground',
                )}
              >
                <span className="flex min-w-0 items-center gap-2">
                  <span aria-hidden className="h-2.5 w-2.5 shrink-0 rounded-[3px]" style={{ background: s.fill }} />
                  <span className="truncate">{JOB_STATUS_LABELS[s.key]}</span>
                </span>
                <span className={cn('tabular-nums', n ? 'font-semibold' : '', s.warn && n ? 'text-warning-foreground' : '')}>{n}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </ChartCard>
  );
}
