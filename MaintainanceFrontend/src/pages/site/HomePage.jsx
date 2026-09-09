import { Link } from 'react-router-dom';
import { useSelector } from 'react-redux';
import {
  ArrowRight, CalendarCheck, Check, ChevronRight, Clock, FileCheck, Phone, Quote, ShieldCheck,
  Search,
} from 'lucide-react';
import { useGetHomeQuery, useGetBootstrapQuery, useGetPublicServicesQuery } from '@/features/public/publicApi';
import { selectLocale } from '@/features/ui/uiSlice';
import { LeadForm } from '@/features/public/LeadForm';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ErrorState } from '@/components/common/ErrorState';
import {
  SectionShell, SectionHeading, Eyebrow, DataIcon, Stars, ServiceCard, CategoryTile, PriceTag,
} from '@/components/site';
import {
  PageTransition, Reveal, StaggerOnView, Stagger, CountUp, Marquee, WordReveal, Tilt,
  Spotlight, DriftField, DrawLine, motion,
} from '@/components/motion';
import { formatNpr, imageUrl, titleCase } from '@/lib/format';
import { cn } from '@/lib/utils';

/**
 * The home page is the storefront front door: search, categories, then priced
 * services you can book. Everything below that is still whatever the admin has
 * made visible, in their order — adding, hiding or reordering a section stays a
 * content change, not a code edit.
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
  const { data: boot } = useGetBootstrapQuery(locale);
  const { data: catalogue } = useGetPublicServicesQuery({ locale });

  const slide = (Array.isArray(section.data) ? section.data : [])[0];
  const categories = boot?.nav?.categories ?? [];
  const items = catalogue?.items ?? [];
  const countFor = (slug) => items.filter((s) => s.category?.slug === slug).length || null;
  const mobile = settings?.['contact.phoneSecondary'];
  const cover = slide?.imageId ? imageUrl(media?.[slide.imageId], 1200) : null;
  const stats = (settings?.['stats.items'] ?? []).slice(0, 3);

  return (
    <section className="relative isolate overflow-hidden border-b">
      <div className="glow-paper absolute inset-0 -z-10" aria-hidden />
      <div className="blueprint-fine mask-b absolute inset-0 -z-10 opacity-70" aria-hidden />

      <div className="container relative py-12 md:py-16 lg:py-20">
        <div className="grid items-center gap-12 lg:grid-cols-[1.05fr_0.95fr] lg:gap-14">
          {/* ── the pitch ── */}
          <div className="mx-auto max-w-2xl text-center lg:mx-0 lg:text-left">
            <motion.p
              initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}
              className="inline-flex items-center gap-2 rounded-full border bg-card/80 px-3 py-1 text-xs font-medium text-muted-foreground shadow-sm backdrop-blur"
            >
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-pulse-ring rounded-full bg-gold" aria-hidden />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-gold" aria-hidden />
              </span>
              Booking now · we call back within 2 hours
            </motion.p>

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
              <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground transition-colors group-focus-within:text-primary" aria-hidden />
              <input
                type="search" name="q"
                placeholder="What needs fixing? seepage, kitchen, wiring…"
                aria-label="Search services"
                className="h-[3.25rem] w-full rounded-full border bg-card pl-11 pr-[7.5rem] text-sm shadow-card outline-none transition-all placeholder:text-muted-foreground focus:border-primary focus:ring-4 focus:ring-primary/10"
              />
              <Button type="submit" className="absolute right-2 top-2 h-9 rounded-full px-5">Search</Button>
            </motion.form>

            <div className="mt-4 flex flex-wrap items-center justify-center gap-2 text-xs text-muted-foreground lg:justify-start">
              <span>Popular:</span>
              {POPULAR_SEARCHES.map((term) => (
                <Link
                  key={term}
                  to={`/services?q=${encodeURIComponent(term)}`}
                  className="rounded-full border bg-card/60 px-2.5 py-1 transition-colors hover:border-primary/40 hover:text-foreground"
                >
                  {term}
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
              <dl className="mt-9 flex flex-wrap items-center justify-center gap-x-8 gap-y-4 border-t pt-6 lg:justify-start">
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
            ) : null}
          </div>

          {/* ── the proof ── */}
          <HeroProofPanel cover={cover} />
        </div>

        {categories.length ? (
          <div className="mt-14 border-t pt-10">
            <div className="mb-5 flex items-end justify-between gap-4">
              <div>
                <Eyebrow>Browse by trade</Eyebrow>
                <h2 className="mt-1.5 text-lg font-bold tracking-tight">Pick the work you need doing</h2>
              </div>
              <Link to="/services" className="shrink-0 text-sm font-medium text-primary hover:underline">
                All services <ArrowRight className="inline h-3.5 w-3.5" />
              </Link>
            </div>
            <StaggerOnView className="grid grid-cols-2 gap-3 sm:grid-cols-4" stagger={0.05}>
              {categories.map((c, i) => (
                <CategoryTile key={c.id} category={c} count={countFor(c.slug)} index={i} />
              ))}
            </StaggerOnView>
          </div>
        ) : null}
      </div>
    </section>
  );
}

