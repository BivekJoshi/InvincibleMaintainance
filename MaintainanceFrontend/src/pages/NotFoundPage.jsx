import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { PageTransition } from '@/components/motion';

export default function NotFoundPage() {
  return (
    <PageTransition className="flex min-h-dvh flex-col items-center justify-center p-6 text-center">
      <p className="text-6xl font-extrabold tracking-tight text-muted-foreground/30">404</p>
      <h1 className="mt-4 text-xl font-bold">We could not find that page</h1>
      <p className="mt-2 max-w-sm text-sm text-muted-foreground">
        The link may be out of date, or the page may have moved.
      </p>
      <Button asChild className="mt-6"><Link to="/">Back to the homepage</Link></Button>
    </PageTransition>
  );
}
