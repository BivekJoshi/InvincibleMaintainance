import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc.js';
import timezone from 'dayjs/plugin/timezone.js';
import relativeTime from 'dayjs/plugin/relativeTime.js';
import { env } from '../config/env.js';

dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.extend(relativeTime);
dayjs.tz.setDefault(env.business.timezone);

export { dayjs };

export const addMinutes = (date, m) => new Date(new Date(date).getTime() + m * 60000);
export const addDays = (date, d) => new Date(new Date(date).getTime() + d * 86400000);
export const startOfDay = (date = new Date()) => dayjs(date).tz(env.business.timezone).startOf('day').toDate();
export const endOfDay = (date = new Date()) => dayjs(date).tz(env.business.timezone).endOf('day').toDate();
/** Renders a UTC instant in Kathmandu local time. */
export const local = (date, fmt = 'YYYY-MM-DD HH:mm') =>
  dayjs(date).tz(env.business.timezone).format(fmt);
