import { useId } from 'react';
import { motion, useReducedMotion } from '@/three/motion/motionKit';
import { THEME_MODE_LABELS } from '@/config/theme';
import { useTheme } from '@/hooks/useTheme';
import { cn } from '@/helpers/utils';
import { THEME_MODE_ICONS } from './ThemeToggle';

/**
 * All three modes at once: light, dark, and the one that follows the device.
 *
 * For the places with room to show the choice rather than hide it — the login
 * screen, a settings row, the foot of the mobile drawer. The fill slides
 * between the segments on a shared `layoutId`, which is scoped per instance so
 * two switches on one page do not animate into each other.
 *
 * `aria-pressed` is on each segment rather than `role="radiogroup"`: these are
 * three buttons that act immediately, not a form field awaiting a submit.
 */
export function ThemeModeSwitch({ className, showLabels = false, size = 'md' }) {
  const { mode, modes, setMode } = useTheme();
  const reduced = useReducedMotion();
  const layoutId = `theme-mode-pill-${useId()}`;

  const compact = size === 'sm';

  return (
    <div
      role="group"
      aria-label="Colour theme"
      className={cn(
        'relative inline-flex items-center gap-0.5 rounded-full border bg-muted/40 p-0.5',
        className,
      )}
    >
      {modes.map((value) => {
        const Icon = THEME_MODE_ICONS[value];
        const { label, hint } = THEME_MODE_LABELS[value];
        const on = mode === value;

        return (
          <button
            key={value}
            type="button"
            onClick={() => setMode(value)}
            aria-pressed={on}
            title={hint}
            className={cn(
              'relative flex items-center gap-1.5 rounded-full font-semibold transition-colors',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background',
              compact ? 'px-2 py-1 text-[11px]' : 'px-2.5 py-1.5 text-xs',
              on ? 'text-foreground' : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {on ? (
              <motion.span
                layoutId={layoutId}
                aria-hidden
                className="absolute inset-0 rounded-full border bg-background shadow-sm"
                transition={reduced ? { duration: 0 } : { type: 'spring', stiffness: 420, damping: 34, mass: 0.7 }}
              />
            ) : null}
            <Icon aria-hidden className={cn('relative', compact ? 'h-3 w-3' : 'h-3.5 w-3.5')} />
            {showLabels ? <span className="relative">{label}</span> : null}
            <span className="sr-only">{showLabels ? hint : label}</span>
          </button>
        );
      })}
    </div>
  );
}
