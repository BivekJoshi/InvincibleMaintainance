import { forwardRef, useEffect, useRef, useState } from 'react';
import {
  motion, AnimatePresence, useReducedMotion, useScroll, useTransform, useSpring,
  useMotionValue, useMotionValueEvent, useInView, animate as animateValue,
} from 'framer-motion';
import { cn } from '@/lib/utils';

/**
 * Motion vocabulary for the whole app. Four rules:
 *   1. Motion is decoration — never the only signal that something happened.
 *   2. Only transform and opacity animate, so nothing triggers layout.
 *   3. Nothing blocks input while it runs.
 *   4. Every effect collapses to a static state under `prefers-reduced-motion`.
 */

export const EASE = [0.16, 1, 0.3, 1];   // expo-out: fast start, soft landing
export const EASE_IN_OUT = [0.65, 0, 0.35, 1];

export const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: EASE } },
  exit: { opacity: 0, y: -8, transition: { duration: 0.18 } },
};

export const fadeIn = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { duration: 0.3 } },
  exit: { opacity: 0, transition: { duration: 0.15 } },
};

export const scaleIn = {
  hidden: { opacity: 0, scale: 0.96 },
  show: { opacity: 1, scale: 1, transition: { duration: 0.25, ease: EASE } },
  exit: { opacity: 0, scale: 0.98, transition: { duration: 0.15 } },
};

export const slideRight = {
  hidden: { opacity: 0, x: -12 },
  show: { opacity: 1, x: 0, transition: { duration: 0.3, ease: EASE } },
};

/** Parent that staggers its children — use with <Stagger.Item>. */
export const staggerParent = (stagger = 0.055, delay = 0) => ({
  hidden: {},
  show: { transition: { staggerChildren: stagger, delayChildren: delay } },
});

/** Honours the OS reduced-motion setting; returns variants that snap instead of move. */
export function useMotionVariants(variants) {
  const reduced = useReducedMotion();
  if (!reduced) return variants;
  return {
    hidden: { opacity: 0 },
    show: { opacity: 1, transition: { duration: 0 } },
    exit: { opacity: 0, transition: { duration: 0 } },
  };
}

/** Wraps a route so it fades in on mount and out on navigation. */
export function PageTransition({ children, className }) {
  const variants = useMotionVariants(fadeUp);
  return (
    <motion.div initial="hidden" animate="show" exit="exit" variants={variants} className={className}>
      {children}
    </motion.div>
  );
}

/** A list whose children appear in sequence rather than all at once. */
export function Stagger({ children, className, stagger = 0.055, delay = 0, as = 'div', ...props }) {
  const reduced = useReducedMotion();
  const Comp = motion[as] ?? motion.div;
  return (
    <Comp
      initial="hidden"
      animate="show"
      variants={reduced ? { hidden: {}, show: {} } : staggerParent(stagger, delay)}
      className={className}
      {...props}
    >
      {children}
    </Comp>
  );
}

Stagger.Item = forwardRef(function StaggerItem({ children, className, variants = fadeUp, as = 'div', ...props }, ref) {
  const resolved = useMotionVariants(variants);
  const Comp = motion[as] ?? motion.div;
  return (
    <Comp ref={ref} variants={resolved} className={className} {...props}>
      {children}
    </Comp>
  );
});

/** Same as Stagger, but it waits until the group scrolls into view. */
export function StaggerOnView({ children, className, stagger = 0.07, delay = 0, amount = 0.2, as = 'div', ...props }) {
  const reduced = useReducedMotion();
  const Comp = motion[as] ?? motion.div;
  if (reduced) {
    const Plain = as;
    return <Plain className={className} {...props}>{children}</Plain>;
  }
  return (
    <Comp
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, amount }}
      variants={reduced ? { hidden: {}, show: {} } : staggerParent(stagger, delay)}
      className={className}
      {...props}
    >
      {children}
    </Comp>
  );
}

/**
 * Reveals a marketing section the first time it scrolls into view.
 * `from` picks the direction it travels in from.
 */
export function Reveal({ children, className, delay = 0, amount = 0.2, from = 'bottom', distance = 26, blur = true }) {
  const reduced = useReducedMotion();
  const offset = {
    bottom: { y: distance }, top: { y: -distance },
    left: { x: -distance }, right: { x: distance }, none: {},
  }[from] ?? { y: distance };

  const variants = {
    hidden: { opacity: 0, ...offset, filter: blur ? 'blur(6px)' : 'blur(0px)' },
    show: {
      opacity: 1, x: 0, y: 0, filter: 'blur(0px)',
      transition: { duration: 0.7, ease: EASE, delay },
    },
  };

  if (reduced) return <div className={className}>{children}</div>;

  return (
    <motion.div
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, amount }}
      variants={variants}
      className={className}
    >
      {children}
    </motion.div>
  );
}

