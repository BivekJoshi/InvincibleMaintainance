import { describe, it, expect } from 'vitest';
import { nepaliPhone, optionalEmail, optionalPhone } from '@/form/schemas/fields';
import { adminLeadSchema, leadSchema } from '@/form/schemas/lead.schema';
import { bookingDetailsSchema } from '@/form/schemas/booking.schema';
import { customerSchema, customerSiteSchema, parseMapPin } from '@/form/schemas/customer.schema';

describe('Nepali phone numbers', () => {
  it.each([
    ['9808338255', '9808338255'],
    ['9741234567', '9741234567'],
    ['9612345678', '9612345678'],
    ['+977 9808338255', '9808338255'],
    ['977-9808338255', '9808338255'],
    ['980 833 8255', '9808338255'],
    ['01-5407720', '01-5407720'],
    ['015407720', '015407720'],
    ['061-456789', '061-456789'],
    ['(01) 5407720', '015407720'],
  ])('accepts %s as %s', (input, output) => {
    expect(nepaliPhone.parse(input)).toBe(output);
  });

  it.each([
    '12345', '9508338255', '98083382', '980833825512', '1-5407720', 'phone', '', '+1 415 555 0100', '01-54077',
  ])('refuses %s', (input) => {
    const r = nepaliPhone.safeParse(input);
    expect(r.success).toBe(false);
    if (input) expect(r.error.issues[0].message).toMatch(/9808338255 or 01-5407720/);
  });

  it('an optional second number may be left empty, but not wrong', () => {
    expect(optionalPhone.parse('')).toBeUndefined();
    expect(optionalPhone.parse(undefined)).toBeUndefined();
    expect(optionalPhone.parse('01-5407720')).toBe('01-5407720');
    expect(optionalPhone.safeParse('555').success).toBe(false);
  });

  it('every contact form uses the rule', () => {
    const base = { name: 'Sita Rai', address: 'Jhamsikhel, Lalitpur' };
    for (const schema of [leadSchema, bookingDetailsSchema]) {
      expect(schema.safeParse({ ...base, phone: '01-5407720' }).success).toBe(true);
      expect(schema.safeParse({ ...base, phone: '5407720' }).success).toBe(false);
    }
    const lead = { name: 'Sita Rai', source: 'call', priority: 'NORMAL', preferredLocale: 'en' };
    expect(adminLeadSchema.safeParse({ ...lead, phone: '9808338255', altPhone: '01-5407720' }).success).toBe(true);
    expect(adminLeadSchema.safeParse({ ...lead, phone: '9808338255', altPhone: '12' }).success).toBe(false);
    const customer = { type: 'individual', name: 'Sita Rai', preferredLocale: 'ne' };
    expect(customerSchema.safeParse({ ...customer, phone: '+977 9808338255' }).data.phone).toBe('9808338255');
    expect(customerSchema.safeParse({ ...customer, phone: '98083382' }).success).toBe(false);
  });
});

describe('emails', () => {
  it('are trimmed and lower-cased, as the API stores them', () => {
    expect(optionalEmail.parse('  Sita.Rai@Example.COM ')).toBe('sita.rai@example.com');
    expect(optionalEmail.parse('')).toBeUndefined();
    expect(optionalEmail.parse(undefined)).toBeUndefined();
    expect(optionalEmail.safeParse('sita@').success).toBe(false);
  });

  it('are optional on the public forms', () => {
    const base = { name: 'Sita Rai', phone: '9808338255', address: 'Jhamsikhel' };
    expect(leadSchema.parse({ ...base, email: '' }).email).toBeUndefined();
    expect(bookingDetailsSchema.parse({ ...base, email: 'SITA@x.com' }).email).toBe('sita@x.com');
    expect(bookingDetailsSchema.safeParse({ ...base, email: 'not-an-email' }).success).toBe(false);
  });
});

describe('customers', () => {
  it('keep Devanagari names and notes intact', () => {
    const r = customerSchema.parse({
      type: 'individual', name: 'रमेश श्रेष्ठ', phone: '9808338255', notes: 'बिहान फोन गर्नु', preferredLocale: 'ne',
    });
    expect(r).toMatchObject({ name: 'रमेश श्रेष्ठ', notes: 'बिहान फोन गर्नु', preferredLocale: 'ne' });
  });

  it('refuses a language the site does not speak', () => {
    expect(customerSchema.safeParse({ type: 'company', name: 'Co', phone: '9808338255', preferredLocale: 'fr' }).success).toBe(false);
  });

  it('sites: coordinates are optional and bounded', () => {
    const site = { label: 'Home', address: 'Jhamsikhel', isPrimary: true };
    expect(customerSiteSchema.parse({ ...site, lat: '', lng: '' })).not.toHaveProperty('lat', expect.anything());
    expect(customerSiteSchema.parse({ ...site, lat: '27.6712', lng: '85.324' })).toMatchObject({ lat: 27.6712, lng: 85.324 });
    expect(customerSiteSchema.safeParse({ ...site, lat: 95 }).success).toBe(false);
  });

  it('reads a pin copied from a map app', () => {
    expect(parseMapPin('27.6712, 85.3240')).toEqual({ lat: 27.6712, lng: 85.324 });
    expect(parseMapPin(' 27.6712 85.3240 ')).toEqual({ lat: 27.6712, lng: 85.324 });
    expect(parseMapPin('127.1, 85')).toBeNull();
    expect(parseMapPin('Jhamsikhel')).toBeNull();
  });
});
