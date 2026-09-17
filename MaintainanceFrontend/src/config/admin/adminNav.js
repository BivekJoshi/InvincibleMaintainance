import {
  Blocks, Briefcase, Building2, CalendarDays, ClipboardCheck, Coins, Contact, File, FileText, GalleryHorizontal,
  HelpCircle, Home, Image, Images, KanbanSquare, LayoutDashboard, LayoutGrid, ListChecks, ListOrdered, LogIn,
  MessageSquareQuote, MessageSquareText, Newspaper, Package, Receipt, Ruler, ScrollText, Send, Settings, ShieldCheck,
  Sparkles, Tag, Tags, Timer, UserCog, Users, Wallet, Wrench,
} from 'lucide-react';
import { can } from '@/helpers/permissions';

/**
 * The back office's navigation, grouped by what the business does. Filtered by
 * capability — the same map the API enforces — and pure, so it is tested without a DOM.
 *
 * `soon` marks a module whose API exists but whose screen does not. It renders as
 * plainly unavailable rather than as a link, because a nav item that bounces you back
 * to the dashboard reads as a broken app, not as an unbuilt one.
 *
 * A built item at `/admin/content/<resource>` — in Content, Page blocks or Blog & pages —
 * must have an entry in `resourceRegistry.js` with the same capability, unless it is one of
 * the bespoke content pages (`BESPOKE_CONTENT`); an entry with its own `basePath` has an item
 * at that path in whichever group it belongs to. The registry test enforces all of it.
 *
 * `editLabel` names the last crumb under an item (`Edit` for content, `Details` elsewhere).
 * `badge` names a live count the shell shows beside the item (`slaBreached`).
 *
 * @typedef {{ to: string, label: string, icon: import('react').ElementType, capability?: string, end?: boolean, soon?: boolean, editLabel?: string, badge?: string }} NavItem
 * @typedef {{ key: string, label: string, items: NavItem[] }} NavGroup
 */

/** @type {NavGroup[]} */
export const ADMIN_NAV = [
  {
    key: 'overview',
    label: 'Overview',
    items: [{ to: '/admin', label: 'Dashboard', icon: LayoutDashboard, end: true }],
  },
  {
    key: 'sales',
    label: 'Sales',
    items: [
      { to: '/admin/sla', label: 'SLA board', icon: Timer, capability: 'leads:read', badge: 'slaBreached' },
      { to: '/admin/leads', label: 'Leads', icon: Users, capability: 'leads:read' },
      { to: '/admin/leads/board', label: 'Pipeline', icon: KanbanSquare, capability: 'leads:read', editLabel: 'Board' },
      { to: '/admin/customers', label: 'Customers', icon: Contact, capability: 'customers:read' },
      { to: '/admin/surveys', label: 'Site surveys', icon: ClipboardCheck, capability: 'surveys:read' },
      { to: '/admin/quotations', label: 'Quotations', icon: FileText, capability: 'quotations:read' },
      { to: '/admin/rate-card', label: 'Rate card', icon: Ruler, capability: 'quotations:read', editLabel: 'Edit' },
    ],
  },
  {
    key: 'operations',
    label: 'Operations',
    items: [
      { to: '/admin/jobs', label: 'Jobs', icon: Briefcase, capability: 'jobs:read', soon: true },
      { to: '/admin/dispatch', label: 'Dispatch board', icon: CalendarDays, capability: 'jobs:dispatch', soon: true },
      { to: '/admin/materials', label: 'Materials', icon: Package, capability: 'materials:read', soon: true },
    ],
  },
  {
    key: 'finance',
    label: 'Finance',
    items: [
      { to: '/admin/invoices', label: 'Invoices', icon: Receipt, capability: 'invoices:read', soon: true },
      { to: '/admin/expenses', label: 'Expenses', icon: Wallet, capability: 'expenses:read', soon: true },
    ],
  },
  {
    key: 'aftercare',
    label: 'Aftercare',
    items: [
      { to: '/admin/warranties', label: 'Warranty & AMC', icon: ShieldCheck, capability: 'jobs:read', soon: true },
    ],
  },
  {
    key: 'content',
    label: 'Content',
    items: [
      { to: '/admin/content/home', label: 'Home page', icon: Home, capability: 'cms:read' },
      { to: '/admin/content/hero-slides', label: 'Hero slides', icon: GalleryHorizontal, capability: 'cms:read' },
      { to: '/admin/content/services', label: 'Services', icon: Wrench, capability: 'cms:read' },
      { to: '/admin/content/service-categories', label: 'Service categories', icon: LayoutGrid, capability: 'cms:read' },
      { to: '/admin/content/projects', label: 'Projects', icon: Building2, capability: 'cms:read' },
      { to: '/admin/content/offers', label: 'Offers', icon: Tag, capability: 'cms:read' },
      { to: '/admin/content/pricing-plans', label: 'Pricing plans', icon: Coins, capability: 'cms:read' },
      { to: '/admin/content/testimonials', label: 'Testimonials', icon: MessageSquareQuote, capability: 'cms:read' },
      { to: '/admin/content/faqs', label: 'FAQs', icon: HelpCircle, capability: 'cms:read' },
      { to: '/admin/content/gallery', label: 'Gallery', icon: Images, capability: 'cms:read' },
      // media:read is also held by SALES and DISPATCHER for job photos; the library screen is an editor's.
      { to: '/admin/content/media', label: 'Media library', icon: Image, capability: 'cms:read' },
    ],
  },
  {
    // The smaller pieces the home page's bands are made of.
    key: 'blocks',
    label: 'Page blocks',
    items: [
      { to: '/admin/content/features', label: 'Features', icon: Sparkles, capability: 'cms:read' },
      { to: '/admin/content/list-items', label: 'List items', icon: ListChecks, capability: 'cms:read' },
      { to: '/admin/content/content-blocks', label: 'Content blocks', icon: Blocks, capability: 'cms:read' },
      { to: '/admin/content/process-steps', label: 'Process steps', icon: ListOrdered, capability: 'cms:read' },
    ],
  },
  {
    key: 'publishing',
    label: 'Blog & pages',
    items: [
      { to: '/admin/content/posts', label: 'Posts', icon: Newspaper, capability: 'cms:read' },
      { to: '/admin/content/post-categories', label: 'Post categories', icon: Tags, capability: 'cms:read' },
      { to: '/admin/content/pages', label: 'Pages', icon: File, capability: 'cms:read' },
    ],
  },
  {
    key: 'platform',
    label: 'Platform',
    items: [
      // ADMIN only: these capabilities are held by ADMIN's `*` alone, and the API refuses every other role.
      { to: '/admin/platform/users', label: 'Users', icon: UserCog, capability: 'users:admin' },
      { to: '/admin/platform/roles', label: 'Roles & permissions', icon: ShieldCheck, capability: 'users:admin' },
      { to: '/admin/platform/login-activity', label: 'Login activity', icon: LogIn, capability: 'users:admin' },
      { to: '/admin/platform/audit', label: 'Audit log', icon: ScrollText, capability: 'audit:read' },
      { to: '/admin/platform/messages', label: 'Messages', icon: Send, capability: 'messages:admin' },
      { to: '/admin/platform/message-templates', label: 'Message templates', icon: MessageSquareText, capability: 'messages:admin', editLabel: 'Edit' },
      // EDITOR reads the settings; only ADMIN saves them (settings:write is held by ADMIN's `*` alone).
      { to: '/admin/platform/settings', label: 'Settings', icon: Settings, capability: 'settings:read' },
    ],
  },
];

