import { StatusBadge } from '@/components/ui/badge';

/**
 * What this document is, whose it is, and where it stands.
 *
 * The number is the thing a customer reads back over the phone, so it is the
 * heading — tabular figures, and never abbreviated. The status badge is the
 * same component the back office uses, so a customer and the person they are
 * calling see the same word — unless `statusLabel` puts it in the customer's words.
 */
export function DocumentHeader({ kind, icon: Icon, number, subject, status, statusLabel, meta }) {
  return (
    <header className="flex flex-wrap items-start justify-between gap-4 border-b pb-6">
      <div>
        <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-primary">
          {Icon ? <Icon className="h-3.5 w-3.5" aria-hidden /> : null} {kind}
        </p>
        <h1 className="mt-1 text-2xl font-bold tabular-nums">{number}</h1>
        {subject ? <p className="mt-1 text-sm text-muted-foreground">{subject}</p> : null}
      </div>
      <div className="text-right">
        {status ? <StatusBadge status={status} label={statusLabel} /> : null}
        {meta ? <div className="mt-2 space-y-0.5 text-xs text-muted-foreground">{meta}</div> : null}
      </div>
    </header>
  );
}
