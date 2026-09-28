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
    // Tighter edges on a phone: at 360 px the sheet keeps ~300 px for the document itself.
    <PageTransition className={cn('container px-3 py-8 sm:px-6 sm:py-14', width === 'sm' ? 'max-w-2xl' : 'max-w-3xl', className)}>
      <Card>
        <CardContent className="p-4 sm:p-8">{children}</CardContent>
      </Card>
    </PageTransition>
  );
}
