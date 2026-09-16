import { describe, it, expect } from 'vitest';
import { breadcrumbsFor, contentHomeFor, landingPathFor, navForRole } from '@/config/admin/adminNav';

/** `{ group label: [item labels] }` for a role. */
const navOf = (role) => Object.fromEntries(navForRole(role).map((g) => [g.label, g.items.map((i) => i.label)]));

describe('admin nav', () => {
  it('shows ADMIN every group, in business order', () => {
    expect(Object.keys(navOf('ADMIN'))).toEqual(['Overview', 'Sales', 'Operations', 'Finance', 'Aftercare', 'Content', 'Platform']);
    expect(navOf('ADMIN').Platform).toEqual(['Users', 'Audit log', 'Settings']);
    expect(landingPathFor('ADMIN')).toBe('/admin');
  });

  it('shows EDITOR Content and settings only, and lands it on Content rather than the dashboard', () => {
    const nav = navOf('EDITOR');
    expect(Object.keys(nav)).toEqual(['Content', 'Platform']);
    expect(nav.Content).toContain('FAQs');
    expect(nav.Platform).toEqual(['Settings']);
    expect(landingPathFor('EDITOR')).toBe('/admin/content');
    expect(nav.Content).toEqual([
      'Home page', 'Hero slides', 'Services', 'Service categories', 'Projects', 'FAQs', 'Process steps', 'Media library',
    ]);
    expect(nav.Sales).toBeUndefined();
    expect(contentHomeFor('EDITOR')).toBe('/admin/content/home');
  });

  it('shows ACCOUNTANT the rate card, read-only by capability', () => {
    expect(navOf('ACCOUNTANT').Sales).toContain('Rate card');
    expect(navOf('ACCOUNTANT').Content).toBeUndefined();
  });

  it('hides Content, Finance and Platform from SALES', () => {
    const nav = navOf('SALES');
    expect(Object.keys(nav)).toEqual(['Overview', 'Sales', 'Operations', 'Aftercare']);
    expect(nav.Sales).toEqual(['SLA board', 'Leads', 'Customers', 'Site surveys', 'Quotations', 'Rate card']);
    expect(nav.Operations).toEqual(['Jobs']);
    expect(landingPathFor('SALES')).toBe('/admin');
    expect(contentHomeFor('SALES')).toBe('/admin');
  });

  it('keeps unbuilt modules marked as soon', () => {
    const sales = navForRole('SALES').find((g) => g.key === 'sales').items;
    expect(sales.find((i) => i.label === 'Customers').soon).toBe(true);
    expect(sales.find((i) => i.label === 'Leads').soon).toBeFalsy();
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
    expect(breadcrumbsFor('/tech')).toEqual([]);
  });
});
