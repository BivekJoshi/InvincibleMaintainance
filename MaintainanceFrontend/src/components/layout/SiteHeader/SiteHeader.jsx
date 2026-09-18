import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, NavLink, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import {
  ArrowRight, CalendarCheck, ChevronDown, LayoutDashboard, LogIn, Menu, Search,
} from 'lucide-react';
import { AnimatePresence, motion, useReducedMotion } from '@/three/motion/motionKit';
import { useAuth } from '@/hooks/useAuth';
import { useSiteSettings } from '@/hooks/useSiteSettings';
import { BrandMark } from '@/components/site/BrandMark';
import { FIELD_ROLES } from '@/config/constants';
import { preloadPath } from '@/routes/routeModules';
import { Button } from '@/components/ui/button';
import { LocaleSwitch } from '@/components/common/LocaleSwitch';
import { ThemeToggle } from '@/components/theme/ThemeToggle';
import { cn } from '@/helpers/utils';
import { HeaderSearch } from './HeaderSearch';
import { MegaPanel } from './MegaPanel';
import { MobileDrawer } from './MobileDrawer';
import { UtilityStrip } from './UtilityStrip';

// One spring for every indicator that slides. Shared so the pill and the
// underline move with the same weight.
const SLIDE = { type: 'spring', stiffness: 420, damping: 34, mass: 0.7 };

/**
 * The public header — the bar itself, and the state the panels under it share.
 *
 * Three rows became one. The trade list that used to sit in a permanent rail
 * under the bar now lives in `MegaPanel`, opened from "Services", so the
 * landing page opens with a single 64px bar over the hero instead of a stack of
 * chrome — and browsing is still one hover away from every page.
 *
 * What is left in this file is what the bar itself has to know: which link the
 * pill is under, whether the page has scrolled, and which panel is open. The
 * panels, the search box and the utility strip are their own files beside it.
 *
 * Everything that moves here moves on transform or opacity only, and every
 * animation collapses to a cut under `prefers-reduced-motion`.
 */
