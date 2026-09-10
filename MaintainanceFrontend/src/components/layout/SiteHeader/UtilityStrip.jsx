import { SITE_PROMISE_LABELS } from '@/config/site/promises';

/**
 * The line above the bar: what the company promises, and the two numbers that
 * answer. Not sticky — it scrolls away and hands the page over to the header.
 */
export function UtilityStrip({ phone, mobile }) {
  return (
    <div className="hidden border-b bg-muted/50 md:block">
      <div className="container flex h-9 items-center justify-between text-xs text-muted-foreground">
        <p className="flex items-center gap-2.5">
          {/* A live dot: the SLA is the product, so it gets a pulse. */}
          <span className="relative flex h-1.5 w-1.5" aria-hidden>
            <span className="absolute inset-0 rounded-full bg-sla-ok motion-safe:animate-pulse-ring" />
            <span className="relative h-1.5 w-1.5 rounded-full bg-sla-ok" />
          </span>
          {SITE_PROMISE_LABELS.map((label, i) => (
            <span key={label} className="flex items-center gap-2.5">
              {i ? <span className="h-1 w-1 rounded-full bg-gold/70" aria-hidden /> : null}
              {label}
            </span>
          ))}
        </p>
        <div className="flex items-center gap-5">
          <a href={`tel:${phone}`} className="transition-colors hover:text-foreground">{phone}</a>
          <a href={`tel:${mobile}`} className="transition-colors hover:text-foreground">{mobile}</a>
        </div>
      </div>
    </div>
  );
}
