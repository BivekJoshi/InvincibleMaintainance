import { lazy, Suspense } from 'react';
import { Link } from 'react-router-dom';
import { useSelector } from 'react-redux';
import {
  ArrowRight, CalendarCheck, Check, ChevronRight, Clock, Phone, Quote, ShieldCheck, Search,
} from 'lucide-react';
import { useGetHomeQuery, useGetBootstrapQuery, useGetPublicServicesQuery } from '@/api/publicApi';
import { selectLocale } from '@/redux/slices/uiSlice';
import { LeadForm } from '@/components/public/LeadForm';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { ErrorState } from '@/components/common/ErrorState';
import {
  SectionShell, SectionHeading, Eyebrow, DataIcon, Stars, ServiceCard, ProjectCard, CategoryTile,
  Media,
} from '@/components/site';
import {
  PageTransition, Reveal, StaggerOnView, Stagger, CountUp, Marquee, WordReveal, HeadlineReveal,
  Spotlight, DriftField, DrawLine, ScrollStage, useStageStep, useReducedMotion, motion,
} from '@/three/motion';
import { formatNpr, imageUrl, titleCase } from '@/helpers/format';
import { cn } from '@/helpers/utils';

// The hero's anchor. Deliberately not the login page's timber frame: this one
// is the trades themselves — screed, waterproofing, tile, conduit, supply — in
// solid colour. WebGL is a big dependency for a marketing page, so it is split
// out of the main bundle and arrives after the copy has already painted.
const SectionCutScene = lazy(() =>
  import('@/three/scenes/SectionCutScene').then((m) => ({ default: m.SectionCutScene })));

/**
 * The home page is the storefront front door: search, categories, then priced
 * services you can book. Everything below that is still whatever the admin has
 * made visible, in their order — adding, hiding or reordering a section stays a
 * content change, not a code edit.
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

function HomeSkeleton() {
  return (
    <div className="container py-10">
      <Skeleton className="h-10 w-2/3 max-w-lg" />
      <Skeleton className="mt-4 h-12 w-full max-w-2xl rounded-full" />
      <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-32 rounded-xl" />)}
      </div>
      <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-72 rounded-xl" />)}
      </div>
    </div>
  );
}

// ── shared bits ────────────────────────────────────────────────────────────────

/** The rise-into-place a card uses when its grid scrolls in. */
const RISE = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.16, 1, 0.3, 1] } },
};

/** Hover behaviour shared by every clickable card on the page. */
const CARD_HOVER = 'transition-all duration-300 hover:-translate-y-1 hover:border-primary/30 hover:shadow-card';

// ── link safety ────────────────────────────────────────────────────────────────
// Editors type CTA URLs by hand. Anything that is not a route this app serves
// goes to the booking page rather than to a 404.
const ROUTES = ['/', '/services', '/pricing', '/contact', '/book'];
const isExternal = (url = '') => /^(https?:|tel:|mailto:|viber:)/i.test(url);

