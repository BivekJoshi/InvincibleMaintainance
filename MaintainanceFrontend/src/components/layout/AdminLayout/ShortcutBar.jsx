import { useEffect, useState } from 'react';
import { useDispatch } from 'react-redux';
import { NavLink, useLocation } from 'react-router-dom';
import { ArrowDown, ArrowUp, GripVertical, Plus, Settings2, Star, StickyNote, Trash2, Zap } from 'lucide-react';
import { AnimatePresence, Reorder, motion, useDragControls } from 'framer-motion';
import {
  useCreateShortcutMutation, useDeleteShortcutMutation, useGetNotesQuery, useGetShortcutsQuery,
  useReorderShortcutsMutation, useUpdateShortcutMutation,
} from '@/api/meApi';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { SHORTCUT_ICONS, isSamePlace, shortcutIcon, suggestShortcut } from '@/config/admin/shortcuts';
import { shortcutSchema } from '@/form/schemas/me.schema';
import { setNotesOpen, toastError, toastSuccess } from '@/redux/slices/uiSlice';
import { cn } from '@/helpers/utils';

const EASE = [0.16, 1, 0.3, 1];
const apiMessage = (err) => err?.data?.error?.message ?? 'Please try again.';

/** A name and an icon — the pin form and each row of the manager share it. */
function IconPicker({ value, onChange }) {
  return (
    <div role="radiogroup" aria-label="Icon" className="grid grid-cols-8 gap-1">
      {Object.entries(SHORTCUT_ICONS).map(([name, Icon]) => (
        <button
          key={name}
          type="button"
          role="radio"
          aria-checked={value === name}
          aria-label={name}
          onClick={() => onChange(name)}
          className={cn(
            'grid h-7 w-7 place-items-center rounded-md border transition-colors',
            value === name ? 'border-primary bg-primary text-primary-foreground' : 'border-transparent text-muted-foreground hover:bg-accent hover:text-foreground',
          )}
        >
          <Icon className="h-3.5 w-3.5" aria-hidden />
        </button>
      ))}
    </div>
  );
}

/**
 * The star: pins the page on screen (with a name and an icon of your choosing), or unpins it
 * when it is already a shortcut.
 */
function PinButton({ shortcuts, max }) {
  const dispatch = useDispatch();
  const { pathname, search } = useLocation();
  const suggestion = suggestShortcut(pathname, search);
  const pinned = shortcuts.find((s) => isSamePlace(s.to, pathname, search));
  const [open, setOpen] = useState(false);
  const [label, setLabel] = useState('');
  const [icon, setIcon] = useState('Bookmark');
  const [error, setError] = useState(null);
  const [create, { isLoading }] = useCreateShortcutMutation();
  const [remove] = useDeleteShortcutMutation();

  useEffect(() => {
    if (open && suggestion) { setLabel(suggestion.label); setIcon(suggestion.icon); setError(null); }
    // Only when the form opens: typing must not be overwritten.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  if (!suggestion) return null;

  if (pinned) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost" size="icon" className="h-8 w-8 shrink-0 text-gold hover:text-gold"
            aria-label={`Unpin ${pinned.label}`}
            onClick={() => remove(pinned.id).unwrap()
              .then(() => dispatch(toastSuccess('Shortcut removed', pinned.label)))
              .catch((err) => dispatch(toastError('Could not remove the shortcut', apiMessage(err))))}
          >
            <Star className="h-4 w-4 fill-current" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom">Pinned — click to unpin</TooltipContent>
      </Tooltip>
    );
  }

  const full = shortcuts.length >= max;
  const save = async (e) => {
    e.preventDefault();
    const parsed = shortcutSchema.safeParse({ label, to: suggestion.to, icon });
    if (!parsed.success) { setError(parsed.error.issues[0].message); return; }
    try {
      await create(parsed.data).unwrap();
      dispatch(toastSuccess('Pinned to your shortcuts', parsed.data.label));
      setOpen(false);
    } catch (err) {
      setError(apiMessage(err));
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <Tooltip>
        <TooltipTrigger asChild>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" aria-label="Pin this page to your shortcuts">
              <Star className="h-4 w-4" />
            </Button>
          </PopoverTrigger>
        </TooltipTrigger>
        <TooltipContent side="bottom">Pin this page</TooltipContent>
      </Tooltip>
      <PopoverContent align="start" className="w-80">
        {full ? (
          <p className="text-sm text-muted-foreground">
            You have {max} shortcuts, the most the bar holds. Remove one to pin this page.
          </p>
        ) : (
          <form onSubmit={save} className="space-y-3" noValidate>
            <div>
              <p className="text-sm font-semibold">Pin this page</p>
              <p className="truncate text-xs text-muted-foreground" title={suggestion.to}>{suggestion.to}</p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="shortcut-label">Name</Label>
              <Input
                id="shortcut-label" value={label} maxLength={40} autoFocus
                onChange={(e) => { setLabel(e.target.value); setError(null); }}
                aria-invalid={Boolean(error)} aria-describedby={error ? 'shortcut-error' : undefined}
              />
              {error ? <p id="shortcut-error" className="text-xs font-medium text-destructive">{error}</p> : null}
            </div>
            <div className="space-y-1.5">
              <span className="text-sm font-medium">Icon</span>
              <IconPicker value={icon} onChange={setIcon} />
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)}>Cancel</Button>
              <Button type="submit" size="sm" disabled={isLoading}><Star /> Pin</Button>
            </div>
          </form>
        )}
      </PopoverContent>
    </Popover>
  );
}

