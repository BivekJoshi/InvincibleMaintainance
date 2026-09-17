import { useId, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { useElementWidth } from '@/hooks/useElementWidth';
import { niceScale } from '@/helpers/dashboard';
import { ChartTooltip } from './ChartCard';

const PAD = { top: 12, right: 16, bottom: 26 };

/**
 * Lines over time on one value axis, with a soft wash under each `area` series,
 * a crosshair that snaps to the nearest day, and arrow-key stepping once focused.
 * The first series gets its latest value as a direct label.
 *
 * @param {{
 *   data: object[], xKey: string,
 *   series: { key: string, label: string, color: string, area?: boolean }[],
 *   formatValue?: (n: number) => string, formatAxis?: (n: number) => string,
 *   formatX: (x: any) => string, formatTitle?: (x: any) => string,
 *   height?: number, axisWidth?: number, label: string,
 * }} props
 */
export function LineChart({
  data, xKey, series, formatValue = (n) => n.toLocaleString('en-IN'), formatAxis = formatValue,
  formatX, formatTitle = formatX, height = 220, axisWidth = 32, label,
}) {
  const [ref, width] = useElementWidth();
  const [active, setActive] = useState(null);
  const reduced = useReducedMotion();
  const gradientId = useId().replace(/:/g, '');

  const left = axisWidth + 8;
  const plotW = Math.max(width - left - PAD.right, 10);
  const plotH = height - PAD.top - PAD.bottom;
  const peak = Math.max(0, ...data.flatMap((d) => series.map((s) => d[s.key] ?? 0)));
  const scale = niceScale(peak);
  const x = (i) => left + (data.length < 2 ? plotW / 2 : (i / (data.length - 1)) * plotW);
  const y = (v) => PAD.top + plotH - (v / scale.max) * plotH;

  const linePath = (key) => data.map((d, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(d[key] ?? 0).toFixed(1)}`).join('');
  const areaPath = (key) => `${linePath(key)}L${x(data.length - 1).toFixed(1)},${y(0)}L${x(0).toFixed(1)},${y(0)}Z`;

  // Label roughly every 70px, always including the last day.
  const every = Math.max(1, Math.ceil(data.length / Math.max(2, Math.floor(plotW / 70))));
  const xTicks = data.map((_, i) => i).filter((i) => (data.length - 1 - i) % every === 0);

  const pointAt = (clientX, rect) => {
    const px = clientX - rect.left - left;
    return Math.min(data.length - 1, Math.max(0, Math.round((px / plotW) * (data.length - 1))));
  };

  const onKeyDown = (e) => {
    const moves = { ArrowLeft: -1, ArrowRight: 1, Home: -Infinity, End: Infinity };
    if (!(e.key in moves)) return;
    e.preventDefault();
    setActive((i) => Math.min(data.length - 1, Math.max(0, (i ?? data.length - 1) + moves[e.key])));
  };

  const last = data.length - 1;
  const lead = series[0];
  const draw = reduced ? {} : { initial: { pathLength: 0 }, animate: { pathLength: 1 }, transition: { duration: 1.1, ease: [0.16, 1, 0.3, 1] } };
  const wash = reduced ? {} : { initial: { opacity: 0 }, animate: { opacity: 1 }, transition: { duration: 0.8, delay: 0.4 } };

  return (
    <div ref={ref} className="relative w-full" style={{ height }}>
      <svg
        width={width}
        height={height}
        role="img"
        aria-label={`${label}. Focus and use the arrow keys to read each day.`}
        tabIndex={0}
        className="overflow-visible rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        onPointerMove={(e) => setActive(pointAt(e.clientX, e.currentTarget.getBoundingClientRect()))}
        onPointerLeave={() => setActive(null)}
        onFocus={() => setActive((i) => i ?? last)}
        onBlur={() => setActive(null)}
        onKeyDown={onKeyDown}
      >
        <defs>
          {series.filter((s) => s.area).map((s) => (
            <linearGradient key={s.key} id={`${gradientId}-${s.key}`} x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor={s.color} stopOpacity="0.22" />
              <stop offset="100%" stopColor={s.color} stopOpacity="0" />
            </linearGradient>
          ))}
        </defs>

        {scale.ticks.map((t) => (
          <g key={t}>
            <line x1={left} x2={left + plotW} y1={y(t)} y2={y(t)} className="stroke-border" strokeWidth="1" shapeRendering="crispEdges" />
            <text x={left - 8} y={y(t)} dy="0.32em" textAnchor="end" className="fill-muted-foreground text-[10px] tabular-nums">
              {formatAxis(t)}
            </text>
          </g>
        ))}
        {xTicks.map((i) => (
          <text key={i} x={x(i)} y={height - 6} textAnchor={i === last ? 'end' : 'middle'} className="fill-muted-foreground text-[10px]">
            {formatX(data[i][xKey])}
          </text>
        ))}

        {series.filter((s) => s.area).map((s) => (
          <motion.path key={`a-${s.key}`} d={areaPath(s.key)} fill={`url(#${gradientId}-${s.key})`} {...wash} />
        ))}
        {series.map((s) => (
          <motion.path
            key={`l-${s.key}`}
            d={linePath(s.key)}
            fill="none"
            stroke={s.color}
            strokeWidth="2"
            strokeLinejoin="round"
            strokeLinecap="round"
            {...draw}
          />
        ))}

        {active != null ? (
          <line x1={x(active)} x2={x(active)} y1={PAD.top} y2={PAD.top + plotH} className="stroke-muted-foreground/50" strokeWidth="1" />
        ) : null}

        {series.map((s) => {
          const i = active ?? last;
          return (
            <circle
              key={`d-${s.key}`}
              cx={x(i)}
              cy={y(data[i]?.[s.key] ?? 0)}
              r="4.5"
              fill={s.color}
              className="stroke-card"
              strokeWidth="2"
            />
          );
        })}

        {active == null && data.length ? (
          <text
            x={x(last) - 8}
            y={y(data[last][lead.key] ?? 0) - 10}
            textAnchor="end"
            className="fill-foreground text-[11px] font-semibold tabular-nums"
          >
            {formatValue(data[last][lead.key] ?? 0)}
          </text>
        ) : null}
      </svg>

      {active != null ? (
        <ChartTooltip
          x={x(active)}
          y={PAD.top + plotH / 2}
          width={width}
          title={formatTitle(data[active][xKey])}
          rows={series.map((s) => ({ label: s.label, value: formatValue(data[active][s.key] ?? 0), swatch: s.color }))}
        />
      ) : null}
    </div>
  );
}
