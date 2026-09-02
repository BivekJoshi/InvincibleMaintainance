import { describe, it, expect } from 'vitest';
import { publicLeadSchema } from '../src/shared/schemas/crm.js';
import { serviceSchema } from '../src/shared/schemas/cms.js';
import { toPartial } from '../src/shared/schemas/common.js';

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

describe('toPartial', () => {
  it('unwraps refined schemas so PUT does not demand every field', () => {
    expect(typeof serviceSchema.partial).toBe('undefined');
    expect(toPartial(serviceSchema).safeParse({}).success).toBe(true);
  });
});