/** One row in the manager: drag or arrow it into place, rename it, change its icon, remove it. */
function ManageRow({ shortcut, index, count, onMove, onCommit }) {
  const dispatch = useDispatch();
  const [label, setLabel] = useState(shortcut.label);
  const [update] = useUpdateShortcutMutation();
  const [remove] = useDeleteShortcutMutation();
  const drag = useDragControls();
  const Icon = shortcutIcon(shortcut.icon);

  useEffect(() => setLabel(shortcut.label), [shortcut.label]);

  const rename = () => {
    const next = label.trim();
    if (!next || next === shortcut.label) { setLabel(shortcut.label); return; }
    update({ id: shortcut.id, label: next.slice(0, 40) }).unwrap()
      .catch((err) => { setLabel(shortcut.label); dispatch(toastError('Could not rename the shortcut', apiMessage(err))); });
  };

  return (
    <Reorder.Item
      value={shortcut}
      dragListener={false}
      dragControls={drag}
      onDragEnd={onCommit}
      className="flex items-center gap-2 rounded-lg border bg-card p-2 shadow-hairline"
      whileDrag={{ scale: 1.02, boxShadow: 'var(--elevation-3)' }}
    >
      <span
        onPointerDown={(e) => drag.start(e)}
        className="shrink-0 cursor-grab touch-none text-muted-foreground active:cursor-grabbing"
        aria-hidden
      >
        <GripVertical className="h-4 w-4" />
      </span>
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" size="icon" className="h-8 w-8 shrink-0" aria-label={`Change the icon of ${shortcut.label}`}>
            <Icon className="h-4 w-4" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto">
          <IconPicker
            value={shortcut.icon}
            onChange={(icon) => update({ id: shortcut.id, icon }).unwrap()
              .catch((err) => dispatch(toastError('Could not change the icon', apiMessage(err))))}
          />
        </PopoverContent>
      </Popover>
      <div className="min-w-0 flex-1">
        <Input
          value={label}
          maxLength={40}
          onChange={(e) => setLabel(e.target.value)}
          onBlur={rename}
          onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }}
          aria-label={`Name of shortcut ${index + 1}`}
          className="h-8"
        />
        <p className="mt-0.5 truncate px-1 text-[11px] text-muted-foreground">{shortcut.to}</p>
      </div>
      <div className="flex shrink-0 flex-col">
        <button type="button" disabled={index === 0} onClick={() => onMove(index, -1)} aria-label={`Move ${shortcut.label} up`}
          className="rounded p-0.5 text-muted-foreground hover:text-foreground disabled:opacity-30">
          <ArrowUp className="h-3.5 w-3.5" />
        </button>
        <button type="button" disabled={index === count - 1} onClick={() => onMove(index, 1)} aria-label={`Move ${shortcut.label} down`}
          className="rounded p-0.5 text-muted-foreground hover:text-foreground disabled:opacity-30">
          <ArrowDown className="h-3.5 w-3.5" />
        </button>
      </div>
      <Button
        variant="ghost" size="icon" className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive"
        aria-label={`Remove ${shortcut.label}`}
        onClick={() => remove(shortcut.id).unwrap()
          .catch((err) => dispatch(toastError('Could not remove the shortcut', apiMessage(err))))}
      >
        <Trash2 className="h-4 w-4" />
      </Button>
    </Reorder.Item>
  );
}

