import { Users } from 'lucide-react';
import { ChartCard, ChartTable, LegendKey } from '@/components/charts/ChartCard';
import { LineChart } from '@/components/charts/LineChart';
import { dayParts } from '@/helpers/dashboard';

const SERIES = [
  { key: 'leads', label: 'Enquiries', color: 'hsl(var(--chart-1))', area: true },
  { key: 'won', label: 'Since won', color: 'hsl(var(--chart-2))' },
];

const title = (day) => { const p = dayParts(day); return `${p.weekday} ${p.date}`; };

/** Enquiries per day for two weeks, and how many of each day's have already turned into work. */
export function LeadTrendCard({ data, className }) {
  const total = data.reduce((n, d) => n + d.leads, 0);
  const won = data.reduce((n, d) => n + d.won, 0);
  return (
    <ChartCard
      title="Enquiries"
      subtitle="Last 14 days, by the day they came in"
      icon={Users}
      to="/admin/leads"
      linkLabel="Open leads"
      className={className}
      aside={<span className="mr-2 hidden text-[11px] text-muted-foreground sm:inline"><b className="font-semibold text-foreground">{total}</b> in · <b className="font-semibold text-foreground">{won}</b> won</span>}
      table={(
        <ChartTable
          columns={['Day', 'Enquiries', 'Since won']}
          rows={[...data].reverse().map((d) => [title(d.day), d.leads, d.won])}
        />
      )}
    >
      <div className="mb-1 flex gap-4">
        {SERIES.map((s) => <LegendKey key={s.key} color={s.color} label={s.label} />)}
      </div>
      <LineChart
        data={data}
        xKey="day"
        series={SERIES}
        formatX={(day) => dayParts(day).date}
        formatTitle={title}
        height={180}
        label={`Enquiries per day for the last 14 days: ${total} in total, ${won} since won.`}
      />
    </ChartCard>
  );
}
