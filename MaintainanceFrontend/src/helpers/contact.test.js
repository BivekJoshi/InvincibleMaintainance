import { describe, expect, it } from 'vitest';
import { whatsappHref } from './contact';

describe('whatsappHref', () => {
  it('links a Nepali mobile in any of the forms staff type', () => {
    expect(whatsappHref('9808338255')).toBe('https://wa.me/9779808338255');
    expect(whatsappHref('+977 980-833-8255')).toBe('https://wa.me/9779808338255');
    expect(whatsappHref('977-9708338255')).toBe('https://wa.me/9779708338255');
  });

  it('gives nothing for a landline or no number', () => {
    expect(whatsappHref('01-5550123')).toBeNull();
    expect(whatsappHref('')).toBeNull();
    expect(whatsappHref(undefined)).toBeNull();
  });
});
