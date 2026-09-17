import { describe, it, expect } from 'vitest';
import { Bookmark, Users } from 'lucide-react';
import { NOTE_STYLES, isSamePlace, noteStyle, shortcutIcon, suggestShortcut } from '@/config/admin/shortcuts';
import { NOTE_COLORS, noteSchema, shortcutSchema } from '@/form/schemas/me.schema';

describe('suggestShortcut', () => {
  it('names a screen after its nav item and wears its icon', () => {
    expect(suggestShortcut('/admin/leads')).toEqual({ to: '/admin/leads', label: 'Leads', icon: 'Users' });
    expect(suggestShortcut('/admin/dispatch/')).toEqual({ to: '/admin/dispatch', label: 'Dispatch board', icon: 'CalendarDays' });
  });

  it('names a record page after its screen and crumb, and keeps a filter', () => {
    expect(suggestShortcut('/admin/leads/cl1').label).toBe('Leads · Details');
    expect(suggestShortcut('/admin/materials/new').label).toBe('Materials · New');
    expect(suggestShortcut('/admin/leads', '?status=NEW')).toEqual({ to: '/admin/leads?status=NEW', label: 'Leads · filtered', icon: 'Users' });
  });

  it('falls back to a bookmark for an unknown admin page, and refuses anywhere else', () => {
    expect(suggestShortcut('/admin/somewhere')).toEqual({ to: '/admin/somewhere', label: 'Back office', icon: 'Bookmark' });
    expect(suggestShortcut('/services')).toBeNull();
    expect(suggestShortcut('/administrator')).toBeNull();
  });

  it('suggests only what the API accepts', () => {
    for (const path of ['/admin', '/admin/leads/board', '/admin/content/faqs/cl1', '/admin/platform/settings']) {
      expect(shortcutSchema.safeParse(suggestShortcut(path)).success, path).toBe(true);
    }
  });
});

describe('shortcut helpers', () => {
  it('matches the page on screen, ignoring a trailing slash', () => {
    expect(isSamePlace('/admin/leads', '/admin/leads/')).toBe(true);
    expect(isSamePlace('/admin/leads?status=NEW', '/admin/leads', '?status=NEW')).toBe(true);
    expect(isSamePlace('/admin/leads', '/admin/leads', '?status=NEW')).toBe(false);
  });

  it('falls back to the bookmark for an icon it does not know', () => {
    expect(shortcutIcon('Users')).toBe(Users);
    expect(shortcutIcon('Gone')).toBe(Bookmark);
    expect(shortcutIcon(null)).toBe(Bookmark);
  });

  it('styles every note colour, and an unknown one as yellow', () => {
    expect(Object.keys(NOTE_STYLES)).toEqual(NOTE_COLORS);
    expect(noteStyle('teal')).toBe(NOTE_STYLES.yellow);
  });
});

describe('me schemas', () => {
  it('keeps shortcuts inside the back office', () => {
    const ok = (to) => shortcutSchema.safeParse({ label: 'x', to }).success;
    expect(ok('/admin')).toBe(true);
    expect(ok('/admin/leads?status=NEW')).toBe(true);
    for (const bad of ['https://evil.com', '//evil.com', '/admin//evil.com', '/administrator', '/admin#top', '/admin\\x', 'javascript:alert(1)', '/services']) {
      expect(ok(bad), bad).toBe(false);
    }
  });

  it('keeps Nepali note text intact and defaults the colour', () => {
    const parsed = noteSchema.parse({ body: '  भोलि बिहान १० बजे फोन गर्ने  ' });
    expect(parsed).toEqual({ body: 'भोलि बिहान १० बजे फोन गर्ने', color: 'yellow' });
    expect(noteSchema.safeParse({ body: '   ' }).success).toBe(false);
    expect(noteSchema.safeParse({ body: 'x', color: 'teal' }).success).toBe(false);
  });
});
