import { ShieldCheck, ShieldX } from 'lucide-react';
import { formatDate } from '@/helpers/format';
import { cn } from '@/helpers/utils';

/** One labelled fact from the certificate. */
function Entry({ label, children, wide = false }) {
  if (!children) return null;
  return (
    <div className={wide ? 'sm:col-span-2' : undefined}>
      <dt className="text-xs uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 font-medium">{children}</dd>
    </div>
  );
}

/**
 * The certificate itself: whether the cover is live, and the job it covers.
 *
 * The seal at the top is the whole message — a customer opening this link is
 * asking one question, and it is answered before they read a word.
 */
export function WarrantyCertificate({ warranty }) {
  const { isValid, endsAt, customer, job, scope } = warranty;

  return (
    <>
      <header className="text-center">
        <div
          className={cn(
            'mx-auto grid h-14 w-14 place-items-center rounded-full',
            isValid ? 'surface-success' : 'bg-muted text-muted-foreground',
          )}
        >
          {isValid ? <ShieldCheck className="h-7 w-7" aria-hidden /> : <ShieldX className="h-7 w-7" aria-hidden />}
        </div>
        <h1 className="mt-4 text-2xl font-bold">Warranty certificate</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {isValid ? `Valid until ${formatDate(endsAt)}` : `This warranty ended on ${formatDate(endsAt)}`}
        </p>
      </header>

      <dl className="mt-8 grid gap-4 border-y py-6 sm:grid-cols-2">
        <Entry label="Customer">{customer.name}</Entry>
        <Entry label="Job"><span className="tabular-nums">{job.number}</span></Entry>
        <Entry label="Work carried out" wide>{job.title}</Entry>
        <Entry label="Completed">{formatDate(job.actualEnd)}</Entry>
        <Entry label="Covers until">{formatDate(endsAt)}</Entry>
        {scope ? (
          <div className="sm:col-span-2">
            <dt className="text-xs uppercase tracking-wide text-muted-foreground">Scope</dt>
            <dd className="mt-0.5 text-sm text-muted-foreground">{scope}</dd>
          </div>
        ) : null}
      </dl>
    </>
  );
}
