import { useCallback, useEffect, useRef, useState } from 'react';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';

/**
 * A confirmation you can `await`:
 *
 *   const [confirm, confirmDialog] = useConfirm();
 *   if (await confirm({ title: 'Delete this FAQ?', destructive: true })) remove(id);
 *   return <>{…}{confirmDialog}</>;
 *
 * The dialog is rendered by the caller rather than by an app-wide provider, so
 * alert-dialog stays out of the marketing bundle. Asking again while a question is
 * open answers the first one "no"; unmounting does the same.
 *
 * @returns {[(options?: object) => Promise<boolean>, import('react').ReactElement]}
 */
export function useConfirm() {
  const [open, setOpen] = useState(false);
  // Kept after close, so the title does not blank out during the exit animation.
  const [options, setOptions] = useState({});
  const resolver = useRef(null);

  const settle = useCallback((value) => {
    resolver.current?.(value);
    resolver.current = null;
    setOpen(false);
  }, []);

  const confirm = useCallback((next = {}) => new Promise((resolve) => {
    resolver.current?.(false);
    resolver.current = resolve;
    setOptions(next);
    setOpen(true);
  }), []);

  useEffect(() => () => resolver.current?.(false), []);

  const dialog = (
    <ConfirmDialog
      {...options}
      open={open}
      onConfirm={() => settle(true)}
      onCancel={() => settle(false)}
    />
  );

  return [confirm, dialog];
}
