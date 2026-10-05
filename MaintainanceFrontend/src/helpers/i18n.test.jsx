import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { COMMON } from '@/config/i18n/common';
import {
  apiErrorText, createT, describeCatalogue, interpolate, isPluralForms, resetI18nWarnings, selectPlural,
} from '@/helpers/i18n';

const CATALOGUE = {
  en: {
    hello: 'Hello {name}',
    photos: { zero: 'No photos yet', one: '{count} photo', other: '{count} photos' },
    total: 'Total {amount}',
    consent: 'I agree to the <terms>terms</terms> and the <privacy>privacy note</privacy>.',
    onlyEnglish: 'Only in English',
    nested: { deep: { key: 'Deep' } },
    errors: { CLAIM_OPEN: 'This screen words it: already claimed' },
  },
  ne: {
    hello: 'नमस्ते {name}',
    photos: { zero: 'अहिलेसम्म फोटो छैन', one: '{count} फोटो', other: '{count} फोटो' },
    total: 'जम्मा {amount}',
    consent: 'म <terms>सर्तहरू</terms> र <privacy>गोपनीयता नीति</privacy> मान्छु।',
    nested: { deep: { key: 'गहिरो' } },
    errors: { CLAIM_OPEN: 'पहिले नै दाबी गरिएको' },
  },
};

describe('t()', () => {
  let warn;
  beforeEach(() => { resetI18nWarnings(); warn = vi.spyOn(console, 'warn').mockImplementation(() => {}); });
  afterEach(() => warn.mockRestore());

  it('fills placeholders and walks nested keys', () => {
    const t = createT(CATALOGUE, 'ne');
    expect(t('hello', { name: 'सीता' })).toBe('नमस्ते सीता');
    expect(t('nested.deep.key')).toBe('गहिरो');
    expect(t.locale).toBe('ne');
  });

  it('prints a number with lakh grouping and a string as it is', () => {
    const t = createT(CATALOGUE, 'en');
    expect(t('total', { amount: 1234567.5 })).toBe('Total 12,34,567.5');
    expect(t('total', { amount: '2083' })).toBe('Total 2083');
  });

  it('picks the plural form for the count, with a zero form when there is one', () => {
    const en = createT(CATALOGUE, 'en');
    expect(en('photos', { count: 0 })).toBe('No photos yet');
    expect(en('photos', { count: 1 })).toBe('1 photo');
    expect(en('photos', { count: 3 })).toBe('3 photos');
    const ne = createT(CATALOGUE, 'ne');
    expect(ne('photos', { count: 0 })).toBe('अहिलेसम्म फोटो छैन');
    expect(ne('photos', { count: 1 })).toBe('1 फोटो');
    expect(ne('photos', { count: 12000 })).toBe('12,000 फोटो');
    expect(selectPlural({ one: 'a', other: 'b' }, 1, 'ne')).toBe('a');
  });

  it('falls back to English when Nepali has no text, and warns once in development', () => {
    const t = createT(CATALOGUE, 'ne');
    expect(t('onlyEnglish')).toBe('Only in English');
    expect(t('onlyEnglish')).toBe('Only in English');
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0][0]).toMatch(/missing ne text for "onlyEnglish"/);
  });

  it('shows the key itself when neither language has it, rather than nothing', () => {
    const t = createT(CATALOGUE, 'en');
    expect(t('no.such.key')).toBe('no.such.key');
    expect(warn).toHaveBeenCalledWith(expect.stringMatching(/missing text for "no.such.key"/));
    expect(t.has('no.such.key')).toBe(false);
    expect(t.has('nested.deep.key')).toBe(true);
    expect(t.has('nested')).toBe(false); // a branch is not a text
  });

  it('prints nothing for a placeholder with no value, and warns', () => {
    expect(interpolate('Hi {name}', {}, 'en')).toBe('Hi ');
    expect(warn).toHaveBeenCalled();
  });

  it('renders <tag> spans through components, and never turns a value into markup', () => {
    const t = createT(CATALOGUE, 'ne');
    render(<p>{t.rich('consent', {}, {
      terms: (c) => <a href="/terms">{c}</a>,
      privacy: (c) => <a href="/privacy">{c}</a>,
    })}</p>);
    expect(screen.getByRole('link', { name: 'सर्तहरू' })).toHaveAttribute('href', '/terms');
    expect(screen.getByRole('link', { name: 'गोपनीयता नीति' })).toHaveAttribute('href', '/privacy');

    render(<p data-testid="hello">{createT(CATALOGUE, 'en').rich('hello', { name: '<terms>x</terms>' }, { terms: () => <b>bold</b> })}</p>);
    expect(screen.getByTestId('hello')).toHaveTextContent('Hello <terms>x</terms>');
  });
});

describe('describeCatalogue', () => {
  it('lists every leaf with its placeholders and tags, and flags anything that is not text', () => {
    const rows = describeCatalogue({ a: 'Hi {name}', b: { one: '{count} x', other: '{count} xs' }, c: { d: '<b>x</b>' }, bad: () => 'x', list: ['a'] });
    expect(rows).toEqual([
      expect.objectContaining({ path: 'a', kind: 'text', placeholders: ['name'] }),
      expect.objectContaining({ path: 'b', kind: 'plural', placeholders: ['count'] }),
      expect.objectContaining({ path: 'c.d', kind: 'text', tags: ['b'] }),
      expect.objectContaining({ path: 'bad', kind: 'invalid' }),
      expect.objectContaining({ path: 'list', kind: 'invalid' }),
    ]);
    expect(isPluralForms({ one: 'a', other: 'b' })).toBe(true);
    expect(isPluralForms({ TECHNICIAN: 'a', other: 'b' })).toBe(false);
  });
});

describe('apiErrorText', () => {
  const screenT = createT(CATALOGUE, 'ne');
  const common = createT(COMMON, 'ne');
  const apiError = (code, message = 'English words', details) => ({ status: 422, data: { error: { code, message, details } } });

  it("prefers the screen's words for a code, then common's, then the server's message", () => {
    expect(apiErrorText(apiError('CLAIM_OPEN'), screenT, common)).toBe('पहिले नै दाबी गरिएको');
    expect(apiErrorText(apiError('WARRANTY_VOID'), screenT, common)).toBe(COMMON.ne.errors.WARRANTY_VOID);
    expect(apiErrorText(apiError('SOMETHING_NEW', 'The server says so'), screenT, common)).toBe('The server says so');
    expect(apiErrorText(apiError('SOMETHING_NEW', ''), screenT, common)).toBe(COMMON.ne.errors.generic);
  });

  it("fills a code's placeholders from its details", () => {
    expect(apiErrorText(apiError('TOO_MANY_PHOTOS', 'x', { max: 5 }), screenT, common)).toBe('बढीमा 5 वटा फोटो मात्र।');
  });

  it('says there is no connection when the request never reached the API', () => {
    expect(apiErrorText({ status: 'FETCH_ERROR', error: 'TypeError: Failed to fetch' }, screenT, common)).toBe(COMMON.ne.errors.offline);
  });
});
