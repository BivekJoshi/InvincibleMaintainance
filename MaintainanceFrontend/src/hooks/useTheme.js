import { useContext } from 'react';
import { ThemeContext } from '@/providers/ThemeProvider';

/**
 * The colour mode and everything that can change it.
 *
 * @returns {{
 *   mode: 'light'|'dark'|'system',  what the user chose
 *   theme: 'light'|'dark',          what that resolves to right now
 *   isDark: boolean,
 *   systemTheme: 'light'|'dark',    what the device is asking for
 *   modes: string[],
 *   setMode: (mode: string) => void,
 *   toggle: () => void,             flips to the opposite of what is on screen
 *   cycle: () => void,              light → dark → system
 * }}
 */
export function useTheme() {
  const value = useContext(ThemeContext);
  if (!value) {
    throw new Error('useTheme must be used inside <ThemeProvider> — see providers/AppProviders.');
  }
  return value;
}
