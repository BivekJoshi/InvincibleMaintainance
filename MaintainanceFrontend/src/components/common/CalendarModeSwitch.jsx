import { useId } from 'react';
import { motion, useReducedMotion } from '@/three/motion/motionKit';
import { CALENDAR_LABELS } from '@/config/locale';
import { useCalendarMode } from '@/hooks/useCalendarMode';
import { cn } from '@/helpers/utils';

/**
 * English (AD) or Nepali (BS): the calendar the back office's calendar and clock read in. Two buttons that act at
 * once — `aria-pressed`, not a radio group — with the fill sliding between them like `ThemeModeSwitch`'s, on a
 * `layoutId` scoped to this instance. The account menu holds it; the admin is English (decision D7), so the words are
 * inline.
 */
export function CalendarModeSwitch({ className }) {
  const { calendar, calendars, setCalendar } = useCalendarMode();
  const reduced = useReducedMotion();
  const layoutId = `calendar-mode-pill-${useId()}`;

  return (
    <div role="group" aria-label="Calendar" className={cn('relative inline-flex items-center gap-0.5 rounded-full border bg-muted/40 p-0.5', className)}>
      {calendars.map((value) => {
        const on = calendar === value;
        const { label, hint } = CALENDAR_LABELS[value];
        return (
          <button
            key={value}
            type="button"
            onClick={() => setCalendar(value)}
            aria-pressed={on}
            title={hint}
            className={cn(
              'relative rounded-full px-2 py-1 text-[11px] font-semibold transition-colors',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background',
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
            <span className="relative">{label}</span>
          </button>
        );
      })}
    </div>
  );
}
