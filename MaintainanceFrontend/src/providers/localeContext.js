import { createContext } from 'react';

/**
 * The language the screens under it are in (Phase J1) — set by `LocaleProvider` for the route (English under
 * `/admin`, the visitor's choice elsewhere) and by `LocaleScope` for a part of a page that shows a set language.
 * `null` outside both, where `useLocale()` reads the store's choice.
 */
export const LocaleContext = createContext(null);
