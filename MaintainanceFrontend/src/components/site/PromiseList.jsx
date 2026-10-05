import { SITE_PROMISES } from '@/config/site/promises';
import { SITE } from '@/config/i18n/site';
import { useT } from '@/hooks/useT';
import { cn } from '@/helpers/utils';
import { DataIcon } from './DataIcon';

/**
 * Free inspection, two-hour response, one-month warranty — the three lines the
 * whole storefront is sold on, rendered the same way everywhere they appear.
 *
 * Three shapes for three jobs, and no fourth: `inline` for a line under a
 * heading, `chips` for a footer or a dark panel, `stack` for a form's sidebar
 * where each promise gets a sentence of its own.
 *
 * @param {{ variant?: 'inline'|'chips'|'stack', tone?: 'paper'|'ink', className?: string }} props
 */
export function PromiseList({ variant = 'inline', tone = 'paper', className }) {
  const t = useT(SITE);
  const ink = tone === 'ink';
  const label = (p) => t(`promises.${p.key}.label`);

  if (variant === 'chips') {
    return (
      <ul className={cn('flex flex-wrap gap-2', className)}>
        {SITE_PROMISES.map((p) => (
          <li
            key={p.key}
            className={cn(
              'rounded-full border px-3 py-1 text-[11px]',
              ink ? 'border-ink-foreground/15 text-ink-muted' : 'border-border text-muted-foreground',
            )}
          >
            {label(p)}
          </li>
        ))}
      </ul>
    );
  }

  if (variant === 'stack') {
    return (
      <ul className={cn('space-y-2 text-sm', className)}>
        {SITE_PROMISES.map((p) => (
          <li key={p.key} className={cn('flex gap-2.5', ink ? 'text-ink-muted' : 'text-muted-foreground')}>
            <DataIcon name={p.icon} className="mt-0.5 h-4 w-4 shrink-0 text-gold" />
            <span>
              <span className={cn('font-medium', ink ? 'text-ink-foreground' : 'text-foreground')}>{label(p)}</span>
              {' — '}{t(`promises.${p.key}.detail`)}
            </span>
          </li>
        ))}
      </ul>
    );
  }

  return (
    <ul className={cn('flex flex-wrap gap-x-5 gap-y-2 text-[13px]', ink ? 'text-ink-muted' : 'text-muted-foreground', className)}>
      {SITE_PROMISES.map((p) => (
        <li key={p.key} className="flex items-center gap-1.5">
          <DataIcon name={p.icon} className="h-3.5 w-3.5 text-gold" />
          {label(p)}
        </li>
      ))}
    </ul>
  );
}
