import { Link } from 'react-router-dom';
import { FileText } from 'lucide-react';
import { motion, useReducedMotion, AnimatedNumber } from '@/three/motion/motionKit';
import { ChartCard, ChartTable } from '@/components/charts/ChartCard';
import { QUOTATION_STAGE_TABS, QUOTATION_STATUS_LABELS } from '@/config/constants';
import { formatNpr } from '@/helpers/format';

const money = (n) => formatNpr(Math.round(n), { compact: true });
const stageFor = (status) => QUOTATION_STAGE_TABS.find((t) => t.statuses?.includes(status))?.value ?? 'all';

/** Money still on the table, by where each quotation is waiting, and how recent answers went. */
export function PipelineCard({ pipeline, className }) {
  const reduced = useReducedMotion();
  const { stages, openValue, openCount, won, lost, wonValue, winRate } = pipeline;
  const max = Math.max(1, ...stages.map((s) => s.value));

  return (
    <ChartCard
      title="Quotation pipeline"
      subtitle={`${openCount} open · win rate from the last 30 days`}
      icon={FileText}
      to="/admin/quotations"
      linkLabel="Open quotations"
      className={className}
      table={(
        <ChartTable
          columns={['Stage', 'Quotations', 'Value']}
          rows={stages.map((s) => [QUOTATION_STATUS_LABELS[s.status], s.count, formatNpr(s.value)])}
        />
      )}
    >
      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="text-[11px] text-muted-foreground">Open value</p>
          <p className="text-2xl font-semibold tracking-tight"><AnimatedNumber value={openValue} format={money} /></p>
        </div>
        <div className="text-right">
          <p className="text-[11px] text-muted-foreground">Win rate</p>
          <p className="text-lg font-semibold">{winRate == null ? '—' : `${Math.round(winRate)}%`}</p>
          <p className="text-[10px] text-muted-foreground">{won} won · {lost} declined</p>
        </div>
      </div>
      <ul className="mt-3 space-y-1">
        {stages.map((s, i) => (
          <li key={s.status}>
            <Link
              to={`/admin/quotations?stage=${stageFor(s.status)}`}
              className="grid grid-cols-[6.5rem_minmax(0,1fr)_auto] items-center gap-2 rounded-md px-1 py-1 text-xs transition-colors hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <span className="truncate">{QUOTATION_STATUS_LABELS[s.status]}</span>
              <span className="h-2 overflow-hidden rounded-full bg-muted">
                <motion.span
                  className="block h-full rounded-full"
                  style={{ width: `${(s.value / max) * 100}%`, background: 'hsl(var(--chart-1))', transformOrigin: 'left' }}
                  initial={reduced ? false : { scaleX: 0 }}
                  animate={{ scaleX: 1 }}
                  transition={{ duration: 0.6, delay: 0.1 + i * 0.06 }}
                />
              </span>
              <span className="w-24 text-right tabular-nums text-muted-foreground">
                <span className="font-semibold text-foreground">{s.count}</span> · {money(s.value)}
              </span>
            </Link>
          </li>
        ))}
      </ul>
      {wonValue ? <p className="mt-auto pt-2 text-[11px] text-muted-foreground">{money(wonValue)} accepted in the last 30 days.</p> : null}
    </ChartCard>
  );
}
