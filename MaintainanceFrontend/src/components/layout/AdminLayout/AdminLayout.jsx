import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ChevronDown, ExternalLink, HardHat, LogOut, Menu, Search } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { useAuth } from '@/hooks/useAuth';
import { useIdlePreload } from '@/hooks/useIdlePreload';
import { usePaletteHotkey } from '@/hooks/usePaletteHotkey';
import { PageOutlet } from '@/routes/PageOutlet';
import { useLogoutMutation } from '@/api/authApi';
import { Button } from '@/components/ui/button';
import { ThemeToggle } from '@/components/theme/ThemeToggle';
import { ThemeModeSwitch } from '@/components/theme/ThemeModeSwitch';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { Kbd } from '@/components/common/Kbd';
import { breadcrumbsFor } from '@/config/admin/adminNav';
import { MOD_KEY } from '@/helpers/keys';
import {
  selectMobileNavOpen, selectSidebarOpen, setCommandOpen, setMobileNav, toggleSidebar,
} from '@/redux/slices/uiSlice';
import { initials } from '@/helpers/format';
import { cn } from '@/helpers/utils';
import { AdminBreadcrumb } from './AdminBreadcrumb';
import { AdminSidebar } from './AdminSidebar';
import { CommandPalette } from './CommandPalette';
import { NotificationPanel } from './NotificationPanel';
import { NotesSheet } from './NotesSheet';
import { ShortcutBar } from './ShortcutBar';

const EASE = [0.16, 1, 0.3, 1];

/** Kathmandu's time, whatever the browser's clock says — the office runs on it. */
function KathmanduClock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(id);
  }, []);
  const time = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kathmandu' }).format(now);
  const day = new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'Asia/Kathmandu' }).format(now);
  return (
    <span className="hidden flex-col items-end leading-tight xl:flex" title="Time in Kathmandu">
      <span className="text-sm font-semibold tabular-nums">{time}</span>
      <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{day} · KTM</span>
    </span>
  );
}

/** The top bar's left side: the trail on a wide screen, just the screen's name on a phone. */
function PageHeading() {
  const { pathname } = useLocation();
  const screen = breadcrumbsFor(pathname).find((c) => c.to)?.label;
  return (
    <>
      <AdminBreadcrumb className="hidden min-w-0 sm:block" />
      {screen ? <p className="min-w-0 truncate text-base font-bold tracking-tight sm:hidden">{screen}</p> : null}
    </>
  );
}

/**
 * The back office shell: an ink sidebar (folds to a rail), a top bar with the page heading,
 * search (Ctrl/⌘+K), notifications and the account menu, and under it a strip of the user's
 * own shortcuts and notes.
 */
