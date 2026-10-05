import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { SITE } from '@/config/i18n/site';
import { useT } from '@/hooks/useT';
import { PageTransition } from '@/three/motion/motionKit';
import { cn } from '@/helpers/utils';

/**
 * In the visitor's language — and English under `/admin`, where `LocaleProvider` sets it.
 *
 * @param {{ className?: string }} props  inside the site's shell a generic page passes a
 *   shorter height, since the header and footer are already on screen
 */
export default function NotFoundPage({ className }) {
  const t = useT(SITE);
  return (
    <PageTransition className={cn('flex min-h-dvh flex-col items-center justify-center p-6 text-center', className)}>
      <p className="text-6xl font-extrabold tracking-tight text-muted-foreground/30">404</p>
      <h1 className="mt-4 text-xl font-bold">{t('notFound.title')}</h1>
      <p className="mt-2 max-w-sm text-sm text-muted-foreground">{t('notFound.body')}</p>
      <Button asChild className="mt-6"><Link to="/">{t('notFound.home')}</Link></Button>
    </PageTransition>
  );
}
