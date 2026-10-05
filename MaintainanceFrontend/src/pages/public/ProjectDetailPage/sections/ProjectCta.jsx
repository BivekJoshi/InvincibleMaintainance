import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SITE } from '@/config/i18n/site';
import { useT } from '@/hooks/useT';

/**
 * The foot of a case study: the caveat about cost bands, then the two things
 * a convinced reader might want — this trade's inspection, or more work like it.
 */
export function ProjectCta({ service }) {
  const t = useT(SITE);
  return (
    <section className="border-t py-8">
      <p className="text-sm text-muted-foreground">{t('project.cta.note')}</p>
      <div className="mt-4 flex flex-wrap gap-3">
        <Button asChild className="h-auto min-h-9 whitespace-normal py-2 text-center">
          <Link to={service ? `/book/${service.slug}` : '/book'}>
            {t('project.cta.book')} <ArrowRight className="h-4 w-4" />
          </Link>
        </Button>
        <Button asChild variant="outline" className="h-auto min-h-9 whitespace-normal py-2 text-center">
          <Link to={service ? `/projects?service=${service.slug}` : '/projects'}>{t('project.cta.more')}</Link>
        </Button>
      </div>
    </section>
  );
}