/**
 * What the hero shows instead of a stock photograph: the promise itself, drawn
 * as the document a customer actually receives. It degrades to a real image the
 * moment an editor uploads one against the hero slide.
 */
const HERO_PROMISES = [
  'Free site inspection — no visiting charge',
  'Written estimate before anything starts',
  'Billed against the published rate card',
  'One-month warranty certificate at handover',
];

function HeroProofPanel({ cover }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.7, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
      className="relative mx-auto w-full max-w-md lg:max-w-none"
    >
      <Tilt max={5} scale={1.008} className="group relative">
        <div className="sheen overflow-hidden rounded-2xl border bg-card shadow-lift">
          {cover ? (
            <img src={cover} alt="" className="h-44 w-full object-cover" />
          ) : null}

          <div className="flex items-center justify-between gap-3 border-b bg-muted/50 px-5 py-3">
            <span className="flex items-center gap-2 text-[13px] font-semibold tracking-tight">
              <FileCheck className="h-4 w-4 text-primary" aria-hidden /> What you get, in writing
            </span>
            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-primary ring-1 ring-inset ring-primary/15">
              Every job
            </span>
          </div>

          <div className="flex items-center gap-4 border-b px-5 py-5">
            <SlaRing />
            <div>
              <p className="text-[13px] font-semibold leading-snug">We call you back within two hours</p>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                Every enquiry is timed from the minute it arrives. Miss the window and it escalates.
              </p>
            </div>
          </div>

          <ul className="divide-y">
            {HERO_PROMISES.map((promise) => (
              <li key={promise} className="flex items-center gap-3 px-5 py-3 text-[13px] leading-snug">
                <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-gold/15 text-gold">
                  <Check className="h-3 w-3" aria-hidden />
                </span>
                {promise}
              </li>
            ))}
          </ul>

        </div>
      </Tilt>

      <motion.p
        initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.45, delay: 0.75, ease: [0.16, 1, 0.3, 1] }}
        className="absolute -bottom-5 left-6 hidden items-center gap-2 rounded-full border border-gold/40 bg-card px-3.5 py-2 text-xs font-semibold shadow-card sm:flex"
      >
        <ShieldCheck className="h-4 w-4 text-gold" aria-hidden /> Certified engineers only
      </motion.p>
    </motion.div>
  );
}

