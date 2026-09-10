/**
 * Everything the colour system needs to know about itself, in one file.
 *
 * The palette itself lives in `styles/globals.css` as CSS variables — this is
 * only the vocabulary around it: which modes exist, where the preference is
 * stored, and the two browser-chrome colours that have to match `--background`
 * so the address bar does not sit a shade off the page.
 */

/** A mode is what the user picked. A theme is what that resolves to right now. */
export const THEME_MODES = ['light', 'dark', 'system'];

export const DEFAULT_THEME_MODE = 'system';

/** Also read by the inline boot script in `index.html` — change both together. */
export const THEME_STORAGE_KEY = 'theme';

export const DARK_QUERY = '(prefers-color-scheme: dark)';

/**
 * `<meta name="theme-color">`, in the same colour `--background` resolves to.
 * The meta tag cannot read a CSS variable, so these two are a copy — if the
 * background changes in `globals.css`, change them here in the same commit.
 */
export const THEME_COLORS = { light: '#fbfaf8', dark: '#11191d' };

/** Label and hint for each mode. Icons are picked in the component, not here. */
export const THEME_MODE_LABELS = {
  light: { label: 'Light', hint: 'Always the paper palette' },
  dark: { label: 'Dark', hint: 'Always the ink palette' },
  system: { label: 'System', hint: 'Follows your device setting' },
};

/** Anything that is not a known mode is treated as "system" rather than trusted. */
export const isThemeMode = (value) => THEME_MODES.includes(value);

/**
 * The one place a mode becomes a theme.
 *
 * @param {string} mode one of THEME_MODES
 * @param {boolean} prefersDark what `DARK_QUERY` currently matches
 * @returns {'light'|'dark'}
 */
export function resolveTheme(mode, prefersDark) {
  if (mode === 'dark') return 'dark';
  if (mode === 'light') return 'light';
  return prefersDark ? 'dark' : 'light';
}

/** The order the icon toggle walks: light → dark → system → light. */
export const nextThemeMode = (mode) =>
  THEME_MODES[(THEME_MODES.indexOf(mode) + 1) % THEME_MODES.length] ?? DEFAULT_THEME_MODE;
