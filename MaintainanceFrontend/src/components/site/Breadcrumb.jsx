import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { cn } from '@/helpers/utils';

/**
 * The trail back up. The last crumb is the page you are on, so it is text
 * rather than a link — a link to here is a link that does nothing.
 *
 * @param {{ items: Array<{ label: string, to?: string }>, className?: string }} props
 */
export function Breadcrumb({ items, className }) {
  return (
    <nav aria-label="Breadcrumb" className={cn('flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground', className)}>
      {items.map((item, i) => (
        <span key={`${item.label}-${i}`} className="flex items-center gap-1.5">
          {i ? <ChevronRight className="h-3 w-3" aria-hidden /> : null}
          {item.to && i < items.length - 1 ? (
            <Link to={item.to} className="transition-colors hover:text-foreground">{item.label}</Link>
          ) : (
            <span className={i === items.length - 1 ? 'text-foreground' : undefined} aria-current={i === items.length - 1 ? 'page' : undefined}>
              {item.label}
            </span>
          )}
        </span>
      ))}
    </nav>
  );
}
