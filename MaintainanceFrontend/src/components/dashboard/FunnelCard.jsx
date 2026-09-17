import { Filter } from 'lucide-react';
import { motion, useReducedMotion } from '@/three/motion/motionKit';
import { ChartCard } from '@/components/charts/ChartCard';

/** Ordered stages, so one colour stepping darker as the funnel narrows. */
const STEPS = ['0.3', '0.5', '0.72', '1'];

/** How the last 30 days' enquiries turned into work, and where each step lost people. */
export function FunnelCard({ funnel, className }) {
  const reduced = useReducedMotion();
  const { stages, total, lost } = funnel;

  return (
    <ChartCard
      title="From enquiry to job"
      subtitle="Last 30 days"
      icon={Filter}
      to="/admin/leads/board"
      linkLabel="Open the lead board"
      className={className}
    >
      <ol className="space-y-2">
        {stages.map((s, i) => {
          const prev = stages[i - 1];
          const kept = prev?.count ? Math.round((s.count / prev.count) * 100) : null;
          return (
            <li key={s.key}>
              <div className="flex items-baseline justify-between gap-2 text-xs">
                <span className="font-medium">{s.label}</span>
                <span className="text-xs text-muted-foreground">
                  <span className="font-semibold text-foreground">{s.count}</span> · {s.pct}%
                </span>
              </div>
              <div className="mt-1 h-2 overflow-hidden rounded-full bg-muted">
                <motion.div
                  className="h-full rounded-full"
                  style={{ background: `hsl(var(--chart-1) / ${STEPS[i] ?? 1})`, width: `${total ? (s.count / total) * 100 : 0}%`, transformOrigin: 'left' }}
                  initial={reduced ? false : { scaleX: 0 }}
                  animate={{ scaleX: 1 }}
                  transition={{ duration: 0.8, delay: 0.15 + i * 0.1, ease: [0.16, 1, 0.3, 1] }}
                />
              </div>
              {kept != null ? (
                <p className="mt-0.5 text-[11px] text-muted-foreground">{kept}% of the step before</p>
              ) : null}
            </li>
          );
        })}
      </ol>
      <p className="mt-auto pt-3 text-[11px] text-muted-foreground">
        {lost ? `${lost} marked lost in the same period.` : 'None marked lost in the same period.'}
      </p>
    </ChartCard>
  );
}
