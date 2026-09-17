import { Suspense } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { RouteErrorBoundary } from '@/components/common/ErrorBoundary/RouteErrorBoundary';
import { EASE, motion, useReducedMotion } from '@/three/motion/motionKit';
import { cn } from '@/helpers/utils';

/**
 * The page slot every shell renders instead of a bare `<Outlet />`.
 *
 * Keyed on the pathname, so the page swaps while the header, footer and
 * scroll-progress bar stay mounted, and the Suspense boundary wraps that swap
 * so a chunk still in flight replaces the content area rather than the whole
 * screen. The boundary is *outside* the animated wrapper on purpose: inside,
 * the wrapper hid the spinner behind its own entrance, and a boundary that
 * suspends re-runs the effects beneath it when it resolves — which restarted
 * the entrance from invisible at the moment the page finally arrived, so a
 * heavy route looked like a blank screen for as long as it took to render.
 *
 * An error boundary sits outside both, so a page that throws is replaced inside
 * the shell — header and sidebar stay, and following any link clears it.
 *
 * There is deliberately no `<AnimatePresence>` here. Its exit is gated on every
 * `motion` descendant resolving `setActive('exit')`, and an animation with
 * `repeat: Infinity` — the drift field behind the home hero has about thirty —
 * never resolves. The outgoing page then never unmounts, and because `<Outlet />`
 * reads live route context, the stuck wrapper renders the *incoming* page at
 * `opacity: 0`: a blank screen that no further navigation could clear.
 *
 * Routing must not depend on decorative animation behaving. So the page enters
 * and leaves on a cut, which is also a frame faster: the new chunk starts
 * downloading on click instead of after an exit animation.
 */

const VARIANTS = {
  hidden: { opacity: 0, y: 8 },
  show: { opacity: 1, y: 0, transition: { duration: 0.22, ease: EASE } },
};

export function PageOutlet({ className }) {
  const { pathname } = useLocation();
  const reduced = useReducedMotion();

  return (
    <RouteErrorBoundary variant="page">
      <Suspense fallback={<RouteFallback className={className} />}>
        <motion.div
          key={pathname}
          initial={reduced ? false : 'hidden'}
          animate="show"
          variants={VARIANTS}
          className={className}
        >
          <Outlet />
        </motion.div>
      </Suspense>
    </RouteErrorBoundary>
  );
}

/** Holds roughly a screen of height so the footer does not jump up to meet it. */
export function RouteFallback({ className }) {
  return (
    <div className={cn('flex min-h-[60dvh] items-center justify-center', className)}>
      <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" aria-label="Loading" />
    </div>
  );
}
