import { useTheme } from '@/hooks/useTheme';

/** Side-effect-only component: keeps the <html> theme class in sync. */
export function ThemeEffect() {
  useTheme();
  return null;
}
