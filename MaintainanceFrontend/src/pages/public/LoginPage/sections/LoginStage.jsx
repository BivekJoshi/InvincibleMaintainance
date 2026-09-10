import { lazy, Suspense } from 'react';
import { Link } from 'react-router-dom';
import { CountUp, EASE, Spotlight, motion, useMinWidth, useMotionVariants, useReducedMotion } from '@/three/motion/motionKit';
import { cn } from '@/helpers/utils';
import { LOGIN_RISE, STATS } from '../loginContent';
import { LoginCredo } from './LoginCredo';

// three.js is ~120kB gzipped and nothing on this page needs it to sign in, so it
// gets its own chunk and only starts downloading once the form is already usable.
const BlueprintScene = lazy(() =>
  import('@/three/scenes/BlueprintScene').then((m) => ({ default: m.BlueprintScene })));

/** Registration crosshair — the mark a drawing is aligned by. Purely graphic. */
function Crosshair({ className }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className={cn('h-5 w-5', className)} fill="none">
      <path d="M12 2v20M2 12h20" stroke="currentColor" strokeWidth="0.75" />
      <circle cx="12" cy="12" r="4.5" stroke="currentColor" strokeWidth="0.75" />
    </svg>
  );
}

/**
 * The dark half: a WebGL site that erects itself, under the company's promise.
 *
 * Entirely decorative — no pointer events, nothing here is needed to sign in,
 * and the CSS blueprint underneath stands in when WebGL is missing. It is
 * mounted only above `lg`, and by a media query rather than by CSS alone:
 * `hidden lg:block` would still mount the component and fetch three.js on a
 * phone that will never show it.
 */
export function LoginStage({ company }) {
  const reduced = useReducedMotion();
  const wideEnough = useMinWidth(1024);
  const rise = useMotionVariants(LOGIN_RISE);

  return (
    <motion.aside
      initial={reduced ? false : { clipPath: 'inset(0 0 100% 0)' }}
      animate={{ clipPath: 'inset(0 0 0% 0)' }}
      transition={{ duration: 1, ease: EASE }}
      className="ink-panel relative isolate hidden overflow-hidden lg:block"
    >
      {/* Fallback texture, and a faint weave over the WebGL site either way. */}
      <div className="blueprint pointer-events-none absolute inset-0 opacity-50" aria-hidden />
      {wideEnough ? (
        <Suspense fallback={null}>
          <BlueprintScene className="absolute inset-0" reduced={Boolean(reduced)} />
        </Suspense>
      ) : null}
      <div className="glow-ink pointer-events-none absolute inset-0" aria-hidden />
      {/* Keeps the copy legible wherever the frame happens to be standing. */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-3/5 bg-gradient-to-t from-ink via-ink/75 to-transparent" aria-hidden />
      <Spotlight size={640} />

      {/* Registration marks — the panel reads as a sheet, not a photograph. */}
      <div className="pointer-events-none absolute inset-6 text-gold/40" aria-hidden>
        <Crosshair className="absolute -left-2.5 -top-2.5" />
        <Crosshair className="absolute -right-2.5 -top-2.5" />
        <Crosshair className="absolute -bottom-2.5 -left-2.5" />
        <Crosshair className="absolute -bottom-2.5 -right-2.5" />
      </div>

      {/* Scale rule down the left margin: minor ticks every 16px, a longer
          brass tick every fifth. Two gradients, no elements to lay out. */}
      <div className="pointer-events-none absolute bottom-24 left-10 top-24 w-4 border-l border-ink-foreground/15" aria-hidden>
        <div className="absolute inset-y-0 left-0 w-2 bg-[repeating-linear-gradient(to_bottom,hsl(var(--ink-foreground)/0.25)_0_1px,transparent_1px_16px)]" />
        <div className="absolute inset-y-0 left-0 w-4 bg-[repeating-linear-gradient(to_bottom,hsl(var(--gold)/0.55)_0_1px,transparent_1px_80px)]" />
      </div>

      <div className="relative z-10 flex h-full flex-col justify-between p-12 xl:p-16">
        <motion.div initial="hidden" animate="show" variants={rise}>
          <Link to="/" className="group inline-flex items-center gap-3">
            <span className="grid h-11 w-11 place-items-center rounded-xl border border-gold/40 bg-gold/10 font-extrabold text-gold transition-colors group-hover:bg-gold/20">
              {company.charAt(0)}
            </span>
            <span>
              <span className="block text-lg font-semibold tracking-tight">{company}</span>
              <span className="eyebrow block text-ink-muted">Back office</span>
            </span>
          </Link>
        </motion.div>

        <div className="max-w-md">
          <motion.p
            initial="hidden" animate="show" variants={rise} transition={{ delay: 0.2 }}
            className="eyebrow text-gold"
          >
            Kathmandu · Nepal
          </motion.p>

          <LoginCredo />

          <motion.dl
            initial="hidden" animate="show" variants={rise} transition={{ delay: 0.4 }}
            className="mt-10 flex items-end gap-10 border-t border-ink-foreground/10 pt-6"
          >
            {STATS.map((stat) => (
              <div key={stat.label}>
                <dt className="sr-only">{stat.label}</dt>
                <dd className="text-2xl font-semibold tabular-nums text-gold">
                  {stat.plain ? stat.value : <CountUp value={stat.value} />}
                  {stat.suffix}
                </dd>
                <p className="mt-1 text-[11px] uppercase tracking-[0.14em] text-ink-muted">{stat.label}</p>
              </div>
            ))}
          </motion.dl>
        </div>
      </div>
    </motion.aside>
  );
}
