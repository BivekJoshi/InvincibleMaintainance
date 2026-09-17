import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import {
  CornerDownLeft, ExternalLink, HardHat, LogOut, Monitor, Moon, PanelLeft, StickyNote, Sun,
} from 'lucide-react';
import { useGetNotesQuery, useGetShortcutsQuery } from '@/api/meApi';
import {
  Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandSeparator, CommandShortcut,
} from '@/components/ui/command';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { Kbd } from '@/components/common/Kbd';
import { MOD_KEY } from '@/helpers/keys';
import { navForRole } from '@/config/admin/adminNav';
import { shortcutIcon } from '@/config/admin/shortcuts';
import { useTheme } from '@/hooks/useTheme';
import { selectCommandOpen, setCommandOpen, setNotesOpen, toggleSidebar } from '@/redux/slices/uiSlice';

/**
 * Ctrl/⌘+K: jump to any screen your role can open, your shortcuts or a note, or run a shell
 * action. Everything is matched as you type; ↑↓ to move, ↵ to go.
 */
export function CommandPalette({ role, onLogout }) {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const open = useSelector(selectCommandOpen);
  const { setMode } = useTheme();
  const { data: shortcuts } = useGetShortcutsQuery(undefined, { skip: !open });
  const { data: notes } = useGetNotesQuery(undefined, { skip: !open });

  const close = () => dispatch(setCommandOpen(false));
  const run = (fn) => () => { close(); fn(); };
  const go = (to) => run(() => navigate(to));

  const groups = navForRole(role).map((g) => ({ ...g, items: g.items.filter((i) => !i.soon) })).filter((g) => g.items.length);

  return (
    <Dialog open={open} onOpenChange={(next) => dispatch(setCommandOpen(next))}>
      <DialogContent className="top-[18%] max-w-xl translate-y-0 gap-0 overflow-hidden p-0 shadow-lift">
        <DialogTitle className="sr-only">Search the back office</DialogTitle>
        <DialogDescription className="sr-only">Type to find a screen, shortcut, note or action.</DialogDescription>
        <Command
          loop
          className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:pb-1 [&_[cmdk-group-heading]]:pt-3 [&_[cmdk-group-heading]]:text-[10px] [&_[cmdk-group-heading]]:font-bold [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-[0.16em] [&_[cmdk-input]]:h-14 [&_[cmdk-item]]:gap-3 [&_[cmdk-item]]:rounded-lg [&_[cmdk-item]]:px-3 [&_[cmdk-item]]:py-2.5"
        >
          <CommandInput placeholder="Search screens, shortcuts, notes and actions…" />
          <CommandList className="max-h-[min(60vh,420px)] px-2 pb-2">
            <CommandEmpty>Nothing matches. Try a screen name, like “quotations”.</CommandEmpty>

            {shortcuts?.items?.length ? (
              <CommandGroup heading="Your shortcuts">
                {shortcuts.items.map((s) => {
                  const Icon = shortcutIcon(s.icon);
                  return (
                    <CommandItem key={s.id} value={`shortcut ${s.label} ${s.to}`} onSelect={go(s.to)}>
                      <Icon className="h-4 w-4 text-gold" aria-hidden />
                      <span className="truncate">{s.label}</span>
                      <span className="ml-auto truncate text-xs text-muted-foreground">{s.to}</span>
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            ) : null}

            {groups.map((group) => (
              <CommandGroup key={group.key} heading={group.label}>
                {group.items.map((item) => (
                  <CommandItem key={item.to} value={`${item.label} ${group.label} ${item.to}`} onSelect={go(item.to)}>
                    <item.icon className="h-4 w-4 text-muted-foreground" aria-hidden />
                    <span>{item.label}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            ))}

            {notes?.items?.length ? (
              <CommandGroup heading="Notes">
                {notes.items.slice(0, 30).map((n) => (
                  <CommandItem key={n.id} value={`note ${n.id} ${n.body}`} onSelect={run(() => dispatch(setNotesOpen(true)))}>
                    <StickyNote className="h-4 w-4 text-gold" aria-hidden />
                    <span className="line-clamp-1">{n.body}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            ) : null}

            <CommandSeparator className="my-1" />
            <CommandGroup heading="Actions">
              <CommandItem value="new note write jot" onSelect={run(() => dispatch(setNotesOpen(true)))}>
                <StickyNote className="h-4 w-4" aria-hidden /> Write a note
              </CommandItem>
              <CommandItem value="toggle collapse expand sidebar" onSelect={run(() => dispatch(toggleSidebar()))}>
                <PanelLeft className="h-4 w-4" aria-hidden /> Collapse or expand the sidebar
              </CommandItem>
              <CommandItem value="theme light" onSelect={run(() => setMode('light'))}>
                <Sun className="h-4 w-4" aria-hidden /> Light theme
              </CommandItem>
              <CommandItem value="theme dark" onSelect={run(() => setMode('dark'))}>
                <Moon className="h-4 w-4" aria-hidden /> Dark theme
              </CommandItem>
              <CommandItem value="theme system device" onSelect={run(() => setMode('system'))}>
                <Monitor className="h-4 w-4" aria-hidden /> Follow the device theme
              </CommandItem>
              <CommandItem value="view website public site" onSelect={go('/')}>
                <ExternalLink className="h-4 w-4" aria-hidden /> View the website
              </CommandItem>
              {role === 'TECHNICIAN' || role === 'ADMIN' ? (
                <CommandItem value="technician view field app" onSelect={go('/tech')}>
                  <HardHat className="h-4 w-4" aria-hidden /> Technician view
                </CommandItem>
              ) : null}
              {onLogout ? (
                <CommandItem value="sign out log out logout" onSelect={run(onLogout)} className="text-destructive data-[selected=true]:text-destructive">
                  <LogOut className="h-4 w-4" aria-hidden /> Sign out
                </CommandItem>
              ) : null}
            </CommandGroup>
          </CommandList>
          <div className="flex items-center gap-3 border-t bg-muted/40 px-4 py-2 text-[11px] text-muted-foreground">
            <span className="flex items-center gap-1"><Kbd>↑</Kbd><Kbd>↓</Kbd> move</span>
            <span className="flex items-center gap-1"><Kbd><CornerDownLeft className="h-3 w-3" /></Kbd> open</span>
            <span className="flex items-center gap-1"><Kbd>Esc</Kbd> close</span>
            <CommandShortcut className="ml-auto flex items-center gap-1 tracking-normal">
              <Kbd>{MOD_KEY}</Kbd><Kbd>K</Kbd>
            </CommandShortcut>
          </div>
        </Command>
      </DialogContent>
    </Dialog>
  );
}
