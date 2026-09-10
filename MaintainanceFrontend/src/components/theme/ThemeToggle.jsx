import { Monitor, Moon, Sun } from 'lucide-react';
import { motion, useReducedMotion } from '@/three/motion/motionKit';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { THEME_MODE_LABELS } from '@/config/theme';
import { useTheme } from '@/hooks/useTheme';
import { cn } from '@/helpers/utils';

/**
 * One button, for the header bars where three would be too much furniture.
 *
 * It shows what is on screen and lands on the opposite — never a third state
 * nobody asked for. Someone on "system" who reaches for it gets the palette
 * they can see they are not getting, which is the whole reason they reached.
 * The brass dot says the mode is still following the device, so a visitor can
 * tell "dark because I chose it" from "dark because it is night here".
 *
 * `cycle` swaps the click for light → dark → system, for a bar with room for
 * only one control but a user who wants all three.
 */
export function ThemeToggle({ className, cycle: walk = false, size = 'icon', variant = 'ghost' }) {
  const { mode, isDark, cycle, toggle } = useTheme();
  const reduced = useReducedMotion();
  const following = mode === 'system';

  const label = walk
    ? `Colour theme: ${THEME_MODE_LABELS[mode].label}. Change`
    : `Switch to ${isDark ? 'light' : 'dark'} theme`;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant={variant}
          size={size}
          onClick={walk ? cycle : toggle}
          aria-label={label}
          className={cn('relative', className)}
        >
          <span className="relative block h-[18px] w-[18px]">
            {/* Both marks share the box and trade places on a rotation, so the
                swap reads as one object turning rather than two icons blinking. */}
            <Sun
              aria-hidden
              className="absolute inset-0 h-[18px] w-[18px] rotate-0 scale-100 transition-transform duration-500 dark:-rotate-90 dark:scale-0"
            />
            <Moon
              aria-hidden
              className="absolute inset-0 h-[18px] w-[18px] rotate-90 scale-0 transition-transform duration-500 dark:rotate-0 dark:scale-100"
            />
          </span>
          {following ? (
            <motion.span
              aria-hidden
              initial={reduced ? false : { scale: 0 }}
              animate={{ scale: 1 }}
              className="absolute bottom-1 right-1 h-1.5 w-1.5 rounded-full bg-gold ring-2 ring-background"
            />
          ) : null}
        </Button>
      </TooltipTrigger>
      <TooltipContent side="bottom">
        {following ? `Following your device · ${isDark ? 'dark' : 'light'}` : THEME_MODE_LABELS[mode].label}
      </TooltipContent>
    </Tooltip>
  );
}

/** The mark for a mode, so a menu row and a switch segment cannot disagree. */
export const THEME_MODE_ICONS = { light: Sun, dark: Moon, system: Monitor };
