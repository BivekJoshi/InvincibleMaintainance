import { createSlice } from '@reduxjs/toolkit';

const stored = (key, fallback) => {
  try { return localStorage.getItem(key) ?? fallback; } catch { return fallback; }
};

const uiSlice = createSlice({
  name: 'ui',
  initialState: {
    theme: stored('theme', 'system'),
    locale: stored('locale', 'en'),
    sidebarOpen: true,
    mobileNavOpen: false,
    toasts: [],
  },
  reducers: {
    setTheme(state, action) {
      state.theme = action.payload;
      try { localStorage.setItem('theme', action.payload); } catch { /* private mode */ }
    },
    setLocale(state, action) {
      state.locale = action.payload;
      try { localStorage.setItem('locale', action.payload); } catch { /* private mode */ }
    },
    toggleSidebar(state) { state.sidebarOpen = !state.sidebarOpen; },
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

export const { setTheme, setLocale, toggleSidebar, setMobileNav, pushToast, dismissToast } = uiSlice.actions;
export default uiSlice.reducer;

export const selectTheme = (s) => s.ui.theme;
export const selectLocale = (s) => s.ui.locale;
export const selectToasts = (s) => s.ui.toasts;

export const toastSuccess = (title, description) => pushToast({ title, description, variant: 'success' });
export const toastError = (title, description) => pushToast({ title, description, variant: 'destructive' });