function ManageShortcuts({ open, onOpenChange, shortcuts, max }) {
  const dispatch = useDispatch();
  const [order, setOrder] = useState(shortcuts);
  const [reorder] = useReorderShortcutsMutation();

  useEffect(() => setOrder(shortcuts), [shortcuts]);

  const commit = (next = order) => {
    const ids = next.map((s) => s.id);
    if (ids.join() === shortcuts.map((s) => s.id).join()) return;
    reorder(ids).unwrap().catch((err) => dispatch(toastError('Could not save the order', apiMessage(err))));
  };

  const move = (index, step) => {
    const next = [...order];
    const [row] = next.splice(index, 1);
    next.splice(index + step, 0, row);
    setOrder(next);
    commit(next);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Your shortcuts</DialogTitle>
          <DialogDescription>
            Drag to reorder, rename in place, or remove. Pin more with the star on any page — up to {max}.
          </DialogDescription>
        </DialogHeader>
        {order.length ? (
          <Reorder.Group axis="y" values={order} onReorder={setOrder} className="max-h-[60vh] space-y-2 overflow-y-auto p-0.5">
            {order.map((s, i) => (
              <ManageRow key={s.id} shortcut={s} index={i} count={order.length} onMove={move} onCommit={() => commit()} />
            ))}
          </Reorder.Group>
        ) : (
          <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
            No shortcuts yet. Open any screen and press the <Star className="inline h-3.5 w-3.5" aria-label="star" /> to pin it here.
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
}

/**
 * The strip under the top bar: your pinned screens, a star to pin the one you are on, and
 * your notes. Everything in it belongs to the signed-in user and follows them between devices.
 */
export function ShortcutBar() {
  const dispatch = useDispatch();
  const { data, isLoading } = useGetShortcutsQuery();
  const { data: notes } = useGetNotesQuery();
  const [managing, setManaging] = useState(false);
  const shortcuts = data?.items ?? [];
  const max = data?.max ?? 12;
  const noteCount = notes?.items?.length ?? 0;

  return (
    <div className="flex h-11 items-center gap-1 border-b bg-background/70 px-2 backdrop-blur sm:px-4">
      <span className="hidden shrink-0 items-center gap-1.5 pr-1 text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground md:flex">
        <Zap className="h-3.5 w-3.5 text-gold" aria-hidden /> Shortcuts
      </span>

      <PinButton shortcuts={shortcuts} max={max} />

      <nav
        aria-label="Your shortcuts"
        className="relative min-w-0 flex-1 overflow-x-auto [mask-image:linear-gradient(to_right,black_calc(100%-2rem),transparent)] [scrollbar-width:none]"
      >
        <ul className="flex items-center gap-1.5 pr-8">
          <AnimatePresence initial={false}>
            {shortcuts.map((s) => {
              const Icon = shortcutIcon(s.icon);
              return (
                <motion.li
                  key={s.id}
                  layout
                  initial={{ opacity: 0, scale: 0.85 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.85 }}
                  transition={{ duration: 0.2, ease: EASE }}
                  className="shrink-0"
                >
                  <NavLink
                    to={s.to}
                    end
                    className={({ isActive }) => cn(
                      'flex h-7 items-center gap-1.5 rounded-full border px-2.5 text-xs font-medium transition-colors',
                      isActive
                        ? 'border-gold/60 bg-gold/15 text-foreground'
                        : 'border-border bg-card text-muted-foreground hover:border-gold/40 hover:text-foreground',
                    )}
                  >
                    <Icon className="h-3.5 w-3.5 text-gold" aria-hidden />
                    <span className="max-w-[10rem] truncate">{s.label}</span>
                  </NavLink>
                </motion.li>
              );
            })}
          </AnimatePresence>
          {!isLoading && !shortcuts.length ? (
            <li className="truncate text-xs text-muted-foreground">
              Press the star to pin the screens you use most.
            </li>
          ) : null}
        </ul>
      </nav>

      {shortcuts.length ? (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" aria-label="Manage shortcuts" onClick={() => setManaging(true)}>
              <Settings2 className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">Manage shortcuts</TooltipContent>
        </Tooltip>
      ) : null}

      <span className="mx-1 h-5 w-px shrink-0 bg-border" aria-hidden />

      <Button
        variant="outline" size="sm"
        className="h-8 shrink-0 gap-1.5 rounded-full"
        onClick={() => dispatch(setNotesOpen(true))}
        aria-label={`Notes${noteCount ? `, ${noteCount}` : ''}`}
      >
        <StickyNote className="h-4 w-4 text-gold" />
        <span className="hidden sm:inline">Notes</span>
        {noteCount ? <span className="rounded-full bg-muted px-1.5 text-[10px] font-bold tabular-nums">{noteCount}</span> : <Plus className="h-3 w-3 sm:hidden" />}
      </Button>

      <ManageShortcuts open={managing} onOpenChange={setManaging} shortcuts={shortcuts} max={max} />
    </div>
  );
}
