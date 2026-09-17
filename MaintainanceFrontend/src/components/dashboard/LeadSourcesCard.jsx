import { Megaphone } from 'lucide-react';
import { motion, useReducedMotion } from '@/three/motion/motionKit';
import { ChartCard, ChartTable, LegendKey } from '@/components/charts/ChartCard';
import { LEAD_SOURCE_LABELS } from '@/config/constants';

const WON = 'hsl(var(--chart-2))';
const REST = 'hsl(var(--chart-1) / 0.45)';
const MAX_ROWS = 6;

/**
 * Where enquiries come from and which channels turn into work: one bar per
 * source, the won part in brass. Past six sources the tail folds into "Other".
 */
export function LeadSourcesCard({ sources, className }) {
  const reduced = useReducedMotion();
  const head = sources.slice(0, MAX_ROWS);
  const tail = sources.slice(MAX_ROWS);
  const rows = tail.length
    ? [...head, tail.reduce((o, s) => ({ ...o, total: o.total + s.total, won: o.won + s.won }), { source: '_rest', total: 0, won: 0 })]
    : head;
  const max = Math.max(1, ...rows.map((r) => r.total));
  const name = (s) => (s === '_rest' ? 'Everything else' : LEAD_SOURCE_LABELS[s] ?? s);

  return (
    <ChartCard
      title="Where enquiries come from"
      subtitle="Last 30 days, by channel"
      icon={Megaphone}
      className={className}
      aside={<span className="mr-2 hidden gap-3 md:flex"><LegendKey shape="box" color={WON} label="Won" /><LegendKey shape="box" color={REST} label="Not won" /></span>}
      table={(
        <ChartTable
          columns={['Channel', 'Enquiries', 'Won', 'Conversion']}
          rows={sources.map((s) => [name(s.source), s.total, s.won, `${s.conversionRate}%`])}
        />
      )}
    >
      {rows.length ? (
        <ul className="space-y-2">
          {rows.map((r, i) => {
            const rate = r.total ? Math.round((r.won / r.total) * 100) : 0;
            return (
              <li key={r.source} className="grid grid-cols-[minmax(0,7.5rem)_1fr_auto] items-center gap-3 text-xs">
                <span className="truncate">{name(r.source)}</span>
                <div
                  className="flex h-2.5 gap-0.5"
                  role="img"
                  aria-label={`${name(r.source)}: ${r.total} enquiries, ${r.won} won`}
                  title={`${r.total} enquiries · ${r.won} won`}
                >
                  <motion.div
                    className="flex h-full gap-0.5"
                    style={{ width: `${(r.total / max) * 100}%`, transformOrigin: 'left' }}
                    initial={reduced ? false : { scaleX: 0 }}
                    animate={{ scaleX: 1 }}
                    transition={{ duration: 0.7, delay: 0.1 + i * 0.06, ease: [0.16, 1, 0.3, 1] }}
                  >
                    {r.won ? <span className={r.won === r.total ? 'h-full rounded-[4px]' : 'h-full rounded-l-[4px]'} style={{ width: `${(r.won / r.total) * 100}%`, background: WON }} /> : null}
                    {r.total - r.won ? (
                      <span className={r.won ? 'h-full flex-1 rounded-r-[4px]' : 'h-full flex-1 rounded-[4px]'} style={{ background: REST }} />
                    ) : null}
                  </motion.div>
                </div>
                <span className="w-16 text-right text-xs text-muted-foreground">
                  <span className="font-semibold text-foreground">{r.total}</span> · {rate}%
                </span>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="py-8 text-center text-sm text-muted-foreground">No enquiries in the last 30 days.</p>
      )}
    </ChartCard>
  );
}
