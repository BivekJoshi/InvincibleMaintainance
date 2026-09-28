import { toKathmanduParts } from '@/helpers/format';
import { VISIT_NOTE_MAX, visitResponseSchema } from '@/form/schemas/visit.schema';

/** The longest note a "Need another time" may carry — the API's `visitResponseSchema` (`form/schemas/visit.schema.js`). */
export { VISIT_NOTE_MAX };

const UNDER_WAY = ['EN_ROUTE', 'IN_PROGRESS'];
const DONE = ['COMPLETED', 'VERIFIED'];

/**
 * What the customer's visit page shows, from the visit the API returned (`GET /public/visits/:token`, or an
 * answer's reply). The API decides whether an answer can still be given (`canAnswer`); the page never guesses.
 *
 * - `open`       — no answer yet: Confirm · Need another time
 * - `confirmed`  — they confirmed, and may still change it (the latest answer wins)
 * - `reschedule` — they asked for another time, and may still change it
 * - `cancelled` · `underway` · `done` · `closed` — no answer can be given: no buttons, a call-the-office line
 *
 * @param {{ status?: string, answer?: 'CONFIRMED'|'RESCHEDULE_REQUESTED'|null, canAnswer?: boolean }|null|undefined} visit
 * @param {{ closed?: boolean }} [options] `closed` — the API refused an answer (`VISIT_CLOSED`), whatever the
 *   page's copy of the visit still says
 * @returns {{ kind: 'open'|'confirmed'|'reschedule'|'cancelled'|'underway'|'done'|'closed', canAnswer: boolean }}
 */
export function visitPageState(visit, { closed = false } = {}) {
  const canAnswer = Boolean(visit?.canAnswer) && !closed;
  if (!canAnswer) {
    if (visit?.status === 'CANCELLED') return { kind: 'cancelled', canAnswer };
    if (UNDER_WAY.includes(visit?.status)) return { kind: 'underway', canAnswer };
    if (DONE.includes(visit?.status)) return { kind: 'done', canAnswer };
    return { kind: 'closed', canAnswer };
  }
  if (visit.answer === 'CONFIRMED') return { kind: 'confirmed', canAnswer };
  if (visit.answer === 'RESCHEDULE_REQUESTED') return { kind: 'reschedule', canAnswer };
  return { kind: 'open', canAnswer };
}

/**
 * The visit's window as the customer reads it, in Kathmandu time, in the page's words: a day
 * ("Friday, 2 October 2026" / "शुक्रबार, 2 अक्टोबर 2026") and the hours ("10:00–12:00"). Digits stay Latin.
 * Null when there is no start.
 *
 * @param {{ start?: string|null, end?: string|null }|null|undefined} window
 * @param {object} copy the page's words (`visitCopy(locale)`)
 * @returns {{ day: string, time: string }|null}
 */
export function visitWhen(window, copy) {
  const start = toKathmanduParts(window?.start);
  if (!start.date) return null;
  const end = toKathmanduParts(window?.end);
  const [year, month, day] = start.date.split('-').map(Number);
  const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
  return {
    day: copy.day({ weekday: copy.weekdays[weekday], day, month: copy.months[month - 1], year }),
    time: end.time ? copy.time.range(start.time, end.time) : copy.time.from(start.time),
  };
}

/**
 * The body of `POST /public/visits/:token/respond`: `{ answer }`, with the note only on a reschedule and only
 * when there is one (trimmed — the API trims too, and refuses unknown keys).
 *
 * @param {'confirm'|'reschedule'} answer
 * @param {string} [note]
 */
export function respondBody(answer, note) {
  const text = answer === 'reschedule' ? String(note ?? '').trim() : '';
  // Through the mirrored schema, so the page never sends what the API would refuse.
  return visitResponseSchema.parse(text ? { answer, note: text } : { answer });
}

/** A `tel:` link for a phone as it is printed: `01-5407720` → `tel:015407720`, `+977 980…` → `tel:+977980…`. */
export const telHref = (phone) => `tel:${String(phone ?? '').replace(/[^\d+]/g, '')}`;
