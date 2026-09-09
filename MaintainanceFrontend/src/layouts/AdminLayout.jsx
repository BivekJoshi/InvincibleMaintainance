import { useState } from 'react';
import { Outlet, NavLink, Link, useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import {
  LayoutDashboard, Users, Timer, Briefcase, FileText, Receipt, Package, ShieldCheck,
  Image, Settings, Menu, X, LogOut, Moon, Sun, Bell, ChevronDown,
} from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { useAuth } from '@/hooks/useAuth';
import { useLogoutMutation } from '@/features/auth/authApi';
import { useGetNotificationsQuery } from '@/features/dashboard/dashboardApi';
import { selectTheme, setTheme } from '@/features/ui/uiSlice';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { initials } from '@/lib/format';
import { cn } from '@/lib/utils';

/** Navigation is filtered by capability — the same map the API enforces. */
const NAV = [
  { to: '/admin', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/admin/sla', label: 'SLA board', icon: Timer, capability: 'leads:read', badge: 'sla' },
  { to: '/admin/leads', label: 'Leads', icon: Users, capability: 'leads:read' },
  { to: '/admin/customers', label: 'Customers', icon: Users, capability: 'customers:read' },
  { to: '/admin/quotations', label: 'Quotations', icon: FileText, capability: 'quotations:read' },
  { to: '/admin/jobs', label: 'Jobs', icon: Briefcase, capability: 'jobs:read' },
  { to: '/admin/materials', label: 'Materials', icon: Package, capability: 'materials:read' },
  { to: '/admin/invoices', label: 'Invoices', icon: Receipt, capability: 'invoices:read' },
  { to: '/admin/warranties', label: 'Warranty & AMC', icon: ShieldCheck, capability: 'jobs:read' },
  { to: '/admin/content', label: 'Website', icon: Image, capability: 'cms:read' },
  { to: '/admin/settings', label: 'Settings', icon: Settings, capability: 'settings:read' },
];

export function AdminLayout() {
  const { user, role, can } = useAuth();
  const dispatch = useDispatch();
  const theme = useSelector(selectTheme);
  const navigate = useNavigate();
  const [logout] = useLogoutMutation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const { data: notifications } = useGetNotificationsQuery({ unreadOnly: 'true' }, { pollingInterval: 60000 });

  const items = NAV.filter((n) => !n.capability || can(n.capability));
  const unread = notifications?.unread ?? 0;

  const onLogout = async () => {
    await logout().unwrap().catch(() => {});
    navigate('/login', { replace: true });
  };

  const sidebar = (
    <nav className="flex flex-1 flex-col gap-0.5 p-3">
      {items.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.end}
          onClick={() => setMobileOpen(false)}
          className={({ isActive }) => cn(
            'group relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
            isActive ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-accent hover:text-foreground',
          )}
        >
          {({ isActive }) => (
            <>
              {isActive ? (
                <motion.span
                  layoutId="admin-nav-active"
                  className="absolute inset-y-1 left-0 w-1 rounded-r-full bg-primary"
                  transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
                />
              ) : null}
              <item.icon className="h-4 w-4 shrink-0" aria-hidden />
              {item.label}
            </>
          )}
        </NavLink>
      ))}
    </nav>
  );

  return (
    <div className="flex min-h-dvh bg-muted/20">
      {/* Desktop sidebar */}
      <aside className="hidden w-60 shrink-0 flex-col border-r bg-background lg:flex">
        <div className="flex h-16 items-center gap-2 border-b px-5 font-extrabold tracking-tight">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-primary text-sm text-primary-foreground">G</span>
          Ghar Jatan
        </div>
        {sidebar}
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
              <div className="flex h-16 items-center justify-between border-b px-5 font-extrabold">
                Ghar Jatan
                <Button variant="ghost" size="icon" onClick={() => setMobileOpen(false)} aria-label="Close menu">
                  <X className="h-5 w-5" />
                </Button>
              </div>
              {sidebar}
            </motion.aside>
          </>
        ) : null}
      </AnimatePresence>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-4 border-b bg-background/85 px-4 backdrop-blur sm:px-6">
          <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setMobileOpen(true)} aria-label="Open menu">
            <Menu className="h-5 w-5" />
          </Button>

          <div className="ml-auto flex items-center gap-1">
            <Button variant="ghost" size="icon" className="relative" aria-label={`Notifications${unread ? `, ${unread} unread` : ''}`}>
              <Bell className="h-4 w-4" />
              {unread > 0 ? (
                <motion.span
                  initial={{ scale: 0 }} animate={{ scale: 1 }}
                  className="absolute right-1 top-1 grid h-4 min-w-4 place-items-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground"
                >
                  {unread > 9 ? '9+' : unread}
                </motion.span>
              ) : null}
            </Button>

            <Button
              variant="ghost" size="icon"
              onClick={() => dispatch(setTheme(theme === 'dark' ? 'light' : 'dark'))}
              aria-label="Toggle theme"
            >
              <Sun className="h-4 w-4 dark:hidden" />
              <Moon className="hidden h-4 w-4 dark:block" />
            </Button>

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

        <main className="flex-1 p-4 sm:p-6"><Outlet /></main>
      </div>
    </div>
  );
}
