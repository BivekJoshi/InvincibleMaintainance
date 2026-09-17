import { describe, expect, it } from 'vitest';
import { buildSettingsForm, fieldNameOf } from '@/config/admin/settingsForm';

/** The shapes the API seeds (prisma/seed-data.js), grouped as GET /admin/settings answers. */
const GROUPED = {
  booking: [
    { key: 'booking.closedWeekdays', label: 'Closed weekdays', type: 'json', value: [6], hint: 'Days the calendar will not offer.' },
    { key: 'booking.slotCapacity', label: 'Visits per slot', type: 'number', value: null },
    { key: 'booking.maxDaysAhead', label: 'Days ahead', type: 'number', value: 30 },
  ],
  branding: [
    { key: 'badges.items', label: 'Hero trust badges', type: 'json', value: [{ icon: 'gift', label: 'Free Consultation' }] },
    // As jsonb returns it: keys in the database's order, not the form's.
    { key: 'stats.items', label: 'Counters', type: 'json', value: [{ label: 'Satisfied Clients', value: '2.5k+' }] },
    { key: 'branding.tagline', label: 'Tagline', type: 'string', value: 'Certified engineers.' },
    { key: 'branding.logoId', label: 'Logo', type: 'media', value: '' },
  ],
  contact: [
    { key: 'contact.companyName', label: 'Company name', type: 'string', value: 'Ghar Jatan' },
    { key: 'contact.phonePrimary', label: 'Primary phone', type: 'string', value: '01-5407720' },
    { key: 'contact.viber', label: 'Viber', type: 'string', value: '' },
    { key: 'contact.email', label: 'Email', type: 'string', value: 'support@gharjatan.com.np' },
  ],
  custom: [{ key: 'custom.flags', label: 'custom.flags', type: 'json', value: { a: 1 } }],
  finance: [
    { key: 'finance.vatRate', label: 'VAT rate (%)', type: 'number', value: 13 },
    { key: 'finance.quotationTerms', label: 'Quotation terms', type: 'richtext', value: '1. Valid 15 days.\n2. 50% advance.' },
  ],
  sla: [{ key: 'sla.autoAssign', label: 'Auto-assign', type: 'boolean', value: true }],
  social: [{ key: 'social.facebook', label: 'Facebook URL', type: 'string', value: '' }],
};

const form = buildSettingsForm(GROUPED);
const field = (key) => form.fields.flatMap((g) => g.fields).find((f) => f.name === fieldNameOf(key));
const parse = (patch) => form.schema.safeParse({ ...form.values, ...patch });
const issues = (patch) => parse(patch).error?.issues.map((i) => i.path.join('.')) ?? [];

