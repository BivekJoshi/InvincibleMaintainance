import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight, BarChart3, Table2 } from 'lucide-react';
import { fadeUp, motion, useMotionVariants } from '@/three/motion/motionKit';
import { cn } from '@/helpers/utils';

/**
 * The frame every dashboard chart sits in: a title, one line on what it shows,
 * and a Chart / Table switch — the table is the chart's accessible twin, so no
 * value is only reachable by hovering.
 *
 * @param {{ title: string, subtitle?: string, icon?: any, to?: string, linkLabel?: string,
 *   table?: React.ReactNode, aside?: React.ReactNode, className?: string, children: React.ReactNode }} props
 */
export function ChartCard({ title, subtitle, icon: Icon, to, linkLabel = 'Open', table, aside, className, children }) {
  const [view, setView] = useState('chart');
  const showTable = table && view === 'table';
  const variants = useMotionVariants(fadeUp);

  return (
    <motion.section
      variants={variants}
      className={cn('group/card relative flex min-w-0 flex-col rounded-xl border bg-card p-4 shadow-hairline', className)}
      aria-label={title}
    >
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="flex items-center gap-1.5 text-[13px] font-semibold leading-6">
            {Icon ? <Icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden /> : null}
            <span className="truncate">{title}</span>
          </h2>
          {subtitle ? <p className="truncate text-[11px] text-muted-foreground">{subtitle}</p> : null}
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {aside}
          {table ? (
            <div className="flex rounded-lg border p-0.5" role="group" aria-label={`${title} view`}>
              {[['chart', BarChart3, 'Chart'], ['table', Table2, 'Table']].map(([value, ViewIcon, label]) => (
                <button
                  key={value}
                  type="button"
                  aria-pressed={view === value}
                  aria-label={`Show as ${label.toLowerCase()}`}
                  title={label}
                  onClick={() => setView(value)}
                  className={cn(
                    'grid h-6 w-6 place-items-center rounded-md text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                    view === value && 'bg-muted text-foreground',
                  )}
                >
                  <ViewIcon className="h-3.5 w-3.5" aria-hidden />
                </button>
              ))}
            </div>
          ) : null}
          {to ? (
            <Link
              to={to}
              className="grid h-7 w-7 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              aria-label={`${linkLabel}: ${title}`}
              title={linkLabel}
            >
              <ArrowUpRight className="h-4 w-4" aria-hidden />
            </Link>
          ) : null}
        </div>
      </header>
      <div className="mt-3 flex min-h-0 flex-1 flex-col">
        {showTable ? <div className="max-h-72 overflow-auto">{table}</div> : children}
      </div>
    </motion.section>
  );
}

/** A compact table for a chart's Table view. `rows` are arrays of cells, first cell is the row name. */
export function ChartTable({ columns, rows }) {
  return (
    <table className="w-full text-sm">
      <thead className="sticky top-0 bg-card">
        <tr className="border-b text-left text-xs text-muted-foreground">
          {columns.map((c, i) => (
            <th key={c} scope="col" className={cn('py-2 font-medium', i > 0 && 'text-right')}>{c}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((r, row) => (
          <tr key={row} className="border-b last:border-0">
            {r.map((cell, i) => (i === 0
              ? <th key={i} scope="row" className="py-1.5 text-left font-normal">{cell}</th>
              : <td key={i} className="py-1.5 text-right tabular-nums">{cell}</td>))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** The floating readout a chart shows under the pointer. Values lead, names follow. */
export function ChartTooltip({ x, y, width, title, rows }) {
  if (x == null) return null;
  const flip = x > width - 170;
  return (
    <div
      role="status"
      className="pointer-events-none absolute z-10 min-w-36 rounded-lg border bg-popover px-3 py-2 text-popover-foreground shadow-lift"
      style={{ left: x, top: y, transform: `translate(${flip ? 'calc(-100% - 12px)' : '12px'}, -50%)` }}
    >
      <p className="text-[11px] text-muted-foreground">{title}</p>
      <ul className="mt-1 space-y-0.5">
        {rows.map((r) => (
          <li key={r.label} className="flex items-center gap-2 text-xs">
            {r.swatch ? <span className="h-0.5 w-3 rounded-full" style={{ background: r.swatch }} aria-hidden /> : null}
            <span className="font-semibold tabular-nums">{r.value}</span>
            <span className="text-muted-foreground">{r.label}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** A legend key: a short line for a line series, a square for a filled one. */
export function LegendKey({ color, shape = 'line', label, value }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
      <span
        aria-hidden
        className={shape === 'line' ? 'h-0.5 w-3.5 rounded-full' : 'h-2.5 w-2.5 rounded-[3px]'}
        style={{ background: color }}
      />
      {label}
      {value != null ? <span className="font-semibold text-foreground">{value}</span> : null}
    </span>
  );
}
