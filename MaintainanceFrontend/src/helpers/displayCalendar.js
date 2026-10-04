import { CALENDARS, DEFAULT_CALENDAR } from '@/config/locale';

let current = DEFAULT_CALENDAR;

/**
 * The calendar the back office writes and picks dates in right now: the account menu's choice (`uiSlice.calendar`)
 * while the admin shell is on screen — `AdminLayout` sets it as it renders, before any page under it formats a date,
 * and puts AD back when it unmounts — and AD everywhere else. `helpers/format.js` reads it for a date formatted
 * without a `locale` (the admin's way; the site, the documents and the field app always pass theirs), and the date
 * pickers read it to choose their calendar. A module value rather than a context because `formatDate` is a plain
 * function; the admin remounts its page when the choice changes, so every date is written again.
 */
export const displayCalendar = () => current;

/** @param {'ad'|'bs'} calendar */
export function setDisplayCalendar(calendar) {
  current = CALENDARS.includes(calendar) ? calendar : DEFAULT_CALENDAR;
}