describe('buildSettingsForm', () => {
  it('makes one card per group, known groups first in their set order, others after', () => {
    expect(form.fields.map((g) => g.label)).toEqual([
      'Contact details', 'Brand and home page', 'Social links', 'Online booking',
      'Lead response', 'Quotations and invoices', 'Custom',
    ]);
    expect(form.fields.every((g) => g.type === 'group' && g.variant === 'card')).toBe(true);
  });

  it('picks the input from the row type and the key', () => {
    expect(field('booking.closedWeekdays')).toMatchObject({ type: 'weekdays', description: 'Days the calendar will not offer.' });
    expect(field('badges.items')).toMatchObject({ type: 'objectList', itemLabel: 'Badge' });
    expect(field('stats.items').itemFields.map((f) => f.name)).toEqual(['value', 'label']);
    expect(field('contact.phonePrimary')).toMatchObject({ type: 'text', inputType: 'tel', required: true });
    expect(field('contact.email')).toMatchObject({ inputType: 'email' });
    expect(field('social.facebook')).toMatchObject({ inputType: 'url' });
    expect(field('finance.vatRate')).toMatchObject({ type: 'number', min: 0, max: 100, required: true });
    expect(field('booking.slotCapacity')).toMatchObject({ type: 'number', required: false });
    expect(field('sla.autoAssign').type).toBe('switch');
    expect(field('finance.quotationTerms').type).toBe('textarea');
    expect(field('branding.logoId').type).toBe('media');
    expect(field('custom.flags').type).toBe('textarea');
    // Dots would read as nesting in react-hook-form.
    expect(field('contact.phonePrimary').name).toBe('contact__phonePrimary');
  });

  it('starts from the stored values, as the inputs hold them', () => {
    expect(form.values).toMatchObject({
      booking__closedWeekdays: [6],
      booking__slotCapacity: undefined,
      finance__vatRate: 13,
      branding__logoId: undefined,
      sla__autoAssign: true,
      custom__flags: '{\n  "a": 1\n}',
    });
    expect(parse({}).success).toBe(true);
  });

  it('applies the Nepali phone rule, and lets an optional number stay empty', () => {
    expect(issues({ contact__phonePrimary: '12345' })).toEqual(['contact__phonePrimary']);
    expect(issues({ contact__phonePrimary: '' })).toEqual(['contact__phonePrimary']);
    expect(issues({ contact__viber: '' })).toEqual([]);
    expect(issues({ contact__viber: '5550100' })).toEqual(['contact__viber']);
    expect(parse({ contact__phonePrimary: '+977 980 8338255' }).data.contact__phonePrimary).toBe('9808338255');
    expect(issues({ contact__email: 'not-an-email' })).toEqual(['contact__email']);
    expect(issues({ social__facebook: 'facebook.com/x' })).toEqual(['social__facebook']);
    expect(issues({ finance__vatRate: 130 })).toEqual(['finance__vatRate']);
    expect(issues({ finance__vatRate: undefined })).toEqual(['finance__vatRate']);
    expect(issues({ booking__slotCapacity: undefined })).toEqual([]);
    expect(issues({ booking__closedWeekdays: [0, 1, 2, 3, 4, 5, 6] })).toEqual(['booking__closedWeekdays']);
    expect(issues({ custom__flags: '{ nope' })).toEqual(['custom__flags']);
  });

  it('refuses a half-filled badge row but drops a blank one', () => {
    expect(issues({ badges__items: [{ icon: 'gift', label: '' }] })).toEqual(['badges__items.0.label']);
    const ok = parse({ badges__items: [{ icon: '', label: '' }, { icon: 'clock', label: '2 Hour Response' }] });
    expect(ok.data.badges__items).toEqual([{ icon: 'clock', label: '2 Hour Response' }]);
  });

  it('sends only the keys whose stored value changes, in stored shapes', () => {
    expect(form.changes(form.values)).toEqual({});
    // The schema's output orders a counter's keys as { value, label }; that is not a change.
    expect(form.changes(parse({}).data)).toEqual({});
    const changed = form.changes({
      ...form.values,
      contact__phonePrimary: '9808338255',
      booking__closedWeekdays: [5, 0, 6],
      booking__slotCapacity: 4,
      finance__vatRate: 13,
      badges__items: [{ icon: 'gift', label: ' नि:शुल्क परामर्श ' }, { icon: '', label: '' }],
      custom__flags: '{"a":1}',
      finance__quotationTerms: '1. Valid 15 days.\n2. 50% advance.',
      branding__tagline: 'प्रमाणित इन्जिनियर',
    });
    expect(changed).toEqual({
      'contact.phonePrimary': '9808338255',
      'booking.closedWeekdays': [0, 5, 6],
      'booking.slotCapacity': 4,
      'badges.items': [{ icon: 'gift', label: 'नि:शुल्क परामर्श' }],
      'branding.tagline': 'प्रमाणित इन्जिनियर',
    });
    // Emptying an optional number stores null; unticking a switch stores false.
    expect(buildSettingsForm({ booking: [{ key: 'booking.slotCapacity', label: 'x', type: 'number', value: 3 }] })
      .changes({ booking__slotCapacity: undefined })).toEqual({ 'booking.slotCapacity': null });
    expect(form.changes({ ...form.values, sla__autoAssign: false })).toEqual({ 'sla.autoAssign': false });
  });
});
