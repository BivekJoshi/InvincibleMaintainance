import { describe, expect, it } from 'vitest';
import { linkIssue, siteHref } from '@/helpers/links';
import { siteNavFor } from '@/config/site/siteNav';

describe('siteHref', () => {
  it('keeps the routes and prefixes the app serves, and external links', () => {
    for (const url of ['/', '/pricing', '/blog', '/blog/five-checks', '/services/seepage?x=1', 'tel:9808338255', 'https://example.com']) {
      expect(siteHref(url)).toBe(url);
    }
  });

  it('sends an unknown path to booking, unless it is a live page', () => {
    expect(siteHref('/about')).toBe('/book');
    expect(siteHref('/about', '/book', ['about'])).toBe('/about');
    expect(siteHref('/about#team', '/book', ['about'])).toBe('/about#team');
    expect(siteHref('/हाम्रो-बारेमा', '/book', ['हाम्रो-बारेमा'])).toBe('/हाम्रो-बारेमा');
    expect(siteHref('/%E0%A4%B9%E0%A4%BE', '/book', ['हा'])).toBe('/%E0%A4%B9%E0%A4%BE');
    // Only a single segment can be a page.
    expect(siteHref('/about/team', '/book', ['about'])).toBe('/book');
    expect(siteHref('', '/book')).toBe('/book');
  });
});

describe('linkIssue', () => {
  it('names the problem for a link the site would not follow', () => {
    expect(linkIssue('/nowhere')).toMatch(/Use a page of this site/);
    expect(linkIssue('/about', ['about'])).toBeNull();
    expect(linkIssue('')).toBeNull();
    expect(linkIssue(undefined)).toBeNull();
  });
});

describe('siteNavFor', () => {
  it('adds Blog before Contact only when the blog has a post', () => {
    expect(siteNavFor({ blog: false }).map((n) => n.label)).toEqual(['Services', 'Our work', 'Pricing', 'Contact']);
    expect(siteNavFor(undefined).map((n) => n.to)).not.toContain('/blog');
    expect(siteNavFor({ blog: true }).map((n) => n.label)).toEqual(['Services', 'Our work', 'Pricing', 'Blog', 'Contact']);
  });
});
