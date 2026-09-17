import { useState } from 'react';
import { CalendarClock } from 'lucide-react';
import { ChartCard, ChartTable } from '@/components/charts/ChartCard';
import { cn } from '@/helpers/utils';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** One hue, light to dark: five steps so neighbouring counts still read apart. */
const STEPS = [0, 0.18, 0.36, 0.56, 0.78, 1];
const step = (v, max) => (v ? Math.max(1, Math.ceil((v / max) * (STEPS.length - 1))) : 0);

/** When enquiries arrive — weekday against time of day, over 30 days — so the phones can be staffed to match. */
export function HeatmapCard({ heatmap, className }) {
  const { bands, cells, total } = heatmap;
  const [hover, setHover] = useState(null);
  const max = Math.max(1, ...cells.flat());
  let peak = null;
  cells.forEach((row, d) => row.forEach((v, b) => { if (v && (!peak || v > peak.v)) peak = { d, b, v }; }));
  const readout = hover ?? peak;

  return (
    <ChartCard
      title="When enquiries arrive"
      subtitle={`${total} in the last 30 days · Kathmandu time`}
      icon={CalendarClock}
      className={className}
      table={(
        <ChartTable
          columns={['Day', ...bands.map((b) => b.label)]}
          rows={cells.map((row, d) => [DAYS[d], ...row])}
        />
      )}
    >
      <div className="overflow-x-auto">
        <table className="w-full min-w-[20rem] border-separate [border-spacing:3px]" onMouseLeave={() => setHover(null)}>
          <caption className="sr-only">Enquiries by weekday and time of day</caption>
          <thead>
            <tr>
              <th scope="col" className="w-9" />
              {bands.map((b) => (
                <th key={b.key} scope="col" className="pb-1 text-center text-[10px] font-normal text-muted-foreground">{b.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {cells.map((row, d) => (
              <tr key={DAYS[d]}>
                <th scope="row" className="pr-1 text-left text-[11px] font-medium text-muted-foreground">{DAYS[d]}</th>
                {row.map((v, b) => {
                  const on = readout && readout.d === d && readout.b === b;
                  return (
                    <td
                      key={b}
                      tabIndex={0}
                      aria-label={`${DAYS[d]} ${bands[b].label}: ${v} enquir${v === 1 ? 'y' : 'ies'}`}
                      onMouseEnter={() => setHover({ d, b, v })}
                      onFocus={() => setHover({ d, b, v })}
                      onBlur={() => setHover(null)}
                      className={cn(
                        'h-7 rounded-[4px] text-center text-[10px] font-medium tabular-nums outline-none transition-shadow focus-visible:ring-2 focus-visible:ring-ring',
                        on && 'ring-2 ring-foreground/70',
                        step(v, max) >= 4 ? 'text-primary-foreground' : 'text-transparent',
                      )}
                      style={{ background: v ? `hsl(var(--chart-1) / ${STEPS[step(v, max)]})` : 'hsl(var(--muted))' }}
                    >
                      {v || ''}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-2 flex items-center justify-between gap-3 text-[11px] text-muted-foreground">
        <p aria-live="polite" className="truncate">
          {readout
            ? <><span className="font-semibold text-foreground">{readout.v}</span> on {DAYS[readout.d]}, {bands[readout.b].label}{hover ? '' : ' — the busiest slot'}</>
            : 'No enquiries yet.'}
        </p>
        <span className="flex shrink-0 items-center gap-1" aria-hidden>
          Fewer
          {STEPS.slice(1).map((o) => <span key={o} className="h-2.5 w-2.5 rounded-[3px]" style={{ background: `hsl(var(--chart-1) / ${o})` }} />)}
          More
        </span>
      </div>
    </ChartCard>
  );
}