/** Subtle lift on hover — used by service and project cards. */
export function HoverLift({ children, className, ...props }) {
  const reduced = useReducedMotion();
  return (
    <motion.div
      whileHover={reduced ? undefined : { y: -4, transition: { duration: 0.2, ease: EASE } }}
      whileTap={reduced ? undefined : { scale: 0.995 }}
      className={className}
      {...props}
    >
      {children}
    </motion.div>
  );
}

// ── scroll-driven ──────────────────────────────────────────────────────────────

/** A hairline progress bar showing how far down the page the reader is. */
export function ScrollProgress({ className }) {
  const { scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, { stiffness: 140, damping: 26, restDelta: 0.001 });
  return (
    <motion.div
      style={{ scaleX }}
      className={cn('pointer-events-none fixed inset-x-0 top-0 z-50 h-0.5 origin-left bg-gold', className)}
      aria-hidden
    />
  );
}

/**
 * Moves its children against the scroll direction. `speed` is the fraction of
 * the travelled distance to offset by — 0.2 is subtle, 0.6 is theatrical.
 */
export function Parallax({ children, speed = 0.2, className, style }) {
  const ref = useRef(null);
  const reduced = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start end', 'end start'] });
  const raw = useTransform(scrollYProgress, [0, 1], [`${speed * 100}%`, `${-speed * 100}%`]);
  const y = useSpring(raw, { stiffness: 90, damping: 24, restDelta: 0.001 });
  return (
    <motion.div ref={ref} style={reduced ? style : { ...style, y }} className={className}>
      {children}
    </motion.div>
  );
}

/**
 * Fades and lifts a block away as the reader scrolls past it. Used on the hero
 * so the page feels like it is being handed over to the next section.
 */
export function ScrollFade({ children, className, start = 0, end = 0.85 }) {
  const ref = useRef(null);
  const reduced = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start start', 'end start'] });
  const opacity = useTransform(scrollYProgress, [start, end], [1, 0]);
  const scale = useTransform(scrollYProgress, [start, 1], [1, 0.965]);
  const y = useTransform(scrollYProgress, [start, 1], [0, 60]);
  return (
    <motion.div ref={ref} style={reduced ? undefined : { opacity, scale, y }} className={className}>
      {children}
    </motion.div>
  );
}

/** Draws a line (or any element) horizontally as the section scrolls through. */
export function DrawLine({ className, vertical = false }) {
  const ref = useRef(null);
  const reduced = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start 0.85', 'end 0.4'] });
  const scale = useSpring(scrollYProgress, { stiffness: 120, damping: 30, restDelta: 0.001 });
  return (
    <div ref={ref} className={cn('relative', className)} aria-hidden>
      <motion.span
        style={reduced ? { transform: 'none' } : (vertical ? { scaleY: scale } : { scaleX: scale })}
        className={cn('absolute inset-0 block bg-gold', vertical ? 'origin-top' : 'origin-left')}
      />
    </div>
  );
}

// ── pointer-driven ─────────────────────────────────────────────────────────────

/** Tilts a card in 3D toward the pointer. Disabled for touch and reduced motion. */
export function Tilt({ children, className, max = 7, scale = 1.01, glare = false }) {
  const ref = useRef(null);
  const reduced = useReducedMotion();
  const px = useMotionValue(0.5);
  const py = useMotionValue(0.5);
  const spring = { stiffness: 220, damping: 26, mass: 0.4 };
  const rotateX = useSpring(useTransform(py, [0, 1], [max, -max]), spring);
  const rotateY = useSpring(useTransform(px, [0, 1], [-max, max]), spring);
  // Declared before the early return: hook order must not depend on a setting
  // the reader can change while the page is open.
  const glareBackground = useTransform(
    [px, py],
    ([x, y]) => `radial-gradient(400px circle at ${x * 100}% ${y * 100}%, hsl(var(--gold) / 0.14), transparent 60%)`,
  );

  if (reduced) return <div className={className}>{children}</div>;

  const onMove = (e) => {
    const r = ref.current?.getBoundingClientRect();
    if (!r) return;
    px.set((e.clientX - r.left) / r.width);
    py.set((e.clientY - r.top) / r.height);
  };
  const reset = () => { px.set(0.5); py.set(0.5); };

  return (
    <motion.div
      ref={ref}
      onPointerMove={(e) => e.pointerType === 'mouse' && onMove(e)}
      onPointerLeave={reset}
      whileHover={{ scale }}
      transition={{ duration: 0.3, ease: EASE }}
      style={{ rotateX, rotateY, transformStyle: 'preserve-3d', perspective: 1200 }}
      className={className}
    >
      {children}
      {glare ? (
        <motion.span
          aria-hidden
          className="pointer-events-none absolute inset-0 rounded-[inherit] opacity-0 transition-opacity duration-300 group-hover:opacity-100"
          style={{ background: glareBackground }}
        />
      ) : null}
    </motion.div>
  );
}

