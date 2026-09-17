import {
  Bookmark, Boxes, Briefcase, Building2, CalendarDays, ClipboardCheck, ClipboardList, Contact, FileText, Flag,
  FolderTree, HardHat, Heart, Home, Image, KanbanSquare, LayoutDashboard, Newspaper, Package, Receipt, Ruler,
  ScrollText, Send, Settings, Star, Tag, Timer, Truck, UserCog, Users, Wrench, Zap,
} from 'lucide-react';
import { ADMIN_NAV, activeNavPath, breadcrumbsFor } from '@/config/admin/adminNav';
import { NOTE_COLORS } from '@/form/schemas/me.schema';

/**
 * The marks a pinned shortcut can wear, stored by name. A name the list does not know
 * (an icon removed later) falls back to the bookmark rather than breaking the bar.
 */
export const SHORTCUT_ICONS = {
  Bookmark, Star, Zap, Flag, Heart,
  LayoutDashboard, Timer, Users, KanbanSquare, Contact, ClipboardCheck, FileText, Ruler,
  Briefcase, CalendarDays, HardHat, ClipboardList, Boxes, Package, FolderTree, Truck,
  Receipt, Home, Wrench, Building2, Tag, Image, Newspaper, UserCog, ScrollText, Send, Settings,
};

export const shortcutIcon = (name) => SHORTCUT_ICONS[name] ?? Bookmark;

const iconNameOf = (component) => Object.keys(SHORTCUT_ICONS).find((k) => SHORTCUT_ICONS[k] === component);

/**
 * What pinning `pathname` + `search` would save: the address, a name from the nav and the
 * screen's own icon. A record page is named after its screen and the crumb under it
 * ("Leads · Details"); the name is only a suggestion — the pin form lets you change it.
 *
 * @param {string} pathname
 * @param {string} [search]
 * @returns {{ to: string, label: string, icon: string } | null} null outside the back office
 */
export function suggestShortcut(pathname, search = '') {
  const path = pathname.replace(/\/+$/, '') || '/';
  if (path !== '/admin' && !path.startsWith('/admin/')) return null;

  const to = `${path}${search && search !== '?' ? search : ''}`;
  const activeTo = activeNavPath(path);
  const item = ADMIN_NAV.flatMap((g) => g.items).find((i) => i.to === activeTo);
  if (!item) return { to, label: 'Back office', icon: 'Bookmark' };

  const crumbs = breadcrumbsFor(path);
  const tail = crumbs.length > 2 ? crumbs.at(-1).label : null;
  const label = [item.label, tail, search && search !== '?' ? 'filtered' : null].filter(Boolean).join(' · ');
  return { to, label: label.slice(0, 40), icon: iconNameOf(item.icon) ?? 'Bookmark' };
}

/** Whether a saved shortcut is the page on screen (a trailing slash does not count). */
export const isSamePlace = (to, pathname, search = '') =>
  to === `${pathname.replace(/\/+$/, '') || '/'}${search && search !== '?' ? search : ''}`;

/**
 * Full class names per note colour — Tailwind only ships the classes it can read in the
 * source, so they are spelled out rather than built from the colour's name.
 */
export const NOTE_STYLES = {
  yellow: { paper: 'bg-note-yellow border-note-yellow-edge', swatch: 'bg-note-yellow-edge', label: 'Yellow' },
  blue: { paper: 'bg-note-blue border-note-blue-edge', swatch: 'bg-note-blue-edge', label: 'Blue' },
  green: { paper: 'bg-note-green border-note-green-edge', swatch: 'bg-note-green-edge', label: 'Green' },
  pink: { paper: 'bg-note-pink border-note-pink-edge', swatch: 'bg-note-pink-edge', label: 'Pink' },
  purple: { paper: 'bg-note-purple border-note-purple-edge', swatch: 'bg-note-purple-edge', label: 'Purple' },
};

export const noteStyle = (color) => NOTE_STYLES[color] ?? NOTE_STYLES[NOTE_COLORS[0]];
