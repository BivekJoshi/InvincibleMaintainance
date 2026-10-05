import { formatDateBs, toKathmanduParts } from '@/helpers/format';

/**
 * The words of the `visit_booked` SMS (Phase L5), for the booking dialog's preview. Nothing here is sent:
 * the API sends the message once the booking commits (`visit.service#announceVisit`), from the seeded
 * template in its customer's language (`MaintainanceBackend/prisma/seed-data.js`). These bodies and the
 * variables' formats mirror that template and that service — change them together.
 *
 * The same text goes to the site contact when that is another number, greeted by their own name.
 */
export const VISIT_BOOKED_COPY = {
  en: 'Hi {{name}}, your site visit {{number}} is booked for {{date}}, {{window}}. {{surveyor}} will come. '
    + 'Confirm or ask for another time: {{link}} - {{appName}}',
  ne: 'नमस्ते {{name}}, तपाईंको साइट निरीक्षण {{number}} {{date}}, {{window}} मा तय भएको छ। {{surveyor}} आउनुहुनेछ। '
    + 'पुष्टि गर्न वा अर्को समय माग्न: {{link}} - {{appName}}',
};

/** Who comes while nobody is assigned — the API's words (`SURVEYOR_WORDS`). */
export const SURVEYOR_WORDS = { en: 'our surveyor', ne: 'हाम्रो सर्वेक्षक' };

/** What stands in for what exists only after the booking: the job's number and the link's token. */
export const NUMBER_PLACEHOLDER = 'JOB-…';
export const visitLinkPlaceholder = (origin = globalThis.location?.origin ?? '') => `${origin}/visit/…`;

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/**
 * `3 Oct 2026` — the visit's day in Kathmandu, written as the API writes it (dayjs `D MMM YYYY`). Built by
 * hand rather than with `Intl`, whose en-GB September is "Sept". In Nepali the API writes that day's Bikram Sambat
 * date in Nepali words (`utils/dates.js#customerDate`, Phase J1): `17 असोज 2083`.
 */
export function visitDateText(iso, locale = 'en') {
  const { date } = toKathmanduParts(iso);
  if (!date) return '';
  if (locale === 'ne') return formatDateBs(iso, { long: true, locale: 'ne' });
  const [y, m, d] = date.split('-').map(Number);
  return `${d} ${MONTHS[m - 1]} ${y}`;
}

/** `10:00–12:00` in Kathmandu time, or the start alone without an end (the API's `visitWindowText`). */
export function visitWindowText(startIso, endIso) {
  const start = toKathmanduParts(startIso).time;
  if (!start) return '';
  const end = toKathmanduParts(endIso).time;
  return end ? `${start}–${end}` : start;
}

/** "Ram Thapa (9841234567)", the name alone without a phone, or "our surveyor" while nobody is picked. */
export function surveyorText(surveyor, locale = 'en') {
  if (!surveyor?.name) return SURVEYOR_WORDS[locale] ?? SURVEYOR_WORDS.en;
  return surveyor.phone ? `${surveyor.name} (${surveyor.phone})` : surveyor.name;
}

/** Fills `{{var}}` as the API's `renderTemplate` does: a missing variable is empty. */
export const fillTemplate = (body, vars = {}) => String(body)
  .replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_m, key) => (vars[key] == null ? '' : String(vars[key])));

/**
 * The SMS as the customer will read it.
 *
 * @param {{ locale?: 'en'|'ne', name: string, start: string, end?: string,
 *   surveyor?: { name?: string, phone?: string|null }|null, link?: string, number?: string, appName?: string }} visit
 * @returns {string}
 */
export function visitBookedSms({ locale = 'en', name, start, end, surveyor, link, number = NUMBER_PLACEHOLDER, appName = '' }) {
  const body = VISIT_BOOKED_COPY[locale] ?? VISIT_BOOKED_COPY.en;
  const text = fillTemplate(body, {
    name,
    number,
    date: visitDateText(start, locale),
    window: visitWindowText(start, end),
    surveyor: surveyorText(surveyor, locale),
    link: link ?? visitLinkPlaceholder(),
    appName,
  });
  // No company name to sign with: drop the dangling " - ".
  return appName ? text : text.replace(/ - $/, '');
}