export function SiteHeader() {
  const navigate = useNavigate();
  const reduced = useReducedMotion();
  const { pathname, search: qs } = useLocation();
  const [params] = useSearchParams();
  const { name: company, initial, logoUrl, phone, mobile, categories, nav } = useSiteSettings();
  const { isAuthenticated, role } = useAuth();

  const [scrolled, setScrolled] = useState(false);
  const [hovered, setHovered] = useState(null);
  const [mega, setMega] = useState(false);
  const [drawer, setDrawer] = useState(null);   // null | 'menu' | 'search'

  const searchRef = useRef(null);
  const closeTimer = useRef(null);

  // Staff who are already signed in get a way back into their own app rather
  // than a login form that would only bounce them onward.
  const appHome = FIELD_ROLES.includes(role) ? '/tech' : '/admin';
  const query = params.get('q') ?? '';

  const activeTo = nav.find((n) => pathname === n.to || pathname.startsWith(`${n.to}/`))?.to ?? null;
  // The pill parks on the trade panel's trigger while that panel is open, so
  // the two read as one object even once the pointer has left the bar.
  const megaTo = nav.find((n) => n.mega)?.to ?? null;
  const pillAt = hovered ?? (mega ? megaTo : null) ?? activeTo ?? nav[0].to;
  const pillLit = Boolean(hovered) || mega;
  const transition = reduced ? { duration: 0 } : SLIDE;

  const openMega = useCallback(() => {
    clearTimeout(closeTimer.current);
    setMega(true);
  }, []);

  // A short grace period: the pointer has to cross a gap to reach the panel,
  // and closing the instant it leaves the trigger makes that gap a trap.
  const closeMega = useCallback((delay = 140) => {
    clearTimeout(closeTimer.current);
    closeTimer.current = setTimeout(() => setMega(false), delay);
  }, []);

  useEffect(() => () => clearTimeout(closeTimer.current), []);

  useEffect(() => { setDrawer(null); setMega(false); }, [pathname, qs]);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Escape closes whatever is open; "/" jumps to the search box the way every
  // catalogue the visitor already uses does.
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') { setMega(false); setDrawer(null); return; }
      const el = e.target;
      const typing = el?.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el?.tagName ?? '');
      if (e.key === '/' && !typing) { e.preventDefault(); searchRef.current?.focus(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // The drawer is a modal surface; the page behind it must not scroll under it.
  useEffect(() => {
    if (!drawer) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [drawer]);

  const search = (q) => {
    setDrawer(null);
    navigate(q ? `/services?q=${encodeURIComponent(q)}` : '/services');
  };

  return (
    <>
      <UtilityStrip phone={phone} mobile={mobile} />

      <header
        className={cn(
          'sticky top-0 z-40 border-b transition-[background-color,border-color,box-shadow] duration-300',
          scrolled
            ? 'border-border/80 bg-background/80 shadow-[0_18px_40px_-32px_hsl(var(--ink)/0.75)] supports-[backdrop-filter]:backdrop-blur-xl'
            : 'border-border/40 bg-background',
        )}
      >
        {/* A hairline of brass that lights up once the page is under way. */}
        <span
          aria-hidden
          className={cn(
            'pointer-events-none absolute inset-x-0 bottom-[-1px] h-px bg-gradient-to-r from-transparent via-gold/60 to-transparent transition-opacity duration-500',
            scrolled ? 'opacity-100' : 'opacity-0',
          )}
        />

        <div className="container flex h-16 items-center gap-2">
          <Link to="/" className="group flex shrink-0 items-center gap-2.5" aria-label={`${company} — home`}>
            <BrandMark
              logoUrl={logoUrl}
              initial={initial}
              className="relative h-9 w-9 overflow-hidden rounded-lg bg-primary text-sm font-bold text-primary-foreground shadow-hairline"
            >
              <span
                aria-hidden
                className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/35 to-transparent transition-transform duration-700 group-hover:translate-x-full"
              />
            </BrandMark>
            <span className="max-w-[9rem] truncate text-[15px] font-bold leading-none tracking-tight sm:max-w-none">
              {company}
            </span>
          </Link>

          <nav
            className="ml-6 hidden items-center lg:flex"
            onMouseLeave={() => setHovered(null)}
            aria-label="Main"
          >
            {nav.map((item) => {
              const isActive = activeTo === item.to;
              const hasMega = item.mega && categories.length > 0;
              const showPill = pillAt === item.to;

              return (
                <div
                  key={item.to}
                  className="relative"
                  onMouseEnter={() => { preloadPath(item.to); setHovered(item.to); if (hasMega) openMega(); else setMega(false); }}
                  onFocus={() => { preloadPath(item.to); return hasMega ? openMega() : setMega(false); }}
                  onBlur={() => hasMega && closeMega()}
                >
                  {/* One pill for the whole row: it slides between items rather
                      than fading in and out under each of them. */}
                  {showPill ? (
                    <motion.span
                      layoutId="site-nav-pill"
                      aria-hidden
                      className="absolute inset-0 rounded-full bg-muted"
                      initial={false}
                      animate={{ opacity: pillLit ? 1 : 0 }}
                      transition={{ ...transition, opacity: { duration: reduced ? 0 : 0.18 } }}
                    />
                  ) : null}

                  <NavLink
                    to={item.to}
                    onMouseLeave={hasMega ? () => closeMega() : undefined}
                    className={cn(
                      'relative flex items-center gap-1 rounded-full px-3.5 py-2 text-sm font-medium transition-colors',
                      isActive ? 'text-foreground' : 'text-muted-foreground hover:text-foreground',
                    )}
                    aria-expanded={hasMega ? mega : undefined}
                  >
                    {item.label}
                    {hasMega ? (
                      <ChevronDown
                        aria-hidden
                        className={cn('h-3.5 w-3.5 opacity-60 transition-transform duration-300', mega && 'rotate-180')}
                      />
                    ) : null}
                  </NavLink>

                  {isActive ? (
                    <motion.span
                      layoutId="site-nav-active"
                      aria-hidden
                      className="absolute inset-x-3.5 -bottom-0.5 h-[2px] rounded-full bg-gold"
                      transition={transition}
                    />
                  ) : null}
                </div>
              );
            })}
          </nav>

          <div className="ml-auto flex items-center gap-1.5">
            <HeaderSearch ref={searchRef} className="hidden lg:block" defaultValue={query} onSearch={search} />

            <Button
              variant="ghost" size="icon" className="lg:hidden"
              onClick={() => setDrawer('search')} aria-label="Search services"
            >
              <Search className="h-[18px] w-[18px]" />
            </Button>

            <LocaleSwitch className="hidden md:flex" />

            <ThemeToggle />

            <Button asChild variant="ghost" size="sm" className="hidden px-2 lg:inline-flex xl:px-3">
              <Link to={isAuthenticated ? appHome : '/login'}>
                {isAuthenticated ? <LayoutDashboard className="h-4 w-4" /> : <LogIn className="h-4 w-4" />}
                <span className="hidden xl:inline">{isAuthenticated ? 'Dashboard' : 'Log in'}</span>
              </Link>
            </Button>

            <Button asChild size="sm" className="group hidden shadow-hairline sm:inline-flex">
              <Link to="/book">
                <CalendarCheck className="h-4 w-4" />
                Book a visit
                <ArrowRight className="h-3.5 w-3.5 -translate-x-1 opacity-0 transition-all duration-300 group-hover:translate-x-0 group-hover:opacity-100" />
              </Link>
            </Button>

            <Button
              variant="ghost" size="icon" className="lg:hidden"
              onClick={() => setDrawer((d) => (d ? null : 'menu'))}
              aria-label="Menu" aria-expanded={drawer === 'menu'} aria-controls="site-drawer"
            >
              <Menu className="h-5 w-5" />
            </Button>
          </div>
        </div>

        <AnimatePresence>
          {mega ? (
            <MegaPanel
              key="mega"
              categories={categories}
              reduced={reduced}
              onEnter={openMega}
              onLeave={() => closeMega()}
            />
          ) : null}
        </AnimatePresence>
      </header>

      <AnimatePresence>
        {drawer ? (
          <MobileDrawer
            key="drawer"
            reduced={reduced}
            focusSearch={drawer === 'search'}
            query={query}
            categories={categories}
            nav={nav}
            company={company}
            phone={phone}
            mobile={mobile}
            isAuthenticated={isAuthenticated}
            appHome={appHome}
            activeTo={activeTo}
            onSearch={search}
            onClose={() => setDrawer(null)}
          />
        ) : null}
      </AnimatePresence>
    </>
  );
}
