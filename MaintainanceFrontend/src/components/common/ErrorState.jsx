import { AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

/** Surfaces the API's real message; falls back only when there isn't one. */
export function ErrorState({ error, onRetry, className }) {
  const message =
    error?.data?.error?.message ??
    error?.error ??
    (typeof error === 'string' ? error : 'Something went wrong loading this.');
  const code = error?.data?.error?.code;
  const details = error?.data?.error?.details;

  return (
    <div className={cn('flex flex-col items-center justify-center px-6 py-16 text-center', className)}>
      <div className="mb-4 rounded-full bg-destructive/10 p-3">
        <AlertTriangle className="h-6 w-6 text-destructive" aria-hidden />
      </div>
      <h3 className="text-sm font-semibold">{message}</h3>
      {Array.isArray(details) && details.length ? (
        <ul className="mt-2 space-y-0.5 text-xs text-muted-foreground">
          {details.map((d, i) => (
            <li key={i}>{d.path ? `${d.path}: ${d.message}` : d.message ?? String(d)}</li>
          ))}
        </ul>
      ) : null}
      {code ? <p className="mt-2 font-mono text-[11px] text-muted-foreground">{code}</p> : null}
      {onRetry ? (
        <Button variant="outline" className="mt-5" onClick={onRetry}>
          <RefreshCw className="h-4 w-4" /> Try again
        </Button>
      ) : null}
    </div>
  );
}
