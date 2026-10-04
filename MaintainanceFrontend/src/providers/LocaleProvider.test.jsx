import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { cwd } from 'node:process';
import { afterEach, describe, expect, it } from 'vitest';
import { act, screen } from '@testing-library/react';
import { renderWithProviders } from '@/test/renderWithProviders';
import { LocaleProvider } from '@/providers/LocaleProvider';
import { useLocale } from '@/hooks/useT';
import { DEVANAGARI_FONT_URL, isEnglishOnlyPath } from '@/config/locale';
import { setLocale } from '@/redux/slices/uiSlice';

function Probe() {
  return <p data-testid="locale">{useLocale()}</p>;
}

const fontLinks = () => document.querySelectorAll('link#font-devanagari');

describe('LocaleProvider (Phase J1)', () => {
  afterEach(() => {
    fontLinks().forEach((link) => link.remove());
    document.documentElement.lang = 'en';
  });

  it('follows the visitor on the site, sets <html lang> and loads the Devanagari font once', () => {
    const { store } = renderWithProviders(<LocaleProvider><Probe /></LocaleProvider>, { path: '/services', preloadedState: { ui: { locale: 'ne', toasts: [] } } });
    expect(screen.getByTestId('locale')).toHaveTextContent('ne');
    expect(document.documentElement.lang).toBe('ne');
    expect(fontLinks()).toHaveLength(1);
    expect(fontLinks()[0].href).toBe(DEVANAGARI_FONT_URL);

    act(() => store.dispatch(setLocale('en')));
    expect(document.documentElement.lang).toBe('en');
    act(() => store.dispatch(setLocale('ne')));
    expect(fontLinks()).toHaveLength(1);
  });

  it('keeps the back office English and fetches no font there', () => {
    renderWithProviders(<LocaleProvider><Probe /></LocaleProvider>, { path: '/admin/leads', preloadedState: { ui: { locale: 'ne', toasts: [] } } });
    expect(screen.getByTestId('locale')).toHaveTextContent('en');
    expect(document.documentElement.lang).toBe('en');
    expect(fontLinks()).toHaveLength(0);
  });

  it('treats only /admin and below as English-only — the field app and the login follow the visitor', () => {
    expect(isEnglishOnlyPath('/admin')).toBe(true);
    expect(isEnglishOnlyPath('/admin/quotations/1/print')).toBe(true);
    expect(isEnglishOnlyPath('/administrator-tips')).toBe(false);
    expect(isEnglishOnlyPath('/tech')).toBe(false);
    expect(isEnglishOnlyPath('/login')).toBe(false);
  });

  it("index.html loads the same font before the first paint, and no longer loads it for everyone", () => {
    const html = readFileSync(resolve(cwd(), 'index.html'), 'utf8');
    expect(html).toContain(`link.href = '${DEVANAGARI_FONT_URL}'`);
    expect(html).not.toMatch(/<link[^>]+Noto\+Sans\+Devanagari/);
  });
});
