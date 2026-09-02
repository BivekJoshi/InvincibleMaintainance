import { useSearchParams, Link } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { useGetPublicServicesQuery, useGetBootstrapQuery } from '@/features/public/publicApi';
import { selectLocale } from '@/features/ui/uiSlice';
import { Skeleton } from '@/components/ui/skeleton';
import { ErrorState } from '@/components/common/ErrorState';
import { EmptyState } from '@/components/common/EmptyState';
import { PageHero, ServiceCard, SectionShell, gridFit } from '@/components/site';
import { PageTransition, StaggerOnView, Stagger } from '@/components/motion';
import { cn } from '@/lib/utils';

export default function ServicesPage() {
  const locale = useSelector(selectLocale);
  const [params, setParams] = useSearchParams();
  const category = params.get('category') ?? '';
  const { data: boot } = useGetBootstrapQuery(locale);
  const { data, isLoading, error, refetch } = useGetPublicServicesQuery({
    locale, ...(category ? { category } : {}),
  });

  const categories = boot?.nav?.categories ?? [];
  const items = data?.items ?? [];
  const { cols, fillers } = gridFit(items.length);

  const select = (slug) => {
    if (slug) setParams({ category: slug });
    else setParams({});
  };

  if (error) return <ErrorState error={error} onRetry={refetch} className="min-h-[60dvh]" />;

  return (
    <PageTransition>
      <PageHero
        eyebrow="What we do"
        title="Every service, diagnosed before it is priced"
        description="Instruments before opinions, a published rate card before a quotation, and a written one-month warranty after handover."
      />

      <SectionShell>
        {/* Category filter — the footer and the home page both link straight in
            with ?category=, so the state lives in the URL, not in a store. */}
        {categories.length ? (
          <div className="mb-10 flex flex-wrap gap-2">
            <FilterChip active={!category} onClick={() => select('')}>All work</FilterChip>
            {categories.map((c) => (
              <FilterChip key={c.id} active={category === c.slug} onClick={() => select(c.slug)}>
                {c.name}
              </FilterChip>
            ))}
          </div>
        ) : null}

        {isLoading ? (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-72 rounded-lg" />)}
          </div>
        ) : items.length ? (
          <StaggerOnView
            className={cn(
              'grid gap-px overflow-hidden rounded-lg border bg-border sm:grid-cols-2',
              cols === 3 && 'lg:grid-cols-3',
            )}
            stagger={0.06}
          >
            {items.map((service, i) => (
              <Stagger.Item
                key={service.id}
                className="bg-card"
                variants={{
                  hidden: { opacity: 0, y: 24, filter: 'blur(6px)' },
                  show: { opacity: 1, y: 0, filter: 'blur(0px)', transition: { duration: 0.55, ease: [0.16, 1, 0.3, 1] } },
                }}
              >
                <ServiceCard service={service} media={data.media} index={i + 1} />
              </Stagger.Item>
            ))}
            {Array.from({ length: fillers }).map((_, i) => (
              <div key={`filler-${i}`} className="hidden bg-card sm:block" aria-hidden />
            ))}
          </StaggerOnView>
        ) : (
          <EmptyState
            title="Nothing in this category yet"
            description="Try another category, or tell us what you need and we will quote it."
            action={{ asChild: <Link to="/contact">Ask us directly</Link> }}
          />
        )}
      </SectionShell>
    </PageTransition>
  );
}

function FilterChip({ active, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'rounded-full border px-4 py-2 text-sm transition-colors',
        active
          ? 'border-foreground bg-foreground text-background'
          : 'border-border text-muted-foreground hover:border-foreground/40 hover:text-foreground',
      )}
    >
      {children}
    </button>
  );
}
