import { describe, it, expect } from 'vitest';
import { normalizePhone, isNepaliPhone } from '../src/utils/phone.js';

describe('Nepali phone handling', () => {
  it('strips country code and separators so duplicates collapse', () => {
    for (const input of ['+977 9808338255', '+9779808338255', '977-9808338255', '9808338255', '980 833 8255']) {
      expect(normalizePhone(input)).toBe('9808338255');
    }
  });

  it('accepts real Nepali mobile and landline formats', () => {
    for (const v of ['9808338255', '9841234567', '9779808338255', '01-5407720', '015407720', '021-522334']) {
      expect(isNepaliPhone(v)).toBe(true);
    }
  });

  it('rejects malformed numbers', () => {
    for (const v of ['12345', '', 'abcdefghij', '98083382', '12345678901234']) {
      expect(isNepaliPhone(v)).toBe(false);
    }
  });
});
