import { useId } from 'react';

/**
 * A stat tile's trend: a quiet line with the latest point in the accent.
 * Decorative — the tile states the number, so this is hidden from readers.
 *
 * @param {{ values: number[], color: string, width?: number, height?: number }} props
 */
export function Sparkline({ values, color, width = 96, height = 32 }) {
  const id = useId().replace(/:/g, '');
  if (!values?.length) return null;
  const max = Math.max(1, ...values);
  const step = values.length > 1 ? width / (values.length - 1) : 0;
  const pts = values.map((v, i) => [i * step, height - 3 - (v / max) * (height - 6)]);
  const line = pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`).join('');
  const [lx, ly] = pts[pts.length - 1];

  return (
    <svg width={width} height={height} className="overflow-visible" aria-hidden>
      <defs>
        <linearGradient id={id} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.2" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={`${line}L${lx},${height}L0,${height}Z`} fill={`url(#${id})`} />
      <path d={line} fill="none" stroke={color} strokeOpacity="0.55" strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={lx} cy={ly} r="3" fill={color} className="stroke-card" strokeWidth="1.5" />
    </svg>
  );
}
