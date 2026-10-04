import { ShieldCheck, ShieldX } from 'lucide-react';
import { DOCUMENTS } from '@/config/i18n/documents';
import { useT } from '@/hooks/useT';
import { formatDate, formatDateAdBs } from '@/helpers/format';
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
 * asking one question, and it is answered before they read a word. Its label is
 * the warranty's status in the page's words (`DOCUMENTS.warranty.status`).
 *
 * Phase J1: in the site's language, the dates of the work and the cover in AD with their BS twin — "26 Sept 2026
 * (2083-06-10 BS)", "2026 सेप्टेम्बर 26 (2083-06-10 वि.सं.)". A voided warranty says so rather than when it ends.
 */
export function WarrantyCertificate({ warranty }) {
  const t = useT(DOCUMENTS);
  const { locale } = t;
  const { isValid, status, endsAt, customer, job, scope } = warranty;
  const statusKey = `warranty.status.${status}`;
  let standing = t('warranty.ended', { date: formatDate(endsAt, { locale }) });
  if (isValid) standing = t('warranty.validUntil', { date: formatDate(endsAt, { locale }) });
  else if (status === 'VOID') standing = t('warranty.voided');

  return (
    <>
      <header className="text-center">
        <div
          role="img"
          aria-label={t.has(statusKey) ? t(statusKey) : undefined}
          className={cn(
            'mx-auto grid h-14 w-14 place-items-center rounded-full',
            isValid ? 'surface-success' : 'bg-muted text-muted-foreground',
          )}
        >
          {isValid ? <ShieldCheck className="h-7 w-7" aria-hidden /> : <ShieldX className="h-7 w-7" aria-hidden />}
        </div>
        <h1 className="mt-4 text-2xl font-bold">{t('warranty.title')}</h1>
        <p className="mt-1 text-sm text-muted-foreground" data-testid="warranty-standing">{standing}</p>
      </header>

      <dl className="mt-8 grid gap-4 border-y py-6 sm:grid-cols-2">
        <Entry label={t('warranty.customer')}>{customer.name}</Entry>
        <Entry label={t('warranty.job')}><span className="tabular-nums">{job.number}</span></Entry>
        <Entry label={t('warranty.work')} wide>{job.title}</Entry>
        <Entry label={t('warranty.completed')}>
          {job.actualEnd ? <span className="tabular-nums">{formatDateAdBs(job.actualEnd, { locale })}</span> : null}
        </Entry>
        <Entry label={t('warranty.coversUntil')}>
          {endsAt ? <span className="tabular-nums" data-testid="warranty-covers-until">{formatDateAdBs(endsAt, { locale })}</span> : null}
        </Entry>
        {scope ? (
          <div className="sm:col-span-2">
            <dt className="text-xs uppercase tracking-wide text-muted-foreground">{t('warranty.scope')}</dt>
            <dd className="mt-0.5 text-sm text-muted-foreground">{scope}</dd>
          </div>
        ) : null}
      </dl>
    </>
  );
}
