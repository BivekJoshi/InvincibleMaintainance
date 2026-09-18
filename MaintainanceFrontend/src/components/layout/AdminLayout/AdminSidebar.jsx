import { useEffect, useMemo, useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { ChevronDown, LogOut, PanelLeftClose, PanelLeftOpen, Search, X } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { activeNavPath, activeNavTab, navForRole, navTabsForRole } from '@/config/admin/adminNav';
import { useNavBadges } from '@/hooks/useNavBadges';
import { useSiteSettings } from '@/hooks/useSiteSettings';
import { initials } from '@/helpers/format';
import { BrandMark } from '@/components/site/BrandMark';
import { cn } from '@/helpers/utils';

const EASE = [0.16, 1, 0.3, 1];
const FOLDED_KEY = 'adminNavFolded';

/** The groups someone folded away, remembered per browser. */
function useFoldedGroups() {
  const [folded, setFolded] = useState(() => {
    try { return new Set(JSON.parse(localStorage.getItem(FOLDED_KEY) ?? '[]')); } catch { return new Set(); }
  });
  const toggle = (key) => setFolded((prev) => {
    const next = new Set(prev);
    if (next.has(key)) next.delete(key); else next.add(key);
    try { localStorage.setItem(FOLDED_KEY, JSON.stringify([...next])); } catch { /* private mode */ }
    return next;
  });
  return [folded, toggle];
}

const badgeText = (n) => (n > 99 ? '99+' : n);

/** One nav row, or one icon on the rail. */
function NavRow({ item, active, badge, rail, scope, onNavigate, hint }) {
  if (item.soon) {
    const row = (
      <span
        aria-disabled="true"
        title={rail ? undefined : `${item.label} is not built yet`}
        className={cn(
          'flex cursor-not-allowed items-center gap-3 rounded-lg text-sm text-ink-muted/50',
          rail ? 'h-10 w-10 justify-center' : 'px-3 py-2',
        )}
      >
        <item.icon className="h-4 w-4 shrink-0" aria-hidden />
        {rail ? <span className="sr-only">{item.label} (not built yet)</span> : (
          <>
            <span className="truncate">{item.label}</span>
            <span className="ml-auto rounded-full border border-ink-foreground/10 px-1.5 text-[9px] font-semibold uppercase tracking-wider">
              Soon
            </span>
          </>
        )}
      </span>
    );
    return rail ? <RailTip label={`${item.label} · soon`}>{row}</RailTip> : row;
  }

  const link = (
    <NavLink
      to={item.to}
      end={item.end}
      onClick={onNavigate}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'group relative flex items-center gap-3 rounded-lg text-sm font-medium outline-none transition-colors',
        'focus-visible:ring-2 focus-visible:ring-gold',
        rail ? 'h-10 w-10 justify-center' : 'px-3 py-2',
        active ? 'bg-ink-foreground/10 text-ink-foreground' : 'text-ink-muted hover:bg-ink-foreground/[0.06] hover:text-ink-foreground',
      )}
    >
      {active ? (
        <motion.span
          layoutId={`${scope}-nav-active`}
          className={cn('absolute rounded-full bg-gold', rail ? 'inset-x-2 -bottom-0.5 h-0.5' : 'inset-y-2 left-0 w-[3px]')}
          transition={{ duration: 0.3, ease: EASE }}
        />
      ) : null}
      <item.icon
        className={cn('h-4 w-4 shrink-0 transition-colors', active ? 'text-gold' : 'group-hover:text-ink-foreground')}
        aria-hidden
      />
      {rail ? <span className="sr-only">{item.label}</span> : (
        <span className="min-w-0 flex-1 truncate">
          {item.label}
          {hint ? <span className="ml-1.5 text-[11px] font-normal text-ink-muted">in {hint}</span> : null}
        </span>
      )}
      {badge ? (
        <span
          className={cn(
            'rounded-full bg-destructive font-bold tabular-nums text-destructive-foreground',
            rail ? 'absolute right-0.5 top-0.5 px-1 text-[9px]' : 'px-1.5 py-0.5 text-[10px]',
          )}
          title={`${badge} past the response deadline`}
        >
          {badgeText(badge)}
          <span className="sr-only"> past the response deadline</span>
        </span>
      ) : null}
    </NavLink>
  );
  return rail ? <RailTip label={item.label}>{link}</RailTip> : link;
}

function RailTip({ label, children }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent side="right">{label}</TooltipContent>
    </Tooltip>
  );
}

/**
 * The four sections as a segmented control. It follows the page on screen; a click only
 * changes what the sidebar lists, it never navigates.
 */