function siteHref(url, fallback = '/book') {
  if (!url) return fallback;
  if (isExternal(url)) return url;
  const path = url.split(/[?#]/)[0];
  return ROUTES.includes(path) || path.startsWith('/services/') || path.startsWith('/book/') ? url : fallback;
}

function Cta({ href, children, ...props }) {
  const target = siteHref(href);
  return (
    <Button asChild {...props}>
      {isExternal(target) ? <a href={target}>{children}</a> : <Link to={target}>{children}</Link>}
    </Button>
  );
}

// ── front door ─────────────────────────────────────────────────────────────────

const POPULAR_SEARCHES = ['Seepage', 'Waterproofing', 'Modular kitchen', 'Rewiring', 'Renovation'];

function StorefrontHero({ section, settings, media }) {
  const locale = useSelector(selectLocale);
  const reduced = useReducedMotion();
  const { data: boot } = useGetBootstrapQuery(locale);
  const { data: catalogue } = useGetPublicServicesQuery({ locale });

  const slide = (Array.isArray(section.data) ? section.data : [])[0];
  const categories = boot?.nav?.categories ?? [];
  const items = catalogue?.items ?? [];
  const countFor = (slug) => items.filter((s) => s.category?.slug === slug).length || null;
  const mobile = settings?.['contact.phoneSecondary'];
  const stats = (settings?.['stats.items'] ?? []).slice(0, 3);

  return (
    <section className="relative isolate overflow-hidden border-b">
      {/* The scene is confined to its own card in the right column now, so the
          band behind the copy needs nothing but a colour wash. */}
      <div className="glow-paper absolute inset-0 -z-20" aria-hidden />
      <div
        className="absolute inset-0 -z-10 bg-gradient-to-b from-transparent via-transparent to-background"
        aria-hidden
      />

      <div className="container relative py-12 md:py-16 lg:py-20">
        <div className="grid items-center gap-12 lg:grid-cols-[1.05fr_0.95fr] lg:gap-14">
          {/* ── the pitch ── */}
          <div className="mx-auto max-w-2xl text-center lg:mx-0 lg:text-left">
            <motion.div
              initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}
            >
              <Badge variant="outline" className="gap-2 border-border bg-card/80 py-1 font-medium text-muted-foreground shadow-sm backdrop-blur">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="absolute inline-flex h-full w-full animate-pulse-ring rounded-full bg-gold" aria-hidden />
                  <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-gold" aria-hidden />
                </span>
                Booking now · we call back within 2 hours
              </Badge>
            </motion.div>

            <WordReveal
              as="h1"
              delay={0.05}
              text={slide?.title ?? 'Book a certified engineer for your home'}
              className="mt-5 block text-[2.15rem] font-bold leading-[1.08] tracking-tight md:text-[3rem] lg:text-[3.25rem]"
            />
            <motion.p
              initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.28, ease: [0.16, 1, 0.3, 1] }}
              className="mx-auto mt-5 max-w-xl text-[15px] leading-relaxed text-muted-foreground lg:mx-0"
            >
              {slide?.subtitle ?? 'Published prices, a free inspection first, and a one-month written warranty.'}
            </motion.p>

            <motion.form
              initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.36, ease: [0.16, 1, 0.3, 1] }}
              role="search"
              action="/services"
              className="group relative mx-auto mt-7 max-w-xl lg:mx-0"
            >
              <Search className="pointer-events-none absolute left-4 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-muted-foreground transition-colors group-focus-within:text-primary" aria-hidden />
              <Input
                type="search" name="q"
                placeholder="What needs fixing? seepage, kitchen, wiring…"
                aria-label="Search services"
                className="h-[3.25rem] rounded-full bg-card pl-11 pr-[7.5rem] shadow-card transition-all focus-visible:ring-4 focus-visible:ring-primary/10"
              />
              <Button type="submit" className="absolute right-2 top-2 h-9 rounded-full px-5">Search</Button>
            </motion.form>

            <div className="mt-4 flex flex-wrap items-center justify-center gap-2 text-xs text-muted-foreground lg:justify-start">
              <span>Popular:</span>
              {POPULAR_SEARCHES.map((term) => (
                <Link key={term} to={`/services?q=${encodeURIComponent(term)}`}>
                  <Badge variant="outline" className="bg-card/60 font-normal transition-colors hover:border-primary/40 hover:text-foreground">
                    {term}
                  </Badge>
                </Link>
              ))}
            </div>

            {/* Stacked full-width on a phone so the two CTAs share an edge. */}
            <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-center lg:justify-start">
              <Cta href={slide?.ctaUrl} size="lg" className="w-full shadow-card sm:w-auto">
                <CalendarCheck className="h-4 w-4" /> {slide?.ctaLabel ?? 'Book a free inspection'}
              </Cta>
              {mobile ? (
                <Button asChild size="lg" variant="outline" className="w-full sm:w-auto">
                  <a href={`tel:${mobile}`}><Phone className="h-4 w-4" /> {mobile}</a>
                </Button>
              ) : null}
            </div>

            {stats.length ? (
              <>
                <Separator className="mt-9" />
                <dl className="flex flex-wrap items-center justify-center gap-x-8 gap-y-4 pt-6 lg:justify-start">
                  {stats.map((stat) => (
                    <div key={stat.label} className="text-center lg:text-left">
                      <dt className="sr-only">{stat.label}</dt>
                      <dd>
                        <span className="block text-xl font-bold tracking-tight text-primary">
                          <CountUp value={stat.value} />
                        </span>
                        <span className="mt-0.5 block text-[11px] uppercase tracking-wide text-muted-foreground">
                          {stat.label}
                        </span>
                      </dd>
                    </div>
                  ))}
                </dl>
              </>
            ) : null}
          </div>

          {/* ── the proof ── */}
          <HeroShowcase reduced={Boolean(reduced)} />
        </div>

        {categories.length ? (
          <>
            <Separator className="mt-14" />
            <div className="pt-10">
              <div className="mb-5 flex items-end justify-between gap-4">
                <div>
                  <Eyebrow>Browse by trade</Eyebrow>
                  <h2 className="mt-1.5 text-lg font-bold tracking-tight">Pick the work you need doing</h2>
                </div>
                <Button asChild variant="link" className="h-auto shrink-0 p-0">
                  <Link to="/services">All services <ArrowRight className="h-3.5 w-3.5" /></Link>
                </Button>
              </div>
              <StaggerOnView className="grid grid-cols-2 gap-3 sm:grid-cols-4" stagger={0.05}>
                {categories.map((c, i) => (
                  <CategoryTile key={c.id} category={c} count={countFor(c.slug)} media={media} index={i} />
                ))}
              </StaggerOnView>
            </div>
          </>
        ) : null}
      </div>
    </section>
  );
}

/**
 * The right half of the hero.
 *
 * It used to be a card listing what a customer gets in writing; those promises
 * are the band immediately below this one, so the space is better spent on the
 * work itself. The scene is a bathroom corner that builds and then opens — the
 * trades the company actually sells, in the colours those materials actually
 * are — and it carries a caption that says what is being shown.
 */
