import { useSelector } from 'react-redux';
import { useGetHomeQuery } from '@/api/publicApi';
import { selectLocale } from '@/redux/slices/uiSlice';
import { ErrorState } from '@/components/common/ErrorState';
import { PageTransition } from '@/three/motion/motionKit';
import { HomeSkeleton } from './HomeSkeleton';
import { StorefrontHero } from './sections/StorefrontHero';
import { PromiseStrip } from './sections/PromiseStrip';
import { PopularServices } from './sections/PopularServices';
import { RecentWork } from './sections/RecentWork';
import { Offers } from './sections/Offers';
import { Gallery } from './sections/Gallery';
import { FeatureRow } from './sections/FeatureRow';
import { KitchenBlock } from './sections/KitchenBlock';
import { StatsBand } from './sections/StatsBand';
import { ExplainerBlock } from './sections/ExplainerBlock';
import { ContentBlock } from './sections/ContentBlock';
import { ChecklistBlock } from './sections/ChecklistBlock';
import { PackageGrid } from './sections/PackageGrid';
import { ChipList } from './sections/ChipList';
import { HowItWorks } from './sections/HowItWorks';
import { Reviews } from './sections/Reviews';
import { ClosingCta } from './sections/ClosingCta';

/**
 * The home page is the storefront front door: search, categories, then priced
 * services you can book. Everything below that is still whatever the admin has
 * made visible, in their order — adding, hiding or reordering a section stays a
 * content change, not a code edit.
 *
 * The registry below is the whole map: a section key from the API picks the
 * component that renders it, and each of those lives in its own file under
 * `./sections/`. An unknown key, or a section the API sent empty, renders
 * nothing rather than an empty band.
 *
 * Two things every section obeys. Surfaces are shadcn primitives — <Card>,
 * <Badge>, <Separator> — never a hand-rolled `rounded-xl border bg-card`. And
 * every picture goes in a <Media> slot, so the layout is identical before and
 * after an editor uploads one.
 */
const SECTIONS = {
  hero: StorefrontHero,
  quick_inquiry: PromiseStrip,
  services: PopularServices,
  projects: RecentWork,
  offers: Offers,
  gallery: Gallery,
  why_choose: FeatureRow,
  construction: FeatureRow,
  pre_engineered: FeatureRow,
  kitchen: KitchenBlock,
  stats: StatsBand,
  seepage: ExplainerBlock,
  interior: ContentBlock,
  renovation: ChecklistBlock,
  pricing: PackageGrid,
  other_civil: ChipList,
  process: HowItWorks,
  testimonials: Reviews,
  cta_form: ClosingCta,
};

export default function HomePage() {
  const locale = useSelector(selectLocale);
  const { data, isLoading, error, refetch } = useGetHomeQuery(locale);

  if (error) return <ErrorState error={error} onRetry={refetch} className="min-h-[60dvh]" />;
  if (isLoading) return <HomeSkeleton />;

  return (
    <PageTransition>
      {data.sections.map((section) => {
        const Component = SECTIONS[section.key];
        if (!Component || !section.data) return null;
        return <Component key={section.key} section={section} media={data.media} settings={data.settings} />;
      })}
    </PageTransition>
  );
}
