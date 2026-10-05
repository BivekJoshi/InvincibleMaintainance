import { useEffect } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { ClipboardList, ClipboardCheck, History, LogOut } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useIdlePreload } from '@/hooks/useIdlePreload';
import { PageOutlet } from '@/routes/PageOutlet';
import { useOfflineQueue } from '@/hooks/useOfflineQueue';
import { useT } from '@/hooks/useT';
import { FIELD } from '@/config/i18n/field';
import { useLogoutMutation } from '@/api/authApi';
import { Button } from '@/components/ui/button';
import { LocaleSwitch } from '@/components/common/LocaleSwitch';
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
 *
 * Phase J1: every word is `FIELD`'s, and the header carries the language switch (English / नेपाली, kept in the
 * store's persisted `locale`). At 360 px the name and role truncate; the switch, the sync button and Sign out keep
 * their size — each a 44 px target.
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
  const t = useT(FIELD);
  const tabs = TABS.filter((tab) => !tab.roles || tab.roles.includes(role));
  const sync = useOfflineQueue();
  const [logout] = useLogoutMutation();
  const navigate = useNavigate();

  return (
    <div className="flex min-h-dvh flex-col bg-muted/20">
      <header className="sticky top-0 z-30 border-b bg-background">
        <div className="flex h-14 items-center gap-1.5 px-3 min-[400px]:gap-2 min-[400px]:px-4">
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">{user?.name}</p>
            <p className="truncate text-[11px] text-muted-foreground">{t.has(`roles.${role}`) ? t(`roles.${role}`) : t('roles.other')}</p>
          </div>
          <LocaleSwitch className="shrink-0 [&>button]:min-h-11 [&>button]:min-w-11 [&>button]:px-2" />
          <SyncButton sync={sync} />
          <Button
            variant="ghost" size="icon" className="h-11 w-11 shrink-0"
            onClick={async () => { await logout().unwrap().catch(() => {}); navigate('/login', { replace: true }); }}
            aria-label={t('signOut')}
          >
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
        <SyncBanner sync={sync} />
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
            {t(`tabs.${tab.key}`)}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
