import { createContext, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { selectTheme, setTheme } from '@/redux/slices/uiSlice';
import {
  DARK_QUERY, THEME_COLORS, THEME_MODES, THEME_STORAGE_KEY,
  isThemeMode, nextThemeMode, resolveTheme,
} from '@/config/theme';

/**
 * The colour mode, and the one place the DOM hears about it.
 *
 * Two values, deliberately kept apart:
 *   - `mode`  what the user chose — 'light' | 'dark' | 'system'. Persisted.
 *   - `theme` what that means right now — 'light' | 'dark'. Derived, never stored.
 *
 * A component that wants to *show* the current colours (an icon, a WebGL
 * palette) needs `theme`; a control that lets someone *change* them needs
 * `mode`, or a three-way switch would show "light" for a system preference that
 * merely happens to be light today. Deriving that in each consumer is how the
 * header and the login screen drifted apart, so it is derived once, here.
 *
 * The preference still lives in `uiSlice` — it is UI state like any other, and
 * the store is what persists it. This provider is the effect layer over it: it
 * subscribes to the OS query, writes the class, keeps the browser chrome in
 * step and follows the preference across tabs. Nothing else touches
 * `document.documentElement` for colour.
 */

/** @type {React.Context<null | {
 *   mode: string, theme: 'light'|'dark', isDark: boolean, systemTheme: 'light'|'dark',
 *   modes: string[], setMode: (m: string) => void, toggle: () => void, cycle: () => void,
 * }>} */
export const ThemeContext = createContext(null);

/** matchMedia is missing in jsdom and in very old browsers; both mean "light". */
const prefersDarkNow = () => {
  try { return window.matchMedia(DARK_QUERY).matches; } catch { return false; }
};

export function ThemeProvider({ children }) {
  const dispatch = useDispatch();
  const mode = useSelector(selectTheme);
  const [prefersDark, setPrefersDark] = useState(prefersDarkNow);
  const painted = useRef(false);

  const theme = resolveTheme(mode, prefersDark);

  // Subscribed always, not only while mode is 'system': a switch back to
  // 'system' has to resolve against a value that is already current.
  useEffect(() => {
    let media;
    try { media = window.matchMedia(DARK_QUERY); } catch { return undefined; }
    const sync = (e) => setPrefersDark(e.matches);
    setPrefersDark(media.matches);
    media.addEventListener('change', sync);
    return () => media.removeEventListener('change', sync);
  }, []);

  // Layout effect, so the class is on <html> before the first paint of a
  // client-side navigation rather than one frame after it.
  useLayoutEffect(() => {
    const root = document.documentElement;
    const dark = theme === 'dark';

    // Every surface animates its colours; without this, flipping the mode sets
    // several hundred transitions running at once and the swap looks like a
    // wipe. Suppressed for one frame — but never on the very first paint,
    // where there is nothing to transition from.
    if (painted.current) {
      root.setAttribute('data-theme-switching', '');
      window.requestAnimationFrame(() => {
        window.requestAnimationFrame(() => root.removeAttribute('data-theme-switching'));
      });
    }
    painted.current = true;

    root.classList.toggle('dark', dark);
    // Read by the form controls, the scrollbars and anything else the browser
    // paints itself, so a dark page does not get a white select popup.
    root.style.colorScheme = theme;
    // `data-theme` carries the resolved theme for CSS that cannot use the
    // class, and `data-theme-mode` carries the preference for anything that
    // wants to style the choice itself.
    root.dataset.theme = theme;
    root.dataset.themeMode = mode;

    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', THEME_COLORS[theme]);
  }, [theme, mode]);

  // Two tabs of the same back office should not disagree about the palette.
  // The store writes localStorage; this reads the other tab's write back.
  useEffect(() => {
    const onStorage = (e) => {
      if (e.key !== THEME_STORAGE_KEY || !e.newValue) return;
      if (isThemeMode(e.newValue) && e.newValue !== mode) dispatch(setTheme(e.newValue));
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [dispatch, mode]);

  const setMode = useCallback((next) => {
    dispatch(setTheme(isThemeMode(next) ? next : 'system'));
  }, [dispatch]);

  // What a single icon button does: land on the opposite of what is on screen.
  // From 'system' that means pinning the other one, which is what someone
  // reaching for the button is asking for.
  const toggle = useCallback(() => {
    setMode(theme === 'dark' ? 'light' : 'dark');
  }, [setMode, theme]);

  /** Walks light → dark → system, for a control that offers all three. */
  const cycle = useCallback(() => setMode(nextThemeMode(mode)), [mode, setMode]);

  const value = useMemo(() => ({
    mode,
    theme,
    isDark: theme === 'dark',
    systemTheme: prefersDark ? 'dark' : 'light',
    modes: THEME_MODES,
    setMode,
    toggle,
    cycle,
  }), [mode, theme, prefersDark, setMode, toggle, cycle]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}
