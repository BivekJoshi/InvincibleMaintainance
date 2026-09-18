import { Link } from 'react-router-dom';
import { Mail, MapPin, MessageCircle, Phone } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useSiteSettings } from '@/hooks/useSiteSettings';
import { FIELD_ROLES } from '@/config/constants';
import { PromiseList } from '@/components/site/PromiseList';
import { BrandMark } from '@/components/site/BrandMark';

/** A Nepali mobile as stored (`9808338255`, `+977 980…`) → `9779808338255` for chat links. */
const intlDigits = (phone) => `977${String(phone).replace(/\D/g, '').replace(/^977/, '')}`;

/** One contact line. `href` is optional — an address is not something to dial. */
function ContactLine({ icon: Icon, children, href, align = 'center' }) {
  const body = (
    <>
      <Icon
        className={align === 'start' ? 'mt-0.5 h-3.5 w-3.5 shrink-0 text-gold' : 'h-3.5 w-3.5 shrink-0 text-gold'}
        aria-hidden
      />
      {children}
    </>
  );
  const className = `flex gap-3 ${align === 'start' ? 'items-start' : 'items-center'}`;
  return href
    ? <a href={href} className={`${className} transition-colors hover:text-ink-foreground`}>{body}</a>
    : <span className={className}>{body}</span>;
}

/**
 * The dark foot of every public page: who we are, how to reach us, and the two
 * lists a visitor might still be looking for. Everything it shows comes from
 * `useSiteSettings`, so the phone number here is the phone number in the header.
 */
export function SiteFooter() {
  const {
    name: company, initial, logoUrl, tagline, phone, mobile, email, address, city, whatsapp, viber, social, categories, nav,
  } = useSiteSettings();
  const { isAuthenticated, role } = useAuth();
  const appHome = FIELD_ROLES.includes(role) ? '/tech' : '/admin';

  return (
    <footer className="ink-panel mt-auto">
      <div className="container grid gap-10 py-14 text-sm md:grid-cols-2 lg:grid-cols-12">
        <div className="lg:col-span-4">
          <div className="flex items-center gap-2.5">
            <BrandMark logoUrl={logoUrl} initial={initial} className="h-9 w-9 rounded-md bg-gold text-sm font-bold text-gold-foreground" />
            <span className="text-[15px] font-bold tracking-tight">{company}</span>
          </div>
          <p className="mt-4 max-w-xs leading-relaxed text-ink-muted">{tagline}</p>
          <PromiseList variant="chips" tone="ink" className="mt-5" />
          {social.length ? (
            <ul className="mt-5 flex flex-wrap gap-2" aria-label="Follow us">
              {social.map((s) => (
                <li key={s.key}>
                  <a
                    href={s.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex rounded-md border border-ink-foreground/15 px-2.5 py-1 text-xs text-ink-muted transition-colors hover:border-gold/50 hover:text-ink-foreground"
                  >
                    {s.label}
                  </a>
                </li>
              ))}
            </ul>
          ) : null}
        </div>

        <div className="lg:col-span-3">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-gold">Contact</p>
          <ul className="mt-4 space-y-3 text-ink-muted">
            <li><ContactLine icon={Phone} href={`tel:${phone}`}>{phone}</ContactLine></li>
            <li><ContactLine icon={Phone} href={`tel:${mobile}`}>{mobile}</ContactLine></li>
            {whatsapp ? (
              <li><ContactLine icon={MessageCircle} href={`https://wa.me/${intlDigits(whatsapp)}`}>WhatsApp {whatsapp}</ContactLine></li>
            ) : null}
            {viber ? (
              <li><ContactLine icon={MessageCircle} href={`viber://chat?number=%2B${intlDigits(viber)}`}>Viber {viber}</ContactLine></li>
            ) : null}
            {email ? <li><ContactLine icon={Mail} href={`mailto:${email}`}>{email}</ContactLine></li> : null}
            {address ? <li><ContactLine icon={MapPin} align="start">{address}</ContactLine></li> : null}
          </ul>
        </div>

        <div className="lg:col-span-3">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-gold">Browse</p>
          <ul className="mt-4 space-y-2.5 text-ink-muted">
            {categories.map((c) => (
              <li key={c.id}>
                <Link to={`/services?category=${c.slug}`} className="transition-colors hover:text-ink-foreground">{c.name}</Link>
              </li>
            ))}
          </ul>
        </div>

        <div className="lg:col-span-2">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-gold">Company</p>
          <ul className="mt-4 space-y-2.5 text-ink-muted">
            <li><Link to="/book" className="transition-colors hover:text-ink-foreground">Book a visit</Link></li>
            {nav.map((n) => (
              <li key={n.to}><Link to={n.to} className="transition-colors hover:text-ink-foreground">{n.label}</Link></li>
            ))}
            <li>
              <Link to={isAuthenticated ? appHome : '/login'} className="transition-colors hover:text-ink-foreground">
                {isAuthenticated ? 'Dashboard' : 'Staff login'}
              </Link>
            </li>
          </ul>
        </div>
      </div>

      <div className="border-t border-ink-foreground/10">
        <div className="container flex flex-col gap-2 py-5 text-xs text-ink-muted sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} {company}. All rights reserved.</p>
          <p>{city}, Nepal · Serving Kathmandu Valley</p>
        </div>
      </div>
    </footer>
  );
}
