import { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { selectToasts, dismissToast } from '@/redux/slices/uiSlice';
import { cn } from '@/helpers/utils';

const ICONS = {
  success: CheckCircle2,
  destructive: AlertCircle,
  default: Info,
};

const STYLES = {
  success: 'surface-success border',
  destructive: 'border-destructive/30 bg-destructive/10 text-destructive',
  default: 'border-border bg-popover text-popover-foreground',
};

function Toast({ toast }) {
  const dispatch = useDispatch();
  const Icon = ICONS[toast.variant] ?? ICONS.default;

  useEffect(() => {
    const t = setTimeout(() => dispatch(dismissToast(toast.id)), toast.duration ?? 5000);
    return () => clearTimeout(t);
  }, [dispatch, toast.id, toast.duration]);

  return (
    <motion.li
      layout
      initial={{ opacity: 0, y: 12, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, x: 24, scale: 0.97, transition: { duration: 0.15 } }}
      transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
      className={cn('pointer-events-auto flex w-full items-start gap-3 rounded-lg border p-4 shadow-lg', STYLES[toast.variant] ?? STYLES.default)}
    >
      <Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
      <div className="flex-1 text-sm">
        <p className="font-medium">{toast.title}</p>
        {toast.description ? <p className="mt-0.5 opacity-80">{toast.description}</p> : null}
      </div>
      <button
        type="button"
        onClick={() => dispatch(dismissToast(toast.id))}
        className="opacity-50 transition-opacity hover:opacity-100"
        aria-label="Dismiss"
      >
        <X className="h-4 w-4" />
      </button>
    </motion.li>
  );
}

/** Live region so screen readers hear what sighted users see. */
export function Toaster() {
  const toasts = useSelector(selectToasts);
  return (
    <ul
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed bottom-4 right-4 z-[100] flex w-full max-w-sm flex-col gap-2 px-4 sm:px-0"
    >
      <AnimatePresence initial={false}>
        {toasts.map((t) => <Toast key={t.id} toast={t} />)}
      </AnimatePresence>
    </ul>
  );
}
