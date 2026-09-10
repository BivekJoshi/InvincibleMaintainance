import { useId } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { motion, useReducedMotion } from '@/three/motion/motionKit';
import { selectLocale, setLocale } from '@/redux/slices/uiSlice';
import { cn } from '@/helpers/utils';

/**
 * EN ⇄ नेपाली as a segmented control, with the fill sliding between the two.
 *
 * Self-contained on purpose — like `ThemeToggle`, it reads and writes the store
 * itself, so a header, a drawer and a settings row all get the switch without
 * three separate owners threading `locale` and `onChange` down to it.
 *
 * The Nepali label is set in its own language, so the browser reaches for the
 * Devanagari face rather than rendering it in whatever the page is using.
 */
const LOCALES = [
  { code: 'en', label: 'EN', name: 'English' },
  { code: 'ne', label: 'नेपाली', name: 'Nepali' },
];

export function LocaleSwitch({ className }) {
  const dispatch = useDispatch();
  const locale = useSelector(selectLocale);
  const reduced = useReducedMotion();
  const layoutId = `locale-pill-${useId()}`;

  return (
    <div
      role="group"
      aria-label="Language"
      className={cn('relative flex items-center rounded-full border bg-muted/40 p-0.5', className)}
    >
      {LOCALES.map((l) => {
        const on = locale === l.code;
        return (
          <button
            key={l.code}
            type="button"
            onClick={() => dispatch(setLocale(l.code))}
            aria-pressed={on}
            className={cn(
              'relative rounded-full px-2.5 py-1 text-[11px] font-semibold transition-colors',
              on ? 'text-foreground' : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {on ? (
              <motion.span
                layoutId={layoutId}
                aria-hidden
                className="absolute inset-0 rounded-full border bg-background shadow-hairline"
                transition={reduced ? { duration: 0 } : { type: 'spring', stiffness: 420, damping: 34, mass: 0.7 }}
              />
            ) : null}
            <span className="relative" lang={l.code}>{l.label}</span>
            <span className="sr-only">{l.name}</span>
          </button>
        );
      })}
    </div>
  );
}
