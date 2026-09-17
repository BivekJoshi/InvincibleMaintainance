import { motion, useReducedMotion } from 'framer-motion';
import { useElementWidth } from '@/hooks/useElementWidth';
import { niceScale } from '@/helpers/dashboard';

const PAD = { top: 22, bottom: 38 };
const BAR_MAX = 24;

/** A column with a 4px rounded cap and a square foot on the baseline. */
function columnPath(x, y, w, h) {
  const r = Math.min(4, w / 2, h);
  return `M${x},${y + h}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h}Z`;
}

/**
 * A few columns, one colour, with the emphasised one in the accent — "today"
 * against the rest of the week. Each column carries its value on its cap, and
 * each is a link-like button when `onSelect` is given.
 *
 * @param {{
 *   data: object[], valueKey: string, renderLabel: (d: object, i: number) => [string, string],
 *   highlight?: number, color: string, accent: string, label: string,
 *   describe: (d: object) => string, onSelect?: (d: object) => void, height?: number,
 * }} props
 */
export function ColumnChart({
  data, valueKey, renderLabel, highlight, color, accent, label, describe, onSelect, height = 200,
}) {
  const [ref, width] = useElementWidth();
  const reduced = useReducedMotion();
  const plotH = height - PAD.top - PAD.bottom;
  const scale = niceScale(Math.max(0, ...data.map((d) => d[valueKey])), { min: 4 });
  const slot = width / Math.max(data.length, 1);
  const barW = Math.min(BAR_MAX, slot * 0.5);
  const base = PAD.top + plotH;

  return (
    <div ref={ref} className="w-full" style={{ height }}>
      <svg width={width} height={height} role="list" aria-label={label} className="overflow-visible">
        <line x1="0" x2={width} y1={base + 0.5} y2={base + 0.5} className="stroke-border" strokeWidth="1" />
        {data.map((d, i) => {
          const value = d[valueKey];
          const h = Math.max((value / scale.max) * plotH, value ? 3 : 0);
          const cx = slot * i + slot / 2;
          const [top, bottom] = renderLabel(d, i);
          const on = i === highlight;
          const interactive = Boolean(onSelect);
          return (
            <g
              key={i}
              role="listitem"
              aria-label={describe(d)}
              tabIndex={interactive ? 0 : undefined}
              onClick={interactive ? () => onSelect(d) : undefined}
              onKeyDown={interactive ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(d); } } : undefined}
              className={interactive ? 'group cursor-pointer outline-none' : 'group'}
            >
              <title>{describe(d)}</title>
              {/* The hit area is the whole slot, not the painted column. */}
              <rect x={slot * i + 1} y={PAD.top - 18} width={slot - 2} height={plotH + 18} rx="8" className="fill-transparent group-hover:fill-muted/60 group-focus-visible:fill-muted group-focus-visible:stroke-ring" />
              <motion.path
                d={columnPath(cx - barW / 2, base - h, barW, h)}
                fill={on ? accent : color}
                style={{ transformOrigin: `${cx}px ${base}px` }}
                initial={reduced ? false : { scaleY: 0 }}
                animate={{ scaleY: 1 }}
                transition={{ duration: 0.7, delay: 0.1 + i * 0.05, ease: [0.16, 1, 0.3, 1] }}
              />
              <text x={cx} y={base - h - 6} textAnchor="middle" className={on ? 'fill-foreground text-[11px] font-bold' : 'fill-muted-foreground text-[11px] font-medium'}>
                {value}
              </text>
              <text x={cx} y={base + 16} textAnchor="middle" className={on ? 'fill-foreground text-[11px] font-semibold' : 'fill-muted-foreground text-[11px]'}>
                {top}
              </text>
              <text x={cx} y={base + 30} textAnchor="middle" className="fill-muted-foreground text-[10px]">
                {bottom}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
