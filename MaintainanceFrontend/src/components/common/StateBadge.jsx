import { Badge } from '@/components/ui/badge';
import { cn } from '@/helpers/utils';

const TONES = {
  success: 'surface-success',
  warning: 'surface-warning',
  info: 'surface-info',
  muted: 'border-transparent bg-muted text-muted-foreground',
};

/**
 * A record's state in a list — live / scheduled / ended, published / draft, approved /
 * waiting — on the theme's semantic surfaces, so it follows light and dark mode.
 *
 * @param {{ tone?: keyof TONES, title?: string, className?: string, children: import('react').ReactNode }} props
 */
export function StateBadge({ tone = 'muted', title, className, children }) {
  return (
    <Badge variant="outline" title={title} className={cn('whitespace-nowrap font-medium', TONES[tone], className)}>
      {children}
    </Badge>
  );
}
