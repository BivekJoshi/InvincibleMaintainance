import { describe, it, expect } from 'vitest';
import { activeNavPath, activeNavTab, breadcrumbsFor, contentHomeFor, landingPathFor, navForRole, navTabsForRole } from '@/config/admin/adminNav';
import { can } from '@/helpers/permissions';

/** `{ group label: [item labels] }` for a role. */
const navOf = (role) => Object.fromEntries(navForRole(role).map((g) => [g.label, g.items.map((i) => i.label)]));

describe('admin nav', () => {
  it('shows ADMIN every group, in business order', () => {
    expect(Object.keys(navOf('ADMIN'))).toEqual([
      'Overview', 'Sales', 'Operations', 'Finance', 'Aftercare', 'Reports',
      'Catalog', 'Page blocks', 'Messaging', 'Content', 'Blog & pages', 'Platform',
    ]);
    expect(navOf('ADMIN').Platform).toEqual([
      'Users', 'Roles & permissions', 'Login activity', 'Audit log', 'Messages', 'Settings',
    ]);
    expect(navOf('ADMIN').Messaging).toEqual(['Message templates']);
    expect(navForRole('ADMIN').find((g) => g.key === 'platform').items.filter((i) => i.soon)).toEqual([]);
    expect(landingPathFor('ADMIN')).toBe('/admin');
  });

  it('shows EDITOR Content and settings only, and lands it on Content rather than the dashboard', () => {
    const nav = navOf('EDITOR');
    expect(Object.keys(nav)).toEqual(['Page blocks', 'Content', 'Blog & pages', 'Platform']);
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

  it('shows ACCOUNTANT the rate library and trades, read-only by capability', () => {
    expect(navOf('ACCOUNTANT').Catalog).toEqual(['Rate library', 'Trades & wages', 'Terms library', 'Job templates']);
    expect(navOf('ACCOUNTANT').Content).toBeUndefined();
  });

  it('shows the rate library to whoever prices work, never to the field (Phase L2)', () => {
    for (const role of ['ADMIN', 'MANAGER', 'SALES', 'ACCOUNTANT']) {
      expect(navOf(role).Catalog, role).toEqual(expect.arrayContaining(['Rate library', 'Trades & wages']));
    }
    for (const role of ['DISPATCHER', 'EDITOR', 'SURVEYOR', 'TECHNICIAN']) {
      expect(navOf(role).Catalog ?? [], role).not.toContain('Rate library');
    }
    expect(breadcrumbsFor('/admin/trades/cl1')).toEqual([{ label: 'Catalog' }, { label: 'Trades & wages', to: '/admin/trades' }, { label: 'Edit' }]);
  });

  it('puts the terms library beside the rate library, for whoever reads rates (Phase L4)', () => {
    for (const role of ['ADMIN', 'MANAGER', 'SALES', 'ACCOUNTANT']) {
      expect(navOf(role).Catalog, role).toContain('Terms library');
    }
    for (const role of ['DISPATCHER', 'EDITOR', 'SURVEYOR', 'TECHNICIAN']) {
      expect(navOf(role).Catalog ?? [], role).not.toContain('Terms library');
    }
    expect(breadcrumbsFor('/admin/quotation-terms/new')).toEqual([
      { label: 'Catalog' }, { label: 'Terms library', to: '/admin/quotation-terms' }, { label: 'New' },
    ]);
  });

  it('shows the admin platform screens to ADMIN alone', () => {
    const adminOnly = ['Users', 'Roles & permissions', 'Login activity', 'Audit log', 'Messages', 'Message templates'];
    for (const role of ['EDITOR', 'SALES', 'MANAGER', 'DISPATCHER', 'ACCOUNTANT', 'TECHNICIAN', 'SURVEYOR']) {
      const platform = [...(navOf(role).Platform ?? []), ...(navOf(role).Messaging ?? [])];
      for (const label of adminOnly) expect(platform, `${role} sees ${label}`).not.toContain(label);
    }
    expect(breadcrumbsFor('/admin/platform/message-templates/quotation_sent')).toEqual([
      { label: 'Messaging' }, { label: 'Message templates', to: '/admin/platform/message-templates' }, { label: 'Edit' },
    ]);
    expect(breadcrumbsFor('/admin/platform/audit')).toEqual([{ label: 'Platform' }, { label: 'Audit log', to: '/admin/platform/audit' }]);
  });

  it('shows Settings (read-only) to EDITOR and ADMIN only', () => {
    for (const role of ['SALES', 'DISPATCHER', 'ACCOUNTANT']) expect(navOf(role).Platform).toBeUndefined();
    expect(navOf('ADMIN').Platform).toContain('Settings');
  });

  it('hides Content, Finance and Platform from SALES', () => {
    const nav = navOf('SALES');
    expect(Object.keys(nav)).toEqual(['Overview', 'Sales', 'Operations', 'Aftercare', 'Reports', 'Catalog']);
    // Lost leads moved into Reports › Sales reports (Phase I10).
    expect(nav.Sales).toEqual(['SLA board', 'Leads', 'Pipeline', 'Customers', 'Site surveys', 'Quotations']);
    expect(nav.Reports).toEqual(['Sales reports']);
    // SALES reads jobs, templates and technicians (to pick a surveyor); dispatch and stock are not theirs.
    expect(nav.Operations).toEqual(['Jobs', 'Technicians', 'Inspection templates']);
    expect(nav.Catalog).toEqual(['Rate library', 'Trades & wages', 'Terms library', 'Job templates']);
    expect(landingPathFor('SALES')).toBe('/admin');
    expect(contentHomeFor('SALES')).toBe('/admin');
  });

  it('keeps unbuilt modules marked as soon', () => {
    const sales = navForRole('SALES').find((g) => g.key === 'sales').items;
    expect(sales.find((i) => i.label === 'Customers').soon).toBeFalsy();
    expect(sales.find((i) => i.label === 'Leads').soon).toBeFalsy();
    const ops = navForRole('SALES').find((g) => g.key === 'operations').items;
    expect(ops.find((i) => i.label === 'Jobs').soon).toBeFalsy();
    // Finance is built (Phase I).
    const finance = navForRole('ADMIN').find((g) => g.key === 'finance').items;
    expect(finance.filter((i) => i.soon)).toEqual([]);
  });

  it('gives the dispatcher the whole of Operations (Phase H1)', () => {
    const nav = navOf('DISPATCHER');
    expect(nav.Operations).toEqual(['Jobs', 'Dispatch board', 'Technicians', 'Stock', 'Inspection templates']);
    expect(nav.Catalog).toEqual(['Job templates', 'Materials', 'Material categories', 'Suppliers']);
    expect(navOf('ACCOUNTANT').Operations).toEqual(['Jobs']);
    expect(breadcrumbsFor('/admin/jobs/cl1')).toEqual([{ label: 'Operations' }, { label: 'Jobs', to: '/admin/jobs' }, { label: 'Details' }]);
    expect(breadcrumbsFor('/admin/material-categories/new').at(0)).toEqual({ label: 'Catalog' });
    expect(breadcrumbsFor('/admin/material-categories/new').at(-2)).toEqual({ label: 'Material categories', to: '/admin/material-categories' });
    expect(breadcrumbsFor('/admin/materials/cl1').at(-1)).toEqual({ label: 'Edit' });
    expect(activeNavPath('/admin/dispatch')).toBe('/admin/dispatch');
  });

  it('lists the inspection templates under Operations for whoever reads surveys (Phase L5)', () => {
    for (const role of ['ADMIN', 'MANAGER', 'SALES', 'DISPATCHER']) {
      expect(navOf(role).Operations, role).toContain('Inspection templates');
    }
    for (const role of ['ACCOUNTANT', 'EDITOR', 'SURVEYOR', 'TECHNICIAN']) {
      expect(navOf(role).Operations ?? [], role).not.toContain('Inspection templates');
    }
    expect(breadcrumbsFor('/admin/inspection-templates/new')).toEqual([
      { label: 'Operations' }, { label: 'Inspection templates', to: '/admin/inspection-templates' }, { label: 'New' },
    ]);
    expect(breadcrumbsFor('/admin/inspection-templates/it1').at(-1)).toEqual({ label: 'Edit' });
  });

  it('builds the breadcrumb from the path', () => {
    expect(breadcrumbsFor('/admin')).toEqual([{ label: 'Overview' }, { label: 'Dashboard', to: '/admin' }]);
    expect(breadcrumbsFor('/admin/leads/cl123')).toEqual([{ label: 'Sales' }, { label: 'Leads', to: '/admin/leads' }, { label: 'Details' }]);
    expect(breadcrumbsFor('/admin/content/faqs')).toEqual([{ label: 'Content' }, { label: 'FAQs', to: '/admin/content/faqs' }]);
    expect(breadcrumbsFor('/admin/content/faqs/new').at(-1)).toEqual({ label: 'New' });
    expect(breadcrumbsFor('/admin/content/faqs/cl123/').at(-1)).toEqual({ label: 'Edit' });
    expect(breadcrumbsFor('/admin/content/nope')).toEqual([{ label: 'Content' }]);
    expect(breadcrumbsFor('/admin/content/media')).toEqual([{ label: 'Content' }, { label: 'Media library', to: '/admin/content/media' }]);
    expect(breadcrumbsFor('/admin/rate-card/cl123')).toEqual([{ label: 'Catalog' }, { label: 'Rate library', to: '/admin/rate-card' }, { label: 'Edit' }]);
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

describe('finance and reports (Phase I)', () => {
  it('gives the accountant the whole of Finance, and nobody else money they do not hold', () => {
    expect(navOf('ACCOUNTANT').Finance).toEqual(['Invoices', 'Payments', 'Expenses', 'Finance reports']);
    expect(navOf('ADMIN').Finance).toEqual(['Invoices', 'Payments', 'Expenses', 'Finance reports']);
    for (const role of ['SALES', 'MANAGER', 'DISPATCHER', 'EDITOR', 'TECHNICIAN', 'SURVEYOR']) {
      expect(navOf(role).Finance, `${role} sees Finance`).toBeUndefined();
    }
    // The accountant has no sales or operations reports, and no job margin (costs:read is the money wall's).
    expect(navOf('ACCOUNTANT').Reports).toBeUndefined();
  });

  it('shows each report screen to its capability only — job margin to costs:read', () => {
    expect(navOf('ADMIN').Reports).toEqual(['Sales reports', 'Operations reports', 'Job margin']);
    expect(navOf('MANAGER').Reports).toEqual(['Sales reports', 'Job margin']);
    expect(navOf('SALES').Reports).toEqual(['Sales reports']);
    expect(navOf('DISPATCHER').Reports).toEqual(['Operations reports']);
    for (const role of ['SALES', 'DISPATCHER', 'ACCOUNTANT', 'EDITOR']) {
      expect(navOf(role).Reports ?? [], role).not.toContain('Job margin');
    }
  });

  it('names the finance screens in the breadcrumb', () => {
    expect(breadcrumbsFor('/admin/invoices/inv1')).toEqual([{ label: 'Finance' }, { label: 'Invoices', to: '/admin/invoices' }, { label: 'Details' }]);
    expect(breadcrumbsFor('/admin/expenses/new')).toEqual([{ label: 'Finance' }, { label: 'Expenses', to: '/admin/expenses' }, { label: 'New' }]);
    expect(breadcrumbsFor('/admin/expenses/ex1').at(-1)).toEqual({ label: 'Edit' });
    expect(breadcrumbsFor('/admin/finance/payments')).toEqual([{ label: 'Finance' }, { label: 'Payments', to: '/admin/finance/payments' }]);
    expect(breadcrumbsFor('/admin/reports/sales')).toEqual([{ label: 'Reports' }, { label: 'Sales reports', to: '/admin/reports/sales' }]);
    expect(activeNavTab('/admin/finance/reports')).toBe('home');
  });
});

describe('aftercare (Phase I)', () => {
  const AFTERCARE = ['Warranties', 'Warranty claims', 'AMC contracts', 'Service reminders'];

  it('shows the Aftercare group to whoever reads it, by capability — not to the accountant', () => {
    for (const role of ['ADMIN', 'DISPATCHER', 'SALES', 'MANAGER']) expect(navOf(role).Aftercare, role).toEqual(AFTERCARE);
    for (const role of ['ACCOUNTANT', 'EDITOR', 'TECHNICIAN', 'SURVEYOR']) expect(navOf(role).Aftercare, role).toBeUndefined();
    expect(navForRole('ADMIN').find((g) => g.key === 'aftercare').items.filter((i) => i.soon)).toEqual([]);
  });

  it('gates each item on the capability its API checks: DISPATCHER writes, SALES and MANAGER read only', () => {
    const items = navForRole('ADMIN').find((g) => g.key === 'aftercare').items;
    expect(Object.fromEntries(items.map((i) => [i.to, i.capability]))).toEqual({
      '/admin/warranties': 'warranties:read',
      '/admin/warranty-claims': 'warranties:read',
      '/admin/amc-contracts': 'amc:read',
      '/admin/service-reminders': 'reminders:read',
    });
    for (const write of ['warranties:write', 'amc:write', 'reminders:write']) {
      expect(can('DISPATCHER', write), write).toBe(true);
      for (const role of ['SALES', 'MANAGER', 'ACCOUNTANT']) expect(can(role, write), `${role} ${write}`).toBe(false);
    }
  });

  it('names the aftercare screens in the breadcrumb, a claim apart from its warranty', () => {
    expect(breadcrumbsFor('/admin/warranties/w1')).toEqual([{ label: 'Aftercare' }, { label: 'Warranties', to: '/admin/warranties' }, { label: 'Details' }]);
    expect(breadcrumbsFor('/admin/warranty-claims/cl1')).toEqual([{ label: 'Aftercare' }, { label: 'Warranty claims', to: '/admin/warranty-claims' }, { label: 'Details' }]);
    expect(breadcrumbsFor('/admin/amc-contracts/a1').at(-2)).toEqual({ label: 'AMC contracts', to: '/admin/amc-contracts' });
    expect(activeNavPath('/admin/warranty-claims/cl1')).toBe('/admin/warranty-claims');
    expect(activeNavTab('/admin/service-reminders')).toBe('home');
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

describe('the sidebar tabs', () => {
  const tabsOf = (role) => navTabsForRole(role).map((t) => [t.key, t.groups.map((g) => g.label)]);

  it('splits ADMIN into Home, Helpers, Others and Settings', () => {
    expect(tabsOf('ADMIN')).toEqual([
      ['home', ['Overview', 'Sales', 'Operations', 'Finance', 'Aftercare', 'Reports']],
      ['helpers', ['Catalog', 'Page blocks', 'Messaging']],
      ['others', ['Content', 'Blog & pages']],
      ['settings', ['Platform']],
    ]);
  });

  it('drops a tab with nothing in it', () => {
    expect(tabsOf('EDITOR').map(([key]) => key)).toEqual(['helpers', 'others', 'settings']);
    expect(tabsOf('SALES').map(([key]) => key)).toEqual(['home', 'helpers']);
  });

  it('follows the page you are on', () => {
    expect(activeNavTab('/admin')).toBe('home');
    expect(activeNavTab('/admin/leads/cl1')).toBe('home');
    expect(activeNavTab('/admin/materials/new')).toBe('helpers');
    expect(activeNavTab('/admin/content/list-items')).toBe('helpers');
    expect(activeNavTab('/admin/content/posts/cl1')).toBe('others');
    expect(activeNavTab('/admin/platform/message-templates')).toBe('helpers');
    expect(activeNavTab('/admin/platform/users')).toBe('settings');
    expect(activeNavTab('/admin/nowhere')).toBeNull();
  });
});
