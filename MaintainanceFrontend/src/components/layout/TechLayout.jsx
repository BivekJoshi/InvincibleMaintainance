import { useEffect } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { ClipboardList, ClipboardCheck, History, LogOut } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useIdlePreload } from '@/hooks/useIdlePreload';
import { PageOutlet } from '@/routes/PageOutlet';
import { useOfflineQueue } from '@/hooks/useOfflineQueue';
import { useFieldCopy } from '@/hooks/useFieldCopy';
import { useLogoutMutation } from '@/api/authApi';
import { Button } from '@/components/ui/button';
import { SyncBanner, SyncButton } from '@/components/tech/FieldSyncStatus';
import { cn } from '@/helpers/utils';

const TABS = [
  { to: '/tech', key: 'today', icon: ClipboardList, end: true },
  { to: '/tech/history', key: 'history', icon: History },
  { to: '/tech/surveys', key: 'surveys', icon: ClipboardCheck, roles: ['SURVEYOR', 'ADMIN', 'DISPATCHER'] },
];

/**
 * Mobile-first shell for field staff. Big tap targets, bottom navigation, and
 * nothing that needs a desktop. Safe-area padding keeps the bar clear of the
 * iOS home indicator.
 *
 * It also runs the sync engine (`useOfflineQueue`), once for the whole field app: the header says what
 * is still on the phone and sends it on "Sync now"; the strip under it says when there is no signal and
 * what the office refused.
 */
export function TechLayout() {
  useIdlePreload('tech');
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
  const copy = useFieldCopy();
  const tabs = TABS.filter((t) => !t.roles || t.roles.includes(role));
  const sync = useOfflineQueue();
  const [logout] = useLogoutMutation();
  const navigate = useNavigate();

  return (
    <div className="flex min-h-dvh flex-col bg-muted/20">
      <header className="sticky top-0 z-30 border-b bg-background">
        <div className="flex h-14 items-center gap-2 px-4">
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">{user?.name}</p>
            <p className="text-[11px] text-muted-foreground">{copy.roles[role] ?? copy.roles.other}</p>
          </div>
          <SyncButton sync={sync} copy={copy} />
          <Button
            variant="ghost" size="icon" className="h-11 w-11 shrink-0"
            onClick={async () => { await logout().unwrap().catch(() => {}); navigate('/login', { replace: true }); }}
            aria-label={copy.signOut}
          >
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
        <SyncBanner sync={sync} copy={copy} />
      </header>

      <main className="flex-1 p-4 pb-24"><PageOutlet /></main>

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
              'flex min-h-14 flex-1 flex-col items-center justify-center gap-1 py-2.5 text-[11px] font-medium transition-colors',
              isActive ? 'text-primary' : 'text-muted-foreground',
            )}
          >
            <tab.icon className="h-5 w-5" aria-hidden />
            {copy.tabs[tab.key]}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
