import { AnimatePresence, EASE, motion } from '@/three/motion/motionKit';

/**
 * The confirmation wipe. Cosmetic: the redirect happens either way, and under
 * reduced motion this never mounts at all.
 *
 * The tick draws itself rather than appearing — it reads as a mark being made,
 * which suits the drawing language the rest of the screen is in.
 */
export function AccessGranted({ show }) {
  return (
    <AnimatePresence>
      {show ? (
        <motion.div
          key="granted"
          initial={{ clipPath: 'inset(0 100% 0 0)' }}
          animate={{ clipPath: 'inset(0 0% 0 0)' }}
          transition={{ duration: 0.5, ease: EASE }}
          className="ink-panel pointer-events-none absolute inset-0 z-20 flex items-center justify-center gap-3"
          aria-hidden
        >
          <svg viewBox="0 0 24 24" className="h-5 w-5 text-gold" fill="none">
            <motion.path
              d="M4 12.5 10 18 20 6"
              stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: 0.45, delay: 0.25, ease: EASE }}
            />
          </svg>
          <span className="eyebrow text-gold">Access granted</span>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
