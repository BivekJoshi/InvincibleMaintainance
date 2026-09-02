import { useEffect } from 'react';
import { useSelector } from 'react-redux';
import { selectTheme } from '@/features/ui/uiSlice';

/** Applies the theme class to <html>, following the OS when set to "system". */
export function useTheme() {
  const theme = useSelector(selectTheme);

  useEffect(() => {
    const root = document.documentElement;
    const media = window.matchMedia('(prefers-color-scheme: dark)');

    const apply = () => {
      const dark = theme === 'dark' || (theme === 'system' && media.matches);
      root.classList.toggle('dark', dark);
    };

    apply();
    if (theme !== 'system') return undefined;
    media.addEventListener('change', apply);
    return () => media.removeEventListener('change', apply);
  }, [theme]);

  return theme;
}
