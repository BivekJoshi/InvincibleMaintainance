import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { cwd } from 'node:process';
import { describe, expect, it } from 'vitest';
import {
  VISIT_BOOKED_COPY, surveyorText, visitBookedSms, visitDateText, visitWindowText,
} from '@/components/leads/visitBookedCopy';

describe('the visit_booked SMS preview', () => {
  it('says exactly what the API’s seeded template says, in en and ne', () => {
    // Read as text: importing the seed would load the API's config.
    const seed = readFileSync(resolve(cwd(), '../MaintainanceBackend/prisma/seed-data.js'), 'utf8');
    for (const locale of ['en', 'ne']) {
      const row = seed.match(new RegExp(`key: 'visit_booked', channel: 'sms', locale: '${locale}',\\s*body: '([^']+)'`));
      expect(row?.[1], locale).toBe(VISIT_BOOKED_COPY[locale]);
    }
  });

  it('writes the day and the window in Kathmandu time, as the API does (dayjs “D MMM YYYY”, not Intl’s “Sept”)', () => {
    // 18:30 UTC on the 29th is 00:15 on the 30th in Kathmandu.
    expect(visitDateText('2026-09-29T18:30:00.000Z')).toBe('30 Sep 2026');
    expect(visitWindowText('2026-10-03T04:15:00.000Z', '2026-10-03T06:15:00.000Z')).toBe('10:00–12:00');
    expect(visitWindowText('2026-10-03T04:15:00.000Z')).toBe('10:00');
    expect(visitDateText(null)).toBe('');
    // In Nepali, the Bikram Sambat day in Nepali words — as the API's customerDate writes it (Phase J1).
    expect(visitDateText('2026-09-29T18:30:00.000Z', 'ne')).toBe('14 असोज 2083');
  });

  it('names the surveyor with their number, or says “our surveyor” in the customer’s language', () => {
    expect(surveyorText({ name: 'राम थापा', phone: '9851012345' }, 'ne')).toBe('राम थापा (9851012345)');
    expect(surveyorText({ name: 'Ram Thapa', phone: null })).toBe('Ram Thapa');
    expect(surveyorText(null, 'ne')).toBe('हाम्रो सर्वेक्षक');
    expect(surveyorText(undefined)).toBe('our surveyor');
  });

  it('fills the message, and signs off only with a company name', () => {
    const visit = { name: 'सीता राई', start: '2026-10-03T04:15:00.000Z', end: '2026-10-03T06:15:00.000Z', link: 'https://x.np/visit/…' };
    expect(visitBookedSms({ ...visit, locale: 'ne', appName: 'घर जतन' })).toBe(
      'नमस्ते सीता राई, तपाईंको साइट निरीक्षण JOB-… 17 असोज 2083, 10:00–12:00 मा तय भएको छ। हाम्रो सर्वेक्षक आउनुहुनेछ। '
      + 'पुष्टि गर्न वा अर्को समय माग्न: https://x.np/visit/… - घर जतन',
    );
    expect(visitBookedSms({ ...visit, name: 'Sita Rai' })).toMatch(/Confirm or ask for another time: https:\/\/x\.np\/visit\/…$/);
  });
});
