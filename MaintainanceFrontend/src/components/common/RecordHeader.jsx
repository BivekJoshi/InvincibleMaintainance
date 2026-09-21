import { motion, useReducedMotion } from '@/three/motion/motionKit';
import { cn } from '@/helpers/utils';

/**
 * The top of a record's page — whose record this is. An avatar, a small `eyebrow` of facts,
 * the record's name as the page's heading, a `meta` row (contact links, chips) and the page's
 * `actions`. `children` is the card's foot: a strip of counts or a stage track.
 *
 * @param {{ avatar?: import('react').ReactNode, eyebrow?: import('react').ReactNode, title: string,
 *   meta?: import('react').ReactNode, actions?: import('react').ReactNode, children?: import('react').ReactNode, className?: string }} props
 */
export function RecordHeader({ avatar, eyebrow, title, meta, actions, children, className }) {
  const reduced = useReducedMotion();
  return (
    <motion.header
      initial={reduced ? false : { opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className={cn('mb-5 overflow-hidden rounded-2xl border bg-card shadow-[var(--elevation-1)]', className)}
    >
      <div className="relative flex flex-col gap-4 bg-gradient-to-br from-primary/[0.07] via-card to-card p-5 lg:flex-row lg:items-start">
        <div className="flex min-w-0 flex-1 items-start gap-4">
          {avatar}
          <div className="min-w-0 flex-1">
            {eyebrow ? (
              <p className="flex flex-wrap items-center gap-x-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-gold">{eyebrow}</p>
            ) : null}
            <h1 className="mt-0.5 break-words text-2xl font-semibold tracking-tight">{title}</h1>
            {meta ? <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">{meta}</div> : null}
          </div>
        </div>
        {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
      {children ? <div className="border-t">{children}</div> : null}
    </motion.header>
  );
}
