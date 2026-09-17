import { describe, it, expect } from 'vitest';
import { smsSegments } from '@/helpers/sms';

describe('smsSegments', () => {
  it('counts English as GSM-7: 160 in one part, 153 per part after that', () => {
    expect(smsSegments('')).toMatchObject({ encoding: 'GSM-7', length: 0, segments: 0, perSegment: 160, remaining: 160 });
    expect(smsSegments('Your quotation QT-2083-0001 is ready: https://gharjatan.com.np/q/abc - Ghar Jatan'))
      .toMatchObject({ encoding: 'GSM-7', length: 81, segments: 1, remaining: 79 });
    expect(smsSegments('a'.repeat(160))).toMatchObject({ segments: 1, remaining: 0 });
    expect(smsSegments('a'.repeat(161))).toMatchObject({ segments: 2, perSegment: 153, remaining: 145 });
    expect(smsSegments('a'.repeat(306))).toMatchObject({ segments: 2, remaining: 0 });
    expect(smsSegments('a'.repeat(307))).toMatchObject({ segments: 3 });
  });

  it('counts the extension characters twice', () => {
    expect(smsSegments('Rs {100} [VAT] ~ €')).toMatchObject({ encoding: 'GSM-7', length: 24 });
    expect(smsSegments(`${'a'.repeat(158)}€`)).toMatchObject({ length: 160, segments: 1 });
    expect(smsSegments(`${'a'.repeat(159)}€`)).toMatchObject({ length: 161, segments: 2 });
  });

  it('sends Devanagari as Unicode: 70 in one part, 67 per part', () => {
    const lead = 'धन्यवाद राम, तपाईंको अनुरोध प्राप्त भयो। हाम्रो इन्जिनियरले २ घण्टाभित्र फोन गर्नुहुनेछ।';
    const result = smsSegments(lead);
    expect(result.encoding).toBe('Unicode');
    expect(result.length).toBe(lead.length);
    expect(result.segments).toBe(Math.ceil(lead.length / 67));
    expect(result.perSegment).toBe(67);
    expect(smsSegments('न'.repeat(70))).toMatchObject({ segments: 1, perSegment: 70, remaining: 0 });
    expect(smsSegments('न'.repeat(71))).toMatchObject({ segments: 2, perSegment: 67, remaining: 63 });
  });

  it('turns a whole English message Unicode for one character, and says which', () => {
    const result = smsSegments(`Namaste ${'a'.repeat(70)} – “quoted” रु`);
    expect(result.encoding).toBe('Unicode');
    expect(result.segments).toBe(2);
    expect(result.nonGsm).toEqual(['–', '“', '”', 'र', 'ु']);
  });

  it('counts an emoji as two units', () => {
    expect(smsSegments('🙏')).toMatchObject({ encoding: 'Unicode', length: 2 });
  });
});
