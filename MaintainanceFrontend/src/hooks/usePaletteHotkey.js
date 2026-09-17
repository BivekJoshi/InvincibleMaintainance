import { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { isPaletteChord } from '@/helpers/keys';
import { selectCommandOpen, setCommandOpen } from '@/redux/slices/uiSlice';

/** Opens and closes the command palette on Ctrl/⌘+K, from anywhere in the back office — inputs included. */
export function usePaletteHotkey() {
  const dispatch = useDispatch();
  const open = useSelector(selectCommandOpen);
  useEffect(() => {
    const onKey = (e) => {
      if (!isPaletteChord(e)) return;
      e.preventDefault();
      dispatch(setCommandOpen(!open));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [dispatch, open]);
}
