import { Link2Off, Phone, RefreshCw, WifiOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { telHref } from '../visitPageState';

/**
 * When there is no visit to show: an unknown or mistyped link (404) says so kindly, in the page's language, with
 * the company's phone; anything else (the network) offers Try again as well.
 *
 * @param {{ notFound: boolean, phone?: string, copy: object, onRetry: () => void }} props
 */
export function VisitUnavailable({ notFound, phone, copy, onRetry }) {
  const words = notFound ? copy.invalid : copy.loadError;
  const Icon = notFound ? Link2Off : WifiOff;
  return (
    <div className="flex flex-col items-center py-6 text-center" role={notFound ? undefined : 'alert'}>
      <span aria-hidden className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <Icon className="h-6 w-6" />
      </span>
      <h1 className="text-xl font-bold">{words.title}</h1>
      <p className="mt-2 max-w-sm text-muted-foreground">{words.body}</p>
      <div className="mt-6 grid w-full gap-3 sm:w-auto sm:grid-flow-col">
        {notFound ? null : (
          <Button type="button" size="xl" variant="outline" className="h-auto min-h-12 whitespace-normal py-2" onClick={onRetry}>
            <RefreshCw aria-hidden /> {copy.loadError.retry}
          </Button>
        )}
        {phone ? (
          <Button asChild size="xl" className="h-auto min-h-12 whitespace-normal py-2">
            <a href={telHref(phone)}><Phone aria-hidden /> {copy.call(phone)}</a>
          </Button>
        ) : null}
      </div>
    </div>
  );
}
