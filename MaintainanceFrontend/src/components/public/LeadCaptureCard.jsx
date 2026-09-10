import { cn } from '@/helpers/utils';

/**
 * The panel a lead form sits in: a titled header on muted paper, the form
 * below it, and a hairline between the two.
 *
 * The service page, the contact page and the pricing page all ask for the same
 * thing in the same words, so they ask for it in the same box. What differs is
 * the promise above the form and which service is pre-selected — both props.
 */
export function LeadCaptureCard({ title, description, children, footnote, className }) {
  return (
    <div className={cn('overflow-hidden rounded-lg border bg-card shadow-card', className)}>
      <div className="border-b bg-muted/50 px-6 py-5 sm:px-7">
        <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
        {description ? <div className="mt-1 text-xs text-muted-foreground">{description}</div> : null}
      </div>
      <div className="p-6 sm:p-7">{children}</div>
      {footnote ? (
        <p className="border-t bg-muted/30 px-6 py-3 text-[11px] text-muted-foreground sm:px-7">{footnote}</p>
      ) : null}
    </div>
  );
}
