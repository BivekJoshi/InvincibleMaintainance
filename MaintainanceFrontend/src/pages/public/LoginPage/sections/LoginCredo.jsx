import { useEffect, useState } from 'react';
import { AnimatePresence, EASE, motion, useReducedMotion } from '@/three/motion/motionKit';
import { CREDO, CREDO_INTERVAL } from '../loginContent';

/**
 * The rotating promise on the dark panel, in both languages at once.
 *
 * The English line reveals word by word and the Nepali line follows as a whole.
 * Splitting on spaces is deliberate: per character would break Devanagari
 * clusters apart into marks that mean nothing on their own.
 *
 * Orchestration lives on the wrapper — both lines are variant children of it,
 * so they share one show/exit state. A child with its own object animation
 * gets stranded when the parent exits.
 */
export function LoginCredo() {
  const reduced = useReducedMotion();
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (reduced) return undefined;
    const id = setInterval(() => setIndex((i) => (i + 1) % CREDO.length), CREDO_INTERVAL);
    return () => clearInterval(id);
  }, [reduced]);

  const credo = CREDO[index];

  return (
    // Fixed height: the credo rotates, and the block must not reflow.
    <div className="mt-4 min-h-[7rem]">
      <AnimatePresence mode="wait">
        <motion.div
          key={index}
          initial="hidden"
          animate="show"
          exit="exit"
          variants={{
            hidden: {},
            show: { transition: { staggerChildren: 0.05 } },
            exit: { opacity: 0, y: -10, transition: { duration: 0.28 } },
          }}
        >
          <motion.p
            variants={{ hidden: {}, show: { transition: { staggerChildren: 0.045 } } }}
            className="text-balance text-3xl font-semibold leading-tight tracking-tight xl:text-[2.15rem]"
          >
            {reduced
              ? credo.en
              : credo.en.split(' ').map((word, i) => (
                <span key={`${word}-${i}`} className="inline-block overflow-hidden pb-[0.12em] align-bottom">
                  <motion.span
                    className="inline-block"
                    variants={{
                      hidden: { y: '110%', opacity: 0 },
                      show: { y: '0%', opacity: 1, transition: { duration: 0.7, ease: EASE } },
                    }}
                  >
                    {word}&nbsp;
                  </motion.span>
                </span>
              ))}
          </motion.p>

          <motion.p
            lang="ne"
            variants={{
              hidden: { opacity: 0, y: 8 },
              show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: EASE } },
            }}
            className="mt-3 text-base text-ink-muted"
          >
            {credo.ne}
          </motion.p>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
