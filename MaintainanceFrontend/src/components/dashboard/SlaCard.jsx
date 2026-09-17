import { CheckCircle2, AlertTriangle, XCircle, Timer } from 'lucide-react';
import { motion, useReducedMotion } from '@/three/motion/motionKit';
import { ChartCard, ChartTable } from '@/components/charts/ChartCard';
import { RingMeter } from '@/components/charts/RingMeter';
import { formatMinutes } from '@/helpers/format';
import { cn } from '@/helpers/utils';

/** The promise is judged, so its colour is a status — and it always comes with a word and an icon. */
function standing(rate) {
  if (rate >= 90) return { label: 'On track', icon: CheckCircle2, color: 'hsl(var(--success))', text: 'text-success' };
  if (rate >= 70) return { label: 'Slipping', icon: AlertTriangle, color: 'hsl(var(--warning))', text: 'text-warning-foreground' };
  return { label: 'Off track', icon: XCircle, color: 'hsl(var(--destructive))', text: 'text-destructive' };
}

/** Are we calling people back within two hours — overall, and person by person. */
export function SlaCard({ sla, className }) {
  const reduced = useReducedMotion();
  const s = standing(sla.complianceRate);
  const staff = sla.byStaff?.slice(0, 4) ?? [];

  return (
    <ChartCard
      title="The 2-hour promise"
      subtitle="Leads answered in time, last 30 days"
      icon={Timer}
      to="/admin/sla"
      linkLabel="Open the SLA board"
      className={className}
      table={staff.length ? (
        <ChartTable
          columns={['Person', 'On time', 'Leads', 'Rate']}
          rows={sla.byStaff.map((p) => [p.staff, p.onTime, p.total, `${p.complianceRate}%`])}
        />
      ) : undefined}
    >
      <div className="flex items-center gap-5">
        <RingMeter size={104} value={sla.complianceRate} color={s.color} label={`${sla.complianceRate}% of leads answered within two hours`}>
          <div>
            <p className="text-xl font-semibold leading-none">{Math.round(sla.complianceRate)}%</p>
            <p className="mt-1 text-[10px] uppercase tracking-wider text-muted-foreground">on time</p>
          </div>
        </RingMeter>
        <dl className="min-w-0 space-y-1.5 text-sm">
          <div>
            <dt className="sr-only">Standing</dt>
            <dd className={cn('flex items-center gap-1.5 font-semibold', s.text)}>
              <s.icon className="h-4 w-4" aria-hidden /> {s.label}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Typical first reply</dt>
            <dd className="font-semibold">{sla.medianResponseMinutes == null ? '—' : formatMinutes(sla.medianResponseMinutes)}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Never answered</dt>
            <dd className={cn('font-semibold', sla.neverResponded && 'text-destructive')}>{sla.neverResponded}</dd>
          </div>
        </dl>
      </div>

      {staff.length ? (
        <ul className="mt-3 space-y-2 border-t pt-3">
          {staff.map((p, i) => (
            <li key={p.staff}>
              <div className="flex items-baseline justify-between gap-2 text-xs">
                <span className="truncate font-medium">{p.staff}</span>
                <span className="shrink-0 text-muted-foreground">{p.onTime}/{p.total} · <span className="font-semibold text-foreground">{p.complianceRate}%</span></span>
              </div>
              <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
                <motion.div
                  className="h-full rounded-full"
                  style={{ width: `${p.complianceRate}%`, background: 'hsl(var(--chart-1))', transformOrigin: 'left' }}
                  initial={reduced ? false : { scaleX: 0 }}
                  animate={{ scaleX: 1 }}
                  transition={{ duration: 0.7, delay: 0.3 + i * 0.08 }}
                />
              </div>
            </li>
          ))}
        </ul>
      ) : null}
    </ChartCard>
  );
}
