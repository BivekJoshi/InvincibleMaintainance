import { cn } from '@/helpers/utils';

/** A key cap, for shortcut hints. Decorative: the action it names has its own label. */
export function Kbd({ children, className }) {
  return (
    <kbd
      className={cn(
        'pointer-events-none inline-flex h-5 min-w-5 select-none items-center justify-center rounded border bg-muted px-1 font-sans text-[10px] font-semibold text-muted-foreground',
        className,
      )}
    >
      {children}
    </kbd>
  );
}
