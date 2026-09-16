import { useState } from 'react';
import { NavLink, Link, useLocation, useNavigate } from 'react-router-dom';
import { Menu, X, LogOut, ChevronDown } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { useAuth } from '@/hooks/useAuth';
import { useIdlePreload } from '@/hooks/useIdlePreload';
import { useSiteSettings } from '@/hooks/useSiteSettings';
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
import { activeNavPath, navForRole } from '@/config/admin/adminNav';
import { useNavBadges } from '@/hooks/useNavBadges';
import { initials } from '@/helpers/format';
import { cn } from '@/helpers/utils';
import { AdminBreadcrumb } from './AdminBreadcrumb';
import { NotificationPanel } from './NotificationPanel';

function Brand({ name, initial }) {
  return (
    <span className="flex min-w-0 items-center gap-2">
      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-primary text-sm text-primary-foreground">{initial}</span>
      <span className="truncate">{name}</span>
    </span>
  );
}

/** The grouped sidebar. Navigation is filtered in `config/admin/adminNav.js`. */
function AdminNav({ role, onNavigate }) {
  const { pathname } = useLocation();
  const activeTo = activeNavPath(pathname);
  const badges = useNavBadges(role);
  return (
    <nav aria-label="Back office" className="flex flex-1 flex-col gap-4 overflow-y-auto p-3">
      {navForRole(role).map((group) => (
        <div key={group.key} role="group" aria-labelledby={`nav-group-${group.key}`}>
          <p id={`nav-group-${group.key}`} className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70">
            {group.label}
          </p>
          <div className="flex flex-col gap-0.5">
            {group.items.map((item) => (item.soon ? (
              <span
                key={item.to}
                aria-disabled="true"
                title={`${item.label} is not built yet`}
                className="flex cursor-not-allowed items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground/40"
              >
                <item.icon className="h-4 w-4 shrink-0" aria-hidden />
                {item.label}
                <span className="ml-auto rounded bg-muted px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground/70">
                  Soon
                </span>
              </span>
            ) : (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                onClick={onNavigate}
                aria-current={item.to === activeTo ? 'page' : undefined}
                className={() => cn(
                  'group relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                  item.to === activeTo ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-accent hover:text-foreground',
                )}
              >
                {() => (
                  <>
                    {item.to === activeTo ? (
                      <motion.span
                        layoutId="admin-nav-active"
                        className="absolute inset-y-1 left-0 w-1 rounded-r-full bg-primary"
                        transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
                      />
                    ) : null}
                    <item.icon className="h-4 w-4 shrink-0" aria-hidden />
                    {item.label}
                    {item.badge && badges[item.badge] ? (
                      <span
                        className="ml-auto rounded-full bg-destructive px-1.5 py-0.5 text-[10px] font-bold tabular-nums text-destructive-foreground"
                        title={`${badges[item.badge]} past the response deadline`}
                      >
                        {badges[item.badge] > 99 ? '99+' : badges[item.badge]}
                        <span className="sr-only"> past the response deadline</span>
                      </span>
                    ) : null}
                  </>
                )}
              </NavLink>
            )))}
          </div>
        </div>
      ))}
    </nav>
  );
}

export function AdminLayout() {
  useIdlePreload('admin');
  const { user, role } = useAuth();
  const { name, initial } = useSiteSettings();
  const navigate = useNavigate();
  const [logout] = useLogoutMutation();
  const [mobileOpen, setMobileOpen] = useState(false);

  const onLogout = async () => {
    await logout().unwrap().catch(() => {});
    navigate('/login', { replace: true });
  };

  return (
    <div className="flex min-h-dvh bg-muted/20">
      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col border-r bg-background lg:flex">
        <Link to="/admin" className="flex h-16 items-center border-b px-5 font-extrabold tracking-tight">
          <Brand name={name} initial={initial} />
        </Link>
        <AdminNav role={role} />
        <div className="border-t p-3 text-[11px] text-muted-foreground">
          Signed in as <span className="font-semibold text-foreground">{role}</span>
        </div>
      </aside>

      {/* Mobile drawer */}
      <AnimatePresence>
        {mobileOpen ? (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setMobileOpen(false)}
              className="fixed inset-0 z-40 bg-black/50 lg:hidden"
            />
            <motion.aside
              initial={{ x: '-100%' }} animate={{ x: 0 }} exit={{ x: '-100%' }}
              transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
              className="fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r bg-background lg:hidden"
            >
              <div className="flex h-16 items-center justify-between gap-2 border-b px-5 font-extrabold">
                <Brand name={name} initial={initial} />
                <Button variant="ghost" size="icon" onClick={() => setMobileOpen(false)} aria-label="Close menu">
                  <X className="h-5 w-5" />
                </Button>
              </div>
              <AdminNav role={role} onNavigate={() => setMobileOpen(false)} />
            </motion.aside>
          </>
        ) : null}
      </AnimatePresence>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-16 items-center gap-4 border-b bg-background/85 px-4 backdrop-blur sm:px-6">
          <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setMobileOpen(true)} aria-label="Open menu">
            <Menu className="h-5 w-5" />
          </Button>

          <AdminBreadcrumb className="hidden min-w-0 sm:block" />

          <div className="ml-auto flex items-center gap-1">
            <NotificationPanel />

            <ThemeToggle />

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button type="button" className="flex items-center gap-2 rounded-lg px-2 py-1.5 transition-colors hover:bg-accent">
                  <Avatar className="h-7 w-7">
                    <AvatarFallback>{initials(user?.name ?? '')}</AvatarFallback>
                  </Avatar>
                  <span className="hidden text-sm font-medium sm:inline">{user?.name}</span>
                  <ChevronDown className="h-3 w-3 opacity-50" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>
                  <p className="font-medium">{user?.name}</p>
                  <p className="text-xs font-normal text-muted-foreground">{user?.email}</p>
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
                <DropdownMenuItem asChild><Link to="/">View website</Link></DropdownMenuItem>
                {role === 'TECHNICIAN' || role === 'ADMIN' ? (
                  <DropdownMenuItem asChild><Link to="/tech">Technician view</Link></DropdownMenuItem>
                ) : null}
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={onLogout} className="text-destructive focus:text-destructive">
                  <LogOut className="h-4 w-4" /> Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        <main className="flex-1 p-4 sm:p-6"><PageOutlet /></main>
      </div>
    </div>
  );
}
