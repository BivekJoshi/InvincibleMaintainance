import { Link } from 'react-router-dom';
import { ArrowLeft, CalendarCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { SITE } from '@/config/i18n/site';
import { useT } from '@/hooks/useT';

/** What to do after reading: have an engineer look, or read another article. */
export function PostCta() {
  const t = useT(SITE);
  return (
    <>
      <Card className="mt-12 bg-muted/40">
        <CardContent className="flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-semibold tracking-tight">{t('post.cta.title')}</p>
            <p className="mt-1 text-sm text-muted-foreground">{t('post.cta.body')}</p>
          </div>
          <Button asChild className="h-auto min-h-9 shrink-0 whitespace-normal py-2 text-center">
            <Link to="/book"><CalendarCheck aria-hidden /> {t('post.cta.book')}</Link>
          </Button>
        </CardContent>
      </Card>
      <Button asChild variant="link" className="mt-6 h-auto p-0">
        <Link to="/blog"><ArrowLeft aria-hidden /> {t('post.all')}</Link>
      </Button>
    </>
  );
}
