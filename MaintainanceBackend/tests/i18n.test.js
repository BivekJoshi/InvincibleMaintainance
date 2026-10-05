import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it, expect } from 'vitest';
import { MESSAGE_TEMPLATES } from '../prisma/seed-data.js';
import { placeholdersIn } from '../src/services/notify.service.js';
import { customerDate, customerDateTime } from '../src/utils/dates.js';
import { formatNpr } from '../src/utils/money.js';

/**
 * Phase J1 — what a Nepali-speaking customer reads from the API's side: every message sent in the customer's language
 * has a Nepali template, and the values put into it (dates, amounts) are written the Nepali way.
 */

const SERVICES = resolve(import.meta.dirname, '../src/services');

/**
 * Every `notify({ … })` call in the services, as the (key, channel) pairs it can send and whether it passes the
 * recipient's `locale` — a message that does is a customer's (staff messages stay English, decision D7).
 */
function notifyCalls() {
  const calls = [];
  for (const file of readdirSync(SERVICES).filter((f) => f.endsWith('.js'))) {
    const source = readFileSync(resolve(SERVICES, file), 'utf8');
    for (const match of source.matchAll(/notify\(\{/g)) {
      let depth = 0;
      let end = match.index + 'notify('.length;
      for (; end < source.length; end += 1) {
        if (source[end] === '{') depth += 1;
        if (source[end] === '}') { depth -= 1; if (depth === 0) break; }
      }
      const block = source.slice(match.index, end + 1);
      const key = /templateKey:\s*'(\w+)'/.exec(block)?.[1];
      const channel = /channel:\s*'(\w+)'/.exec(block)?.[1];
      calls.push({ file, key, channels: channel ? [channel] : ['sms', 'email'], customer: /\blocale\b/.test(block), block });
    }
  }
  return calls;
}

/** visit.service sends its two keys through one call with the key in a variable. */
const VARIABLE_KEYS = { 'visit.service.js': ['visit_booked', 'visit_reminder'] };

function customerMessages() {
  const pairs = new Set();
  for (const call of notifyCalls().filter((c) => c.customer)) {
    const keys = call.key ? [call.key] : VARIABLE_KEYS[call.file] ?? [];
    for (const key of keys) for (const channel of call.channels) pairs.add(`${key}|${channel}`);
  }
  return [...pairs].sort().map((p) => p.split('|'));
}

const template = (key, channel, locale) => MESSAGE_TEMPLATES.find((t) => t.key === key && t.channel === channel && t.locale === locale);

describe('customer messages in Nepali (Phase J1)', () => {
  const pairs = customerMessages();

  it('finds the customer-facing messages', () => {
    const keys = new Set(pairs.map(([key]) => key));
    for (const key of ['lead_ack', 'quotation_sent', 'quotation_accepted', 'visit_booked', 'advance_due', 'invoice_sent',
      'invoice_overdue', 'warranty_claim_accepted', 'amc_visit_due', 'job_completed']) {
      expect(keys, key).toContain(key);
    }
    expect(keys).not.toContain('lead_new');
  });

  // A service reminder's SMS is the office's own words exactly ({{message}}, the call's fallback) — no template wraps it.
  const OFFICE_WORDS = new Set(['service_reminder|sms']);

  it.each(pairs.filter(([key, channel]) => !OFFICE_WORDS.has(`${key}|${channel}`)))('%s by %s has an English and a Nepali template with the same placeholders', (key, channel) => {
    const en = template(key, channel, 'en');
    const ne = template(key, channel, 'ne');
    expect(en, `${key} ${channel} en`).toBeTruthy();
    expect(ne, `${key} ${channel} ne`).toBeTruthy();
    expect(placeholdersIn(ne.body, ne.subject).sort()).toEqual(placeholdersIn(en.body, en.subject).sort());
    expect(`${ne.subject ?? ''}${ne.body}`).toMatch(/[ऀ-ॿ]/);
  });
});

describe('dates and amounts in a customer message', () => {
  // 14 Sept 2026, 12:00 in Kathmandu = 29 Bhadra 2083 BS.
  const NOON = new Date('2026-09-14T06:15:00.000Z');

  it('states the date as the Kathmandu day — in Nepali its Bikram Sambat date in Nepali words', () => {
    expect(customerDate(NOON, 'en')).toBe('14 Sep 2026');
    expect(customerDate(NOON, 'ne')).toBe('29 भदौ 2083');
    // 20:00 UTC on the 13th is already the 14th in Kathmandu.
    expect(customerDate(new Date('2026-09-13T20:00:00.000Z'), 'ne')).toBe('29 भदौ 2083');
    expect(customerDate(null, 'ne')).toBeNull();
    // Past the end of the BS table the AD date stands in, rather than the message failing.
    expect(customerDate(new Date('2045-01-10T06:00:00.000Z'), 'ne')).toBe('10 Jan 2045');
    expect(customerDateTime(NOON, 'en')).toBe('14 Sep 2026 12:00');
    expect(customerDateTime(NOON, 'ne')).toBe('29 भदौ 2083, 12:00');
  });

  it('writes an amount with रु. in Nepali and Rs. in English', () => {
    expect(formatNpr(12345678990)).toBe('Rs. 12,34,56,789.90');
    expect(formatNpr(12345678990, { locale: 'ne' })).toBe('रु. 12,34,56,789.90');
    expect(formatNpr(500, { locale: 'ne', withSymbol: false })).toBe('5.00');
  });
});
