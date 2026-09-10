import { Card, CardContent } from '@/components/ui/card';
import { PageTransition } from '@/three/motion/motionKit';
import { cn } from '@/helpers/utils';

/**
 * The sheet a customer-facing document is printed on.
 *
 * A quotation, an invoice and a warranty certificate are all opened from an SMS
 * link, on a phone, by someone with no account — one column, one card, no
 * navigation to lose them in. They shared this frame by copy until it was three
 * slightly different widths.
 */
export function DocumentShell({ children, width = 'md', className }) {
  return (
    <PageTransition className={cn('container py-14', width === 'sm' ? 'max-w-2xl' : 'max-w-3xl', className)}>
      <Card>
        <CardContent className="p-6 sm:p-8">{children}</CardContent>
      </Card>
    </PageTransition>
  );
}