/** The two-hour promise, drawn as a dial rather than written out again. */
function SlaRing() {
  return (
    <div className="relative grid h-16 w-16 shrink-0 place-items-center">
      <svg viewBox="0 0 48 48" className="absolute inset-0 h-full w-full -rotate-90" aria-hidden>
        <circle cx="24" cy="24" r="20" fill="none" stroke="hsl(var(--border))" strokeWidth="3" />
        <motion.circle
          cx="24" cy="24" r="20" fill="none" stroke="hsl(var(--gold))" strokeWidth="3" strokeLinecap="round"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 0.72 }}
          transition={{ duration: 1.5, delay: 0.6, ease: [0.16, 1, 0.3, 1] }}
        />
      </svg>
      <span className="text-center leading-none">
        <span className="block text-base font-bold tabular-nums">2</span>
        <span className="mt-0.5 block text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">hrs</span>
      </span>
    </div>
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
          <Stagger.Item
            key={service.id}
            variants={{
              hidden: { opacity: 0, y: 20 },
              show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.16, 1, 0.3, 1] } },
            }}
          >
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
            <Stagger.Item
              key={plan.id}
              variants={{
                hidden: { opacity: 0, y: 20 },
                show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.16, 1, 0.3, 1] } },
              }}
            >
              <div className={cn(
                'flex h-full flex-col rounded-xl border bg-card p-5 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-card',
                featured && 'border-primary ring-1 ring-primary/20',
              )}>
                <div className="flex items-start justify-between gap-2">
                  <h3 className="text-[15px] font-semibold leading-snug tracking-tight">{plan.title}</h3>
                  {plan.badge ? (
                    <span className={cn(
                      'shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide',
                      featured ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground',
                    )}>
                      {plan.badge}
                    </span>
                  ) : null}
                </div>

                <p className="mt-3">
                  <span className="text-lg font-bold tabular-nums">{formatNpr(plan.priceMin, { compact: true })}</span>
                  <span className="text-xs text-muted-foreground">
                    {' – '}{formatNpr(plan.priceMax, { compact: true, symbol: false })} {plan.unit}
                  </span>
                </p>

                {plan.inclusions?.length ? (
                  <ul className="mt-4 space-y-1.5 border-t pt-4 text-[13px]">
                    {plan.inclusions.slice(0, 5).map((inc, k) => (
                      <li key={k} className="flex gap-2 text-muted-foreground">
                        <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-gold" aria-hidden /> {inc}
                      </li>
                    ))}
                  </ul>
                ) : null}

                <div className="mt-auto pt-5">
                  <Button asChild size="sm" variant={featured ? 'default' : 'outline'} className="w-full">
                    <Link to="/book">Book this package</Link>
                  </Button>
                </div>
              </div>
            </Stagger.Item>
          );
        })}
      </StaggerOnView>
    </SectionShell>
  );
}

