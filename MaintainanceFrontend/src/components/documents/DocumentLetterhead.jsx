import { imageUrl } from '@/helpers/format';

/**
 * The company as a document states it (Phase L4): logo, name, tagline, address, phones, email and the PAN/VAT
 * number — the API's `letterhead` (from the `contact.*`, `branding.*` and `finance.panVatNo` settings), so the
 * customer's page, the print and J2's PDFs all read one source. Phones are call links on a phone.
 *
 * @param {{ letterhead?: { companyName: string, address?: string|null, city?: string|null, phones?: string[],
 *   email?: string|null, panVatNo?: string|null, logo?: object|null, tagline?: string|null }|null,
 *   copy: { panVat: string, phone: string, email: string } }} props
 */
export function DocumentLetterhead({ letterhead, copy }) {
  if (!letterhead?.companyName) return null;
  const { companyName, address, city, phones = [], email, panVatNo, logo, tagline } = letterhead;
  const logoSrc = imageUrl(logo, 400);
  const place = [address, city].filter(Boolean).join(', ');

  return (
    <div className="mb-6 flex flex-wrap items-start gap-x-6 gap-y-3 border-b pb-5" data-testid="letterhead">
      {logoSrc ? (
        <img src={logoSrc} alt={logo?.alt || companyName} className="h-12 w-auto max-w-[9rem] object-contain" />
      ) : null}
      <div className="min-w-0 flex-1 basis-48">
        <p className="text-lg font-bold leading-tight">{companyName}</p>
        {tagline ? <p className="text-xs text-muted-foreground">{tagline}</p> : null}
        {place ? <p className="mt-1 text-xs text-muted-foreground">{place}</p> : null}
        {/* Phones on one line, the email on its own (on a phone it would otherwise break mid-address; in print, beside them). */}
        <p className="text-xs text-muted-foreground">
          {phones.length ? (
            <>
              <span className="sr-only">{copy.phone}: </span>
              {phones.map((p, i) => (
                <span key={p}>
                  {i ? ' · ' : ''}
                  <a href={`tel:${p.replace(/[^\d+]/g, '')}`} className="whitespace-nowrap tabular-nums hover:text-primary hover:underline">{p}</a>
                </span>
              ))}
            </>
          ) : null}
          {email ? (
            <span className="block sm:inline print:inline">
              {phones.length ? <span className="hidden sm:inline print:inline"> · </span> : null}
              <span className="sr-only">{copy.email}: </span>
              <a href={`mailto:${email}`} className="hover:text-primary hover:underline [overflow-wrap:anywhere]">{email}</a>
            </span>
          ) : null}
        </p>
      </div>
      {panVatNo ? (
        <p className="text-xs">
          <span className="text-muted-foreground">{copy.panVat}</span> <span className="font-semibold tabular-nums">{panVatNo}</span>
        </p>
      ) : null}
    </div>
  );
}
