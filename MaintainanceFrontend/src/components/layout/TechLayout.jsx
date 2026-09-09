import { useEffect } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { ClipboardList, ClipboardCheck, LogOut, CloudOff, RefreshCw } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useOfflineQueue } from '@/hooks/useOfflineQueue';
import { useLogoutMutation } from '@/api/authApi';
import { Button } from '@/components/ui/button';
import { cn } from '@/helpers/utils';

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
  // The manifest is what makes the browser offer to install this, and its
  // start_url is /tech — so it is linked only while the field app is on screen.
  // A customer reading the marketing site should never be offered a job sheet.
  useEffect(() => {
    const link = document.createElement('link');
    link.rel = 'manifest';
    link.href = '/manifest.webmanifest';
    document.head.appendChild(link);
    return () => link.remove();
  }, []);

  const { user, role } = useAuth();
  const tabs = TABS.filter((t) => !t.roles || t.roles.includes(role));
  const { count, online, syncing, drain } = useOfflineQueue();
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

      {/* A surveyor has to know their work is still on the phone. */}
      {!online || count > 0 ? (
        <button
          type="button"
          onClick={drain}
          disabled={!online || syncing}
          className="flex w-full items-center justify-center gap-2 bg-amber-100 px-4 py-2 text-xs font-medium text-amber-900 dark:bg-amber-950 dark:text-amber-200"
        >
          {syncing ? <RefreshCw className="h-3.5 w-3.5 animate-spin" aria-hidden /> : <CloudOff className="h-3.5 w-3.5" aria-hidden />}
          {!online
            ? `No signal${count ? ` · ${count} change${count === 1 ? '' : 's'} saved here` : ''}`
            : `${count} change${count === 1 ? '' : 's'} waiting to send · tap to retry`}
        </button>
      ) : null}

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
