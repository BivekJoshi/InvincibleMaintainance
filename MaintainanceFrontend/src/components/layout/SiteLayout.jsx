import { useEffect, useRef, useState } from 'react';
import { Outlet, Link, NavLink, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import {
  Phone, Menu, X, MessageCircle, Moon, Sun, Search, CalendarCheck, Mail, MapPin, ChevronRight,
  LogIn, LayoutDashboard,
} from 'lucide-react';
import { AnimatePresence, motion, ScrollProgress, BackToTop } from '@/three/motion';
import { useGetBootstrapQuery } from '@/api/publicApi';
import { useAuth } from '@/hooks/useAuth';
import { FIELD_ROLES } from '@/config/constants';
import { selectLocale, setLocale, selectTheme, setTheme } from '@/redux/slices/uiSlice';
import { Button } from '@/components/ui/button';
import { DataIcon } from '@/components/site';
import { cn } from '@/helpers/utils';

const NAV = [
  { to: '/services', label: 'All services' },
  { to: '/projects', label: 'Our work' },
  { to: '/pricing', label: 'Pricing' },
  { to: '/contact', label: 'Contact' },
];

const PROMISES = ['Free inspection', '2-hour response', '1-month warranty'];

/**
 * The public shell, built like a storefront: the search field and the category
 * rail are part of the header, so browsing is available from every page rather
 * than only from the home page.
 */
export function SiteLayout() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const locale = useSelector(selectLocale);
  const theme = useSelector(selectTheme);
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const { pathname } = useLocation();
  const [params] = useSearchParams();
  const { data } = useGetBootstrapQuery(locale);
  const { isAuthenticated, role } = useAuth();
  const s = data?.settings ?? {};

  // Staff who are already signed in get a way back into their own app rather
  // than a login form that would only bounce them onward.
  const appHome = FIELD_ROLES.includes(role) ? '/tech' : '/admin';

  const phone = s['contact.phonePrimary'] ?? '01-5407720';
  const mobile = s['contact.phoneSecondary'] ?? '9808338255';
  const company = s['contact.companyName'] ?? 'Ghar Jatan';
  const categories = data?.nav?.categories ?? [];

  useEffect(() => setOpen(false), [pathname]);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const search = (q) => navigate(q ? `/services?q=${encodeURIComponent(q)}` : '/services');

  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <ScrollProgress />

      <div className="hidden border-b bg-muted/60 md:block">
        <div className="container flex h-9 items-center justify-between text-xs text-muted-foreground">
          <p className="flex items-center gap-3">
            {PROMISES.map((p, i) => (
              <span key={p} className="flex items-center gap-3">
                {i ? <span className="h-1 w-1 rounded-full bg-gold" aria-hidden /> : null}
                {p}
              </span>
            ))}
          </p>
          <div className="flex items-center gap-5">
            <a href={`tel:${phone}`} className="transition-colors hover:text-foreground">{phone}</a>
            <a href={`tel:${mobile}`} className="transition-colors hover:text-foreground">{mobile}</a>
          </div>
        </div>
      </div>

      <header
        className={cn(
          'sticky top-0 z-40 border-b bg-background/95 supports-[backdrop-filter]:bg-background/80 supports-[backdrop-filter]:backdrop-blur',
          scrolled && 'shadow-[0_1px_12px_-6px_hsl(var(--ink)/0.35)]',
        )}
      >
        <div className="container flex h-16 items-center gap-4">
          <Link to="/" className="flex shrink-0 items-center gap-2.5">
            <span className="grid h-9 w-9 place-items-center rounded-md bg-primary text-sm font-bold text-primary-foreground">
              {company.trim()[0]?.toUpperCase() ?? 'H'}
            </span>
            <span className="max-w-[8.5rem] truncate text-[15px] font-bold leading-none tracking-tight sm:max-w-none">{company}</span>
          </Link>

          <SearchField className="hidden flex-1 md:block" onSearch={search} defaultValue={params.get('q') ?? ''} />

          <nav className="hidden items-center gap-1 lg:flex">
            {NAV.slice(1).map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) => cn(
                  'rounded-md px-3 py-2 text-sm font-medium transition-colors',
                  isActive ? 'text-primary' : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {item.label}
              </NavLink>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-1 md:ml-0">
            <button
              type="button"
              onClick={() => dispatch(setLocale(locale === 'en' ? 'ne' : 'en'))}
              className="rounded-md px-2 py-1.5 text-xs font-semibold text-muted-foreground transition-colors hover:text-foreground"
              aria-label="Switch language"
            >
              {locale === 'en' ? 'नेपाली' : 'EN'}
            </button>
            <Button
              variant="ghost" size="icon"
              onClick={() => dispatch(setTheme(theme === 'dark' ? 'light' : 'dark'))}
              aria-label="Toggle theme"
            >
              <Sun className="h-4 w-4 dark:hidden" />
              <Moon className="hidden h-4 w-4 dark:block" />
            </Button>
            <Button asChild variant="ghost" size="sm" className="hidden md:inline-flex">
              <Link to={isAuthenticated ? appHome : '/login'}>
                {isAuthenticated
                  ? <><LayoutDashboard className="h-4 w-4" /> Dashboard</>
                  : <><LogIn className="h-4 w-4" /> Log in</>}
              </Link>
            </Button>
            <Button asChild size="sm" className="hidden sm:inline-flex">
              <Link to="/book"><CalendarCheck className="h-4 w-4" /> Book a visit</Link>
            </Button>
            <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setOpen((v) => !v)} aria-label="Menu" aria-expanded={open}>
              {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </Button>
          </div>
        </div>

        {/* Category rail — the storefront's aisles, available on every page. */}
        {categories.length ? (
          <div className="border-t bg-background/60">
            <div className="container no-scrollbar flex items-center gap-1 overflow-x-auto py-1.5">
              <CategoryLink to="/services" active={pathname === '/services' && !params.get('category')}>
                All work
              </CategoryLink>
              {categories.map((c) => (
                <CategoryLink key={c.id} to={`/services?category=${c.slug}`} active={params.get('category') === c.slug} icon={c.icon}>
                  {c.name}
                </CategoryLink>
              ))}
            </div>
          </div>
        ) : null}

        <div className="container pb-3 md:hidden">
          <SearchField onSearch={search} defaultValue={params.get('q') ?? ''} />
        </div>

        <AnimatePresence>
          {open ? (
            <motion.nav
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
              className="overflow-hidden border-t lg:hidden"
            >
              <div className="container flex flex-col py-2">
                {NAV.map((item, i) => (
                  <motion.div
                    key={item.to}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.04 + i * 0.05, duration: 0.28 }}
                  >
                    <NavLink to={item.to} className="flex items-center justify-between border-b py-3 text-[15px] font-medium">
                      {item.label} <ChevronRight className="h-4 w-4 text-muted-foreground" aria-hidden />
                    </NavLink>
                  </motion.div>
                ))}
                <motion.div
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.04 + NAV.length * 0.05, duration: 0.28 }}
                >
                  <Link
                    to={isAuthenticated ? appHome : '/login'}
                    className="flex items-center justify-between border-b py-3 text-[15px] font-medium"
                  >
                    <span className="flex items-center gap-2">
                      {isAuthenticated
                        ? <><LayoutDashboard className="h-4 w-4 text-muted-foreground" aria-hidden /> Dashboard</>
                        : <><LogIn className="h-4 w-4 text-muted-foreground" aria-hidden /> Staff login</>}
                    </span>
                    <ChevronRight className="h-4 w-4 text-muted-foreground" aria-hidden />
                  </Link>
                </motion.div>
                <div className="flex gap-3 py-4">
                  <Button asChild className="flex-1"><Link to="/book">Book a visit</Link></Button>
                  <Button asChild variant="outline" className="flex-1"><a href={`tel:${mobile}`}>Call us</a></Button>
                </div>
              </div>
            </motion.nav>
          ) : null}
        </AnimatePresence>
      </header>

      <main className="flex-1"><Outlet /></main>

      <footer className="ink-panel mt-auto">
        <div className="container grid gap-10 py-14 text-sm md:grid-cols-2 lg:grid-cols-12">
          <div className="lg:col-span-4">
            <div className="flex items-center gap-2.5">
              <span className="grid h-9 w-9 place-items-center rounded-md bg-gold text-sm font-bold text-gold-foreground">
                {company.trim()[0]?.toUpperCase() ?? 'H'}
              </span>
              <span className="text-[15px] font-bold tracking-tight">{company}</span>
            </div>
            <p className="mt-4 max-w-xs leading-relaxed text-ink-muted">
              {s['branding.tagline'] ?? 'Certified engineers. Transparent pricing. Two-hour response.'}
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              {PROMISES.map((p) => (
                <span key={p} className="rounded-full border border-ink-foreground/15 px-3 py-1 text-[11px] text-ink-muted">{p}</span>
              ))}
            </div>
          </div>

          <div className="lg:col-span-3">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-gold">Contact</p>
            <ul className="mt-4 space-y-3 text-ink-muted">
              <li><a href={`tel:${phone}`} className="flex items-center gap-3 hover:text-ink-foreground"><Phone className="h-3.5 w-3.5 text-gold" aria-hidden /> {phone}</a></li>
              <li><a href={`tel:${mobile}`} className="flex items-center gap-3 hover:text-ink-foreground"><Phone className="h-3.5 w-3.5 text-gold" aria-hidden /> {mobile}</a></li>
              <li><a href={`mailto:${s['contact.email']}`} className="flex items-center gap-3 hover:text-ink-foreground"><Mail className="h-3.5 w-3.5 text-gold" aria-hidden /> {s['contact.email']}</a></li>
              <li className="flex items-start gap-3"><MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-gold" aria-hidden /> {s['contact.address']}</li>
            </ul>
          </div>

          <div className="lg:col-span-3">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-gold">Browse</p>
            <ul className="mt-4 space-y-2.5 text-ink-muted">
              {categories.map((c) => (
                <li key={c.id}>
                  <Link to={`/services?category=${c.slug}`} className="hover:text-ink-foreground">{c.name}</Link>
                </li>
              ))}
            </ul>
          </div>

          <div className="lg:col-span-2">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-gold">Company</p>
            <ul className="mt-4 space-y-2.5 text-ink-muted">
              <li><Link to="/book" className="hover:text-ink-foreground">Book a visit</Link></li>
              {NAV.map((n) => <li key={n.to}><Link to={n.to} className="hover:text-ink-foreground">{n.label}</Link></li>)}
              <li>
                <Link to={isAuthenticated ? appHome : '/login'} className="hover:text-ink-foreground">
                  {isAuthenticated ? 'Dashboard' : 'Staff login'}
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <div className="border-t border-ink-foreground/10">
          <div className="container flex flex-col gap-2 py-5 text-xs text-ink-muted sm:flex-row sm:items-center sm:justify-between">
            <p>© {new Date().getFullYear()} {company}. All rights reserved.</p>
            <p>{s['contact.city'] ?? 'Lalitpur'}, Nepal · Serving Kathmandu Valley</p>
          </div>
        </div>
      </footer>

      {/* Most traffic is mobile Kathmandu users — booking and calling stay one tap away. */}
      <div className="fixed inset-x-0 bottom-0 z-40 flex gap-2 border-t bg-background/95 px-3 py-2.5 backdrop-blur md:hidden">
        <Button asChild className="flex-1"><Link to="/book"><CalendarCheck className="h-4 w-4" /> Book a visit</Link></Button>
        <Button asChild variant="outline" size="icon" className="h-9 w-11"><a href={`tel:${mobile}`} aria-label="Call"><Phone className="h-4 w-4" /></a></Button>
        <Button asChild variant="outline" size="icon" className="h-9 w-11">
          <a href={`viber://chat?number=%2B977${mobile}`} aria-label="Viber"><MessageCircle className="h-4 w-4" /></a>
        </Button>
      </div>
      <div className="h-16 md:hidden" aria-hidden />

      <BackToTop />
    </div>
  );
}

