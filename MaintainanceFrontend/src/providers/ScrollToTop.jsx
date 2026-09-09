import { useLayoutEffect, useRef } from 'react';
import { useLocation, useNavigationType } from 'react-router-dom';

/** Scroll offsets keyed by history entry, so Back returns you where you were. */
const offsets = new Map();

/** How long we keep re-trying while a lazy route paints enough content to scroll. */
const SETTLE_MS = 600;

/** Events that mean the visitor took over and we should stop moving the page. */
const INTERRUPTS = ['wheel', 'touchstart', 'keydown', 'pointerdown'];

/**
 * Scrolls the window on navigation, replacing the browser's own restoration
 * (which cannot see a client-rendered route). Three cases:
 *
 *   - Back / forward → the offset that entry was left at.
 *   - A `#hash`      → the element it names.
 *   - Anything else  → the top of the page.
 *
 * The target is only reachable once the new route has rendered — routes are
 * lazy and their data arrives after mount — so each attempt repeats on every
 * frame until the page is tall enough, then stops. Always instant, never
 * smooth: a route change should not race the page transition.
 */
export function ScrollToTop() {
  const { pathname, hash, key } = useLocation();
  const navigationType = useNavigationType();
  const previousKey = useRef(key);

  useLayoutEffect(() => {
    if ('scrollRestoration' in window.history) {
      window.history.scrollRestoration = 'manual';
    }
  }, []);

  // Search params are deliberately not a dependency: list filters rewrite the
  // query string as you type, and yanking the page to the top mid-keystroke is
  // the one thing worse than not scrolling at all.
  useLayoutEffect(() => {
    if (previousKey.current !== key) {
      // Nothing has moved yet, so this is still where the outgoing entry sat.
      offsets.set(previousKey.current, window.scrollY);
      previousKey.current = key;
    }

    const restore = navigationType === 'POP' ? offsets.get(key) : undefined;
    const deadline = Date.now() + SETTLE_MS;
    let frame = 0;

    const stop = () => {
      cancelAnimationFrame(frame);
      for (const event of INTERRUPTS) window.removeEventListener(event, stop);
    };

    const settle = () => {
      const target = resolveTarget(restore, hash);

      if (target === null) {
        // The anchor has not mounted yet — wait for it, but not forever.
        if (Date.now() < deadline) frame = requestAnimationFrame(settle);
        return;
      }

      window.scrollTo(0, target);

      // A short page clamps the scroll; keep trying while content is still
      // arriving, and stop as soon as we land where we asked to be.
      const landed = Math.abs(window.scrollY - target) < 2;
      if (!landed && Date.now() < deadline) frame = requestAnimationFrame(settle);
      else stop();
    };

    for (const event of INTERRUPTS) window.addEventListener(event, stop, { passive: true });
    settle();
    return stop;
  }, [pathname, hash, key, navigationType]);

  return null;
}

/**
 * The offset this navigation should land on, or `null` while the element a
 * hash names is still missing from the document.
 *
 * @param {number|undefined} restore saved offset for a back/forward entry
 * @param {string} hash location hash, including the `#`
 * @returns {number|null}
 */
function resolveTarget(restore, hash) {
  if (restore !== undefined) return restore;

  if (hash.length > 1) {
    const el = document.getElementById(decodeURIComponent(hash.slice(1)));
    if (!el) return null;
    // Clear the sticky header rather than hiding the anchor underneath it.
    return Math.max(0, window.scrollY + el.getBoundingClientRect().top - 80);
  }

  return 0;
}
