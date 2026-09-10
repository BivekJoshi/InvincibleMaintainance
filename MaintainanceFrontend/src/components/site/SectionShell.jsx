import { cn } from '@/helpers/utils';

/**
 * Vertical rhythm for a storefront band. `tone` picks the surface — and only
 * the page decides which, so reordering two sections can never leave three of
 * the same surface stacked on top of each other.
 */
export function SectionShell({ children, className, tone = 'paper', id }) {
  return (
    <section
      id={id}
      className={cn(
        'relative py-14 md:py-20',
        tone === 'muted' && 'border-y bg-muted/40',
        tone === 'ink' && 'ink-panel',
        className,
      )}
    >
      <div className="container relative">{children}</div>
    </section>
  );
}
