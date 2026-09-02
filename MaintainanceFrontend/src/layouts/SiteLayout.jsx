import { useEffect, useState } from 'react';
import { Outlet, Link, NavLink, useLocation } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { Phone, Menu, X, MessageCircle, Moon, Sun, ArrowUpRight, Mail, MapPin } from 'lucide-react';
import { AnimatePresence, motion, ScrollProgress, BackToTop } from '@/components/motion';
import { useGetBootstrapQuery } from '@/features/public/publicApi';
import { selectLocale, setLocale, selectTheme, setTheme } from '@/features/ui/uiSlice';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const NAV = [
  { to: '/services', label: 'Services' },
  { to: '/pricing', label: 'Pricing' },
  { to: '/contact', label: 'Contact' },
];

const PROMISES = ['Free consultation', '2-hour response', '1-month warranty'];

/**
 * The public shell. Masthead and footer are both ink, so the dark hero reads as
 * a continuation of the header rather than a second band — the seam that makes
 * most template sites look assembled rather than designed.
 */
export function SiteLayout() {
  const dispatch = useDispatch();
  const locale = useSelector(selectLocale);
  const theme = useSelector(selectTheme);
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const { pathname } = useLocation();
  const { data } = useGetBootstrapQuery(locale);
  const s = data?.settings ?? {};

  const phone = s['contact.phonePrimary'] ?? '01-5407720';
  const mobile = s['contact.phoneSecondary'] ?? '9808338255';
  const company = s['contact.companyName'] ?? 'Homeplex Nepal';
  const categories = data?.nav?.categories ?? [];

  // Close the mobile sheet whenever the route changes under it.
  useEffect(() => setOpen(false), [pathname]);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <div className="flex min-h-dvh flex-col">
      <ScrollProgress />

      {/* The promises the business makes, above everything else on the page. */}
      <div className="hidden border-b border-ink-foreground/10 bg-ink text-ink-muted md:block">
        <div className="container flex h-10 items-center justify-between text-xs">
          <p className="flex items-center gap-3">
            {PROMISES.map((p, i) => (
              <span key={p} className="flex items-center gap-3">
                {i ? <span className="h-1 w-1 rounded-full bg-gold/70" aria-hidden /> : null}
                {p}
              </span>
            ))}
          </p>
          <div className="flex items-center gap-5">
            <a href={`tel:${phone}`} className="transition-colors hover:text-ink-foreground">{phone}</a>
            <a href={`tel:${mobile}`} className="transition-colors hover:text-ink-foreground">{mobile}</a>
          </div>
        </div>
      </div>

      <header
        className={cn(
          'sticky top-0 z-40 bg-ink text-ink-foreground transition-shadow duration-300',
          scrolled && 'shadow-lift supports-[backdrop-filter]:bg-ink/90 supports-[backdrop-filter]:backdrop-blur',
        )}
      >
        <div className={cn(
          'container flex items-center justify-between gap-6 transition-[height] duration-300 ease-out',
          scrolled ? 'h-14 md:h-16' : 'h-16 md:h-[4.5rem]',
        )}>
          <Link to="/" className="group flex items-center gap-3">
            <motion.span
              className="relative grid h-9 w-9 place-items-center rounded-sm border border-gold/50 font-display text-[15px] font-semibold text-gold"
              whileHover={{ rotate: -6, scale: 1.06 }}
              transition={{ type: 'spring', stiffness: 320, damping: 15 }}
            >
              {company.trim()[0]?.toUpperCase() ?? 'H'}
            </motion.span>
            <span className="leading-none">
              <span className="block font-display text-[17px] font-semibold tracking-tight">{company}</span>
              <span className="eyebrow mt-1 hidden text-[9px] text-ink-muted sm:block">Engineered home services</span>
            </span>
          </Link>

          <nav className="hidden items-center gap-8 md:flex">
            {NAV.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) => cn(
                  'relative py-1 text-sm transition-colors',
                  isActive ? 'text-ink-foreground' : 'text-ink-muted hover:text-ink-foreground',
                )}
              >
                {({ isActive }) => (
                  <>
                    {item.label}
                    <span
                      className={cn(
                        'absolute -bottom-0.5 left-0 h-px w-full origin-left bg-gold transition-transform duration-300',
                        isActive ? 'scale-x-100' : 'scale-x-0',
                      )}
                      aria-hidden
                    />
                  </>
                )}
              </NavLink>
            ))}
          </nav>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => dispatch(setLocale(locale === 'en' ? 'ne' : 'en'))}
              className="rounded-sm px-2 py-1.5 text-xs font-medium text-ink-muted transition-colors hover:text-ink-foreground"
              aria-label="Switch language"
            >
              {locale === 'en' ? 'नेपाली' : 'EN'}
            </button>
            <button
              type="button"
              onClick={() => dispatch(setTheme(theme === 'dark' ? 'light' : 'dark'))}
              className="grid h-9 w-9 place-items-center rounded-sm text-ink-muted transition-colors hover:text-ink-foreground"
              aria-label="Toggle theme"
            >
              <Sun className="h-4 w-4 dark:hidden" />
              <Moon className="hidden h-4 w-4 dark:block" />
            </button>
            <Button asChild variant="gold" size="sm" className="ml-2 hidden sm:inline-flex">
              <Link to="/contact">Free inspection <ArrowUpRight className="h-4 w-4" /></Link>
            </Button>
            <button
              type="button"
              className="grid h-9 w-9 place-items-center rounded-sm text-ink-foreground md:hidden"
              onClick={() => setOpen((v) => !v)}
              aria-label="Menu"
              aria-expanded={open}
            >
              {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>

        <AnimatePresence>
          {open ? (
            <motion.nav
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
              className="overflow-hidden border-t border-ink-foreground/10 md:hidden"
            >
              <div className="container flex flex-col py-2">
                {NAV.map((item, i) => (
                  <motion.div
                    key={item.to}
                    initial={{ opacity: 0, x: -12 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.05 + i * 0.06, duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                  >
                    <NavLink
                      to={item.to}
                      className="flex items-center justify-between border-b border-ink-foreground/10 py-3.5 font-display text-lg"
                    >
                      {item.label} <ArrowUpRight className="h-4 w-4 text-gold" aria-hidden />
                    </NavLink>
                  </motion.div>
                ))}
                <div className="flex gap-3 py-4">
                  <Button asChild variant="gold" className="flex-1"><Link to="/contact">Free inspection</Link></Button>
                  <Button asChild variant="onInk" className="flex-1"><a href={`tel:${mobile}`}>Call us</a></Button>
                </div>
              </div>
            </motion.nav>
          ) : null}
        </AnimatePresence>
      </header>

      <main className="flex-1"><Outlet /></main>

      <footer className="ink-panel">
        <div className="h-px w-full bg-gradient-to-r from-transparent via-gold/50 to-transparent" aria-hidden />
        <div className="container grid gap-12 py-16 text-sm md:grid-cols-2 lg:grid-cols-12">
          <div className="lg:col-span-4">
            <div className="flex items-center gap-3">
              <span className="grid h-9 w-9 place-items-center rounded-sm border border-gold/50 font-display text-[15px] font-semibold text-gold">
                {company.trim()[0]?.toUpperCase() ?? 'H'}
              </span>
              <span className="font-display text-lg font-semibold">{company}</span>
            </div>
            <p className="mt-5 max-w-xs leading-relaxed text-ink-muted">
              {s['branding.tagline'] ?? 'Certified engineers. Transparent pricing. Two-hour response.'}
            </p>
            <div className="mt-6 flex flex-wrap gap-2">
              {PROMISES.map((p) => (
                <span key={p} className="rounded-full border border-ink-foreground/15 px-3 py-1 text-[11px] text-ink-muted">
                  {p}
                </span>
              ))}
            </div>
          </div>

          <div className="lg:col-span-3">
            <p className="eyebrow text-gold">Contact</p>
            <ul className="mt-5 space-y-3 text-ink-muted">
              <li>
                <a href={`tel:${phone}`} className="flex items-center gap-3 transition-colors hover:text-ink-foreground">
                  <Phone className="h-3.5 w-3.5 text-gold" aria-hidden /> {phone}
                </a>
              </li>
              <li>
                <a href={`tel:${mobile}`} className="flex items-center gap-3 transition-colors hover:text-ink-foreground">
                  <Phone className="h-3.5 w-3.5 text-gold" aria-hidden /> {mobile}
                </a>
              </li>
              <li>
                <a href={`mailto:${s['contact.email']}`} className="flex items-center gap-3 transition-colors hover:text-ink-foreground">
                  <Mail className="h-3.5 w-3.5 text-gold" aria-hidden /> {s['contact.email']}
                </a>
              </li>
              <li className="flex items-start gap-3">
                <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-gold" aria-hidden /> {s['contact.address']}
              </li>
            </ul>
          </div>

          <div className="lg:col-span-3">
            <p className="eyebrow text-gold">What we do</p>
            <ul className="mt-5 space-y-2.5 text-ink-muted">
              {categories.map((c) => (
                <li key={c.id}>
                  <Link to={`/services?category=${c.slug}`} className="transition-colors hover:text-ink-foreground">
                    {c.name}
                  </Link>
                </li>
              ))}
              {categories.length ? null : <li>Repair · Waterproofing · Interior · Construction</li>}
            </ul>
          </div>

          <div className="lg:col-span-2">
            <p className="eyebrow text-gold">Company</p>
            <ul className="mt-5 space-y-2.5 text-ink-muted">
              {NAV.map((n) => (
                <li key={n.to}><Link to={n.to} className="transition-colors hover:text-ink-foreground">{n.label}</Link></li>
              ))}
              <li><Link to="/login" className="transition-colors hover:text-ink-foreground">Staff login</Link></li>
            </ul>
          </div>
        </div>

        <div className="border-t border-ink-foreground/10">
          <div className="container flex flex-col gap-2 py-6 text-xs text-ink-muted sm:flex-row sm:items-center sm:justify-between">
            <p>© {new Date().getFullYear()} {company}. All rights reserved.</p>
            <p>{s['contact.city'] ?? 'Lalitpur'}, Nepal · Serving Kathmandu Valley</p>
          </div>
        </div>
      </footer>

      {/* Most traffic is mobile Kathmandu users — keep calling one tap away. */}
      <div className="fixed inset-x-0 bottom-0 z-40 flex border-t border-ink-foreground/10 bg-ink/95 backdrop-blur md:hidden">
        <a href={`tel:${mobile}`} className="flex flex-1 items-center justify-center gap-2 py-4 text-sm font-semibold text-gold">
          <Phone className="h-4 w-4" /> Call now
        </a>
        <a
          href={`viber://chat?number=%2B977${mobile}`}
          className="flex flex-1 items-center justify-center gap-2 border-l border-ink-foreground/10 py-4 text-sm font-semibold text-ink-foreground"
        >
          <MessageCircle className="h-4 w-4" /> Viber
        </a>
      </div>
      <div className="h-14 md:hidden" aria-hidden />

      <BackToTop />
    </div>
  );
}
