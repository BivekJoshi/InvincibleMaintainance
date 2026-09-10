import { cn } from '@/helpers/utils';

/** A small caps label above a heading. */
export function Eyebrow({ children, className }) {
  if (!children) return null;
  return (
    <p className={cn('text-[11px] font-bold uppercase tracking-[0.14em] text-primary', className)}>
      {children}
    </p>
  );
}
