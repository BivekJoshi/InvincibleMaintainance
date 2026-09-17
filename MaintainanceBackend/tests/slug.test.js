import { describe, it, expect } from 'vitest';
import { slugify } from '../src/utils/slug.js';

describe('slugify', () => {
  it('keeps Devanagari words whole, vowel signs and virama included', () => {
    expect(slugify('नेपाली')).toBe('नेपाली');
    expect(slugify('पानी चुहावट मर्मत')).toBe('पानी-चुहावट-मर्मत');
  });

  it('lower-cases Latin and collapses separators into one hyphen', () => {
    expect(slugify('  Bathroom   Waterproofing! ')).toBe('bathroom-waterproofing');
  });

  it('handles mixed scripts and drops apostrophes', () => {
    expect(slugify('छत — Roof')).toBe('छत-roof');
    expect(slugify("Hari's Plumbing")).toBe('haris-plumbing');
  });
});
