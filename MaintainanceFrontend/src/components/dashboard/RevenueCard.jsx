import { Receipt } from 'lucide-react';
import { ChartCard, ChartTable, LegendKey } from '@/components/charts/ChartCard';
import { LineChart } from '@/components/charts/LineChart';
import { AnimatedNumber } from '@/three/motion/motionKit';
import { dayParts, runningRevenue } from '@/helpers/dashboard';
import { formatNpr, formatNprShort } from '@/helpers/format';

const SERIES = [
  { key: 'invoiced', label: 'Invoiced', color: 'hsl(var(--chart-1))', area: true },
  { key: 'collected', label: 'Collected', color: 'hsl(var(--chart-2))', area: true },
];

const dayTitle = (day) => { const p = dayParts(day); return `${p.weekday} ${p.date}`; };
const title = (day) => `Up to ${dayTitle(day)}`;
const money = (n) => formatNpr(Math.round(n), { compact: true });

/** Money in over 30 days as two running totals — the gap between the lines is what is still owed. */
export function RevenueCard({ revenue, className }) {
  const data = runningRevenue(revenue.rows);
  const { invoiced, collected } = revenue.totals;
  const rate = invoiced ? Math.round((collected / invoiced) * 100) : null;

  return (
    <ChartCard
      title="Invoiced and collected"
      subtitle="Running totals, last 30 days"
      icon={Receipt}
      className={className}
      table={(
        <ChartTable
          columns={['Day', 'Invoiced', 'Collected', 'Invoices']}
          rows={[...revenue.rows].reverse().map((r) => [dayTitle(r.key), formatNpr(r.invoiced), formatNpr(r.collected), r.count])}
        />
      )}
    >
      <dl className="mb-2 grid divide-y rounded-lg border sm:grid-cols-3 sm:divide-x sm:divide-y-0">
        {[
          ['Invoiced', <AnimatedNumber key="i" value={invoiced} format={money} />, SERIES[0].color],
          ['Collected', <AnimatedNumber key="c" value={collected} format={money} />, SERIES[1].color],
          ['Collection rate', rate == null ? '—' : <AnimatedNumber key="r" value={rate} format={(n) => `${Math.round(n)}%`} />],
        ].map(([label, value, color]) => (
          <div key={label} className="min-w-0 px-3 py-1.5">
            <dt>{color ? <LegendKey color={color} label={label} /> : <span className="text-xs text-muted-foreground">{label}</span>}</dt>
            <dd className="truncate text-base font-semibold tracking-tight">{value}</dd>
          </div>
        ))}
      </dl>
      <LineChart
        data={data}
        xKey="day"
        series={SERIES}
        formatValue={money}
        formatAxis={formatNprShort}
        axisWidth={52}
        formatX={(day) => dayParts(day).date}
        formatTitle={title}
        height={170}
        label={`Running totals over 30 days: ${formatNpr(invoiced)} invoiced, ${formatNpr(collected)} collected.`}
      />
    </ChartCard>
  );
}
