import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { ClipboardList, ClipboardCheck, LogOut } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useLogoutMutation } from '@/features/auth/authApi';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const TABS = [
  { to: '/tech', label: 'Today', icon: ClipboardList, end: true },
  { to: '/tech/surveys', label: 'Surveys', icon: ClipboardCheck, roles: ['SURVEYOR', 'ADMIN', 'DISPATCHER'] },
];

const ROLE_LABELS = {
  TECHNICIAN: 'Technician',
  SURVEYOR: 'Site surveyor',
  ADMIN: 'Admin',
  DISPATCHER: 'Dispatcher',
};

/**
 * Mobile-first shell for field staff. Big tap targets, bottom navigation, and
 * nothing that needs a desktop. Safe-area padding keeps the bar clear of the
 * iOS home indicator.
 */
export function TechLayout() {
  const { user, role } = useAuth();
  const tabs = TABS.filter((t) => !t.roles || t.roles.includes(role));
  const [logout] = useLogoutMutation();
  const navigate = useNavigate();

  return (
    <div className="flex min-h-dvh flex-col bg-muted/20">
      <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b bg-background px-4">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">{user?.name}</p>
          <p className="text-[11px] text-muted-foreground">{ROLE_LABELS[role] ?? 'Field'}</p>
        </div>
        <Button
          variant="ghost" size="icon"
          onClick={async () => { await logout().unwrap().catch(() => {}); navigate('/login', { replace: true }); }}
          aria-label="Sign out"
        >
          <LogOut className="h-4 w-4" />
        </Button>
      </header>

      <main className="flex-1 p-4 pb-24"><Outlet /></main>

      <nav
        className="fixed inset-x-0 bottom-0 z-40 flex border-t bg-background/95 backdrop-blur"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        {tabs.map((tab) => (
          <NavLink
            key={tab.to}
            to={tab.to}
            end={tab.end}
            className={({ isActive }) => cn(
              'flex flex-1 flex-col items-center gap-1 py-3 text-[11px] font-medium transition-colors',
              isActive ? 'text-primary' : 'text-muted-foreground',
            )}
          >
            <tab.icon className="h-5 w-5" aria-hidden />
            {tab.label}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
