import { DEVANAGARI_FONT_URL } from '@/config/locale';

/** The stylesheet link's id — `index.html` adds the same one before the first paint for a page that opens in Nepali. */
const FONT_LINK_ID = 'font-devanagari';

/**
 * Adds Noto Sans Devanagari's stylesheet once (J1.7): for Nepali screens (`providers/LocaleProvider`), and on the
 * English back office wherever a Nepali date is written in Nepali script — the SLA board's calendar, the clock in BS.
 * It stays once loaded.
 */
export function loadDevanagariFont() {
  if (document.getElementById(FONT_LINK_ID)) return;
  const link = document.createElement('link');
  link.id = FONT_LINK_ID;
  link.rel = 'stylesheet';
  link.href = DEVANAGARI_FONT_URL;
  document.head.appendChild(link);
}
