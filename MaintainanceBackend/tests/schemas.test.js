import { describe, it, expect } from 'vitest';
import { publicLeadSchema } from '../src/shared/schemas/crm.js';
import { serviceSchema } from '../src/shared/schemas/cms.js';
import { toPartial } from '../src/shared/schemas/common.js';
import {
  MAX_NOTES, MAX_SHORTCUTS, noteCreateSchema, noteUpdateSchema, shortcutCreateSchema, shortcutOrderSchema,
  shortcutUpdateSchema,
} from '../src/shared/schemas/me.js';
import { SERVICE_BASE, SERVICE_SCHEMA_CASES } from './fixtures/serviceSchemaCases.js';

describe('public lead form validation', () => {
  const valid = { name: 'Deepak Rai', phone: '+977 9845112233', elapsedMs: 40000 };

  it('normalizes the phone number on the way in', () => {
    expect(publicLeadSchema.parse(valid).phone).toBe('9845112233');
  });

  it('rejects a malformed phone with a human message', () => {
    const r = publicLeadSchema.safeParse({ ...valid, phone: '12345' });
    expect(r.success).toBe(false);
    expect(r.error.issues[0].message).toMatch(/valid Nepali phone/);
  });

  it('rejects a filled honeypot', () => {
    expect(publicLeadSchema.safeParse({ ...valid, website: 'http://spam' }).success).toBe(false);
  });

  it('requires a name of at least two characters', () => {
    expect(publicLeadSchema.safeParse({ ...valid, name: 'X' }).success).toBe(false);
  });

  it('accepts an online booking with a slot', () => {
    const r = publicLeadSchema.safeParse({
      ...valid,
      preferredAt: new Date(Date.now() + 2 * 86400000).toISOString(),
      preferredSlot: 'morning',
    });
    expect(r.success).toBe(true);
    expect(r.data.preferredAt).toBeInstanceOf(Date);
  });

  it('refuses a booking in the past or too far out', () => {
    expect(publicLeadSchema.safeParse({ ...valid, preferredAt: '2020-01-01' }).success).toBe(false);
    expect(publicLeadSchema.safeParse({
      ...valid, preferredAt: new Date(Date.now() + 200 * 86400000).toISOString(),
    }).success).toBe(false);
  });

  it('refuses a slot it does not run', () => {
    expect(publicLeadSchema.safeParse({ ...valid, preferredSlot: 'midnight' }).success).toBe(false);
  });
});

describe('service copy quality gate', () => {
  const base = { name: 'Gate Painting' };

  it('rejects the templated boilerplate the old site shipped', () => {
    const r = serviceSchema.safeParse({ ...base, excerpt: 'Professional gate painting with expert tools and results.' });
    expect(r.success).toBe(false);
    expect(r.error.issues[0].message).toMatch(/placeholder copy/);
  });

  it('rejects copy that is too short to be useful', () => {
    expect(serviceSchema.safeParse({ ...base, excerpt: 'Too short' }).success).toBe(false);
  });

  it('rejects copy longer than the card shows', () => {
    const r = serviceSchema.safeParse({ ...base, excerpt: 'Rust treatment and repainting. '.repeat(7) });
    expect(r.success).toBe(false);
    expect(r.error.issues[0].path).toEqual(['excerpt']);
  });

  it('accepts genuine copy', () => {
    expect(serviceSchema.safeParse({
      ...base,
      excerpt: 'Rust treatment, primer and two topcoats on steel gates, with the hinges serviced while we are there.',
    }).success).toBe(true);
  });

  it('rejects a maximum price below the minimum', () => {
    const r = serviceSchema.safeParse({
      ...base,
      excerpt: 'Rust treatment, primer and two topcoats on steel gates, with the hinges serviced while we are there.',
      priceFrom: 500, priceTo: 100,
    });
    expect(r.success).toBe(false);
  });
});

describe('service schema cases shared with the SPA', () => {
  it.each(SERVICE_SCHEMA_CASES.map((c) => [c.name, c]))('%s', (_name, c) => {
    const r = serviceSchema.safeParse({ ...SERVICE_BASE, ...c.input });
    expect(r.success).toBe(c.valid);
    if (!c.valid && c.path) expect(r.error.issues.map((i) => i.path.join('.'))).toContain(c.path);
  });
});

