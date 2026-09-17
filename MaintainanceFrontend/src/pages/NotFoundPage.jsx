import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { PageTransition } from '@/three/motion/motionKit';
import { cn } from '@/helpers/utils';

/**
 * @param {{ className?: string }} props  inside the site's shell a generic page passes a
 *   shorter height, since the header and footer are already on screen
 */
export default function NotFoundPage({ className }) {
  return (
    <PageTransition className={cn('flex min-h-dvh flex-col items-center justify-center p-6 text-center', className)}>
      <p className="text-6xl font-extrabold tracking-tight text-muted-foreground/30">404</p>
      <h1 className="mt-4 text-xl font-bold">We could not find that page</h1>
      <p className="mt-2 max-w-sm text-sm text-muted-foreground">
        The link may be out of date, or the page may have moved.
      </p>
      <Button asChild className="mt-6"><Link to="/">Back to the homepage</Link></Button>
    </PageTransition>
  );
}
