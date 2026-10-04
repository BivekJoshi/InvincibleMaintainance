import { vi } from 'vitest';
import { resetI18nWarnings } from '@/helpers/i18n';

/**
 * Starts listening for the `[i18n]` warnings `t()` prints in development (a word missing in Nepali, a key missing
 * everywhere, a placeholder with no value) — call it before rendering a screen in Nepali; the function it returns
 * lists what was warned. Other warnings pass through. `vi.restoreAllMocks()` ends it.
 *
 * @returns {() => string[]}
 */
export function watchI18nWarnings() {
  resetI18nWarnings();
  const spy = vi.spyOn(console, 'warn');
  return () => spy.mock.calls.map((args) => String(args[0])).filter((message) => message.startsWith('[i18n]'));
}
