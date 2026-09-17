import { HardHat } from 'lucide-react';
import { motion, useReducedMotion } from '@/three/motion/motionKit';
import { ChartCard, ChartTable } from '@/components/charts/ChartCard';
import { cn } from '@/helpers/utils';

/** Each technician's jobs today against what they can take in a day. */
export function TechLoadCard({ load, className }) {
  const reduced = useReducedMotion();
  const on = load.filter((t) => t.isAvailable);
  const booked = on.reduce((n, t) => n + t.jobs, 0);
  const capacity = on.reduce((n, t) => n + t.capacity, 0);
  const free = on.filter((t) => t.jobs === 0).length;

  return (
    <ChartCard
      title="Crew today"
      subtitle={capacity ? `${booked} of ${capacity} slots booked · ${free} free` : 'No technicians available'}
      icon={HardHat}
      to="/admin/technicians"
      linkLabel="Open technicians"
      className={className}
      table={(
        <ChartTable
          columns={['Technician', 'Jobs', 'Capacity']}
          rows={load.map((t) => [t.isAvailable ? t.name : `${t.name} (off)`, t.jobs, t.capacity])}
        />
      )}
    >
      {load.length ? (
        <ul className="space-y-2.5">
          {load.slice(0, 7).map((t, i) => {
            const pct = t.capacity ? Math.min(100, (t.jobs / t.capacity) * 100) : 0;
            const full = t.isAvailable && t.jobs >= t.capacity;
            return (
              <li key={t.id} className={cn(!t.isAvailable && 'opacity-50')}>
                <div className="flex items-baseline justify-between gap-2 text-xs">
                  <span className="truncate font-medium">{t.name}</span>
                  <span className="shrink-0 tabular-nums text-muted-foreground">
                    {t.isAvailable ? (
                      <><span className={cn('font-semibold', full ? 'text-warning-foreground' : 'text-foreground')}>{t.jobs}</span>/{t.capacity}{full ? ' · full' : ''}</>
                    ) : 'Off today'}
                  </span>
                </div>
                <div className="mt-1 h-1.5 overflow-hidden rounded-full" style={{ background: 'hsl(var(--chart-1) / 0.15)' }}>
                  <motion.div
                    className="h-full rounded-full"
                    style={{ width: `${pct}%`, background: full ? 'hsl(var(--warning))' : 'hsl(var(--chart-1))', transformOrigin: 'left' }}
                    initial={reduced ? false : { scaleX: 0 }}
                    animate={{ scaleX: 1 }}
                    transition={{ duration: 0.6, delay: 0.1 + i * 0.05 }}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="py-8 text-center text-sm text-muted-foreground">No technicians on the books yet.</p>
      )}
    </ChartCard>
  );
}
