import { forwardRef, useEffect, useRef } from 'react';
import { Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/helpers/utils';

/**
 * The storefront search box. Submits to the catalogue; never filters in place.
 * In the header it stays narrow until it has focus, so the bar reads as
 * navigation first and a search engine second.
 */
export const HeaderSearch = forwardRef(function HeaderSearch(
  { className, onSearch, defaultValue = '', autoFocus = false, compact = true },
  ref,
) {
  const inner = useRef(null);
  const node = ref ?? inner;

  useEffect(() => {
    if (node.current) node.current.value = defaultValue;
  }, [defaultValue, node]);

  return (
    <form
      role="search"
      className={cn('relative', className)}
      onSubmit={(e) => { e.preventDefault(); onSearch(node.current?.value.trim() ?? ''); }}
    >
      <Search
        aria-hidden
        className={cn(
          'pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors',
          compact ? 'h-3.5 w-3.5' : 'h-4 w-4',
        )}
      />
      <input
        ref={node}
        type="search"
        name="q"
        defaultValue={defaultValue}
        autoFocus={autoFocus}
        placeholder={compact ? 'Search services…' : 'Search a service…'}
        aria-label="Search services"
        className={cn(
          'peer w-full rounded-full border bg-muted/40 text-sm outline-none transition-all duration-300',
          'placeholder:text-muted-foreground/80 focus:border-primary/40 focus:bg-background focus:ring-4 focus:ring-primary/10',
          compact
            ? 'h-9 w-44 pl-9 pr-9 text-[13px] focus:w-60 xl:w-52 xl:focus:w-72'
            : 'h-11 pl-10 pr-24',
        )}
      />
      {compact ? (
        <kbd className="pointer-events-none absolute right-2.5 top-1/2 hidden -translate-y-1/2 rounded border bg-background px-1.5 font-mono text-[10px] leading-4 text-muted-foreground transition-opacity peer-focus:opacity-0 xl:block">
          /
        </kbd>
      ) : (
        <Button type="submit" size="sm" className="absolute right-1.5 top-1.5 h-8 rounded-full px-4">Search</Button>
      )}
    </form>
  );
});
