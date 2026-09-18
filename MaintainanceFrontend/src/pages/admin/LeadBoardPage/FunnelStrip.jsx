import { Snowflake, Target, Trophy } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { LEAD_STATUS_LABELS } from '@/config/constants';
import { BOARD_COLUMNS, funnelSummary, toneStyle } from '@/helpers/leadBoard';
import { cn } from '@/helpers/utils';

/** One figure beside the funnel. */
function Figure({ icon: Icon, value, label, tone }) {
  return (
    <div className="flex items-center gap-2.5">
      <span className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-xl', tone)}>
        <Icon className="h-4 w-4" aria-hidden />
      </span>
      <div>
        <p className="text-lg font-bold leading-none tabular-nums">{value}</p>
        <p className="mt-1 text-xs text-muted-foreground">{label}</p>
      </div>
    </div>
  );
}

/**
 * The board at a glance: every stage as a slice of one bar in its colour, how many leads are
 * still open, the win rate of the closed ones, and how many open leads are going cold.
 * `totals` fills in as each column loads.
 *
 * @param {{ totals: Record<string, number>, cold: number }} props
 */
export function FunnelStrip({ totals, cold }) {
  const loaded = BOARD_COLUMNS.every((s) => totals[s] != null);
  const { total, open, winRate, shares } = funnelSummary(totals);

  return (
    <section
      aria-label="Pipeline summary"
      className="mb-4 grid gap-4 rounded-2xl border bg-gradient-to-br from-primary/[0.06] via-card to-card p-4 shadow-[var(--elevation-1)] lg:grid-cols-[minmax(0,1fr)_auto]"
    >
      <div className="min-w-0 space-y-3">
        <div className="flex items-baseline justify-between gap-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">The funnel</p>
          <p className="text-xs tabular-nums text-muted-foreground">{loaded ? `${total} lead${total === 1 ? '' : 's'}` : 'Counting…'}</p>
        </div>
        {loaded ? (
          <div className="flex h-3 overflow-hidden rounded-full bg-muted" aria-hidden>
            {BOARD_COLUMNS.map((s) => (totals[s] ? (
              <div
                key={s} style={{ ...toneStyle(s), flexGrow: totals[s] }}
                className="min-w-[6px] bg-[hsl(var(--tone))] transition-[flex-grow] duration-500 first:rounded-l-full last:rounded-r-full motion-reduce:transition-none [&+&]:border-l-2 [&+&]:border-card"
                title={`${LEAD_STATUS_LABELS[s]}: ${totals[s]}`}
              />
            ) : null))}
          </div>
        ) : <Skeleton className="h-3 rounded-full" />}
        <ul className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs">
          {BOARD_COLUMNS.map((s) => (
            <li key={s} style={toneStyle(s)} className="inline-flex items-center gap-1.5">
              <span aria-hidden className="h-2 w-2 rounded-full bg-[hsl(var(--tone))]" />
              <span className="text-muted-foreground">{LEAD_STATUS_LABELS[s]}</span>
              <span className="font-semibold tabular-nums">{totals[s] ?? '…'}</span>
              {loaded && total ? <span className="tabular-nums text-muted-foreground">· {shares[s]}%</span> : null}
            </li>
          ))}
        </ul>
      </div>

      <div className="flex flex-wrap items-center gap-5 border-t border-dotted pt-3 lg:border-l lg:border-t-0 lg:pl-5 lg:pt-0">
        <Figure icon={Target} value={loaded ? open : '…'} label="Still open" tone="bg-info/15 text-info" />
        <Figure icon={Trophy} value={winRate == null ? '—' : `${winRate}%`} label="Win rate" tone="bg-success/15 text-success" />
        <Figure
          icon={Snowflake} value={cold} label="Going cold"
          tone={cold ? 'bg-info/20 text-info-foreground' : 'bg-muted text-muted-foreground'}
        />
      </div>
    </section>
  );
}