/** Content screens that are pages of their own rather than registry entries. */
export const BESPOKE_CONTENT = ['/admin/content/home', '/admin/content/media'];

/** A role whose whole job is one group starts there — an empty dashboard is not a welcome. */
const LANDING = { EDITOR: '/admin/content' };

/** Where `/admin` sends a role. `/admin` itself means the dashboard. */
export const landingPathFor = (role) => LANDING[role] ?? '/admin';

/**
 * The groups and items a role sees, empty groups dropped. The dashboard is hidden from a
 * role that lands elsewhere, because `/admin` would only redirect it.
 *
 * @param {string|null} role
 * @returns {NavGroup[]}
 */
export function navForRole(role) {
  const landing = landingPathFor(role);
  return ADMIN_NAV
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => (
        (!item.capability || can(role, item.capability)) && !(item.to === '/admin' && landing !== '/admin')
      )),
    }))
    .filter((group) => group.items.length);
}

/** `/admin/content` → the first built content screen this role can open, else `/admin`. */
export function contentHomeFor(role) {
  const content = navForRole(role).find((g) => g.key === 'content');
  return content?.items.find((item) => !item.soon)?.to ?? '/admin';
}

/**
 * The trail for an admin path, derived from the nav: group › screen › New | Edit | Details.
 * The last crumb is the current page; a screen crumb before it carries `to`.
 *
 * @param {string} pathname
 * @returns {{ label: string, to?: string }[]}
 */
function bestMatch(pathname) {
  const path = pathname.replace(/\/+$/, '') || '/';
  let best = null;
  for (const group of ADMIN_NAV) {
    for (const item of group.items) {
      if (item.soon) continue;
      const matches = item.end ? path === item.to : path === item.to || path.startsWith(`${item.to}/`);
      if (matches && (!best || item.to.length > best.item.to.length)) best = { group, item };
    }
  }
  return { path, best };
}

/**
 * The nav item a path belongs to — the longest match, so the board at `/admin/leads/board`
 * is Pipeline, not Leads, while a lead at `/admin/leads/:id` is Leads.
 *
 * @param {string} pathname
 * @returns {string|null} the item's `to`
 */
export const activeNavPath = (pathname) => bestMatch(pathname).best?.item.to ?? null;

export function breadcrumbsFor(pathname) {
  const { path, best } = bestMatch(pathname);
  if (!best) return path === '/admin/content' || path.startsWith('/admin/content/') ? [{ label: 'Content' }] : [];

  const crumbs = [{ label: best.group.label }, { label: best.item.label, to: best.item.to }];
  const [next] = path.slice(best.item.to.length).split('/').filter(Boolean);
  const isContent = best.item.to.startsWith('/admin/content/');
  if (next) crumbs.push({ label: next === 'new' ? 'New' : best.item.editLabel ?? (isContent ? 'Edit' : 'Details') });
  return crumbs;
}
