import { createSlice } from '@reduxjs/toolkit';
import { DEFAULT_THEME_MODE, THEME_STORAGE_KEY, isThemeMode } from '@/config/theme';
import { DEFAULT_LOCALE, SUPPORTED_LOCALES } from '@/config/locale';

const stored = (key, fallback) => {
  try { return localStorage.getItem(key) ?? fallback; } catch { return fallback; }
};

const persist = (key, value) => {
  try { localStorage.setItem(key, value); } catch { /* private mode */ }
};

/** A stored value is user-editable; anything unrecognised falls back rather than leaks through. */
const storedTheme = () => {
  const value = stored(THEME_STORAGE_KEY, DEFAULT_THEME_MODE);
  return isThemeMode(value) ? value : DEFAULT_THEME_MODE;
};

const storedLocale = () => {
  const value = stored('locale', DEFAULT_LOCALE);
  return SUPPORTED_LOCALES.includes(value) ? value : DEFAULT_LOCALE;
};

const uiSlice = createSlice({
  name: 'ui',
  initialState: {
    // The colour *preference*, not the resolved theme — `ThemeProvider` derives
    // that and is the only thing that writes it to the document.
    theme: storedTheme(),
    locale: storedLocale(),
    // The desktop sidebar: full, or folded to an icon rail. Remembered per browser.
    sidebarOpen: stored('sidebarOpen', 'true') !== 'false',
    mobileNavOpen: false,
    commandOpen: false,
    notesOpen: false,
    toasts: [],
  },
  reducers: {
    setTheme(state, action) {
      const mode = isThemeMode(action.payload) ? action.payload : DEFAULT_THEME_MODE;
      state.theme = mode;
      persist(THEME_STORAGE_KEY, mode);
    },
    setLocale(state, action) {
      state.locale = action.payload;
      persist('locale', action.payload);
    },
    toggleSidebar(state) {
      state.sidebarOpen = !state.sidebarOpen;
      persist('sidebarOpen', String(state.sidebarOpen));
    },
    setCommandOpen(state, action) { state.commandOpen = action.payload; },
    setNotesOpen(state, action) { state.notesOpen = action.payload; },
    setMobileNav(state, action) { state.mobileNavOpen = action.payload; },
    pushToast: {
      reducer(state, action) { state.toasts.push(action.payload); },
      prepare(toast) {
        return { payload: { id: crypto.randomUUID(), variant: 'default', ...toast } };
      },
    },
    dismissToast(state, action) {
      state.toasts = state.toasts.filter((t) => t.id !== action.payload);
    },
  },
});

export const {
  setTheme, setLocale, toggleSidebar, setMobileNav, setCommandOpen, setNotesOpen, pushToast, dismissToast,
} = uiSlice.actions;
export default uiSlice.reducer;

export const selectTheme = (s) => s.ui.theme;
export const selectLocale = (s) => s.ui.locale;
export const selectToasts = (s) => s.ui.toasts;
export const selectSidebarOpen = (s) => s.ui.sidebarOpen;
export const selectMobileNavOpen = (s) => s.ui.mobileNavOpen;
export const selectCommandOpen = (s) => s.ui.commandOpen;
export const selectNotesOpen = (s) => s.ui.notesOpen;

export const toastSuccess = (title, description) => pushToast({ title, description, variant: 'success' });
export const toastError = (title, description) => pushToast({ title, description, variant: 'destructive' });
