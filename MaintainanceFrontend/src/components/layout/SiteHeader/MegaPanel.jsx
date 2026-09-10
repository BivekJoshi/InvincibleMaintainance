import { Link } from 'react-router-dom';
import { ArrowRight, CalendarCheck, ChevronRight } from 'lucide-react';
import { EASE, motion } from '@/three/motion/motionKit';
import { Button } from '@/components/ui/button';
import { DataIcon } from '@/components/site/DataIcon';
import { SITE_PROMISE_LABELS } from '@/config/site/promises';
import { cn } from '@/helpers/utils';

/**
 * The trade list, opened from "Services". It replaces the permanent category
 * rail: same links, none of the vertical cost on a page the visitor has not
 * asked to browse yet.
 */
export function MegaPanel({ categories, reduced, onEnter, onLeave }) {
  // Four trades in two columns leaves a hole beside the card; past five, one
  // column is a scroll. The panel picks its own shape from what it holds.
  const wide = categories.length > 5;

  const list = {
    hidden: {},
    show: { transition: { staggerChildren: reduced ? 0 : 0.028, delayChildren: reduced ? 0 : 0.04 } },
  };
  const row = {
    hidden: reduced ? {} : { opacity: 0, y: 6 },
    show: { opacity: 1, y: 0, transition: { duration: reduced ? 0 : 0.3, ease: EASE } },
  };

  return (
    <motion.div
      initial={reduced ? { opacity: 0 } : { opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={reduced ? { opacity: 0 } : { opacity: 0, y: -8 }}
      transition={{ duration: reduced ? 0.01 : 0.26, ease: EASE }}
      // The wrapper spans the page so the panel can align to the container, but
      // it must not swallow clicks on the hero either side of the card.
      className="pointer-events-none absolute inset-x-0 top-full hidden lg:block"
    >
      <div className="container pt-2">
        <div
          onMouseEnter={onEnter}
          onMouseLeave={onLeave}
          onFocus={onEnter}
          onBlur={onLeave}
          className={cn(
            'pointer-events-auto overflow-hidden rounded-2xl border bg-popover/95 shadow-float supports-[backdrop-filter]:backdrop-blur-xl',
            wide ? 'w-[min(54rem,calc(100vw-3rem))]' : 'w-[min(40rem,calc(100vw-3rem))]',
          )}
        >
          <motion.div
            variants={list} initial="hidden" animate="show"
            className="grid gap-4 p-4 sm:grid-cols-[1fr_13rem]"
          >
            <div>
              <p className="eyebrow px-2.5 text-muted-foreground">Browse by trade</p>
              <div className={cn('mt-2 grid gap-0.5', wide && 'sm:grid-cols-2')}>
                {categories.map((c) => (
                  <motion.div key={c.id} variants={row}>
                    <Link
                      to={`/services?category=${c.slug}`}
                      className="group/item flex items-center gap-3 rounded-lg px-2.5 py-2 transition-colors hover:bg-muted"
                    >
                      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-md border bg-card text-primary transition-colors group-hover/item:border-gold/50 group-hover/item:text-gold">
                        <DataIcon name={c.icon} className="h-4 w-4" />
                      </span>
                      <span className="min-w-0 flex-1 truncate text-sm font-medium">{c.name}</span>
                      <ChevronRight
                        aria-hidden
                        className="h-4 w-4 -translate-x-1 text-muted-foreground opacity-0 transition-all duration-300 group-hover/item:translate-x-0 group-hover/item:opacity-100"
                      />
                    </Link>
                  </motion.div>
                ))}
              </div>
            </div>

            <motion.div
              variants={row}
              className="ink-panel relative flex flex-col justify-between overflow-hidden rounded-xl p-4"
            >
              {/* Both washes are their own layer: `glow-ink` sets the background
                  shorthand, so on the panel itself it would erase `bg-ink`. */}
              <div className="glow-ink absolute inset-0" aria-hidden />
              <div className="blueprint absolute inset-0 opacity-50" aria-hidden />
              <div className="relative">
                <p className="eyebrow text-gold">No charge</p>
                <p className="mt-2 text-sm font-semibold leading-snug">Not sure which trade you need?</p>
                <p className="mt-1.5 text-xs leading-relaxed text-ink-muted">
                  An engineer visits, finds the cause and quotes it — free, within two hours of your call.
                </p>
              </div>
              <Button asChild variant="gold" size="sm" className="relative mt-4 w-full">
                <Link to="/book"><CalendarCheck className="h-4 w-4" /> Book a visit</Link>
              </Button>
            </motion.div>
          </motion.div>

          <div className="flex items-center justify-between gap-4 border-t bg-muted/40 px-4 py-2.5">
            <Link to="/services" className="group/all inline-flex items-center gap-2 text-[13px] font-semibold text-primary">
              Browse the full catalogue
              <ArrowRight aria-hidden className="h-3.5 w-3.5 transition-transform duration-300 group-hover/all:translate-x-1" />
            </Link>
            <p className="hidden text-xs text-muted-foreground sm:block">{SITE_PROMISE_LABELS.join(' · ')}</p>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
