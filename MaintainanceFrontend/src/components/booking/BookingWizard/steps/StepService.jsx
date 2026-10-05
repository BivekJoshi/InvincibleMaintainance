import { Search } from 'lucide-react';
import { DataIcon } from '@/components/site/DataIcon';
import { Skeleton } from '@/components/ui/skeleton';
import { SITE } from '@/config/i18n/site';
import { useT } from '@/hooks/useT';
import { formatNpr } from '@/helpers/format';
import { cn } from '@/helpers/utils';

/**
 * Step one: what needs doing.
 *
 * The search filters the list in place rather than navigating, because leaving
 * the wizard to browse the catalogue is leaving the wizard. Nothing matching is
 * not a dead end either — the visitor can carry on and describe the job in
 * their own words at the last step.
 */
export function StepService({ services, loading, query, onQuery, value, onChange }) {
  const t = useT(SITE);
  const priceOf = (s) => {
    if (!s.priceFrom) return t('price.afterInspection');
    const price = formatNpr(s.priceFrom, { compact: true, locale: t.locale });
    return s.priceUnit ? t('price.fromPricePer', { price, unit: s.priceUnit }) : t('price.fromPrice', { price });
  };

  return (
    <div>
      <h2 className="text-xl font-bold tracking-tight">{t('booking.service.title')}</h2>
      <p className="mt-1 text-sm text-muted-foreground">{t('booking.service.description')}</p>

      <div className="relative mt-5">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
        <input
          type="search"
          value={query}
          onChange={(e) => onQuery(e.target.value)}
          placeholder={t('search.label')}
          aria-label={t('search.label')}
          className="h-10 w-full rounded-md border bg-card pl-10 pr-3 text-sm outline-none focus:border-primary"
        />
      </div>

      {loading ? (
        <div className="mt-4 grid gap-2 sm:grid-cols-2" aria-hidden>
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-lg" />)}
        </div>
      ) : (
        <div className="mt-4 grid max-h-[420px] gap-2 overflow-y-auto pr-1 sm:grid-cols-2">
          {services.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => onChange(s.id)}
              aria-pressed={value === s.id}
              className={cn(
                'flex items-start gap-3 rounded-lg border bg-card p-3.5 text-left transition-all',
                value === s.id ? 'border-primary ring-1 ring-primary/25' : 'hover:border-primary/40',
              )}
            >
              <span className={cn(
                'mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-full transition-colors',
                value === s.id ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground',
              )}>
                <DataIcon name={s.icon} className="h-4 w-4" />
              </span>
              <span className="min-w-0">
                <span className="block truncate text-[14px] font-semibold tracking-tight">{s.name}</span>
                <span className="mt-0.5 block text-[12px] text-muted-foreground">{priceOf(s)}</span>
              </span>
            </button>
          ))}

          {services.length ? null : (
            <p className="col-span-full rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
              {t('booking.service.empty')}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
