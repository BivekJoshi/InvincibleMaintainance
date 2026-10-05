import { useEffect } from 'react';
import { useSelector } from 'react-redux';
import { useLocation } from 'react-router-dom';
import { isEnglishOnlyPath } from '@/config/locale';
import { loadDevanagariFont } from '@/helpers/devanagariFont';
import { selectLocale } from '@/redux/slices/uiSlice';
import { LocaleContext } from './localeContext';

/**
 * The language of the route on screen (Phase J1): English on every `/admin` path (decision D7 — the back office is
 * not translated, whatever the same browser chose on the public site), the visitor's choice (`uiSlice.locale`, kept
 * in localStorage) everywhere else — the site, the customer's document pages, the login and the field app.
 *
 * It also keeps `<html lang>` in step, which screen readers, hyphenation and the `:lang(ne)` styles follow, and loads
 * Noto Sans Devanagari the first time Nepali is shown (J1.7; `index.html` does it before the first paint when the page
 * opens in Nepali). The font stays once loaded — switching back to English does not unload it.
 */
export function LocaleProvider({ children }) {
  const chosen = useSelector(selectLocale);
  const { pathname } = useLocation();
  const locale = isEnglishOnlyPath(pathname) ? 'en' : chosen;

  useEffect(() => {
    document.documentElement.lang = locale;
    if (locale === 'ne') loadDevanagariFont();
  }, [locale]);

  return <LocaleContext.Provider value={locale}>{children}</LocaleContext.Provider>;
}

/**
 * A part of a page in a set language — the quotation builder's "Customer view" in the customer's language, or a
 * print in the document's. Everything under it that calls `useT()` or `useLocale()` reads `locale`.
 */
export function LocaleScope({ locale, children }) {
  return <LocaleContext.Provider value={locale}>{children}</LocaleContext.Provider>;
}
