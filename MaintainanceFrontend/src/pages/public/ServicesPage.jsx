import { useMemo } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { Search, X } from 'lucide-react';
import { useGetPublicServicesQuery, useGetBootstrapQuery } from '@/features/public/publicApi';
import { selectLocale } from '@/features/ui/uiSlice';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { ErrorState } from '@/components/common/ErrorState';
import { EmptyState } from '@/components/common/EmptyState';
import { PageHero, ServiceCard, SectionShell } from '@/components/site';
import { PageTransition, StaggerOnView, Stagger } from '@/components/motion';
import { cn } from '@/lib/utils';

const SORTS = {
  recommended: { label: 'Recommended', compare: null },
  'price-asc': { label: 'Price: low to high', compare: (a, b) => (a.priceFrom ?? Infinity) - (b.priceFrom ?? Infinity) },
  'price-desc': { label: 'Price: high to low', compare: (a, b) => (b.priceFrom ?? -1) - (a.priceFrom ?? -1) },
  name: { label: 'Name A–Z', compare: (a, b) => a.name.localeCompare(b.name) },
};

/**
 * The catalogue. Category filtering is a server query (the API supports it);
 * the text search and the sort run on the returned list, which is a page of
 * services, not a database — no round trip per keystroke.
 */
export default function ServicesPage() {
  const locale = useSelector(selectLocale);
  const [params, setParams] = useSearchParams();
  const category = params.get('category') ?? '';
  const q = params.get('q') ?? '';
  const sort = params.get('sort') ?? 'recommended';

  const { data: boot } = useGetBootstrapQuery(locale);
  const { data, isLoading, error, refetch } = useGetPublicServicesQuery({
    locale, ...(category ? { category } : {}),
  });

  const categories = boot?.nav?.categories ?? [];
  const categoryName = categories.find((c) => c.slug === category)?.name;

  const items = useMemo(() => {
    const all = data?.items ?? [];
    const needle = q.trim().toLowerCase();
    const filtered = needle
      ? all.filter((s) => [s.name, s.excerpt, s.category?.name].filter(Boolean).join(' ').toLowerCase().includes(needle))
      : all;
    const compare = SORTS[sort]?.compare;
    return compare ? [...filtered].sort(compare) : filtered;
  }, [data, q, sort]);

  const patch = (next) => {
    const merged = { ...Object.fromEntries(params), ...next };
    setParams(Object.fromEntries(Object.entries(merged).filter(([, v]) => v)));
  };

  if (error) return <ErrorState error={error} onRetry={refetch} className="min-h-[60dvh]" />;

  return (
    <PageTransition>
      <PageHero
        eyebrow={categoryName ?? 'Catalogue'}
        title={q ? `Results for “${q}”` : (categoryName ?? 'Every service we book online')}
        description="Published rates, a free inspection before any work, and a one-month written warranty after it."
      />

      <SectionShell>
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">
            {isLoading ? 'Loading…' : `${items.length} service${items.length === 1 ? '' : 's'}`}
            {categoryName ? <> in <span className="font-medium text-foreground">{categoryName}</span></> : null}
          </p>

          <div className="flex flex-wrap items-center gap-2">
            {q ? (
              <button
                type="button"
                onClick={() => patch({ q: '' })}
                className="flex items-center gap-1.5 rounded-full border bg-card px-3 py-1.5 text-xs font-medium transition-colors hover:border-primary/40"
              >
                <Search className="h-3 w-3" aria-hidden /> {q} <X className="h-3 w-3 text-muted-foreground" aria-hidden />
              </button>
            ) : null}
            {category ? (
              <button
                type="button"
                onClick={() => patch({ category: '' })}
                className="flex items-center gap-1.5 rounded-full border bg-card px-3 py-1.5 text-xs font-medium transition-colors hover:border-primary/40"
              >
                {categoryName} <X className="h-3 w-3 text-muted-foreground" aria-hidden />
              </button>
            ) : null}

            <label className="flex items-center gap-2 text-xs text-muted-foreground">
              Sort
              <select
                value={sort}
                onChange={(e) => patch({ sort: e.target.value === 'recommended' ? '' : e.target.value })}
                className="h-9 rounded-md border bg-card px-2 text-xs font-medium text-foreground outline-none focus:border-primary"
              >
                {Object.entries(SORTS).map(([key, s]) => <option key={key} value={key}>{s.label}</option>)}
              </select>
            </label>
          </div>
        </div>

        {isLoading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className={cn('h-80 rounded-xl')} />)}
          </div>
        ) : items.length ? (
          <StaggerOnView className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4" stagger={0.04}>
            {items.map((service) => (
              <Stagger.Item
                key={service.id}
                variants={{
                  hidden: { opacity: 0, y: 18 },
                  show: { opacity: 1, y: 0, transition: { duration: 0.45, ease: [0.16, 1, 0.3, 1] } },
                }}
              >
                <ServiceCard service={service} media={data.media} />
              </Stagger.Item>
            ))}
          </StaggerOnView>
        ) : (
          <EmptyState
            icon={Search}
            title="Nothing matched that"
            description="Try a different word or browse another category — or tell us what you need and we will quote it."
            action={{ asChild: <Link to="/book">Describe the job</Link> }}
          />
        )}
      </SectionShell>
    </PageTransition>
  );
}