function SectionSwitch({ tabs, current, onSelect, badges, rail, scope }) {
  return (
    <div
      role="tablist"
      aria-label="Menu sections"
      aria-orientation={rail ? 'vertical' : 'horizontal'}
      className={cn(
        'relative rounded-xl bg-ink-foreground/[0.06] p-1',
        rail ? 'flex flex-col gap-1' : 'grid gap-0.5',
      )}
      style={rail ? undefined : { gridTemplateColumns: `repeat(${tabs.length}, minmax(0, 1fr))` }}
    >
      {tabs.map((tab) => {
        const selected = tab.key === current;
        const alert = selected ? 0 : tab.groups
          .flatMap((g) => g.items)
          .reduce((sum, item) => sum + (item.badge ? badges[item.badge] ?? 0 : 0), 0);
        const button = (
          <button
            key={tab.key}
            type="button"
            role="tab"
            aria-selected={selected}
            aria-label={rail ? tab.label : undefined}
            title={rail ? undefined : tab.hint}
            onClick={() => onSelect(tab.key)}
            className={cn(
              'relative flex items-center justify-center gap-1 rounded-lg text-[11px] font-semibold outline-none transition-colors',
              'focus-visible:ring-2 focus-visible:ring-gold',
              rail ? 'h-9 w-9' : 'flex-col px-1 py-1.5',
              selected ? 'text-ink' : 'text-ink-muted hover:text-ink-foreground',
            )}
          >
            {selected ? (
              <motion.span
                layoutId={`${scope}-nav-section`}
                className="absolute inset-0 rounded-lg bg-gold shadow-hairline"
                transition={{ duration: 0.3, ease: EASE }}
              />
            ) : null}
            <tab.icon className="relative h-4 w-4" aria-hidden />
            {rail ? null : <span className="relative">{tab.label}</span>}
            {alert ? (
              <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-destructive ring-2 ring-ink">
                <span className="sr-only"> — {alert} past the response deadline</span>
              </span>
            ) : null}
          </button>
        );
        return rail ? <RailTip key={tab.key} label={`${tab.label} — ${tab.hint}`}>{button}</RailTip> : button;
      })}
    </div>
  );
}

/**
 * The back office's sidebar: an ink panel with the four sections, a screen finder, folding
 * groups and the signed-in user. `rail` folds it to icons (desktop only); `onClose` makes it
 * the mobile drawer. What a role sees is decided in `config/admin/adminNav.js`.
 */
