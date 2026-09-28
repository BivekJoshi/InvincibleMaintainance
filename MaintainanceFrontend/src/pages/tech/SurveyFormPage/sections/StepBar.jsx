import { useEffect, useRef } from 'react';
import { Check } from 'lucide-react';
import { cn } from '@/helpers/utils';

/** "3/5", "2" or nothing — a step's own count. */
function countText(count, words) {
  if (Array.isArray(count)) return words.progress.count(count[0], count[1]);
  if (typeof count === 'number' && count > 0) return String(count);
  return null;
}

/**
 * The stepper's steps as one row of big buttons that scrolls sideways on a phone: each shows a tick once its
 * step is done, or its count ("3/5" answered, "4" rows), and the step on screen is `aria-current="step"`.
 * Any step can be opened; the order is only a suggestion.
 *
 * @param {{ steps: string[], current: string, progress: Record<string, { done: boolean, count?: any, alert?: boolean }>,
 *   onPick: (step: string) => void, words: object }} props  `words` is `fieldCopy().survey`
 */
export function StepBar({ steps, current, progress, onPick, words }) {
  const active = useRef(null);

  useEffect(() => {
    active.current?.scrollIntoView?.({ inline: 'center', block: 'nearest' });
  }, [current]);

  return (
    <nav aria-label={words.stepsLabel} className="-mx-4 mb-4 overflow-x-auto px-4 pb-1">
      <ol className="flex w-max gap-2">
        {steps.map((step, i) => {
          const state = progress[step] ?? {};
          const isCurrent = step === current;
          const count = countText(state.count, words);
          return (
            <li key={step}>
              <button
                ref={isCurrent ? active : undefined}
                type="button"
                onClick={() => onPick(step)}
                aria-current={isCurrent ? 'step' : undefined}
                className={cn(
                  // `relative`: the sr-only "Done" inside must not escape the scroller and widen the page.
                  'relative flex min-h-12 items-center gap-2 rounded-full border px-3 text-sm font-medium transition-colors',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                  isCurrent ? 'border-primary bg-primary text-primary-foreground' : 'bg-background hover:bg-muted',
                  state.alert && !isCurrent ? 'border-destructive text-destructive' : '',
                )}
              >
                <span
                  aria-hidden
                  className={cn(
                    'flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs',
                    isCurrent ? 'bg-primary-foreground/20' : state.done ? 'surface-success' : 'bg-muted',
                  )}
                >
                  {state.done ? <Check className="h-3.5 w-3.5" /> : i + 1}
                </span>
                <span className="whitespace-nowrap">{words.steps[step]}</span>
                {count ? <span className={cn('text-xs tabular-nums', isCurrent ? '' : 'text-muted-foreground')}>{count}</span> : null}
                {state.done ? <span className="sr-only">— {words.progress.done}</span> : null}
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
