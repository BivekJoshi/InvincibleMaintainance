import { useMemo, useState } from 'react';
import { ChevronRight, Minus, Plus, Search, ArrowLeft } from 'lucide-react';
import { useGetTechMaterialsQuery } from '@/api/techApi';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { FIELD } from '@/config/i18n/field';
import { useT } from '@/hooks/useT';
import { toLatinDigits } from '@/helpers/format';

/** How many matches the list shows before asking for a narrower search. */
const SHOWN = 40;
const MAX_QTY = 1_000_000;

/** Up to three decimals, the way a quantity is typed — "2.5", not "2.500". */
const tidy = (n) => String(Math.round(n * 1000) / 1000);

/**
 * "What did you use?" — a bottom sheet in two steps: pick a material from `GET /tech/materials` (code, name,
 * unit; there is no rate on this screen, and the API sends none), then the quantity in its unit, with big
 * − and + for gloved thumbs. `onLog({ material, qty })` is the caller's: the job page queues a `material`
 * mutation, so it works the same with or without signal. The list is cached for the shift
 * (`keepUnusedDataFor`), so it opens offline once it has loaded once.
 *
 * Its words are `FIELD.materialsSheet`, with the title, the hint and the button from `section` — `materials` (the
 * job's "Log material") or `diary.received` (a delivery). The quantity is a text box so a Nepali keyboard's digits
 * are taken: `१२.५` is read, and shown, as `12.5`.
 *
 * @param {{ open: boolean, onOpenChange: (open: boolean) => void,
 *   onLog: (line: { material: { id: string, code: string, name: string, unit: string }, qty: number }) => Promise<void>|void,
 *   section?: 'materials'|'diary.received' }} props
 */
export function MaterialsSheet({ open, onOpenChange, onLog, section = 'materials' }) {
  const t = useT(FIELD);
  const { data: materials, isLoading } = useGetTechMaterialsQuery(undefined, { skip: !open });
  const [q, setQ] = useState('');
  const [picked, setPicked] = useState(null);
  const [qty, setQty] = useState('1');
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  const matches = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const list = materials ?? [];
    return needle
      ? list.filter((m) => m.name.toLowerCase().includes(needle) || m.code.toLowerCase().includes(needle))
      : list;
  }, [materials, q]);

  const reset = () => {
    setQ('');
    setPicked(null);
    setQty('1');
    setError(null);
  };

  const change = (next) => {
    if (!next) reset();
    onOpenChange(next);
  };

  const step = (by) => {
    const current = Number(qty) || 0;
    setQty(tidy(Math.max(0, current + by)));
    setError(null);
  };

  const submit = async (event) => {
    event.preventDefault();
    const value = Number(qty);
    if (!Number.isFinite(value) || value <= 0 || value > MAX_QTY) {
      setError(t('materialsSheet.invalid'));
      return;
    }
    setSaving(true);
    try {
      await onLog({ material: picked, qty: value });
      change(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={change}>
      <SheetContent
        side="bottom"
        className="flex max-h-[88dvh] flex-col gap-3 rounded-t-2xl p-4 pb-[max(1rem,env(safe-area-inset-bottom))]"
        closeLabel={t('close')}
      >
        <SheetHeader className="pr-8 text-left">
          <SheetTitle>{t(`${section}.sheetTitle`)}</SheetTitle>
          <SheetDescription>{t(`${section}.sheetBody`)}</SheetDescription>
        </SheetHeader>

        {picked ? (
          <form onSubmit={submit} className="space-y-4" noValidate>
            <div className="rounded-lg border bg-muted/40 p-3">
              <p className="font-semibold leading-tight">{picked.name}</p>
              <p className="mt-0.5 font-mono text-xs text-muted-foreground">{picked.code} · {picked.unit}</p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="material-qty">{t('materialsSheet.quantityIn', { unit: picked.unit })}</Label>
              <div className="flex items-stretch gap-2">
                <Button type="button" variant="outline" className="h-14 w-14 shrink-0" onClick={() => step(-1)} aria-label={t('materialsSheet.less')}>
                  <Minus />
                </Button>
                <div className="relative flex-1">
                  <Input
                    id="material-qty"
                    inputMode="decimal"
                    autoComplete="off"
                    value={qty}
                    onChange={(e) => { setQty(toLatinDigits(e.target.value)); setError(null); }}
                    aria-invalid={error ? 'true' : undefined}
                    aria-describedby={error ? 'material-qty-error' : undefined}
                    className="h-14 pr-14 text-center text-xl font-semibold"
                  />
                  <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-muted-foreground">
                    {picked.unit}
                  </span>
                </div>
                <Button type="button" variant="outline" className="h-14 w-14 shrink-0" onClick={() => step(1)} aria-label={t('materialsSheet.more')}>
                  <Plus />
                </Button>
              </div>
              {error ? <p id="material-qty-error" className="text-sm text-destructive">{error}</p> : null}
            </div>
            <Button type="submit" size="xl" className="w-full" loading={saving}>
              {t(`${section}.submit`, { qty: qty || '0', unit: picked.unit })}
            </Button>
            <Button type="button" variant="ghost" size="lg" className="w-full" onClick={() => { setPicked(null); setError(null); }}>
              <ArrowLeft /> {t('materialsSheet.pickAnother')}
            </Button>
          </form>
        ) : (
          <>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
              <Input
                type="search"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder={t('materialsSheet.search')}
                aria-label={t('materialsSheet.search')}
                className="h-12 pl-9 text-base"
              />
            </div>
            <div className="-mx-1 min-h-0 flex-1 overflow-y-auto px-1">
              {isLoading ? null : !materials ? (
                <p className="py-6 text-center text-sm text-muted-foreground">{t('materialsSheet.notLoaded')}</p>
              ) : !matches.length ? (
                <p className="py-6 text-center text-sm text-muted-foreground">{t('materialsSheet.noMatch')}</p>
              ) : (
                <ul className="space-y-1.5">
                  {matches.slice(0, SHOWN).map((m) => (
                    <li key={m.id}>
                      <button
                        type="button"
                        onClick={() => { setPicked(m); setQty('1'); }}
                        className="flex min-h-14 w-full items-center gap-3 rounded-lg border bg-card px-3 py-2 text-left active:bg-muted"
                      >
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-medium">{m.name}</span>
                          <span className="block font-mono text-xs text-muted-foreground">{m.code} · {m.unit}</span>
                        </span>
                        <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden />
                      </button>
                    </li>
                  ))}
                  {matches.length > SHOWN ? (
                    <li className="py-2 text-center text-xs text-muted-foreground">{t('materialsSheet.moreMatches', { count: matches.length - SHOWN })}</li>
                  ) : null}
                </ul>
              )}
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