/** A control that leans toward the cursor as it approaches. */
export function Magnetic({ children, className, strength = 0.28, radius = 90 }) {
  const ref = useRef(null);
  const reduced = useReducedMotion();
  const x = useSpring(useMotionValue(0), { stiffness: 260, damping: 20, mass: 0.5 });
  const y = useSpring(useMotionValue(0), { stiffness: 260, damping: 20, mass: 0.5 });

  if (reduced) return <div className={className}>{children}</div>;

  const onMove = (e) => {
    const r = ref.current?.getBoundingClientRect();
    if (!r) return;
    const dx = e.clientX - (r.left + r.width / 2);
    const dy = e.clientY - (r.top + r.height / 2);
    const dist = Math.hypot(dx, dy);
    const falloff = Math.max(0, 1 - dist / (radius + Math.max(r.width, r.height) / 2));
    x.set(dx * strength * falloff);
    y.set(dy * strength * falloff);
  };

  return (
    <motion.div
      ref={ref}
      onPointerMove={(e) => e.pointerType === 'mouse' && onMove(e)}
      onPointerLeave={() => { x.set(0); y.set(0); }}
      style={{ x, y }}
      className={cn('inline-flex', className)}
    >
      {children}
    </motion.div>
  );
}

/** A soft light that follows the pointer across a dark panel. */
export function Spotlight({ className, size = 520, color = 'hsl(var(--gold) / 0.13)' }) {
  const ref = useRef(null);
  const reduced = useReducedMotion();
  const x = useSpring(useMotionValue(-1000), { stiffness: 120, damping: 24 });
  const y = useSpring(useMotionValue(-1000), { stiffness: 120, damping: 24 });
  const [on, setOn] = useState(false);

  useEffect(() => {
    if (reduced) return undefined;
    const el = ref.current?.parentElement;
    if (!el) return undefined;
    const move = (e) => {
      const r = el.getBoundingClientRect();
      x.set(e.clientX - r.left);
      y.set(e.clientY - r.top);
      setOn(true);
    };
    const leave = () => setOn(false);
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerleave', leave);
    return () => {
      el.removeEventListener('pointermove', move);
      el.removeEventListener('pointerleave', leave);
    };
  }, [reduced, x, y]);

  const background = useTransform([x, y], ([cx, cy]) =>
    `radial-gradient(${size}px circle at ${cx}px ${cy}px, ${color}, transparent 70%)`);

  if (reduced) return null;

  return (
    <motion.div
      ref={ref}
      aria-hidden
      className={cn('pointer-events-none absolute inset-0 z-0 transition-opacity duration-500', on ? 'opacity-100' : 'opacity-0', className)}
      style={{ background }}
    />
  );
}

// ── text ───────────────────────────────────────────────────────────────────────

/**
 * Reveals a headline word by word from behind a mask. Splitting on spaces keeps
 * Devanagari clusters intact — never split these by character.
 */
export function WordReveal({ text, className, delay = 0, stagger = 0.045, as: Tag = 'span' }) {
  const reduced = useReducedMotion();
  if (!text) return null;
  if (reduced) return <Tag className={className}>{text}</Tag>;

  const words = String(text).split(' ');
  return (
    <Tag className={className}>
      <motion.span
        initial="hidden"
        animate="show"
        variants={staggerParent(stagger, delay)}
        className="inline"
        aria-label={text}
      >
        {words.map((word, i) => (
          <span key={`${word}-${i}`} className="inline-block overflow-hidden pb-[0.12em] align-bottom" aria-hidden>
            <motion.span
              className="inline-block"
              variants={{
                hidden: { y: '110%', opacity: 0 },
                show: { y: '0%', opacity: 1, transition: { duration: 0.75, ease: EASE } },
              }}
            >
              {word}
              {i < words.length - 1 ? ' ' : ''}
            </motion.span>
          </span>
        ))}
      </motion.span>
    </Tag>
  );
}

/**
 * Same reveal, triggered when the heading scrolls into view.
 *
 * This drives itself from `whileInView` rather than from a `useInView` state
 * flag: a heading that never receives the state update would render as an
 * empty box, and a headline that might not appear is not worth the effect.
 */
