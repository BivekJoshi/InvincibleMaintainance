import { useSelector } from 'react-redux';
import { selectLocale } from '@/redux/slices/uiSlice';
import { fieldCopy } from '@/config/tech/fieldCopy';

/** The field app's words in the language the user chose (`uiSlice.locale`) — see `config/tech/fieldCopy.js`. */
export function useFieldCopy() {
  return fieldCopy(useSelector(selectLocale));
}
