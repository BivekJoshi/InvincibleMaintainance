import { motion, useReducedMotion } from 'framer-motion';
import { cn } from '@/helpers/utils';

/**
 * One ratio against a whole, as a ring. The track is a faint step of the same
 * colour so the unfilled part still reads as "this meter".
 *
 * @param {{ value: number, color: string, size?: number, label: string, children?: React.ReactNode, className?: string }} props
 */
export function RingMeter({ value, color, size = 132, label, children, className }) {
  const reduced = useReducedMotion();
  const stroke = 10;
  const r = (size - stroke) / 2;
  const pct = Math.min(100, Math.max(0, value ?? 0));

  return (
    <div className={cn('relative shrink-0', className)} style={{ width: size, height: size }}>
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        role="meter"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={pct}
        className="-rotate-90"
      >
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeOpacity="0.14" strokeWidth={stroke} />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          initial={reduced ? false : { pathLength: 0 }}
          animate={{ pathLength: pct / 100 }}
          transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center">{children}</div>
    </div>
  );
}
