import { Link } from 'react-router-dom';
import { TrendingDown, TrendingUp } from 'lucide-react';
import { AnimatedNumber, Stagger } from '@/three/motion/motionKit';
import { DASHBOARD_CARDS, cardHref } from '@/config/admin/dashboardCards';
import { Sparkline } from '@/components/charts/Sparkline';
import { formatNpr } from '@/helpers/format';
import { cn } from '@/helpers/utils';

const TONE = {
  danger: { value: 'text-destructive', dot: 'bg-destructive' },
  warn: { value: 'text-warning-foreground', dot: 'bg-warning' },
};

/**
 * One number inside a group. Compact: name, value, and one line of context —
 * a change against last week, or the card's hint.
 */
function MetricCell({ name, value, trend, delta }) {
  const def = DASHBOARD_CARDS[name];
  if (!def) return null;
  const Icon = def.icon;
  const tone = def.tone && value > 0 ? TONE[def.tone] : null;
  const format = def.money ? (n) => formatNpr(Math.round(n), { compact: true }) : undefined;
  const shown = format ? format(value) : value;

  const body = (
    <div className={cn('group flex h-full flex-col gap-1 bg-card px-4 py-3 transition-colors', def.soon ? 'opacity-60' : 'hover:bg-muted/50')}>
      <p className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
        <span className="flex min-w-0 items-center gap-1.5">
          {tone ? (
            <span className="relative flex h-1.5 w-1.5 shrink-0" aria-hidden>
              {def.tone === 'danger' ? <span className={cn('absolute inset-0 animate-ping rounded-full opacity-60', tone.dot)} /> : null}
              <span className={cn('relative h-1.5 w-1.5 rounded-full', tone.dot)} />
            </span>
          ) : null}
          <span className="truncate">{def.cell ?? def.label}</span>
        </span>
        {def.soon
          ? <span className="shrink-0 text-[10px]">Soon</span>
          : <Icon className="h-3.5 w-3.5 shrink-0 opacity-60 transition-opacity group-hover:opacity-100" aria-hidden />}
      </p>
      <div className="flex items-end justify-between gap-2">
        <p className={cn('text-xl font-semibold leading-tight tracking-tight', tone?.value)}>
          <AnimatedNumber value={value} format={format} />
        </p>
        {trend ? <Sparkline values={trend} color="hsl(var(--chart-1))" width={64} height={22} /> : null}
      </div>
      <p className="flex items-center gap-1 truncate text-[11px] text-muted-foreground">
        {delta?.pct != null ? (
          <>
            {delta.pct >= 0
              ? <TrendingUp className="h-3 w-3 shrink-0 text-success" aria-hidden />
              : <TrendingDown className="h-3 w-3 shrink-0 text-destructive" aria-hidden />}
            <span className="font-medium text-foreground">{delta.pct > 0 ? '+' : ''}{delta.pct}%</span>
            <span className="truncate">{delta.label}</span>
          </>
        ) : <span className="truncate">{def.hint}</span>}
      </p>
    </div>
  );

  // No link while the screen behind it is unbuilt — a card that navigates back to
  // the page you are already on reads as broken.
  return def.soon ? body : (
    <Link
      to={cardHref(def)}
      aria-label={`${def.label}: ${shown}`}
      className="block h-full focus-visible:relative focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
    >
      {body}
    </Link>
  );
}

/**
 * A titled strip of related numbers, cells split by hairlines.
 *
 * @param {{ label: string, items: { name: string, value: number }[], extras?: (name: string) => object, className?: string }} props
 */
export function MetricGroup({ label, items, extras = () => ({}), className }) {
  const cols = { 1: 'grid-cols-1', 2: 'grid-cols-2', 3: 'grid-cols-2 sm:grid-cols-3 [&>li:last-child]:col-span-2 sm:[&>li:last-child]:col-span-1', 4: 'grid-cols-2 sm:grid-cols-4' }[Math.min(items.length, 4)];
  return (
    <Stagger.Item as="section" aria-label={label} className={cn('overflow-hidden rounded-xl border bg-card shadow-hairline', className)}>
      <h2 className="border-b bg-muted/40 px-4 py-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">{label}</h2>
      <ul className={cn('grid gap-px bg-border', cols)}>
        {items.map((item) => (
          <li key={item.name} className="min-w-0 bg-card">
            <MetricCell name={item.name} value={item.value} {...extras(item.name)} />
          </li>
        ))}
      </ul>
    </Stagger.Item>
  );
}