describe('toPartial', () => {
  it('unwraps refined schemas so PUT does not demand every field', () => {
    expect(typeof serviceSchema.partial).toBe('undefined');
    expect(toPartial(serviceSchema).safeParse({}).success).toBe(true);
  });
});

describe('admin shell shortcuts and notes', () => {
  const shortcut = (to) => shortcutCreateSchema.safeParse({ label: 'Go', to });

  it('exports the limits', () => {
    expect(MAX_SHORTCUTS).toBe(12);
    expect(MAX_NOTES).toBe(100);
  });

  it.each(['/admin', '/admin/leads', '/admin?tab=mine', '/admin/quotations?status=SENT&page=2', '/admin/jobs/abc123'])(
    'accepts the admin path %j', (to) => {
      expect(shortcut(to).success).toBe(true);
    },
  );

  it.each([
    'https://evil.com', 'http://localhost/admin', '//evil', '//evil.com/admin', '/admin//evil.com',
    'javascript:alert(1)', 'JAVASCRIPT:/admin', '/administrator', '/adminx', '/tech/jobs', 'admin',
    '/admin/a b', '/admin\\evil', '/admin\tx', '', `/admin/${'a'.repeat(300)}`,
  ])('rejects %j', (to) => {
    expect(shortcut(to).success).toBe(false);
  });

  it('trims the label and path, and limits the label and icon', () => {
    expect(shortcutCreateSchema.parse({ label: '  Leads ', to: ' /admin/leads ' })).toEqual({ label: 'Leads', to: '/admin/leads' });
    expect(shortcutCreateSchema.safeParse({ label: ' ', to: '/admin' }).success).toBe(false);
    expect(shortcutCreateSchema.safeParse({ label: 'x'.repeat(41), to: '/admin' }).success).toBe(false);
    expect(shortcutCreateSchema.safeParse({ label: 'Go', to: '/admin', icon: 'FileText' }).success).toBe(true);
    expect(shortcutCreateSchema.safeParse({ label: 'Go', to: '/admin', icon: 'file-text' }).success).toBe(false);
    expect(shortcutCreateSchema.safeParse({ label: 'Go', to: '/admin', icon: 'A'.repeat(41) }).success).toBe(false);
  });

  it('an update needs at least one field and never changes the path', () => {
    expect(shortcutUpdateSchema.safeParse({}).success).toBe(false);
    expect(shortcutUpdateSchema.parse({ label: 'New', to: 'https://evil.com' })).toEqual({ label: 'New' });
  });

  it('an order is 1 to 12 ids', () => {
    expect(shortcutOrderSchema.safeParse({ ids: [] }).success).toBe(false);
    expect(shortcutOrderSchema.safeParse({ ids: ['a'] }).success).toBe(true);
    expect(shortcutOrderSchema.safeParse({ ids: Array.from({ length: 13 }, (_, i) => `id${i}`) }).success).toBe(false);
  });

  it('a note defaults to yellow, keeps Nepali text and limits the body', () => {
    const nepali = 'शुक्रबार साँझ ५ बजे बैठक';
    expect(noteCreateSchema.parse({ body: ` ${nepali} ` })).toEqual({ body: nepali, color: 'yellow' });
    expect(noteCreateSchema.safeParse({ body: '' }).success).toBe(false);
    expect(noteCreateSchema.safeParse({ body: 'क'.repeat(2000) }).success).toBe(true);
    expect(noteCreateSchema.safeParse({ body: 'क'.repeat(2001) }).success).toBe(false);
    expect(noteCreateSchema.safeParse({ body: 'x', color: 'red' }).success).toBe(false);
    expect(noteCreateSchema.safeParse({ body: 'x', isPinned: 'true' }).success).toBe(false);
  });

  it('a note update is partial, without a default colour, and needs one field', () => {
    expect(noteUpdateSchema.safeParse({}).success).toBe(false);
    expect(noteUpdateSchema.parse({ isPinned: true })).toEqual({ isPinned: true });
    expect(noteUpdateSchema.safeParse({ color: 'purple' }).success).toBe(true);
  });
});