function Offers({ section }) {
  const offers = Array.isArray(section.data) ? section.data : [];
  if (!offers.length) return null;
  return (
    <SectionShell>
      <SectionHeading eyebrow="Limited time" title="Current offers" />
      <div className="grid gap-4 lg:grid-cols-2">
        {offers.map((offer, i) => (
          <Reveal key={offer.id} delay={i * 0.06} className="h-full">
            <div className="flex h-full flex-col overflow-hidden rounded-xl border bg-card">
              <div className="flex items-center justify-between gap-3 border-b bg-gold/10 px-5 py-3">
                <span className="rounded-full bg-gold px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-gold-foreground">
                  {offer.badge ?? 'Offer'}
                </span>
                {offer.priceMin ? (
                  <span className="text-sm font-semibold tabular-nums">
                    {formatNpr(offer.priceMin, { compact: true })} – {formatNpr(offer.priceMax, { compact: true, symbol: false })}
                  </span>
                ) : null}
              </div>
              <div className="flex flex-1 flex-col p-5">
                <h3 className="font-deva text-lg font-semibold leading-snug tracking-tight">{offer.title}</h3>
                {offer.description ? <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{offer.description}</p> : null}
                {offer.bullets?.length ? (
                  <ul className="mt-4 grid gap-2 text-[13px] sm:grid-cols-2">
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
              </div>
            </div>
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
            <Link
              to={`/services/${item.slug}`}
              className="group flex items-center gap-2 rounded-full border bg-card px-4 py-2 text-[13px] font-medium transition-colors hover:border-primary/40 hover:text-primary"
            >
              {item.name}
              <ChevronRight className="h-3.5 w-3.5 text-muted-foreground transition-transform duration-300 group-hover:translate-x-0.5" aria-hidden />
            </Link>
          </Stagger.Item>
        ))}
      </StaggerOnView>
    </SectionShell>
  );
}

// ── proof and explanation ──────────────────────────────────────────────────────

function HowItWorks({ section }) {
  const steps = Array.isArray(section.data) ? section.data : [];
  if (!steps.length) return null;
  return (
    <SectionShell tone="muted">
      <SectionHeading eyebrow="How it works" title="Booking to warranty, in five steps" />
      <div className="relative">
        {/* The rail the numbers sit on, drawn as the section scrolls through. */}
        <div className="absolute inset-x-0 top-[1.375rem] hidden md:block" aria-hidden>
          <div className="mx-[10%] h-px bg-border">
            <DrawLine className="h-px" />
          </div>
        </div>
        <StaggerOnView className="relative grid gap-4 md:grid-cols-5 md:gap-3" stagger={0.09}>
          {steps.map((step) => (
            <Stagger.Item
              key={step.id}
              variants={{
                hidden: { opacity: 0, y: 18 },
                show: { opacity: 1, y: 0, transition: { duration: 0.45, ease: [0.16, 1, 0.3, 1] } },
              }}
            >
              <div className="group flex h-full gap-4 md:flex-col md:items-center md:gap-0 md:text-center">
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full border-2 border-primary/15 bg-card text-sm font-bold text-primary shadow-sm transition-colors duration-300 group-hover:border-primary group-hover:bg-primary group-hover:text-primary-foreground md:mb-4">
                  {step.stepNo}
                </span>
                <div className="sheen h-full rounded-xl border bg-card p-4 md:w-full">
                  <h3 className="text-[14px] font-semibold leading-snug tracking-tight">{step.title}</h3>
                  <p className="mt-1.5 text-[13px] leading-relaxed text-muted-foreground">{step.description}</p>
                </div>
              </div>
            </Stagger.Item>
          ))}
        </StaggerOnView>
      </div>
    </SectionShell>
  );
}

function FeatureRow({ section }) {
  const items = Array.isArray(section.data) ? section.data : [];
  if (!items.length) return null;
  const COPY = {
    why_choose: { eyebrow: 'Why us', title: 'Four promises, each one measured' },
    construction: { eyebrow: 'Construction', title: 'Built to a drawing, billed to a line item' },
    pre_engineered: { eyebrow: 'Steel buildings', title: 'Pre-engineered structures' },
  };
  return (
    <SectionShell tone={section.key === 'why_choose' ? 'paper' : 'muted'}>
      <SectionHeading {...(COPY[section.key] ?? { title: 'Highlights' })} />
      <StaggerOnView className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4" stagger={0.05}>
        {items.map((f) => (
          <Stagger.Item
            key={f.id}
            variants={{
              hidden: { opacity: 0, y: 16 },
              show: { opacity: 1, y: 0, transition: { duration: 0.45, ease: [0.16, 1, 0.3, 1] } },
            }}
          >
            <div className="sheen group flex h-full flex-col rounded-xl border bg-card p-5 transition-all duration-300 hover:-translate-y-1 hover:shadow-card">
              <span className="grid h-11 w-11 place-items-center rounded-full bg-gold/15 text-gold ring-1 ring-inset ring-gold/25 transition-transform duration-300 group-hover:scale-105">
                <DataIcon name={f.icon} className="h-[18px] w-[18px]" />
              </span>
              <h3 className="mt-4 text-[14px] font-semibold tracking-tight">
                {f.title === f.title?.toUpperCase() ? titleCase(f.title) : f.title}
              </h3>
              <p className="mt-1.5 text-[13px] leading-relaxed text-muted-foreground">{f.description}</p>
            </div>
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
      <StaggerOnView
        className="container relative grid grid-cols-2 gap-y-10 py-14 md:py-16 lg:grid-cols-4"
        stagger={0.1}
      >
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

function RecentWork({ section, media }) {
  const projects = Array.isArray(section.data) ? section.data : [];
  if (!projects.length) return null;
  return (
    <SectionShell>
      <SectionHeading
        eyebrow="Our work"
        title="Recently completed"
        description="Measured, photographed at each stage, handed over against a signed snag list."
        action={<Link to="/projects" className="text-sm font-medium text-primary hover:underline">See all work</Link>}
      />
      <StaggerOnView className="grid gap-4 md:grid-cols-3" stagger={0.06}>
        {projects.map((p) => {
          const cover = p.images?.[0]?.mediaId ?? p.coverId;
          const img = cover ? imageUrl(media?.[cover], 800) : null;
          return (
            <Stagger.Item
              key={p.id}
              variants={{
                hidden: { opacity: 0, y: 18 },
                show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.16, 1, 0.3, 1] } },
              }}
            >
              <Link
                to={`/projects/${p.slug}`}
                className="group block h-full overflow-hidden rounded-xl border bg-card transition-shadow hover:shadow-card"
              >
                <div className="relative h-40 overflow-hidden bg-muted">
                  {img ? (
                    <img src={img} alt="" loading="lazy" className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105" />
                  ) : (
                    <div className="blueprint-fine h-full w-full" aria-hidden />
                  )}
                  <span className={cn(
                    'absolute left-3 top-3 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide',
                    p.status === 'ongoing' ? 'bg-gold text-gold-foreground' : 'bg-background/90 text-muted-foreground backdrop-blur',
                  )}>
                    {p.status}
                  </span>
                </div>
                <div className="p-4">
                  <h3 className="text-[15px] font-semibold leading-snug tracking-tight">{p.title}</h3>
                  <p className="mt-1 text-xs text-muted-foreground">{p.location}</p>
                  <p className="mt-2 line-clamp-2 text-[13px] leading-relaxed text-muted-foreground">{p.summary}</p>
                </div>
              </Link>
            </Stagger.Item>
          );
        })}
      </StaggerOnView>
    </SectionShell>
  );
}

function Gallery({ section, media }) {
  const images = (Array.isArray(section.data) ? section.data : [])
    .map((g) => ({ ...g, src: imageUrl(media?.[g.imageId ?? g.mediaId], 800) }))
    .filter((g) => g.src);
  if (!images.length) return null;
  return (
    <SectionShell tone="muted">
      <SectionHeading eyebrow="On site" title="From the field" />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {images.map((g, i) => (
          <Reveal key={g.id ?? i} delay={Math.min(i, 8) * 0.04}>
            <figure className="group overflow-hidden rounded-xl border bg-card">
              <img src={g.src} alt={g.caption ?? ''} loading="lazy" className="h-40 w-full object-cover transition-transform duration-700 group-hover:scale-105" />
            </figure>
          </Reveal>
        ))}
      </div>
    </SectionShell>
  );
}

function Reviews({ section }) {
  const items = Array.isArray(section.data) ? section.data : [];
  if (!items.length) return null;
  return (
    <SectionShell>
      <SectionHeading eyebrow="Customers" title="What people say afterwards" />
      <StaggerOnView className="grid gap-4 md:grid-cols-2 lg:grid-cols-3" stagger={0.05}>
        {items.map((t) => (
          <Stagger.Item
            key={t.id}
            variants={{
              hidden: { opacity: 0, y: 16 },
              show: { opacity: 1, y: 0, transition: { duration: 0.45, ease: [0.16, 1, 0.3, 1] } },
            }}
          >
            <figure className="relative flex h-full flex-col rounded-xl border bg-card p-5">
              <Quote className="absolute right-4 top-4 h-7 w-7 text-primary/10" aria-hidden />
              <Stars rating={t.rating} />
              <blockquote className={cn('mt-3 flex-1 text-[13px] leading-relaxed', t.locale === 'ne' && 'font-deva')} lang={t.locale}>
                “{t.quote}”
              </blockquote>
              <figcaption className="mt-4 flex items-center gap-3 border-t pt-3.5">
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                  {t.author?.trim()[0] ?? '·'}
                </span>
                <span>
                  <span className={cn('block text-[13px] font-semibold', t.locale === 'ne' && 'font-deva')}>{t.author}</span>
                  <span className={cn('block text-[11px] text-muted-foreground', t.locale === 'ne' && 'font-deva')}>{t.location}</span>
                </span>
              </figcaption>
            </figure>
          </Stagger.Item>
        ))}
      </StaggerOnView>
    </SectionShell>
  );
}

function ExplainerBlock({ section }) {
  const { block, checkpoints = [] } = section.data ?? {};
  if (!block) return null;
  return (
    <SectionShell tone="muted">
      <div className="grid gap-8 lg:grid-cols-2 lg:items-start lg:gap-12">
        <Reveal>
          <Eyebrow>Diagnosis</Eyebrow>
          <h2 className="mt-2 text-2xl font-bold tracking-tight md:text-[1.75rem]">{block.heading}</h2>
          {block.subheading ? (
            <p className="mt-3 border-l-2 border-gold pl-4 text-[15px] leading-relaxed">{block.subheading}</p>
          ) : null}
          <p className="mt-4 text-sm leading-relaxed text-muted-foreground">{block.body}</p>
          {block.cta ? (
            <Cta href={block.cta.url} className="mt-6">{block.cta.label} <ArrowRight className="h-4 w-4" /></Cta>
          ) : null}
        </Reveal>

        {checkpoints.length ? (
          <Reveal delay={0.08}>
            <div className="overflow-hidden rounded-xl border bg-card">
              <p className="border-b bg-muted/50 px-5 py-3 text-sm font-semibold">Signs you should book an inspection</p>
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
            </div>
          </Reveal>
        ) : null}
      </div>
    </SectionShell>
  );
}

function ContentBlock({ section }) {
  const block = section.data;
  if (!block) return null;
  return (
    <SectionShell>
      <div className="grid gap-8 lg:grid-cols-[1fr_1.1fr] lg:gap-12">
        <Reveal>
          <Eyebrow>Interiors</Eyebrow>
          <h2 className="mt-2 text-2xl font-bold tracking-tight md:text-[1.75rem]">{block.heading}</h2>
          {block.subheading ? <p className="mt-3 text-[15px] text-muted-foreground">{block.subheading}</p> : null}
          <p className="mt-4 text-sm leading-relaxed text-muted-foreground">{block.body}</p>
        </Reveal>
        {block.bullets?.length ? (
          <StaggerOnView className="grid gap-3 sm:grid-cols-2" stagger={0.05}>
            {block.bullets.map((b, i) => (
              <Stagger.Item
                key={i}
                variants={{ hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0, transition: { duration: 0.4 } } }}
              >
                <p className="flex h-full gap-2.5 rounded-xl border bg-card p-4 text-[13px] leading-relaxed">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-gold" aria-hidden /> {b}
                </p>
              </Stagger.Item>
            ))}
          </StaggerOnView>
        ) : null}
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
          >
            <p className="flex h-full items-start gap-3 rounded-xl border bg-card p-4 text-[13px] leading-relaxed">
              <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-primary/10 text-[10px] font-bold text-primary">
                {item.position}
              </span>
              {item.text}
            </p>
          </Stagger.Item>
        ))}
      </StaggerOnView>
    </SectionShell>
  );
}

