import { useState } from 'react';
import { AlertTriangle, Check, Copy, ExternalLink, Home, RefreshCw, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { IS_DEV } from '@/config/env';
import { isChunkLoadError, sourceFrame } from '@/helpers/errorDetails';
import { cn } from '@/helpers/utils';

/** Leaves the route map alone: the root boundary sits above the router, so this is a plain link. */
const homeHref = () => (typeof window !== 'undefined' && window.location.pathname.startsWith('/admin') ? '/admin' : '/');

/**
 * What a boundary shows in place of a crashed tree.
 *
 * Production users see a short apology and three ways out. In development the same
 * screen carries the error, the JavaScript stack and React's component stack, a
 * one-click copy of all three, and a link that opens the throwing file in the editor.
 */
export function ErrorFallback({ error, componentStack = '', onReset, variant = 'page', className }) {
  const chunk = isChunkLoadError(error);
  const title = chunk ? 'A newer version of this app is available' : 'Something went wrong';
  const body = chunk
    ? 'Part of this page could not be loaded, usually because the app was updated while it was open. Reloading fixes it.'
    : 'This part of the page stopped working. You can try again, reload, or go back to the start.';

  return (
    <div
      role="alert"
      className={cn(
        'flex w-full items-center justify-center bg-background px-4 text-foreground',
        variant === 'app' ? 'min-h-dvh py-10' : 'min-h-[60dvh] py-10',
        className,
      )}
    >
      <div className={cn('w-full text-center', IS_DEV ? 'max-w-3xl' : 'max-w-md')}>
        <div className="mx-auto mb-4 w-fit rounded-full bg-destructive/10 p-3">
          <AlertTriangle className="h-6 w-6 text-destructive" aria-hidden />
        </div>
        <h2 className="text-lg font-semibold">{title}</h2>
        <p className="mt-2 text-sm text-muted-foreground">{body}</p>

        <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
          {!chunk && onReset ? (
            <Button onClick={onReset}>
              <RotateCcw /> Try again
            </Button>
          ) : null}
          <Button variant={chunk ? 'default' : 'outline'} onClick={() => window.location.reload()}>
            <RefreshCw /> Reload page
          </Button>
          <Button variant="ghost" asChild>
            <a href={homeHref()}>
              <Home /> Go home
            </a>
          </Button>
        </div>

        {IS_DEV ? <DevDetails error={error} componentStack={componentStack} /> : null}
      </div>
    </div>
  );
}

/** Development only. Never rendered in a production build, where `IS_DEV` is inlined as false. */
function DevDetails({ error, componentStack }) {
  const [copied, setCopied] = useState(false);
  const frame = sourceFrame(error?.stack);
  const report = [
    `${error?.name ?? 'Error'}: ${error?.message ?? ''}`,
    `URL: ${window.location.href}`,
    '',
    'Stack:',
    error?.stack ?? '(none)',
    '',
    'Component stack:',
    componentStack.trim() || '(none)',
  ].join('\n');

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(report);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard is refused outside a secure context; the text is on screen to select by hand.
    }
  };

  return (
    <section className="mt-8 overflow-hidden rounded-lg border border-destructive/30 text-left">
      <header className="flex flex-wrap items-center gap-2 border-b border-destructive/20 bg-destructive/5 px-4 py-2">
        <span className="rounded bg-destructive px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-destructive-foreground">
          Dev
        </span>
        <code className="min-w-0 flex-1 break-words font-mono text-xs font-semibold text-destructive">
          {error?.name ?? 'Error'}: {error?.message}
        </code>
        {frame ? (
          <Button variant="ghost" size="sm" asChild>
            <a href={`/__open-in-editor?file=${encodeURIComponent(`${frame.file}:${frame.line}:${frame.column}`)}`} target="_blank" rel="noreferrer">
              <ExternalLink /> {frame.file.split('/').pop()}:{frame.line}
            </a>
          </Button>
        ) : null}
        <Button variant="ghost" size="sm" onClick={copy}>
          {copied ? <Check /> : <Copy />} {copied ? 'Copied' : 'Copy'}
        </Button>
      </header>
      <StackBlock label="Stack trace" text={error?.stack} open />
      <StackBlock label="Component stack" text={componentStack.trim()} />
    </section>
  );
}

function StackBlock({ label, text, open = false }) {
  if (!text) return null;
  return (
    <details open={open} className="group border-t border-border first-of-type:border-t-0">
      <summary className="cursor-pointer select-none px-4 py-2 text-xs font-medium text-muted-foreground hover:text-foreground">
        {label}
      </summary>
      <pre className="max-h-72 overflow-auto bg-muted/50 px-4 py-3 font-mono text-[11px] leading-relaxed text-foreground">
        {text}
      </pre>
    </details>
  );
}
