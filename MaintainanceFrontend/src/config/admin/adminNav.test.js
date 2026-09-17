import { describe, it, expect } from 'vitest';
import { activeNavPath, breadcrumbsFor, contentHomeFor, landingPathFor, navForRole } from '@/config/admin/adminNav';

/** `{ group label: [item labels] }` for a role. */
const navOf = (role) => Object.fromEntries(navForRole(role).map((g) => [g.label, g.items.map((i) => i.label)]));

describe('admin nav', () => {
  it('shows ADMIN every group, in business order', () => {
    expect(Object.keys(navOf('ADMIN'))).toEqual([
      'Overview', 'Sales', 'Operations', 'Finance', 'Aftercare', 'Content', 'Page blocks', 'Blog & pages', 'Platform',
    ]);
    expect(navOf('ADMIN').Platform).toEqual([
      'Users', 'Roles & permissions', 'Login activity', 'Audit log', 'Messages', 'Message templates', 'Settings',
    ]);
    expect(navForRole('ADMIN').find((g) => g.key === 'platform').items.filter((i) => i.soon)).toEqual([]);
    expect(landingPathFor('ADMIN')).toBe('/admin');
  });

  it('shows EDITOR Content and settings only, and lands it on Content rather than the dashboard', () => {
    const nav = navOf('EDITOR');
    expect(Object.keys(nav)).toEqual(['Content', 'Page blocks', 'Blog & pages', 'Platform']);
    expect(nav.Platform).toEqual(['Settings']);
    expect(landingPathFor('EDITOR')).toBe('/admin/content');
    expect(nav.Content).toEqual([
      'Home page', 'Hero slides', 'Services', 'Service categories', 'Projects', 'Offers', 'Pricing plans',
      'Testimonials', 'FAQs', 'Gallery', 'Media library',
    ]);
    expect(nav['Page blocks']).toEqual(['Features', 'List items', 'Content blocks', 'Process steps']);
    expect(nav['Blog & pages']).toEqual(['Posts', 'Post categories', 'Pages']);
    // Every content screen is built now.
    expect(navForRole('EDITOR').flatMap((g) => g.items).filter((i) => i.soon)).toEqual([]);
    expect(nav.Sales).toBeUndefined();
    expect(contentHomeFor('EDITOR')).toBe('/admin/content/home');
  });

  it('shows ACCOUNTANT the rate card, read-only by capability', () => {
    expect(navOf('ACCOUNTANT').Sales).toContain('Rate card');
    expect(navOf('ACCOUNTANT').Content).toBeUndefined();
  });

  it('shows the admin platform screens to ADMIN alone', () => {
    const adminOnly = ['Users', 'Roles & permissions', 'Login activity', 'Audit log', 'Messages', 'Message templates'];
    for (const role of ['EDITOR', 'SALES', 'MANAGER', 'DISPATCHER', 'ACCOUNTANT', 'TECHNICIAN', 'SURVEYOR']) {
      const platform = navOf(role).Platform ?? [];
      for (const label of adminOnly) expect(platform, `${role} sees ${label}`).not.toContain(label);
    }
    expect(breadcrumbsFor('/admin/platform/message-templates/quotation_sent')).toEqual([
      { label: 'Platform' }, { label: 'Message templates', to: '/admin/platform/message-templates' }, { label: 'Edit' },
    ]);
    expect(breadcrumbsFor('/admin/platform/audit')).toEqual([{ label: 'Platform' }, { label: 'Audit log', to: '/admin/platform/audit' }]);
  });

  it('shows Settings (read-only) to EDITOR and ADMIN only', () => {
    for (const role of ['SALES', 'DISPATCHER', 'ACCOUNTANT']) expect(navOf(role).Platform).toBeUndefined();
    expect(navOf('ADMIN').Platform).toContain('Settings');
  });

  it('hides Content, Finance and Platform from SALES', () => {
    const nav = navOf('SALES');
    expect(Object.keys(nav)).toEqual(['Overview', 'Sales', 'Operations', 'Aftercare']);
    expect(nav.Sales).toEqual(['SLA board', 'Leads', 'Pipeline', 'Customers', 'Site surveys', 'Quotations', 'Rate card']);
    // SALES reads jobs, templates and technicians (to pick a surveyor); dispatch and stock are not theirs.
    expect(nav.Operations).toEqual(['Jobs', 'Technicians', 'Job templates']);
    expect(landingPathFor('SALES')).toBe('/admin');
    expect(contentHomeFor('SALES')).toBe('/admin');
  });

  it('keeps unbuilt modules marked as soon', () => {
    const sales = navForRole('SALES').find((g) => g.key === 'sales').items;
    expect(sales.find((i) => i.label === 'Customers').soon).toBeFalsy();
    expect(sales.find((i) => i.label === 'Leads').soon).toBeFalsy();
    const ops = navForRole('SALES').find((g) => g.key === 'operations').items;
    expect(ops.find((i) => i.label === 'Jobs').soon).toBeFalsy();
    const finance = navForRole('ADMIN').find((g) => g.key === 'finance').items;
    expect(finance.find((i) => i.label === 'Invoices').soon).toBe(true);
  });

  it('gives the dispatcher the whole of Operations (Phase H1)', () => {
    const nav = navOf('DISPATCHER');
    expect(nav.Operations).toEqual([
      'Jobs', 'Dispatch board', 'Technicians', 'Job templates', 'Stock', 'Materials', 'Material categories', 'Suppliers',
    ]);
    expect(navOf('ACCOUNTANT').Operations).toEqual(['Jobs', 'Job templates']);
    expect(breadcrumbsFor('/admin/jobs/cl1')).toEqual([{ label: 'Operations' }, { label: 'Jobs', to: '/admin/jobs' }, { label: 'Details' }]);
    expect(breadcrumbsFor('/admin/material-categories/new').at(-2)).toEqual({ label: 'Material categories', to: '/admin/material-categories' });
    expect(breadcrumbsFor('/admin/materials/cl1').at(-1)).toEqual({ label: 'Edit' });
    expect(activeNavPath('/admin/dispatch')).toBe('/admin/dispatch');
  });

  it('builds the breadcrumb from the path', () => {
    expect(breadcrumbsFor('/admin')).toEqual([{ label: 'Overview' }, { label: 'Dashboard', to: '/admin' }]);
    expect(breadcrumbsFor('/admin/leads/cl123')).toEqual([{ label: 'Sales' }, { label: 'Leads', to: '/admin/leads' }, { label: 'Details' }]);
    expect(breadcrumbsFor('/admin/content/faqs')).toEqual([{ label: 'Content' }, { label: 'FAQs', to: '/admin/content/faqs' }]);
    expect(breadcrumbsFor('/admin/content/faqs/new').at(-1)).toEqual({ label: 'New' });
    expect(breadcrumbsFor('/admin/content/faqs/cl123/').at(-1)).toEqual({ label: 'Edit' });
    expect(breadcrumbsFor('/admin/content/nope')).toEqual([{ label: 'Content' }]);
    expect(breadcrumbsFor('/admin/content/media')).toEqual([{ label: 'Content' }, { label: 'Media library', to: '/admin/content/media' }]);
    expect(breadcrumbsFor('/admin/rate-card/cl123')).toEqual([{ label: 'Sales' }, { label: 'Rate card', to: '/admin/rate-card' }, { label: 'Edit' }]);
    expect(breadcrumbsFor('/admin/content/services/new')).toEqual([
      { label: 'Content' }, { label: 'Services', to: '/admin/content/services' }, { label: 'New' },
    ]);
    expect(breadcrumbsFor('/admin/content/list-items/cl123')).toEqual([
      { label: 'Page blocks' }, { label: 'List items', to: '/admin/content/list-items' }, { label: 'Edit' },
    ]);
    expect(breadcrumbsFor('/admin/content/posts/new').slice(0, 1)).toEqual([{ label: 'Blog & pages' }]);
    expect(breadcrumbsFor('/admin/platform/settings')).toEqual([
      { label: 'Platform' }, { label: 'Settings', to: '/admin/platform/settings' },
    ]);
    expect(breadcrumbsFor('/tech')).toEqual([]);
    expect(breadcrumbsFor('/admin/leads/board')).toEqual([{ label: 'Sales' }, { label: 'Pipeline', to: '/admin/leads/board' }]);
    expect(breadcrumbsFor('/admin/customers/cl1')).toEqual([{ label: 'Sales' }, { label: 'Customers', to: '/admin/customers' }, { label: 'Details' }]);
  });
});

describe('the active nav item', () => {
  it('is the longest match', () => {
    expect(activeNavPath('/admin/leads')).toBe('/admin/leads');
    expect(activeNavPath('/admin/leads/cl1')).toBe('/admin/leads');
    expect(activeNavPath('/admin/leads/board')).toBe('/admin/leads/board');
    expect(activeNavPath('/admin/customers/cl1')).toBe('/admin/customers');
    expect(activeNavPath('/admin')).toBe('/admin');
    expect(activeNavPath('/admin/nowhere')).toBeNull();
  });

  it('offers Customers and the Pipeline to sales and dispatch, not to editors', () => {
    const items = (role) => navForRole(role).flatMap((g) => g.items).filter((i) => !i.soon).map((i) => i.to);
    expect(items('SALES')).toEqual(expect.arrayContaining(['/admin/customers', '/admin/leads/board']));
    expect(items('DISPATCHER')).toEqual(expect.arrayContaining(['/admin/customers', '/admin/leads/board']));
    expect(items('ACCOUNTANT')).toContain('/admin/customers');
    expect(items('ACCOUNTANT')).not.toContain('/admin/leads/board');
    expect(items('EDITOR')).not.toContain('/admin/customers');
  });
});
