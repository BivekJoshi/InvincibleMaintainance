import { Link } from 'react-router-dom';
import { CheckCircle2, AlertTriangle, Timer } from 'lucide-react';
import { AnimatedNumber, motion, useReducedMotion } from '@/three/motion/motionKit';
import { DASHBOARD_CARDS, cardHref } from '@/config/admin/dashboardCards';
import { attentionItems, greetingFor, ktmHour } from '@/helpers/dashboard';
import { cn } from '@/helpers/utils';

const todayLabel = () => new Intl.DateTimeFormat('en-GB', {
  weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Asia/Kathmandu',
}).format(new Date());

/**
 * The dashboard's opening band: the greeting, the office's date, and the one
 * number that matters — how many things are waiting on someone — with each of
 * them a link to the queue that clears it.
 */
export function DashboardHero({ name, role, cards, loading, actions }) {
  const reduced = useReducedMotion();
  const items = attentionItems(cards, DASHBOARD_CARDS);
  const total = items.reduce((n, i) => n + i.value, 0);
  const first = name?.split(' ')[0] ?? 'there';
  const roleName = role ? role.charAt(0) + role.slice(1).toLowerCase() : 'staff';

  return (
    <section
      aria-label="Today"
      className="relative isolate overflow-hidden rounded-2xl bg-ink px-5 py-4 text-ink-foreground shadow-card"
    >
      {/* A brass glow and a faint drawing-sheet grid: the trade, quietly. */}
      <div aria-hidden className="pointer-events-none absolute -right-16 -top-24 -z-10 h-56 w-56 rounded-full bg-gold/20 blur-3xl" />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 opacity-[0.06] [background-image:linear-gradient(hsl(var(--ink-foreground))_1px,transparent_1px),linear-gradient(90deg,hsl(var(--ink-foreground))_1px,transparent_1px)] [background-size:22px_22px] [mask-image:linear-gradient(to_left,black,transparent_75%)]"
      />

      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 items-center gap-4">
          {!loading ? (
            <div
              className={cn(
                'grid h-14 w-14 shrink-0 place-items-center rounded-xl border',
                total ? 'border-gold/40 bg-gold/15' : 'border-ink-foreground/15 bg-ink-foreground/5',
              )}
              aria-live="polite"
            >
              {total ? (
                <span className="text-center leading-none">
                  <span className="block text-2xl font-bold"><AnimatedNumber value={total} /></span>
                  <span className="mt-0.5 block text-[9px] uppercase tracking-wider text-ink-muted">to do</span>
                </span>
              ) : (
                <CheckCircle2 className="h-6 w-6 text-gold" role="img" aria-label="All clear" />
              )}
            </div>
          ) : null}
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-gold">{todayLabel()}</p>
            <motion.h1
              initial={reduced ? false : { opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
              className="truncate text-xl font-semibold tracking-tight sm:text-2xl"
            >
              {greetingFor(ktmHour())}, {first}
            </motion.h1>
            <p className="truncate text-xs text-ink-muted">
              {loading
                ? 'Gathering today’s numbers…'
                : total
                  ? `${roleName} view · ${total} item${total === 1 ? '' : 's'} waiting on the team`
                  : `${roleName} view · All clear — nothing is waiting on anyone`}
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-2 lg:items-end">
          {items.length ? (
            <ul className="flex flex-wrap gap-1.5 lg:justify-end" aria-label="Needs attention">
              {items.slice(0, 5).map((item, i) => {
                const def = DASHBOARD_CARDS[item.name];
                const Icon = item.tone === 'danger' ? AlertTriangle : Timer;
                return (
                  <motion.li
                    key={item.name}
                    initial={reduced ? false : { opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.15 + i * 0.05 }}
                  >
                    <Link
                      to={cardHref(def)}
                      className={cn(
                        'inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-[11px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold',
                        item.tone === 'danger'
                          ? 'border-destructive/60 bg-destructive/25 hover:bg-destructive/35'
                          : 'border-ink-foreground/15 bg-ink-foreground/5 hover:bg-ink-foreground/10',
                      )}
                    >
                      <Icon className={cn('h-3 w-3', item.tone === 'danger' ? 'text-ink-foreground' : 'text-gold')} aria-hidden />
                      <span className="font-bold">{item.value}</span>
                      <span className="text-ink-foreground/80">{def.short ?? def.label}</span>
                    </Link>
                  </motion.li>
                );
              })}
            </ul>
          ) : null}
          {actions}
        </div>
      </div>
    </section>
  );
}
