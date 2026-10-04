import { useDispatch, useSelector } from 'react-redux';
import { CALENDARS } from '@/config/locale';
import { selectCalendar, setCalendar } from '@/redux/slices/uiSlice';

/**
 * The calendar the back office reads dates in — AD or BS — and the way to change it (the account menu's switch).
 *
 * @returns {{ calendar: 'ad'|'bs', isBs: boolean, calendars: string[], setCalendar: (calendar: 'ad'|'bs') => void }}
 */
export function useCalendarMode() {
  const dispatch = useDispatch();
  const calendar = useSelector(selectCalendar);
  return {
    calendar,
    isBs: calendar === 'bs',
    calendars: CALENDARS,
    setCalendar: (next) => dispatch(setCalendar(next)),
  };
}
