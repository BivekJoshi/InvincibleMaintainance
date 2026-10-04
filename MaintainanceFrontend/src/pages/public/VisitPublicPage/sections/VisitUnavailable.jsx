import { Link2Off, Phone, RefreshCw, WifiOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DOCUMENTS } from '@/config/i18n/documents';
import { useT } from '@/hooks/useT';
import { telHref } from '../visitPageState';

/**
 * When there is no visit to show: an unknown or mistyped link (404) says so kindly, in the page's language, with
 * the company's phone; anything else (the network) offers Try again as well.
 *
 * @param {{ notFound: boolean, phone?: string, onRetry: () => void }} props
 */
export function VisitUnavailable({ notFound, phone, onRetry }) {
  const t = useT(DOCUMENTS);
  const words = notFound ? 'visit.invalid' : 'visit.loadError';
  const Icon = notFound ? Link2Off : WifiOff;
  return (
    <div className="flex flex-col items-center py-6 text-center" role={notFound ? undefined : 'alert'}>
      <span aria-hidden className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <Icon className="h-6 w-6" />
      </span>
      <h1 className="text-xl font-bold">{t(`${words}.title`)}</h1>
      <p className="mt-2 max-w-sm text-muted-foreground">{t(`${words}.body`)}</p>
      <div className="mt-6 grid w-full gap-3 sm:w-auto sm:grid-flow-col">
        {notFound ? null : (
          <Button type="button" size="xl" variant="outline" className="h-auto min-h-12 whitespace-normal py-2" onClick={onRetry}>
            <RefreshCw aria-hidden /> {t('visit.loadError.retry')}
          </Button>
        )}
        {phone ? (
          <Button asChild size="xl" className="h-auto min-h-12 whitespace-normal py-2">
            <a href={telHref(phone)}><Phone aria-hidden /> {t('visit.call', { phone })}</a>
          </Button>
        ) : null}
      </div>
    </div>
  );
}
