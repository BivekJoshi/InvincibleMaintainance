import { useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { useGetPublicServicesQuery } from '@/api/publicApi';
import { selectLocale } from '@/redux/slices/uiSlice';
import { useSiteSettings } from '@/hooks/useSiteSettings';
import { useSeo } from '@/hooks/useSeo';
import { ErrorState } from '@/components/common/ErrorState';
import { PageHero } from '@/components/site/PageHero';
import { SectionShell } from '@/components/site/SectionShell';
import { PageTransition } from '@/three/motion/motionKit';
import { CatalogueToolbar } from './sections/CatalogueToolbar';
import { ServiceGrid } from './sections/ServiceGrid';
import { DEFAULT_SERVICE_SORT, selectServices } from './servicesSort';

/**
 * The catalogue.
 *
 * The URL is the state: category, search and sort all live in the query string,
 * so a filtered catalogue is a link someone can send. Category filtering is a
 * server query (the API supports it); the text search and the sort run on the
 * returned page in `servicesSort.js`.
 */
export default function ServicesPage() {
  const locale = useSelector(selectLocale);
  const [params, setParams] = useSearchParams();
  const category = params.get('category') ?? '';
  const q = params.get('q') ?? '';
  const sort = params.get('sort') ?? DEFAULT_SERVICE_SORT;

  const { categories } = useSiteSettings();
  const { data, isLoading, error, refetch } = useGetPublicServicesQuery({
    locale, ...(category ? { category } : {}),
  });

  const categoryName = categories.find((c) => c.slug === category)?.name;
  const services = useMemo(() => selectServices(data?.items, q, sort), [data, q, sort]);

  useSeo({
    title: q ? `Search: ${q}` : (categoryName ?? 'Every service we book online'),
    description: 'Published rates, a free inspection before any work, and a one-month written warranty after it.',
  });

  /** Query-string edits, always as a merge — one control never clears another. */
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
        <CatalogueToolbar
          count={services.length}
          isLoading={isLoading}
          query={q}
          categoryName={categoryName}
          sort={sort}
          onPatch={patch}
        />
        <ServiceGrid services={services} media={data?.media} isLoading={isLoading} />
      </SectionShell>
    </PageTransition>
  );
}
