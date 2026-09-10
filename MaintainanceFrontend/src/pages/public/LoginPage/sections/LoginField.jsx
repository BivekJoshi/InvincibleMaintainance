import { AnimatePresence, motion } from '@/three/motion/motionKit';
import { Label } from '@/components/ui/label';
import { cn } from '@/helpers/utils';

/**
 * One labelled field. The brass rail on the left is the only focus signal
 * beyond the ring, and it animates between fields via a shared `layoutId` so it
 * reads as one rail moving rather than two rails blinking.
 *
 * The error sits on the label's line rather than under the input: the message
 * appears and disappears as you type, and under the input it pushed the button
 * up and down while someone was reaching for it.
 */
export function LoginField({ id, label, icon: Icon, error, active, children }) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between gap-3">
        <Label htmlFor={id} required>{label}</Label>
        <AnimatePresence>
          {error ? (
            <motion.span
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              id={`${id}-error`}
              className="text-right text-xs text-destructive"
            >
              {error}
            </motion.span>
          ) : null}
        </AnimatePresence>
      </div>

      <div className="relative">
        <AnimatePresence>
          {active ? (
            <motion.span
              layoutId="field-rail"
              className="absolute -left-3 top-1 z-10 h-9 w-0.5 rounded-full bg-gold"
              transition={{ type: 'spring', stiffness: 480, damping: 38 }}
            />
          ) : null}
        </AnimatePresence>

        <Icon
          aria-hidden
          className={cn(
            'pointer-events-none absolute left-3 top-1/2 z-10 h-4 w-4 -translate-y-1/2 transition-colors',
            error ? 'text-destructive' : active ? 'text-gold' : 'text-muted-foreground',
          )}
        />
        {children}
      </div>
    </div>
  );
}