export function AdminSidebar({ role, user, rail = false, scope = 'desk', onToggleRail, onClose, onNavigate, onLogout }) {
  const { pathname } = useLocation();
  const { name, initial, logoUrl } = useSiteSettings();
  const badges = useNavBadges(role);
  const activeTo = activeNavPath(pathname);
  const tabs = useMemo(() => navTabsForRole(role), [role]);
  const pathTab = activeNavTab(pathname);
  const [tabKey, setTabKey] = useState(pathTab);
  const [query, setQuery] = useState('');
  const [folded, toggleFolded] = useFoldedGroups();

  // Opening a page brings its section forward.
  useEffect(() => { if (pathTab) setTabKey(pathTab); }, [pathTab]);

  const current = tabs.find((t) => t.key === tabKey) ?? tabs[0];
  const needle = query.trim().toLowerCase();
  const matches = useMemo(() => (needle
    ? navForRole(role).flatMap((g) => g.items
      .filter((i) => `${i.label} ${g.label}`.toLowerCase().includes(needle))
      .map((i) => ({ item: i, group: g.label })))
    : []), [needle, role]);

  const navigate = () => { setQuery(''); onNavigate?.(); };

  return (
    <div className="flex h-full flex-col bg-ink text-ink-foreground">
      {/* Brand */}
      <div className={cn('flex h-16 shrink-0 items-center gap-2', rail ? 'justify-center px-2' : 'px-4')}>
        <Link
          to="/admin"
          onClick={onNavigate}
          className="flex min-w-0 items-center gap-2.5 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-gold"
          aria-label={rail ? `${name} — dashboard` : undefined}
        >
          <BrandMark
            logoUrl={logoUrl}
            initial={initial}
            className="relative h-9 w-9 overflow-hidden rounded-xl bg-gold text-sm font-black text-gold-foreground shadow-hairline"
          >
            <span className="absolute inset-0 bg-gradient-to-br from-ink-foreground/25 to-transparent" aria-hidden />
          </BrandMark>
          {rail ? null : (
            <span className="min-w-0 leading-tight">
              <span className="block truncate text-sm font-extrabold tracking-tight">{name}</span>
              <span className="block text-[10px] font-semibold uppercase tracking-[0.18em] text-gold">Back office</span>
            </span>
          )}
        </Link>
        {onClose ? (
          <button type="button" onClick={onClose} aria-label="Close menu" className="ml-auto rounded-lg p-2 text-ink-muted hover:bg-ink-foreground/10 hover:text-ink-foreground">
            <X className="h-5 w-5" />
          </button>
        ) : null}
      </div>

      {/* Sections and finder */}
      {current ? (
        <div className={cn('shrink-0 space-y-2 pb-2', rail ? 'flex flex-col items-center px-2' : 'px-3')}>
          {tabs.length > 1 && !needle ? (
            <SectionSwitch tabs={tabs} current={current.key} onSelect={setTabKey} badges={badges} rail={rail} scope={scope} />
          ) : null}
          {rail ? null : (
            <label className="flex items-center gap-2 rounded-lg border border-ink-foreground/10 bg-ink-foreground/[0.04] px-2.5 transition-colors focus-within:border-gold/60">
              <Search className="h-3.5 w-3.5 shrink-0 text-ink-muted" aria-hidden />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Escape') setQuery(''); }}
                placeholder="Find a screen…"
                aria-label="Find a screen"
                className="h-8 min-w-0 flex-1 bg-transparent text-sm text-ink-foreground outline-none placeholder:text-ink-muted"
              />
            </label>
          )}
        </div>
      ) : null}

      {/* Items */}
      <nav aria-label="Back office" className={cn('flex-1 overflow-y-auto overscroll-contain pb-4', rail ? 'px-2' : 'px-3')}>
        {needle ? (
          matches.length ? (
            <div className="flex flex-col gap-0.5 pt-1">
              {matches.map(({ item, group }) => (
                <NavRow
                  key={item.to} item={item} active={item.to === activeTo} badge={item.badge && badges[item.badge]}
                  scope={scope} onNavigate={navigate} hint={group}
                />
              ))}
            </div>
          ) : (
            <p className="px-3 py-6 text-center text-sm text-ink-muted">No screen called “{query.trim()}”.</p>
          )
        ) : current ? (
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={current.key}
              initial={{ opacity: 0, x: 8 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -8 }}
              transition={{ duration: 0.18, ease: EASE }}
              className={cn('flex flex-col', rail ? 'items-center gap-2' : 'gap-3')}
            >
              {current.groups.map((group, i) => {
                const isFolded = !rail && folded.has(group.key);
                return (
                  <div key={group.key} role="group" aria-label={group.label} className={cn(rail && 'flex flex-col items-center gap-1')}>
                    {rail ? (
                      i > 0 ? <span className="mb-1 h-px w-6 bg-ink-foreground/10" aria-hidden /> : null
                    ) : (
                      <button
                        type="button"
                        onClick={() => toggleFolded(group.key)}
                        aria-expanded={!isFolded}
                        className="flex w-full items-center gap-2 rounded-md px-3 pb-1 pt-1.5 text-[10px] font-bold uppercase tracking-[0.16em] text-ink-muted outline-none hover:text-ink-foreground focus-visible:ring-2 focus-visible:ring-gold"
                      >
                        {group.label}
                        <span className="h-px flex-1 bg-ink-foreground/10" aria-hidden />
                        <span className="tabular-nums">{group.items.length}</span>
                        <ChevronDown className={cn('h-3 w-3 transition-transform', isFolded && '-rotate-90')} aria-hidden />
                      </button>
                    )}
                    <AnimatePresence initial={false}>
                      {isFolded ? null : (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.2, ease: EASE }}
                          className={cn('flex flex-col gap-0.5 overflow-hidden', rail && 'items-center')}
                        >
                          {group.items.map((item) => (
                            <NavRow
                              key={item.to} item={item} rail={rail} scope={scope} active={item.to === activeTo}
                              badge={item.badge && badges[item.badge]} onNavigate={onNavigate}
                            />
                          ))}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                );
              })}
            </motion.div>
          </AnimatePresence>
        ) : null}
      </nav>

      {/* Who is signed in */}
      <div className={cn('shrink-0 border-t border-ink-foreground/10 p-2', rail ? 'flex flex-col items-center gap-1' : 'space-y-1')}>
        {onToggleRail ? (
          <RailTip label={rail ? 'Expand sidebar' : 'Collapse sidebar'}>
            <button
              type="button"
              onClick={onToggleRail}
              aria-label={rail ? 'Expand sidebar' : 'Collapse sidebar'}
              className={cn(
                'flex items-center gap-2 rounded-lg text-xs font-medium text-ink-muted outline-none hover:bg-ink-foreground/[0.06] hover:text-ink-foreground focus-visible:ring-2 focus-visible:ring-gold',
                rail ? 'h-9 w-9 justify-center' : 'w-full px-3 py-2',
              )}
            >
              {rail ? <PanelLeftOpen className="h-4 w-4" /> : <><PanelLeftClose className="h-4 w-4" /> Collapse</>}
            </button>
          </RailTip>
        ) : null}
        <div className={cn('flex items-center gap-2.5 rounded-xl', rail ? 'flex-col' : 'bg-ink-foreground/[0.05] p-2')}>
          <Avatar className="h-8 w-8 ring-2 ring-gold/40">
            <AvatarFallback className="bg-gold/20 text-xs font-bold text-ink-foreground">{initials(user?.name ?? '')}</AvatarFallback>
          </Avatar>
          {rail ? null : (
            <span className="min-w-0 flex-1 leading-tight">
              <span className="block truncate text-sm font-semibold">{user?.name}</span>
              <span className="block truncate text-[10px] font-semibold uppercase tracking-wider text-gold">{role?.toLowerCase()}</span>
            </span>
          )}
          {onLogout ? (
            <RailTip label="Sign out">
              <button
                type="button"
                onClick={onLogout}
                aria-label="Sign out"
                className="rounded-lg p-2 text-ink-muted outline-none hover:bg-destructive/20 hover:text-ink-foreground focus-visible:ring-2 focus-visible:ring-gold"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </RailTip>
          ) : null}
        </div>
      </div>
    </div>
  );
}