function KitchenBlock({ section }) {
  const { cards = [], steps = [] } = section.data ?? {};
  if (!cards.length && !steps.length) return null;
  return (
    <SectionShell>
      <SectionHeading
        eyebrow="Kitchens"
        title="Modernised around how you actually cook"
        action={<Button asChild variant="outline"><Link to="/book">Book a kitchen survey</Link></Button>}
      />
      <div className="grid gap-6 lg:grid-cols-[1.3fr_1fr]">
        <div className="grid content-start gap-3">
          {cards.map((c, i) => (
            <Reveal key={c.id} delay={i * 0.05}>
              <div className="sheen flex gap-4 rounded-xl border bg-card p-4 transition-shadow duration-300 hover:shadow-card">
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-gold/15 text-gold ring-1 ring-inset ring-gold/25">
                  <DataIcon name={c.icon} className="h-[18px] w-[18px]" />
                </span>
                <div>
                  <h3 className="text-[14px] font-semibold tracking-tight">{c.title}</h3>
                  <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">{c.description}</p>
                </div>
              </div>
            </Reveal>
          ))}
        </div>
        {steps.length ? (
          <Reveal delay={0.08}>
            <div className="overflow-hidden rounded-xl border bg-card">
              <p className="border-b bg-muted/50 px-5 py-3 text-sm font-semibold">How a kitchen runs</p>
              <ol className="divide-y">
                {steps.map((s) => (
                  <li key={s.id} className="flex gap-3 px-5 py-3 text-[13px] leading-relaxed">
                    <span className="text-xs font-bold tabular-nums text-primary">{String(s.position).padStart(2, '0')}</span>
                    {s.text}
                  </li>
                ))}
              </ol>
            </div>
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
          <div className="overflow-hidden rounded-xl bg-card text-card-foreground shadow-lift">
            <div className="border-b bg-muted/50 px-6 py-4">
              <h3 className="text-[15px] font-semibold tracking-tight">Or send the details now</h3>
              <p className="mt-0.5 text-xs text-muted-foreground">We call back within two hours.</p>
            </div>
            <div className="p-6">
              <LeadForm services={section.data?.services ?? []} sourcePage="/#contact" />
            </div>
          </div>
        </Reveal>
      </div>
    </SectionShell>
  );
}
