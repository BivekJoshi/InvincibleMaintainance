import { describe, it, expect } from 'vitest';
import { slugify } from '@/helpers/slug';
import { splitParagraphs } from '@/helpers/prose';

describe('slugify — the same rule as the API', () => {
  it('keeps Devanagari words whole, vowel signs and virama included', () => {
    expect(slugify('नेपाली')).toBe('नेपाली');
    expect(slugify('पानी चुहावट मर्मत')).toBe('पानी-चुहावट-मर्मत');
    expect(slugify('छतको वाटरप्रुफिङ')).toBe('छतको-वाटरप्रुफिङ');
  });

  it('lower-cases Latin and collapses separators into one hyphen', () => {
    expect(slugify('  Bathroom   Waterproofing! ')).toBe('bathroom-waterproofing');
  });

  it('handles mixed scripts and drops apostrophes', () => {
    expect(slugify('छत — Roof')).toBe('छत-roof');
    expect(slugify("Hari's Plumbing")).toBe('haris-plumbing');
  });

  it('is empty for nothing', () => {
    expect(slugify(undefined)).toBe('');
    expect(slugify('—')).toBe('');
  });
});

describe('splitParagraphs — how the site reads long copy', () => {
  it('splits on blank lines and drops empty paragraphs', () => {
    expect(splitParagraphs('One.\n\nTwo.\n  \n\n\nThree.')).toEqual(['One.', 'Two.', 'Three.']);
  });

  it('keeps a single line break inside its paragraph', () => {
    expect(splitParagraphs('Line one\nline two\n\nनेपाली अनुच्छेद')).toEqual(['Line one\nline two', 'नेपाली अनुच्छेद']);
  });

  it('is empty for nothing', () => {
    expect(splitParagraphs('')).toEqual([]);
    expect(splitParagraphs(null)).toEqual([]);
  });
});