export function WordRevealOnView({ text, className, stagger = 0.04, amount = 0.3, as: Tag = 'span' }) {
  const reduced = useReducedMotion();
  if (!text) return null;
  if (reduced) return <Tag className={className}>{text}</Tag>;

  const words = String(text).split(' ');
  return (
    <Tag className={className}>
      <motion.span
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, amount }}
        variants={staggerParent(stagger)}
        className="inline"
        aria-label={text}
      >
        {words.map((word, i) => (
          <span key={`${word}-${i}`} className="inline-block overflow-hidden pb-[0.12em] align-bottom" aria-hidden>
            <motion.span
              className="inline-block"
              variants={{
                hidden: { y: '110%', opacity: 0 },
                show: { y: '0%', opacity: 1, transition: { duration: 0.7, ease: EASE } },
              }}
            >
              {word}
              {i < words.length - 1 ? ' ' : ''}
            </motion.span>
          </span>
        ))}
      </motion.span>
    </Tag>
  );
}

// ── numbers ────────────────────────────────────────────────────────────────────

/**
 * Counts a stat up when it enters the viewport. Stats arrive as display strings
 * — "2.5k+", "500+", "2 hr" — so only the leading number is animated and the
 * rest of the string is preserved exactly as the editor typed it.
 */
export function CountUp({ value, className, duration = 1.6 }) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, amount: 0.6 });
  const reduced = useReducedMotion();
  const match = /^(\d+(?:\.\d+)?)(.*)$/s.exec(String(value ?? '').trim());
  const [shown, setShown] = useState(() => (match && !reduced ? null : String(value ?? '')));

  useEffect(() => {
    if (!match || reduced || !inView) return undefined;
    const target = Number(match[1]);
    const decimals = (match[1].split('.')[1] ?? '').length;
    const suffix = match[2];
    const controls = animateValue(0, target, {
      duration,
      ease: EASE,
      onUpdate: (v) => setShown(`${v.toFixed(decimals)}${suffix}`),
      onComplete: () => setShown(`${target.toFixed(decimals)}${suffix}`),
    });
    return () => controls.stop();
  }, [inView, match?.[1], match?.[2], reduced, duration]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <span ref={ref} className={cn('tabular-nums', className)}>
      {shown ?? `0${match?.[2] ?? ''}`}
    </span>
  );
}

// ── ambience ───────────────────────────────────────────────────────────────────

/** Slow-drifting motes over a dark panel. Deterministic, so it never re-shuffles. */
export function DriftField({ count = 14, className }) {
  const reduced = useReducedMotion();
  if (reduced) return null;
  const dots = Array.from({ length: count }, (_, i) => ({
    left: `${(i * 37) % 100}%`,
    top: `${(i * 61) % 100}%`,
    size: 2 + ((i * 7) % 3),
    duration: 9 + ((i * 5) % 11),
    delay: (i % 7) * 0.9,
  }));
  return (
    <div className={cn('pointer-events-none absolute inset-0 overflow-hidden', className)} aria-hidden>
      {dots.map((d, i) => (
        <motion.span
          key={i}
          className="absolute rounded-full bg-gold/40"
          style={{ left: d.left, top: d.top, width: d.size, height: d.size }}
          animate={{ y: [0, -26, 0], opacity: [0, 0.75, 0] }}
          transition={{ duration: d.duration, delay: d.delay, repeat: Infinity, ease: 'easeInOut' }}
        />
      ))}
    </div>
  );
}

/** An endless horizontal strip. Children are rendered twice to close the loop. */
export function Marquee({ children, className, duration = 38, reverse = false, pauseOnHover = true }) {
  const reduced = useReducedMotion();
  return (
    <div className={cn('group relative flex overflow-hidden', className)}>
      {[0, 1].map((copy) => (
        <div
          key={copy}
          aria-hidden={copy === 1}
          className={cn(
            'flex shrink-0 items-center',
            !reduced && 'animate-marquee',
            pauseOnHover && 'group-hover:[animation-play-state:paused]',
            reverse && '[animation-direction:reverse]',
          )}
          style={reduced ? undefined : { animationDuration: `${duration}s` }}
        >
          {children}
        </div>
      ))}
    </div>
  );
}

/** Appears once the reader is a screen down; returns them to the top. */
export function BackToTop({ className }) {
  const { scrollY } = useScroll();
  const [show, setShow] = useState(false);
  useMotionValueEvent(scrollY, 'change', (v) => setShow(v > 900));
  return (
    <AnimatePresence>
      {show ? (
        <motion.button
          type="button"
          initial={{ opacity: 0, scale: 0.8, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.8, y: 10 }}
          transition={{ duration: 0.25, ease: EASE }}
          whileHover={{ y: -3 }}
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          className={cn(
            'fixed bottom-20 right-5 z-40 grid h-11 w-11 place-items-center rounded-full border border-gold/40 bg-ink text-gold shadow-lift md:bottom-8 md:right-8',
            className,
          )}
          aria-label="Back to top"
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
            <path d="M12 19V5M5 12l7-7 7 7" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </motion.button>
      ) : null}
    </AnimatePresence>
  );
}

export { motion, AnimatePresence, useReducedMotion, useScroll, useTransform, useSpring, useInView };
