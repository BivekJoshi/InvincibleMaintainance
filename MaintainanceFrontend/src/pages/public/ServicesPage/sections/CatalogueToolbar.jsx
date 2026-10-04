import { Search } from 'lucide-react';
import { FilterChip } from '@/components/site/FilterChip';
import { SITE } from '@/config/i18n/site';
import { useT } from '@/hooks/useT';
import { SERVICE_SORTS } from '../servicesSort';

/**
 * What is being shown, what narrowed it, and how it is ordered.
 *
 * Each applied filter is a chip that clears itself, so the way out of a search
 * is always beside the evidence that you are in one — the catalogue's own
 * "results for X" heading is a statement, not a control.
 */
export function CatalogueToolbar({ count, isLoading, query, categoryName, sort, onPatch }) {
  const t = useT(SITE);
  const counted = categoryName
    ? t.rich('services.countIn', { count, category: categoryName }, {
      name: (words) => <span className="font-medium text-foreground">{words}</span>,
    })
    : t('services.count', { count });

  return (
    <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
      <p className="text-sm text-muted-foreground">{isLoading ? t('common.loading') : counted}</p>

      <div className="flex flex-wrap items-center gap-2">
        {query ? (
          <FilterChip icon={Search} onClear={() => onPatch({ q: '' })}>{query}</FilterChip>
        ) : null}
        {categoryName ? (
          <FilterChip onClear={() => onPatch({ category: '' })}>{categoryName}</FilterChip>
        ) : null}

        <label className="flex items-center gap-2 text-xs text-muted-foreground">
          {t('services.sort')}
          <select
            value={sort}
            onChange={(e) => onPatch({ sort: e.target.value === 'recommended' ? '' : e.target.value })}
            className="h-9 rounded-md border bg-card px-2 text-xs font-medium text-foreground outline-none focus:border-primary"
          >
            {Object.entries(SERVICE_SORTS).map(([key, s]) => (
              <option key={key} value={key}>{t(`services.sorts.${s.labelKey}`)}</option>
            ))}
          </select>
        </label>
      </div>
    </div>
  );
}
