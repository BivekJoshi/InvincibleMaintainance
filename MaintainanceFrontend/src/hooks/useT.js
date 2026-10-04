import { useCallback, useContext, useMemo } from 'react';
import { useSelector } from 'react-redux';
import { selectLocale } from '@/redux/slices/uiSlice';
import { LocaleContext } from '@/providers/localeContext';
import { COMMON } from '@/config/i18n/common';
import { apiErrorText, createT } from '@/helpers/i18n';

/**
 * The language the screen is in: the nearest `LocaleScope` / `LocaleProvider` (English under `/admin`), else the
 * visitor's choice in the store — a component rendered on its own in a test reads the store.
 *
 * @returns {'en'|'ne'}
 */
export function useLocale() {
  const scoped = useContext(LocaleContext);
  const chosen = useSelector(selectLocale);
  return scoped ?? chosen;
}

/**
 * A translator over `catalogue` in the screen's language — `const t = useT(FIELD)`, then `t('sync.now')`,
 * `t('sync.waiting', { count })`, `t.rich(…)`, and `t.locale` for the format helpers (`formatNpr(x, { locale: t.locale })`).
 * `{ locale }` pins a language, for a document shown in the customer's rather than the reader's.
 *
 * @param {{ en: object, ne?: object }} catalogue one of `config/i18n/*.js`
 * @param {{ locale?: 'en'|'ne' }} [opts]
 */
export function useT(catalogue, { locale: pinned } = {}) {
  const current = useLocale();
  const locale = pinned ?? current;
  return useMemo(() => createT(catalogue, locale), [catalogue, locale]);
}

/**
 * `(error) => words` for an API error on this screen: `catalogue.errors.<CODE>`, then `common`'s, then the server's
 * message (see `helpers/i18n.js#apiErrorText`).
 *
 * @param {{ en: object, ne?: object }} [catalogue]
 * @param {{ locale?: 'en'|'ne' }} [opts]
 */
export function useApiErrorText(catalogue = COMMON, opts) {
  const t = useT(catalogue, opts);
  const common = useT(COMMON, opts);
  return useCallback((error) => apiErrorText(error, t, common), [t, common]);
}
