import { useNavigate } from 'react-router-dom';
import { CalendarDays } from 'lucide-react';
import { ChartCard, ChartTable } from '@/components/charts/ChartCard';
import { ColumnChart } from '@/components/charts/ColumnChart';
import { dayParts } from '@/helpers/dashboard';

/** The week ahead on the calendar; each day opens the jobs list for that day. */
export function JobsWeekCard({ data, className }) {
  const navigate = useNavigate();
  const total = data.reduce((n, d) => n + d.jobs, 0);
  const busiest = data.reduce((a, d) => (d.jobs > a.jobs ? d : a), data[0]);
  const describe = (d) => {
    const p = dayParts(d.day);
    return `${p.weekday} ${p.date}: ${d.jobs} job${d.jobs === 1 ? '' : 's'}`;
  };

  return (
    <ChartCard
      title="The week ahead"
      subtitle={total
        ? `${total} job${total === 1 ? '' : 's'} booked · busiest ${dayParts(busiest.day).weekday}`
        : 'Nothing booked for the next seven days'}
      icon={CalendarDays}
      to="/admin/dispatch"
      linkLabel="Open the dispatch board"
      className={className}
      table={<ChartTable columns={['Day', 'Jobs']} rows={data.map((d) => [describe(d).split(':')[0], d.jobs])} />}
    >
      <ColumnChart
        data={data}
        valueKey="jobs"
        highlight={0}
        color="hsl(var(--chart-1) / 0.35)"
        accent="hsl(var(--chart-1))"
        renderLabel={(d, i) => [i === 0 ? 'Today' : dayParts(d.day).weekday, dayParts(d.day).date]}
        describe={describe}
        onSelect={(d) => navigate(`/admin/jobs?from=${d.day}&to=${d.day}`)}
        height={170}
        label="Jobs booked per day for the next seven days. Choose a day to open its jobs."
      />
    </ChartCard>
  );
}
