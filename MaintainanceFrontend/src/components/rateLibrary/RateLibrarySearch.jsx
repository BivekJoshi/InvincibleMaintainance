import { useEffect, useState } from 'react';
import { Check, Library, Loader2 } from 'lucide-react';
import { useSearchRateLibraryQuery } from '@/api/rateLibraryApi';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Button } from '@/components/ui/button';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { libraryRow } from '@/helpers/boq';
import { formatNpr } from '@/helpers/format';
import { cn } from '@/helpers/utils';

/**
 * The BOQ grid's `/` search (Phase L3): the rate library searched on the server (code or name), in a command
 * palette. **Enter** adds the highlighted item; **Shift+Enter** (or a click on its tick) picks several first,
 * then Enter or "Add" puts them all in. Each becomes a row priced from the library — its name, unit and rate
 * (rupees), and LABOUR or SERVICE by its category; the server snapshots its recipe when the row is saved.
 *
 * @param {{ open: boolean, onOpenChange: (open: boolean) => void, onPick: (rows: object[]) => void, onClosed?: () => void }} props
 */
export function RateLibrarySearch({ open, onOpenChange, onPick, onClosed }) {
  const [q, setQ] = useState('');
  const [picked, setPicked] = useState([]);
  const [highlighted, setHighlighted] = useState('');
  const debounced = useDebouncedValue(q, 200);
  const { data: items = [], isFetching, error } = useSearchRateLibraryQuery({ q: debounced.trim() }, { skip: !open });

  // New results: the first is highlighted, so Enter adds what the search found (the old highlight is gone).
  useEffect(() => {
    if (items.length && !items.some((i) => i.id === highlighted)) setHighlighted(items[0].id);
  }, [items, highlighted]);

  const reset = () => {
    setQ('');
    setPicked([]);
    setHighlighted('');
  };
  const toggle = (item) => setPicked((list) => (list.some((x) => x.id === item.id) ? list.filter((x) => x.id !== item.id) : [...list, item]));
  const add = (extra) => {
    const chosen = [...picked];
    if (extra && !chosen.some((x) => x.id === extra.id)) chosen.push(extra);
    reset();
    onPick(chosen.map(libraryRow));
  };

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) reset(); onOpenChange(next); }}>
      <DialogContent
        className="max-w-2xl overflow-hidden p-0"
        onCloseAutoFocus={(e) => {
          // The grid puts focus on the row it added (or back on its cell) once the dialog has let go of it.
          e.preventDefault();
          onClosed?.();
        }}
      >
        <DialogTitle className="sr-only">Search the rate library</DialogTitle>
        <DialogDescription className="sr-only">
          Type a code or a name. Enter adds the highlighted item; Shift+Enter ticks it and keeps the list open.
        </DialogDescription>
        <Command
          label="Search the rate library"
          shouldFilter={false}
          value={highlighted}
          onValueChange={setHighlighted}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && e.shiftKey) {
              e.preventDefault();
              const item = items.find((i) => i.id === highlighted);
              if (item) toggle(item);
            }
          }}
          className="[&_[cmdk-input]]:h-12"
        >
          <CommandInput value={q} onValueChange={setQ} placeholder="Search the rate library — code or name…" aria-label="Search the rate library" />
          <CommandList className="max-h-[360px]">
            {isFetching && !items.length ? (
              <div className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Searching…
              </div>
            ) : (
              <CommandEmpty>{error ? 'The library could not be searched.' : 'Nothing in the library matches.'}</CommandEmpty>
            )}
            {items.length ? (
              <CommandGroup heading="Rate library">
                {items.map((item) => {
                  const isPicked = picked.some((x) => x.id === item.id);
                  return (
                    <CommandItem key={item.id} value={item.id} onSelect={() => add(item)} className="gap-3">
                      <button
                        type="button"
                        tabIndex={-1}
                        aria-label={`${isPicked ? 'Untick' : 'Tick'} ${item.code}`}
                        onClick={(e) => { e.stopPropagation(); toggle(item); }}
                        onPointerDown={(e) => e.stopPropagation()}
                        className={cn('grid h-4 w-4 shrink-0 place-items-center rounded-sm border', isPicked && 'border-primary bg-primary text-primary-foreground')}
                      >
                        {isPicked ? <Check className="h-3 w-3" aria-hidden /> : null}
                      </button>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate">
                          <span className="font-mono text-xs font-semibold">{item.code}</span> · {item.name}
                        </span>
                        <span className="block truncate text-xs text-muted-foreground">
                          {item.category ?? 'Uncategorised'}{item.components?.length ? ` · recipe of ${item.components.length}` : ''}
                        </span>
                      </span>
                      <span className="shrink-0 text-right text-xs tabular-nums">
                        {formatNpr(item.rate)} <span className="text-muted-foreground">/ {item.unit}</span>
                      </span>
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            ) : null}
          </CommandList>
          <div className="flex flex-wrap items-center justify-between gap-2 border-t px-3 py-2 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <Library className="h-3.5 w-3.5" aria-hidden />
              Enter adds · Shift+Enter ticks more · Esc closes
            </span>
            {picked.length ? (
              <Button type="button" size="sm" onClick={() => add()}>
                Add {picked.length} {picked.length === 1 ? 'row' : 'rows'}
              </Button>
            ) : null}
          </div>
        </Command>
      </DialogContent>
    </Dialog>
  );
}
