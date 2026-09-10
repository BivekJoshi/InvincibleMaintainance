import { Check } from 'lucide-react';
import { cn } from '@/helpers/utils';

/**
 * Where you are in the flow, and the way back to anywhere you have already been.
 *
 * Steps ahead are disabled rather than hidden: the visitor can see the booking
 * is four short steps, which is the number that stops people abandoning at the
 * first one.
 */
export function BookingStepper({ steps, step, onStep }) {
  return (
    <ol className="flex items-center gap-2">
      {steps.map((label, i) => {
        const state = i === step ? 'current' : i < step ? 'done' : 'todo';
        return (
          <li key={label} className="flex flex-1 items-center gap-2">
            <button
              type="button"
              onClick={() => i < step && onStep(i)}
              disabled={i > step}
              aria-current={state === 'current' ? 'step' : undefined}
              className={cn(
                'flex items-center gap-2 rounded-full px-1 text-left text-xs font-medium transition-colors',
                state === 'todo' && 'text-muted-foreground',
                i < step && 'hover:text-primary',
              )}
            >
              <span className={cn(
                'grid h-6 w-6 shrink-0 place-items-center rounded-full border text-[11px] font-bold transition-colors',
                state === 'current' && 'border-primary bg-primary text-primary-foreground',
                state === 'done' && 'border-primary bg-primary/10 text-primary',
                state === 'todo' && 'border-border text-muted-foreground',
              )}>
                {state === 'done' ? <Check className="h-3 w-3" aria-hidden /> : i + 1}
              </span>
              <span className="hidden sm:block">{label}</span>
            </button>
            {i < steps.length - 1 ? (
              <span className={cn('h-px flex-1 transition-colors', i < step ? 'bg-primary' : 'bg-border')} aria-hidden />
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}