/** The storefront search box. Submits to the catalogue; never filters in place. */
function SearchField({ className, onSearch, defaultValue = '' }) {
  const ref = useRef(null);

  useEffect(() => {
    if (ref.current) ref.current.value = defaultValue;
  }, [defaultValue]);

  return (
    <form
      className={cn('relative', className)}
      onSubmit={(e) => { e.preventDefault(); onSearch(ref.current?.value.trim() ?? ''); }}
      role="search"
    >
      <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
      <input
        ref={ref}
        type="search"
        name="q"
        defaultValue={defaultValue}
        placeholder="Search a service — seepage, kitchen, wiring…"
        aria-label="Search services"
        className="h-10 w-full rounded-full border bg-muted/50 pl-10 pr-24 text-sm outline-none transition-colors placeholder:text-muted-foreground focus:border-primary focus:bg-background"
      />
      <Button type="submit" size="sm" className="absolute right-1 top-1 h-8 rounded-full px-4">Search</Button>
    </form>
  );
}

function CategoryLink({ to, active, icon, children }) {
  return (
    <Link
      to={to}
      className={cn(
        'flex shrink-0 items-center gap-2 rounded-full px-3.5 py-1.5 text-[13px] font-medium transition-colors',
        active ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted hover:text-foreground',
      )}
    >
      {icon ? <DataIcon name={icon} className="h-3.5 w-3.5" /> : null}
      {children}
    </Link>
  );
}