function HeroShowcase({ reduced }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.7, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
      className="relative mx-auto w-full max-w-md lg:max-w-none"
    >
      {/* No <Tilt> here: a CSS 3D transform on a live canvas resamples it blurry,
          and the scene already leans to the pointer on its own. */}
      <Card className="sheen overflow-hidden shadow-lift">
        <Suspense fallback={<div className="aspect-[7/6] w-full animate-pulse bg-muted/40" />}>
          <SectionCutScene reduced={reduced} />
        </Suspense>
      </Card>

      {/* Over the canvas, not hanging off the card: the caption owns the bottom
          edge and the two would sit on top of each other. */}
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.45, delay: 0.75, ease: [0.16, 1, 0.3, 1] }}
        className="pointer-events-none absolute left-4 top-4"
      >
        <Badge variant="outline" className="gap-2 border-gold/40 bg-card/90 px-3 py-1.5 text-[11px] font-semibold shadow-card backdrop-blur">
          <ShieldCheck className="h-3.5 w-3.5 text-gold" aria-hidden /> Certified engineers only
        </Badge>
      </motion.div>
    </motion.div>
  );
}

function PromiseStrip({ section }) {
  const badges = Array.isArray(section.data) ? section.data : [];
  if (!badges.length) return null;
  return (
    <div className="border-b bg-card">
      <Marquee className="mask-x py-3 sm:hidden" duration={24}>
        {badges.map((b, i) => (
          <span key={i} className="flex items-center gap-2 whitespace-nowrap px-5 text-[13px] font-medium">
            <DataIcon name={b.icon} className="h-4 w-4 text-primary" /> {b.label}
            <span className="ml-5 h-1 w-1 rounded-full bg-border" aria-hidden />
          </span>
        ))}
      </Marquee>
      <div className="container hidden grid-cols-3 divide-x sm:grid">
        {badges.map((b, i) => (
          <div key={i} className="group flex items-center justify-center gap-3 py-4">
            <span className="grid h-8 w-8 place-items-center rounded-full bg-primary/8 text-primary transition-colors duration-300 group-hover:bg-primary group-hover:text-primary-foreground">
              <DataIcon name={b.icon} className="h-4 w-4" />
            </span>
            <span className="text-[13px] font-medium">{b.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── catalogue ──────────────────────────────────────────────────────────────────

function PopularServices({ section, media }) {
  const services = Array.isArray(section.data) ? section.data : [];
  if (!services.length) return null;
  return (
    <SectionShell>
      <SectionHeading
        eyebrow="Book online"
        title="Popular services"
        description="Published rates, a free inspection before any work, and a one-month written warranty after it."
        action={
          <Button asChild variant="outline">
            <Link to="/services">Browse all services <ArrowRight className="h-4 w-4" /></Link>
          </Button>
        }
      />
      <StaggerOnView className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4" stagger={0.06}>
        {services.map((service) => (
          <Stagger.Item key={service.id} variants={RISE} className="h-full">
            <ServiceCard service={service} media={media} />
          </Stagger.Item>
        ))}
      </StaggerOnView>
    </SectionShell>
  );
}

function PackageGrid({ section }) {
  const plans = Array.isArray(section.data) ? section.data : [];
  if (!plans.length) return null;
  return (
    <SectionShell tone="muted">
      <SectionHeading
        eyebrow="Packages"
        title="Fixed-scope packages"
        description="Everything in the list is included at the published rate. The exact figure is confirmed after the free inspection."
        action={<Button asChild variant="outline"><Link to="/pricing">Full rate card <ArrowRight className="h-4 w-4" /></Link></Button>}
      />
      <StaggerOnView className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4" stagger={0.06}>
        {plans.map((plan) => {
          const featured = plan.badge === 'Popular';
          return (
            <Stagger.Item key={plan.id} variants={RISE} className="h-full">
              <Card className={cn('flex h-full flex-col', CARD_HOVER, featured && 'border-primary ring-1 ring-primary/20')}>
                <CardHeader className="space-y-0 p-5 pb-0">
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-[15px] font-semibold leading-snug tracking-tight">{plan.title}</CardTitle>
                    {plan.badge ? (
                      <Badge variant={featured ? 'default' : 'secondary'} className="shrink-0 text-[10px] font-bold uppercase tracking-wide">
                        {plan.badge}
                      </Badge>
                    ) : null}
                  </div>
                  <p className="pt-3">
                    <span className="text-lg font-bold tabular-nums">{formatNpr(plan.priceMin, { compact: true })}</span>
                    <span className="text-xs text-muted-foreground">
                      {' – '}{formatNpr(plan.priceMax, { compact: true, symbol: false })} {plan.unit}
                    </span>
                  </p>
                </CardHeader>

                {plan.inclusions?.length ? (
                  <CardContent className="p-5 pb-0 pt-4">
                    <Separator className="mb-4" />
                    <ul className="space-y-1.5 text-[13px]">
                      {plan.inclusions.slice(0, 5).map((inc, k) => (
                        <li key={k} className="flex gap-2 text-muted-foreground">
                          <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-gold" aria-hidden /> {inc}
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                ) : null}

                <CardFooter className="mt-auto p-5">
                  <Button asChild size="sm" variant={featured ? 'default' : 'outline'} className="w-full">
                    <Link to="/book">Book this package</Link>
                  </Button>
                </CardFooter>
              </Card>
            </Stagger.Item>
          );
        })}
      </StaggerOnView>
    </SectionShell>
  );
}

/** An offer, with room for the picture that sells it. */
function Offers({ section, media }) {
  const offers = Array.isArray(section.data) ? section.data : [];
  if (!offers.length) return null;
  return (
    <SectionShell>
      <SectionHeading eyebrow="Limited time" title="Current offers" />
      <div className="grid gap-4 lg:grid-cols-2">
        {offers.map((offer, i) => (
          <Reveal key={offer.id} delay={i * 0.06} className="h-full">
            <Card className="group flex h-full flex-col overflow-hidden sm:flex-row">
              {/* A third of the card is picture. With none uploaded the slot
                  keeps its width and shows the grid, so the row stays even. */}
              {/* A ratio on a phone, where the card stacks and nothing else sets
                  the height; the full column height once it sits beside the copy. */}
              <div className="relative aspect-[4/3] sm:aspect-auto sm:w-2/5 sm:shrink-0">
                <Media media={media?.[offer.imageId]} alt={offer.title} icon="gift" zoom fill />
              </div>

              <div className="flex flex-1 flex-col">
                <CardHeader className="flex-row items-center justify-between gap-3 space-y-0 border-b bg-gold/10 px-5 py-3">
                  <Badge variant="gold" className="text-[10px] font-bold uppercase tracking-wide">
                    {offer.badge ?? 'Offer'}
                  </Badge>
                  {offer.priceMin ? (
                    <span className="text-sm font-semibold tabular-nums">
                      {formatNpr(offer.priceMin, { compact: true })} – {formatNpr(offer.priceMax, { compact: true, symbol: false })}
                    </span>
                  ) : null}
                </CardHeader>

                <CardContent className="flex flex-1 flex-col p-5">
                  <CardTitle className="font-deva text-lg font-semibold leading-snug tracking-tight">{offer.title}</CardTitle>
                  {offer.description ? <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{offer.description}</p> : null}
                  {offer.bullets?.length ? (
                    <ul className="mt-4 grid gap-2 text-[13px]">
                      {offer.bullets.map((b, k) => (
                        <li key={k} className="flex gap-2 text-muted-foreground">
                          <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-gold" aria-hidden /> {b}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                  <Cta href={offer.ctaUrl} className="mt-5 w-full sm:w-auto sm:self-start">
                    {offer.ctaLabel ?? 'Book now'} <ArrowRight className="h-4 w-4" />
                  </Cta>
                </CardContent>
              </div>
            </Card>
          </Reveal>
        ))}
      </div>
    </SectionShell>
  );
}

function ChipList({ section }) {
  const items = Array.isArray(section.data) ? section.data : [];
  if (!items.length) return null;
  return (
    <SectionShell>
      <SectionHeading
        eyebrow="Also on the books"
        title="Other civil work"
        description="Carried out by our own crews, measured and billed against a published rate."
      />
      <StaggerOnView className="flex flex-wrap gap-2" stagger={0.03}>
        {items.map((item) => (
          <Stagger.Item
            key={item.id}
            variants={{ hidden: { opacity: 0, scale: 0.96 }, show: { opacity: 1, scale: 1, transition: { duration: 0.35 } } }}
          >
            <Button asChild variant="outline" size="sm" className="group h-auto rounded-full py-2 text-[13px] font-medium hover:border-primary/40 hover:text-primary">
              <Link to={`/services/${item.slug}`}>
                {item.name}
                <ChevronRight className="h-3.5 w-3.5 text-muted-foreground transition-transform duration-300 group-hover:translate-x-0.5" aria-hidden />
              </Link>
            </Button>
          </Stagger.Item>
        ))}
      </StaggerOnView>
    </SectionShell>
  );
}

// ── proof and explanation ──────────────────────────────────────────────────────

/**
 * The five steps, pinned.
 *
 * This is the page's one theatrical moment: the section holds still while the
 * reader scrolls two screens, and the steps hand over to each other one at a
 * time — the current one lit, the finished ones ticked, the rail filling as it
 * goes. Under `prefers-reduced-motion` <ScrollStage> drops the pin entirely and
 * `progress` arrives as null, which renders the plain grid below instead.
 */
function HowItWorks({ section }) {
  const steps = Array.isArray(section.data) ? section.data : [];
  if (!steps.length) return null;

  return (
    <ScrollStage pages={1.6} className="bg-muted/50">
      {(progress) => (progress ? <PinnedSteps steps={steps} progress={progress} /> : <PlainSteps steps={steps} />)}
    </ScrollStage>
  );
}

function PinnedSteps({ steps, progress }) {
  const active = useStageStep(progress, steps.length);

  return (
    <div className="container py-12">
      <SectionHeading eyebrow="How it works" title="Booking to warranty, in five steps" />

      {/* The rail. Its fill is the scroll position itself, so the bar and the
          cards can never disagree about where the reader is. */}
      <div className="relative mb-8 h-px w-full bg-border" aria-hidden>
        <motion.span className="absolute inset-y-0 left-0 block w-full origin-left bg-gold" style={{ scaleX: progress }} />
      </div>

      <ol className="grid gap-3 md:grid-cols-5">
        {steps.map((step, i) => {
          const state = i === active ? 'current' : i < active ? 'done' : 'todo';
          return (
            <motion.li
              key={step.id}
              animate={{
                opacity: state === 'todo' ? 0.42 : 1,
                y: state === 'current' ? -6 : 0,
                scale: state === 'current' ? 1.015 : 1,
              }}
              transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
            >
              <Card className={cn(
                'sheen h-full transition-colors duration-300',
                state === 'current' && 'border-primary/40 shadow-card',
              )}>
                <CardHeader className="items-center space-y-0 pb-3 text-center">
                  <span className={cn(
                    'grid h-11 w-11 place-items-center rounded-full border-2 text-sm font-bold transition-colors duration-300',
                    state === 'todo' && 'border-border bg-card text-muted-foreground',
                    state === 'current' && 'border-primary bg-primary text-primary-foreground',
                    state === 'done' && 'border-gold/40 bg-gold/15 text-gold',
                  )}>
                    {state === 'done' ? <Check className="h-4 w-4" aria-hidden /> : step.stepNo}
                  </span>
                </CardHeader>
                <CardContent className="px-4 pb-5 text-center">
                  <CardTitle className="text-[14px] font-semibold leading-snug tracking-tight">{step.title}</CardTitle>
                  <p className="mt-1.5 text-[13px] leading-relaxed text-muted-foreground">{step.description}</p>
                </CardContent>
              </Card>
            </motion.li>
          );
        })}
      </ol>

      <p className="mt-8 text-center text-xs text-muted-foreground">
        Step {active + 1} of {steps.length} · keep scrolling
      </p>
    </div>
  );
}

/** The same five steps with no pin — reduced motion, and the print view. */
function PlainSteps({ steps }) {
  return (
    <SectionShell tone="muted">
      <SectionHeading eyebrow="How it works" title="Booking to warranty, in five steps" />
      <div className="relative">
        <div className="absolute inset-x-0 top-[1.375rem] hidden md:block" aria-hidden>
          <div className="mx-[10%] h-px bg-border"><DrawLine className="h-px" /></div>
        </div>
        <ol className="relative grid gap-4 md:grid-cols-5 md:gap-3">
          {steps.map((step) => (
            <li key={step.id} className="flex h-full gap-4 md:flex-col md:items-center md:gap-0 md:text-center">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full border-2 border-primary/15 bg-card text-sm font-bold text-primary shadow-sm md:mb-4">
                {step.stepNo}
              </span>
              <Card className="sheen h-full md:w-full">
                <CardContent className="p-4">
                  <CardTitle className="text-[14px] font-semibold leading-snug tracking-tight">{step.title}</CardTitle>
                  <p className="mt-1.5 text-[13px] leading-relaxed text-muted-foreground">{step.description}</p>
                </CardContent>
              </Card>
            </li>
          ))}
        </ol>
      </div>
    </SectionShell>
  );
}

/**
 * Feature cards. A feature with a picture gets one; a feature without keeps the
 * icon plate. Both shapes are the same height, so a group can mix the two while
 * an editor is still working through the uploads.
 */
function FeatureRow({ section, media }) {
  const items = Array.isArray(section.data) ? section.data : [];
  if (!items.length) return null;
  const COPY = {
    why_choose: { eyebrow: 'Why us', title: 'Four promises, each one measured' },
    construction: { eyebrow: 'Construction', title: 'Built to a drawing, billed to a line item' },
    pre_engineered: { eyebrow: 'Steel buildings', title: 'Pre-engineered structures' },
  };
  const illustrated = items.some((f) => f.imageId);

  return (
    <SectionShell tone={section.key === 'why_choose' ? 'paper' : 'muted'}>
      <SectionHeading {...(COPY[section.key] ?? { title: 'Highlights' })} />
      <StaggerOnView className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4" stagger={0.05}>
        {items.map((f) => (
          <Stagger.Item key={f.id} variants={RISE} className="h-full">
            <Card className={cn('sheen group flex h-full flex-col overflow-hidden', CARD_HOVER)}>
              {illustrated ? <Media media={media?.[f.imageId]} ratio={16 / 9} icon={f.icon} zoom /> : null}
              <CardContent className="flex flex-1 flex-col p-5">
                {illustrated ? null : (
                  <span className="grid h-11 w-11 place-items-center rounded-full bg-gold/15 text-gold ring-1 ring-inset ring-gold/25 transition-transform duration-300 group-hover:scale-105">
                    <DataIcon name={f.icon} className="h-[18px] w-[18px]" />
                  </span>
                )}
                <CardTitle className={cn('text-[14px] font-semibold tracking-tight', !illustrated && 'mt-4')}>
                  {f.title === f.title?.toUpperCase() ? titleCase(f.title) : f.title}
                </CardTitle>
                <p className="mt-1.5 text-[13px] leading-relaxed text-muted-foreground">{f.description}</p>
              </CardContent>
            </Card>
          </Stagger.Item>
        ))}
      </StaggerOnView>
    </SectionShell>
  );
}

function StatsBand({ section }) {
  const stats = Array.isArray(section.data) ? section.data : [];
  if (!stats.length) return null;
  return (
    <section className="ink-panel relative isolate overflow-hidden">
      <div className="glow-ink absolute inset-0 -z-10" aria-hidden />
      <div className="blueprint absolute inset-0 -z-10 opacity-60" aria-hidden />
      <Spotlight />
      <DriftField count={10} />
      <StaggerOnView className="container relative grid grid-cols-2 gap-y-10 py-14 md:py-16 lg:grid-cols-4" stagger={0.1}>
        {stats.map((s, i) => (
          <Stagger.Item
            key={i}
            className={cn(
              'px-4 text-center lg:px-8',
              i % 2 ? 'border-l border-ink-foreground/12' : null,
              i > 0 ? 'lg:border-l lg:border-ink-foreground/12' : 'lg:border-l-0',
            )}
            variants={{
              hidden: { opacity: 0, y: 14 },
              show: { opacity: 1, y: 0, transition: { duration: 0.45, ease: [0.16, 1, 0.3, 1] } },
            }}
          >
            <p className="text-[2.25rem] font-bold leading-none tracking-tight text-gold md:text-[2.75rem]">
              <CountUp value={s.value} />
            </p>
            <p className="mt-2.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-muted">{s.label}</p>
          </Stagger.Item>
        ))}
      </StaggerOnView>
    </section>
  );
}

/** Recent work — the same <ProjectCard> the /projects catalogue renders. */
function RecentWork({ section, media }) {
  const projects = Array.isArray(section.data) ? section.data : [];
  if (!projects.length) return null;
  return (
    <SectionShell>
      <SectionHeading
        eyebrow="Our work"
        title="Recently completed"
        description="Measured, photographed at each stage, handed over against a signed snag list."
        action={
          <Button asChild variant="outline">
            <Link to="/projects">See all work <ArrowRight className="h-4 w-4" /></Link>
          </Button>
        }
      />
      <StaggerOnView className="grid gap-4 md:grid-cols-3" stagger={0.06}>
        {projects.map((p) => (
          <Stagger.Item key={p.id} variants={RISE} className="h-full">
            <ProjectCard project={p} media={media} />
          </Stagger.Item>
        ))}
      </StaggerOnView>
    </SectionShell>
  );
}

/**
 * The field gallery, as a mosaic rather than a uniform strip: the first tile is
 * twice the size, so the block reads as a wall of work instead of a grid of
 * thumbnails. Each picture wipes open as it arrives.
 */
function Gallery({ section, media }) {
  const images = (Array.isArray(section.data) ? section.data : []).slice(0, 7);
  if (!images.length) return null;
  return (
    <SectionShell tone="muted">
      <SectionHeading eyebrow="On site" title="From the field" />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {images.map((g, i) => (
          <figure key={g.id ?? i} className={cn('group relative', i === 0 && 'col-span-2 row-span-2')}>
            <Card className="h-full overflow-hidden">
              <Media
                media={media?.[g.imageId ?? g.mediaId]}
                alt={g.caption ?? ''}
                ratio={1}
                width={i === 0 ? 1200 : 800}
                icon="hard-hat"
                reveal
                zoom
                scrim={g.caption ? 'ink' : 'none'}
              >
                {g.caption ? (
                  <figcaption className="absolute inset-x-0 bottom-0 p-3 text-[12px] font-medium leading-snug text-ink-foreground opacity-0 transition-opacity duration-300 group-hover:opacity-100">
                    {g.caption}
                  </figcaption>
                ) : null}
              </Media>
            </Card>
          </figure>
        ))}
      </div>
    </SectionShell>
  );
}

/** Testimonials, with the customer's photograph when there is one. */
function Reviews({ section, media }) {
  const items = Array.isArray(section.data) ? section.data : [];
  if (!items.length) return null;
  return (
    <SectionShell>
      <SectionHeading eyebrow="Customers" title="What people say afterwards" />
      <StaggerOnView className="grid gap-4 md:grid-cols-2 lg:grid-cols-3" stagger={0.05}>
        {items.map((t) => (
          <Stagger.Item key={t.id} variants={RISE} className="h-full">
            <Card className="relative flex h-full flex-col">
              <Quote className="absolute right-4 top-4 h-7 w-7 text-primary/10" aria-hidden />
              <CardContent className="flex flex-1 flex-col p-5">
                <Stars rating={t.rating} />
                <blockquote className={cn('mt-3 flex-1 text-[13px] leading-relaxed', t.locale === 'ne' && 'font-deva')} lang={t.locale}>
                  “{t.quote}”
                </blockquote>
              </CardContent>
              <CardFooter className="flex-col items-stretch p-5 pt-0">
                <Separator className="mb-3.5" />
                <figcaption className="flex items-center gap-3">
                  <Avatar className="h-8 w-8 shrink-0">
                    <AvatarImage src={imageUrl(media?.[t.photoId], 200) ?? undefined} alt="" />
                    <AvatarFallback className="bg-primary/10 text-xs font-bold text-primary">
                      {t.author?.trim()[0] ?? '·'}
                    </AvatarFallback>
                  </Avatar>
                  <span>
                    <span className={cn('block text-[13px] font-semibold', t.locale === 'ne' && 'font-deva')}>{t.author}</span>
                    <span className={cn('block text-[11px] text-muted-foreground', t.locale === 'ne' && 'font-deva')}>{t.location}</span>
                  </span>
                </figcaption>
              </CardFooter>
            </Card>
          </Stagger.Item>
        ))}
      </StaggerOnView>
    </SectionShell>
  );
}

function ExplainerBlock({ section, media }) {
  const { block, checkpoints = [] } = section.data ?? {};
  if (!block) return null;
  return (
    <SectionShell tone="muted">
      <div className="grid gap-8 lg:grid-cols-2 lg:items-start lg:gap-12">
        <Reveal>
          <Eyebrow>Diagnosis</Eyebrow>
          <HeadlineReveal
            as="h2"
            text={block.heading}
            className="mt-2 text-2xl font-bold tracking-tight md:text-[1.75rem]"
          />
          {block.subheading ? (
            <p className="mt-3 border-l-2 border-gold pl-4 text-[15px] leading-relaxed">{block.subheading}</p>
          ) : null}
          <p className="mt-4 text-sm leading-relaxed text-muted-foreground">{block.body}</p>
          {block.cta ? (
            <Cta href={block.cta.url} className="mt-6">{block.cta.label} <ArrowRight className="h-4 w-4" /></Cta>
          ) : null}
        </Reveal>

        <Reveal delay={0.08} className="grid gap-4">
          {/* What the problem actually looks like — the picture belongs next to
              the symptoms, not at the top of the section. */}
          <Card className="overflow-hidden">
            <Media media={media?.[block.imageId]} alt={block.heading} ratio={16 / 9} icon="droplets" reveal />
          </Card>

          {checkpoints.length ? (
            <Card className="overflow-hidden">
              <CardHeader className="border-b bg-muted/50 px-5 py-3">
                <CardTitle className="text-sm font-semibold">Signs you should book an inspection</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <ul className="divide-y">
                  {checkpoints.map((c) => (
                    <li key={c.id} className="flex gap-3 px-5 py-3 text-[13px] leading-relaxed">
                      <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-primary/10 text-[10px] font-bold text-primary">
                        {c.position}
                      </span>
                      {c.text}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ) : null}
        </Reveal>
      </div>
    </SectionShell>
  );
}

function ContentBlock({ section, media }) {
  const block = section.data;
  if (!block) return null;
  return (
    <SectionShell>
      <div className="grid gap-8 lg:grid-cols-2 lg:gap-12">
        <Reveal>
          <Eyebrow>Interiors</Eyebrow>
          <HeadlineReveal
            as="h2"
            text={block.heading}
            className="mt-2 text-2xl font-bold tracking-tight md:text-[1.75rem]"
          />
          {block.subheading ? <p className="mt-3 text-[15px] text-muted-foreground">{block.subheading}</p> : null}
          <p className="mt-4 text-sm leading-relaxed text-muted-foreground">{block.body}</p>

          {block.bullets?.length ? (
            <StaggerOnView className="mt-6 grid gap-3 sm:grid-cols-2" stagger={0.05}>
              {block.bullets.map((b, i) => (
                <Stagger.Item
                  key={i}
                  variants={{ hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0, transition: { duration: 0.4 } } }}
                >
                  <Card className="h-full">
                    <CardContent className="flex gap-2.5 p-4 text-[13px] leading-relaxed">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-gold" aria-hidden /> {b}
                    </CardContent>
                  </Card>
                </Stagger.Item>
              ))}
            </StaggerOnView>
          ) : null}
        </Reveal>

        <Reveal delay={0.08}>
          <Card className="overflow-hidden shadow-card">
            <Media media={media?.[block.imageId]} alt={block.heading} ratio={4 / 3} icon="sofa" reveal from="left" />
          </Card>
        </Reveal>
      </div>
    </SectionShell>
  );
}

function ChecklistBlock({ section }) {
  const items = Array.isArray(section.data) ? section.data : [];
  if (!items.length) return null;
  return (
    <SectionShell tone="muted">
      <SectionHeading
        eyebrow="Renovation"
        title="When it is time to renovate"
        description="If two or more of these describe your house, book a free assessment."
        action={<Button asChild><Link to="/book">Book an assessment</Link></Button>}
      />
      <StaggerOnView className="grid gap-3 sm:grid-cols-2" stagger={0.04}>
        {items.map((item) => (
          <Stagger.Item
            key={item.id}
            variants={{ hidden: { opacity: 0, x: -12 }, show: { opacity: 1, x: 0, transition: { duration: 0.45 } } }}
            className="h-full"
          >
            <Card className="h-full">
              <CardContent className="flex items-start gap-3 p-4 text-[13px] leading-relaxed">
                <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-primary/10 text-[10px] font-bold text-primary">
                  {item.position}
                </span>
                {item.text}
              </CardContent>
            </Card>
          </Stagger.Item>
        ))}
      </StaggerOnView>
    </SectionShell>
  );
}

function KitchenBlock({ section, media }) {
  const { cards = [], steps = [] } = section.data ?? {};
  if (!cards.length && !steps.length) return null;
  const lead = cards.find((c) => c.imageId);

  return (
    <SectionShell>
      <SectionHeading
        eyebrow="Kitchens"
        title="Modernised around how you actually cook"
        action={<Button asChild variant="outline"><Link to="/book">Book a kitchen survey</Link></Button>}
      />
      <div className="grid gap-6 lg:grid-cols-[1.3fr_1fr]">
        <div className="grid content-start gap-3">
          {/* One wide picture leads the column when a kitchen card carries one. */}
          <Reveal>
            <Card className="overflow-hidden">
              <Media media={media?.[lead?.imageId]} alt={lead?.title ?? ''} ratio={16 / 7} icon="chef-hat" reveal />
            </Card>
          </Reveal>

          {cards.map((c, i) => (
            <Reveal key={c.id} delay={0.05 + i * 0.05}>
              <Card className="sheen transition-shadow duration-300 hover:shadow-card">
                <CardContent className="flex gap-4 p-4">
                  <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-gold/15 text-gold ring-1 ring-inset ring-gold/25">
                    <DataIcon name={c.icon} className="h-[18px] w-[18px]" />
                  </span>
                  <div>
                    <CardTitle className="text-[14px] font-semibold tracking-tight">{c.title}</CardTitle>
                    <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">{c.description}</p>
                  </div>
                </CardContent>
              </Card>
            </Reveal>
          ))}
        </div>

        {steps.length ? (
          <Reveal delay={0.08}>
            <Card className="overflow-hidden">
              <CardHeader className="border-b bg-muted/50 px-5 py-3">
                <CardTitle className="text-sm font-semibold">How a kitchen runs</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <ol className="divide-y">
                  {steps.map((s) => (
                    <li key={s.id} className="flex gap-3 px-5 py-3 text-[13px] leading-relaxed">
                      <span className="text-xs font-bold tabular-nums text-primary">{String(s.position).padStart(2, '0')}</span>
                      {s.text}
                    </li>
                  ))}
                </ol>
              </CardContent>
            </Card>
          </Reveal>
        ) : null}
      </div>
    </SectionShell>
  );
}

// ── closing ────────────────────────────────────────────────────────────────────

function ClosingCta({ section, settings }) {
  const phone = settings?.['contact.phonePrimary'];
  const mobile = settings?.['contact.phoneSecondary'];
  return (
    <SectionShell tone="ink" id="contact" className="isolate overflow-hidden">
      {/* Full-bleed decoration from inside a centred container. */}
      <div className="glow-ink absolute inset-y-0 left-1/2 -z-10 w-screen -translate-x-1/2" aria-hidden />
      <div className="blueprint mask-t absolute inset-y-0 left-1/2 -z-10 w-screen -translate-x-1/2 opacity-70" aria-hidden />
      <Spotlight />
      <DriftField count={12} />
      <div className="grid gap-8 lg:grid-cols-2 lg:items-center lg:gap-14">
        <Reveal>
          <Eyebrow className="text-gold">Free consultation</Eyebrow>
          <h2 className="mt-2 text-2xl font-bold leading-tight tracking-tight md:text-3xl">
            Not sure what you need? Book the free inspection.
          </h2>
          <p className="mt-4 max-w-lg text-sm leading-relaxed text-ink-muted">
            No visiting charge. A certified engineer inspects, explains the cause, and gives you a
            written estimate before anything starts.
          </p>

          <div className="mt-6 flex flex-wrap gap-3">
            <Button asChild variant="gold" size="lg"><Link to="/book"><CalendarCheck className="h-4 w-4" /> Pick a time slot</Link></Button>
            {mobile ? (
              <Button asChild variant="onInk" size="lg"><a href={`tel:${mobile}`}><Phone className="h-4 w-4" /> {mobile}</a></Button>
            ) : null}
          </div>

          <ul className="mt-7 grid gap-2 text-sm text-ink-muted sm:grid-cols-2">
            {['No visiting charge', 'Two-hour response', 'Written estimate first', '1-month warranty'].map((p) => (
              <li key={p} className="flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-gold" aria-hidden /> {p}</li>
            ))}
          </ul>
          <p className="mt-6 flex items-center gap-2 text-xs text-ink-muted">
            <Clock className="h-3.5 w-3.5" aria-hidden /> {settings?.['contact.address']} · {phone}
          </p>
        </Reveal>

        <Reveal delay={0.08}>
          <Card className="overflow-hidden shadow-lift">
            <CardHeader className="space-y-0 border-b bg-muted/50 px-6 py-4">
              <CardTitle className="text-[15px] font-semibold tracking-tight">Or send the details now</CardTitle>
              <p className="mt-0.5 text-xs text-muted-foreground">We call back within two hours.</p>
            </CardHeader>
            <CardContent className="p-6">
              <LeadForm services={section.data?.services ?? []} sourcePage="/#contact" />
            </CardContent>
          </Card>
        </Reveal>
      </div>
    </SectionShell>
  );
}