export function AdminLayout() {
  useIdlePreload('admin');
  usePaletteHotkey();
  const dispatch = useDispatch();
  const { user, role } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [logout] = useLogoutMutation();
  const expanded = useSelector(selectSidebarOpen);
  const mobileOpen = useSelector(selectMobileNavOpen);

  const closeMobile = () => dispatch(setMobileNav(false));
  // A route change closes the drawer, however it happened.
  useEffect(() => { dispatch(setMobileNav(false)); }, [pathname, dispatch]);

  const onLogout = async () => {
    await logout().unwrap().catch(() => {});
    navigate('/login', { replace: true });
  };

  return (
    <div className="flex min-h-dvh bg-muted/30">
      {/* Desktop sidebar */}
      <motion.aside
        initial={false}
        animate={{ width: expanded ? 272 : 76 }}
        transition={{ duration: 0.3, ease: EASE }}
        className="sticky top-0 hidden h-dvh shrink-0 overflow-hidden border-r border-ink lg:block"
      >
        <AdminSidebar
          role={role} user={user} rail={!expanded} scope="desk"
          onToggleRail={() => dispatch(toggleSidebar())} onLogout={onLogout}
        />
      </motion.aside>

      {/* Mobile drawer */}
      <AnimatePresence>
        {mobileOpen ? (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={closeMobile}
              className="fixed inset-0 z-40 bg-ink/60 backdrop-blur-sm lg:hidden"
            />
            <motion.aside
              initial={{ x: '-100%' }} animate={{ x: 0 }} exit={{ x: '-100%' }}
              transition={{ duration: 0.3, ease: EASE }}
              className="fixed inset-y-0 left-0 z-50 w-[min(86vw,300px)] shadow-float lg:hidden"
            >
              <AdminSidebar
                role={role} user={user} scope="mobile"
                onClose={closeMobile} onNavigate={closeMobile} onLogout={onLogout}
              />
            </motion.aside>
          </>
        ) : null}
      </AnimatePresence>

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="sticky top-0 z-30">
          <header className="flex h-16 items-center gap-3 border-b bg-background/90 px-3 backdrop-blur sm:px-6">
            <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => dispatch(setMobileNav(true))} aria-label="Open menu">
              <Menu className="h-5 w-5" />
            </Button>

            <PageHeading />

            <div className="ml-auto flex items-center gap-1 sm:gap-2">
              <button
                type="button"
                onClick={() => dispatch(setCommandOpen(true))}
                aria-label="Search the back office"
                aria-keyshortcuts="Control+K Meta+K"
                className={cn(
                  'group flex h-9 items-center gap-2 rounded-full border bg-muted/50 text-sm text-muted-foreground shadow-hairline transition-colors',
                  'hover:border-gold/50 hover:bg-background hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  'w-9 justify-center md:w-64 md:justify-start md:px-3',
                )}
              >
                <Search className="h-4 w-4 shrink-0 transition-colors group-hover:text-gold" aria-hidden />
                <span className="hidden flex-1 text-left md:inline">Search or jump to…</span>
                <span className="hidden items-center gap-0.5 md:flex"><Kbd>{MOD_KEY}</Kbd><Kbd>K</Kbd></span>
              </button>

              <KathmanduClock />
              <span className="mx-1 hidden h-6 w-px bg-border xl:block" aria-hidden />

              <NotificationPanel />
              <ThemeToggle />

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button type="button" className="flex items-center gap-2 rounded-full p-0.5 pr-2 transition-colors hover:bg-accent" aria-label="Account menu">
                    <Avatar className="h-8 w-8 ring-2 ring-gold/40">
                      <AvatarFallback className="bg-gold/15 text-xs font-bold">{initials(user?.name ?? '')}</AvatarFallback>
                    </Avatar>
                    <ChevronDown className="hidden h-3 w-3 opacity-50 sm:block" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-60">
                  <DropdownMenuLabel className="flex items-center gap-3">
                    <Avatar className="h-9 w-9"><AvatarFallback>{initials(user?.name ?? '')}</AvatarFallback></Avatar>
                    <span className="min-w-0">
                      <span className="block truncate font-medium">{user?.name}</span>
                      <span className="block truncate text-xs font-normal text-muted-foreground">{user?.email}</span>
                    </span>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {/* The bar's button flips light and dark; the preference —
                      including following the device — is set here, where a
                      setting belongs. */}
                  <div className="flex items-center justify-between gap-3 px-2 py-1.5">
                    <span className="text-sm">Theme</span>
                    <ThemeModeSwitch size="sm" />
                  </div>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild><Link to="/"><ExternalLink className="h-4 w-4" /> View website</Link></DropdownMenuItem>
                  {role === 'TECHNICIAN' || role === 'ADMIN' ? (
                    <DropdownMenuItem asChild><Link to="/tech"><HardHat className="h-4 w-4" /> Technician view</Link></DropdownMenuItem>
                  ) : null}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={onLogout} className="text-destructive focus:text-destructive">
                    <LogOut className="h-4 w-4" /> Sign out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </header>
          <ShortcutBar />
        </div>

        <main className="flex-1 p-4 sm:p-6"><PageOutlet /></main>
      </div>

      <CommandPalette role={role} onLogout={onLogout} />
      <NotesSheet />
    </div>
  );
}
