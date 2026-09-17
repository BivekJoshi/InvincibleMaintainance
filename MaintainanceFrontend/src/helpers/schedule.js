import { TIMEZONE_OFFSET_MINUTES } from '@/config/locale';
import { formatDate, formatTime } from '@/helpers/format';

/**
 * Where a dated piece of content stands right now, in words an editor reads in a list:
 * an offer's start/end window, a post's publish time. The API decides what is public by
 * comparing instants (`startsAt <= now <= endsAt`, `publishedAt <= now`); these helpers
 * use the same comparison, and only the wording ("today", "tomorrow") is by Kathmandu
 * calendar day.
 */

const DAY_MS = 86_400_000;
const OFFSET_MS = TIMEZONE_OFFSET_MINUTES * 60_000;

/** The Kathmandu calendar day of an instant, as a day number. */
const ktmDay = (ms) => Math.floor((ms + OFFSET_MS) / DAY_MS);

const toMs = (value) => {
  if (value == null || value === '') return null;
  const ms = new Date(value).getTime();
  return Number.isNaN(ms) ? null : ms;
};

/**
 * "today", "tomorrow", "yesterday" or the date, by Kathmandu calendar day.
 *
 * @param {number} ms
 * @param {number} now
 * @param {boolean} [withTime] add the time for today and tomorrow
 */
function dayWord(ms, now, withTime = false) {
  const diff = ktmDay(ms) - ktmDay(now);
  const time = withTime ? ` at ${formatTime(new Date(ms).toISOString())}` : '';
  if (diff === 0) return `today${time}`;
  if (diff === 1) return `tomorrow${time}`;
  if (diff === -1) return 'yesterday';
  return `on ${formatDate(new Date(ms).toISOString())}`;
}

/**
 * An offer's window: `scheduled` before `startsAt`, `ended` after `endsAt`, else `live`.
 * A missing bound is open on that side.
 *
 * @param {{ startsAt?: string|null, endsAt?: string|null }} window
 * @param {Date|number} [now]
 * @returns {{ status: 'live'|'scheduled'|'ended', label: string }}
 */
export function offerWindow({ startsAt, endsAt } = {}, now = Date.now()) {
  const at = toMs(now);
  const start = toMs(startsAt);
  const end = toMs(endsAt);
  if (start != null && start > at) return { status: 'scheduled', label: `Starts ${dayWord(start, at, true)}` };
  if (end != null && end < at) return { status: 'ended', label: `Ended ${dayWord(end, at)}` };
  return { status: 'live', label: end == null ? 'No end date' : `Ends ${dayWord(end, at, true)}` };
}

/**
 * A post: `draft` without a publish time, `scheduled` before it, `published` after.
 *
 * @param {string|null|undefined} publishedAt
 * @param {Date|number} [now]
 * @returns {{ status: 'draft'|'scheduled'|'published', label: string }}
 */
export function publishState(publishedAt, now = Date.now()) {
  const at = toMs(now);
  const ms = toMs(publishedAt);
  if (ms == null) return { status: 'draft', label: 'Not published' };
  if (ms > at) return { status: 'scheduled', label: `Publishes ${dayWord(ms, at, true)}` };
  return { status: 'published', label: `Published ${dayWord(ms, at)}` };
}
