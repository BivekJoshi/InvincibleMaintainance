import { useSelector } from 'react-redux';
import { useGetHomeQuery } from '@/api/publicApi';
import { selectLocale } from '@/redux/slices/uiSlice';
import { useSeo } from '@/hooks/useSeo';
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
 * Three things every section obeys. Surfaces are shadcn primitives — <Card>,
 * <Badge>, <Separator> — never a hand-rolled `rounded-xl border bg-card`. Every
 * picture goes in a <Media> slot, so the layout is identical before and after
 * an editor uploads one. And no section picks its own background: the `tone`
 * it is handed alternates down the page, so reordering two sections in the CMS
 * can never leave three of the same surface stacked on top of each other.
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

/**
 * Surfaces that are not the page's alternating paper/muted pair. `own` is a
 * band that paints itself — the hero and the promise ribbon — and takes no
 * part in the rhythm; `ink` is a dark interruption, which ends the run so the
 * band after it opens on paper again.
 */
const SURFACE = { hero: 'own', quick_inquiry: 'own', stats: 'ink', cta_form: 'ink' };

/** A section the API sent with nothing in it is not a section. */
function isEmpty(data) {
  if (!data) return true;
  return Array.isArray(data) ? data.length === 0 : Object.keys(data).length === 0;
}

export default function HomePage() {
  const locale = useSelector(selectLocale);
  const { data, isLoading, error, refetch } = useGetHomeQuery(locale);
  // No title of its own: the default title and description from Settings.
  useSeo();

  if (error) return <ErrorState error={error} onRetry={refetch} className="min-h-[60dvh]" />;
  if (isLoading) return <HomeSkeleton />;

  // Tones are assigned in one pass rather than inside each section, because a
  // section cannot know what is above it — and it is what is above it that
  // decides whether it should be paper or muted.
  let alternation = 0;
  const bands = [];

  for (const section of data.sections) {
    const Component = SECTIONS[section.key];
    if (!Component || isEmpty(section.data)) continue;

    const surface = SURFACE[section.key];
    const tone = surface ?? (alternation % 2 === 0 ? 'paper' : 'muted');
    if (surface === 'ink') alternation = 0;
    else if (!surface) alternation += 1;

    bands.push(
      <Component
        key={section.key}
        section={section}
        media={data.media}
        settings={data.settings}
        tone={tone === 'own' ? undefined : tone}
      />,
    );
  }

  return <PageTransition>{bands}</PageTransition>;
}
