import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { ArrowRight, ArrowUpRight, Check, Phone, Quote } from 'lucide-react';
import { useGetHomeQuery } from '@/features/public/publicApi';
import { selectLocale } from '@/features/ui/uiSlice';
import { LeadForm } from '@/features/public/LeadForm';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ErrorState } from '@/components/common/ErrorState';
import { SectionShell, SectionHeading, Eyebrow, DataIcon, Stars, Index, ServiceCard, gridFit } from '@/components/site';
import {
  PageTransition, Reveal, StaggerOnView, Stagger, CountUp, Parallax, ScrollFade, Spotlight,
  DriftField, Tilt, Magnetic, DrawLine, WordReveal, Marquee, motion, AnimatePresence, useReducedMotion,
} from '@/components/motion';
import { formatNpr, imageUrl, titleCase } from '@/lib/format';
import { cn } from '@/lib/utils';

/**
 * The home page renders whatever sections the admin has made visible, in their
 * chosen order. Adding, hiding or reordering a section is a content change —
 * no code edit, which was the whole point of the rebuild.
 *
 * Design: one dark "ink" mast (header → hero), then paper, with brass as the
 * only accent. Sections alternate paper / muted / ink so the page has a
 * rhythm instead of nineteen identical white bands.
 */
const SECTIONS = {
  hero: HeroSection,
  quick_inquiry: PromiseStrip,
  services: ServicesSection,
  projects: ProjectsSection,
  offers: OffersSection,
  gallery: GallerySection,
  why_choose: FeatureGridSection,
  construction: FeatureGridSection,
  pre_engineered: FeatureGridSection,
  kitchen: KitchenSection,
  stats: StatsSection,
  seepage: SeepageSection,
  interior: ContentBlockSection,
  renovation: NumberedListSection,
  pricing: PricingSection,
  other_civil: OtherCivilSection,
  process: ProcessSection,
  testimonials: TestimonialsSection,
  cta_form: CtaFormSection,
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
    <div>
      <div className="ink-panel blueprint">
        <div className="container grid gap-12 py-24 lg:grid-cols-2">
          <div className="space-y-5">
            <Skeleton className="h-4 w-40 bg-ink-foreground/10" />
            <Skeleton className="h-16 w-full bg-ink-foreground/10" />
            <Skeleton className="h-16 w-4/5 bg-ink-foreground/10" />
            <Skeleton className="h-12 w-64 bg-ink-foreground/10" />
          </div>
          <Skeleton className="h-[420px] w-full bg-ink-foreground/10" />
        </div>
      </div>
      <div className="container grid gap-6 py-24 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-64 rounded-lg" />)}
      </div>
    </div>
  );
}

// ── link safety ────────────────────────────────────────────────────────────────
// Editors type CTA URLs by hand. Anything that is not a route this app actually
// serves goes to the contact page rather than to a 404.
const ROUTES = ['/', '/services', '/pricing', '/contact'];

function isExternal(url = '') {
  return /^(https?:|tel:|mailto:|viber:)/i.test(url);
}

function siteHref(url, fallback = '/contact') {
  if (!url) return fallback;
  if (isExternal(url)) return url;
  const path = url.split(/[?#]/)[0];
  return ROUTES.includes(path) || path.startsWith('/services/') ? url : fallback;
}

/** A CTA that renders a router link internally and a plain anchor externally. */
function Cta({ href, children, ...props }) {
  const target = siteHref(href);
  return (
    <Button asChild {...props}>
      {isExternal(target) ? <a href={target}>{children}</a> : <Link to={target}>{children}</Link>}
    </Button>
  );
}

// ── hero ───────────────────────────────────────────────────────────────────────

function HeroSection({ section, media, settings }) {
  const slides = (Array.isArray(section.data) ? section.data : []).filter(Boolean);
  const reduced = useReducedMotion();
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (slides.length < 2 || reduced || paused) return undefined;
    const timer = setInterval(() => setIndex((i) => (i + 1) % slides.length), 7000);
    return () => clearInterval(timer);
  }, [slides.length, reduced, paused]);

  const slide = slides[index] ?? slides[0];
  if (!slide) return null;

  const bg = imageUrl(media?.[slide.imageId], 1600);
  const phone = settings?.['contact.phonePrimary'];
  const mobile = settings?.['contact.phoneSecondary'];

  /** Entrance props, or nothing at all when the reader asked for less motion. */
  const enter = (delay = 0, y = 14) => (reduced ? {} : {
    initial: { opacity: 0, y },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.6, delay, ease: [0.16, 1, 0.3, 1] },
  });

  return (
    <section
      className="relative isolate overflow-hidden ink-panel"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      {/* Background stack: photograph if one is uploaded, otherwise the drawing
          grid — the hero must look deliberate before any media exists. */}
      {bg ? (
        <Parallax speed={0.14} className="absolute inset-0 -z-10">
          <img src={bg} alt="" className="h-[130%] w-full object-cover opacity-25" aria-hidden />
        </Parallax>
      ) : null}
      <Parallax speed={0.06} className="absolute inset-0 -z-10">
        <div className="blueprint mask-b h-[130%] w-full opacity-70" aria-hidden />
      </Parallax>
      <DriftField count={18} className="-z-10" />
      <Spotlight size={620} />
      <motion.div
        className="absolute -right-40 -top-40 -z-10 h-[520px] w-[520px] rounded-full blur-3xl"
        style={{ background: 'radial-gradient(circle, hsl(var(--gold) / 0.35), transparent 65%)' }}
        animate={reduced ? undefined : { scale: [1, 1.12, 1], opacity: [0.32, 0.48, 0.32] }}
        transition={{ duration: 11, repeat: Infinity, ease: 'easeInOut' }}
        aria-hidden
      />

      <ScrollFade className="container relative z-10 grid items-center gap-14 py-20 md:py-28 lg:grid-cols-[1.05fr_minmax(360px,0.9fr)] lg:gap-20">
        <div>
          <div className="flex items-center gap-3">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-pulse-ring rounded-full bg-gold" aria-hidden />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-gold" aria-hidden />
            </span>
            <span className="eyebrow text-gold">Responding within 2 hours</span>
          </div>

          <AnimatePresence mode="wait">
            <motion.div
              key={slide.id ?? index}
              initial={reduced ? { opacity: 0 } : { opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              exit={reduced ? { opacity: 0 } : { opacity: 0, y: -10 }}
              transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
            >
              <WordReveal
                as="h1"
                text={slide.title}
                stagger={0.05}
                className="mt-6 block max-w-2xl font-display text-[clamp(2.4rem,5.6vw,4.25rem)] font-semibold leading-[1.04] tracking-[-0.03em]"
              />
              {slide.subtitle ? (
                <motion.p {...enter(0.35, 12)} className="mt-6 max-w-xl text-[17px] leading-relaxed text-ink-muted">
                  {slide.subtitle}
                </motion.p>
              ) : null}

              <motion.div {...enter(0.45)} className="mt-9 flex flex-wrap items-center gap-3">
                <Magnetic>
                  <Cta href={slide.ctaUrl} variant="gold" size="xl" className="group/cta">
                    {slide.ctaLabel ?? 'Book a free inspection'}
                    <ArrowUpRight className="h-4 w-4 transition-transform duration-300 group-hover/cta:-translate-y-0.5 group-hover/cta:translate-x-0.5" />
                  </Cta>
                </Magnetic>
                <Magnetic strength={0.2}>
                  <Button asChild variant="onInk" size="xl"><Link to="/pricing">See published rates</Link></Button>
                </Magnetic>
              </motion.div>
            </motion.div>
          </AnimatePresence>

          {slides.length > 1 ? (
            <div className="mt-10 flex items-center gap-2" role="tablist" aria-label="Highlights">
              {slides.map((s, i) => (
                <button
                  key={s.id ?? i}
                  type="button"
                  role="tab"
                  aria-selected={i === index}
                  aria-label={s.title}
                  onClick={() => setIndex(i)}
                  className={cn(
                    'h-0.5 rounded-full transition-all duration-500',
                    i === index ? 'w-10 bg-gold' : 'w-5 bg-ink-foreground/25 hover:bg-ink-foreground/50',
                  )}
                />
              ))}
            </div>
          ) : null}

          <motion.div
            {...(reduced ? {} : { initial: { opacity: 0 }, animate: { opacity: 1 }, transition: { duration: 0.6, delay: 0.7 } })}
            className="mt-10 border-t border-ink-foreground/10 pt-6 text-sm text-ink-muted"
          >
            Or call{' '}
            <a href={`tel:${phone}`} className="font-medium text-ink-foreground underline-offset-4 hover:underline">{phone}</a>
            {mobile ? (
              <>
                {' '}·{' '}
                <a href={`tel:${mobile}`} className="font-medium text-ink-foreground underline-offset-4 hover:underline">{mobile}</a>
              </>
            ) : null}
          </motion.div>
        </div>

        <motion.div {...enter(0.12, 26)} className="relative">
          <motion.div
            className="absolute -inset-3 -z-10 rounded-lg border border-ink-foreground/10"
            animate={reduced ? undefined : { rotate: [0, 0.6, 0], scale: [1, 1.012, 1] }}
            transition={{ duration: 12, repeat: Infinity, ease: 'easeInOut' }}
            aria-hidden
          />
          <div className="overflow-hidden rounded-lg bg-card text-card-foreground shadow-float">
            <div className="flex items-start justify-between gap-4 border-b bg-muted/50 px-6 py-5">
              <div>
                <h2 className="font-display text-xl font-semibold tracking-tight">Free consultation</h2>
                <p className="mt-1 text-sm text-muted-foreground">Tell us the problem. We call back within two hours.</p>
              </div>
              <span className="shrink-0 rounded-full bg-gold/12 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-widest text-gold">
                No charge
              </span>
            </div>
            <div className="p-6"><LeadForm compact sourcePage="/" /></div>
          </div>
        </motion.div>
      </ScrollFade>

      {/* Scroll cue — the page below the fold is the substance, so say so. */}
      <motion.div
        className="pointer-events-none absolute inset-x-0 bottom-6 hidden justify-center lg:flex"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.2, duration: 0.6 }}
        aria-hidden
      >
        <motion.span
          className="h-10 w-px bg-gradient-to-b from-transparent via-gold to-transparent"
          animate={reduced ? undefined : { scaleY: [0.3, 1, 0.3], opacity: [0.3, 1, 0.3] }}
          transition={{ duration: 2.6, repeat: Infinity, ease: 'easeInOut' }}
        />
      </motion.div>
    </section>
  );
}

// ── promise strip ──────────────────────────────────────────────────────────────

function PromiseStrip({ section }) {
  const badges = Array.isArray(section.data) ? section.data : [];
  if (!badges.length) return null;
  return (
    <div className="border-b bg-background">
      <Marquee className="mask-x py-5 sm:hidden" duration={26}>
        {badges.map((b, i) => (
          <span key={i} className="flex items-center gap-3 whitespace-nowrap px-6 text-sm font-medium">
            <DataIcon name={b.icon} className="h-4 w-4 text-gold" />
            {b.label}
            <span className="ml-6 h-1 w-1 rotate-45 bg-gold/60" aria-hidden />
          </span>
        ))}
      </Marquee>

      <StaggerOnView className="container hidden divide-y sm:grid sm:grid-cols-3 sm:divide-x sm:divide-y-0" stagger={0.1}>
        {badges.map((b, i) => (
          <Stagger.Item
            key={i}
            className="group flex items-center gap-4 py-6 sm:justify-center sm:px-6"
            variants={{
              hidden: { opacity: 0, y: 18 },
              show: { opacity: 1, y: 0, transition: { duration: 0.55, ease: [0.16, 1, 0.3, 1] } },
            }}
          >
            <motion.span
              className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-gold/35 text-gold"
              whileHover={{ scale: 1.12, rotate: -8 }}
              transition={{ type: 'spring', stiffness: 300, damping: 14 }}
            >
              <DataIcon name={b.icon} className="h-4 w-4" />
            </motion.span>
            <span className="text-sm font-medium tracking-tight">{b.label}</span>
          </Stagger.Item>
        ))}
      </StaggerOnView>
    </div>
  );
}

// ── services ───────────────────────────────────────────────────────────────────

function ServicesSection({ section, media }) {
  const services = Array.isArray(section.data) ? section.data : [];
  if (!services.length) return null;
  const { cols, fillers } = gridFit(services.length);
  return (
    <SectionShell>
      <SectionHeading
        eyebrow="What we do"
        title="Services diagnosed before they are priced"
        description="Instruments before opinions, a published rate card before a quotation, and a written warranty after handover."
        action={
          <Button asChild variant="outline">
            <Link to="/services">All services <ArrowRight className="h-4 w-4" /></Link>
          </Button>
        }
      />
      <StaggerOnView
        className={cn(
          'grid gap-px overflow-hidden rounded-lg border bg-border sm:grid-cols-2',
          cols === 3 && 'lg:grid-cols-3',
        )}
        stagger={0.07}
      >
        {services.map((service, i) => (
          <Stagger.Item
            key={service.id}
            className="bg-card"
            variants={{
              hidden: { opacity: 0, y: 28, filter: 'blur(6px)' },
              show: { opacity: 1, y: 0, filter: 'blur(0px)', transition: { duration: 0.6, ease: [0.16, 1, 0.3, 1] } },
            }}
          >
            <ServiceCard service={service} media={media} index={i + 1} />
          </Stagger.Item>
        ))}
        {Array.from({ length: fillers }).map((_, i) => (
          <div key={`filler-${i}`} className="hidden bg-card sm:block" aria-hidden />
        ))}
      </StaggerOnView>
    </SectionShell>
  );
}

// ── projects ───────────────────────────────────────────────────────────────────

function ProjectsSection({ section, media }) {
  const projects = Array.isArray(section.data) ? section.data : [];
  if (!projects.length) return null;
  return (
    <SectionShell tone="muted">
      <SectionHeading
        eyebrow="Our work"
        title="Recent projects, with the numbers"
        description="Every project below was measured, photographed at each stage and handed over against a signed snag list."
      />
      <div className="grid gap-5 lg:grid-cols-3">
        {projects.map((p, i) => {
          const cover = p.images?.[0]?.mediaId ?? p.coverId;
          const img = cover ? imageUrl(media?.[cover], 1200) : null;
          const lead = i === 0;
          return (
            <Reveal
              key={p.id}
              delay={Math.min(i, 4) * 0.06}
              className={cn(lead && 'lg:col-span-2 lg:row-span-2')}
            >
              <article
                className={cn(
                  'group relative flex h-full flex-col justify-end overflow-hidden rounded-lg border bg-ink text-ink-foreground',
                  lead ? 'min-h-[420px]' : 'min-h-[220px]',
                )}
              >
                {img ? (
                  <Parallax speed={0.09} className="absolute inset-0">
                    <img
                      src={img} alt="" loading="lazy"
                      className="h-[125%] w-full object-cover opacity-60 transition-opacity duration-700 group-hover:opacity-80"
                    />
                  </Parallax>
                ) : (
                  <Parallax speed={0.05} className="absolute inset-0">
                    <div className="blueprint h-[125%] w-full opacity-60" aria-hidden />
                  </Parallax>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-ink via-ink/70 to-transparent" aria-hidden />

                <div className={cn(
                  'relative p-6 transition-transform duration-500 ease-out group-hover:-translate-y-1',
                  lead && 'p-8',
                )}>
                  <span className={cn(
                    'inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-widest',
                    p.status === 'ongoing' ? 'border-gold/40 text-gold' : 'border-ink-foreground/25 text-ink-muted',
                  )}>
                    <span className={cn('h-1.5 w-1.5 rounded-full', p.status === 'ongoing' ? 'bg-gold' : 'bg-ink-foreground/60')} aria-hidden />
                    {p.status}
                  </span>
                  <h3 className={cn(
                    'mt-4 font-display font-semibold leading-tight tracking-tight',
                    lead ? 'text-[1.75rem]' : 'text-lg',
                  )}>
                    {p.title}
                  </h3>
                  <p className="mt-1.5 text-xs uppercase tracking-widest text-ink-muted">{p.location}</p>
                  {lead && p.summary ? (
                    <p className="mt-4 max-w-lg text-sm leading-relaxed text-ink-muted">{p.summary}</p>
                  ) : null}
                </div>
              </article>
            </Reveal>
          );
        })}
      </div>
    </SectionShell>
  );
}

// ── gallery ────────────────────────────────────────────────────────────────────

function GallerySection({ section, media }) {
  const images = (Array.isArray(section.data) ? section.data : [])
    .map((g) => ({ ...g, src: imageUrl(media?.[g.imageId ?? g.mediaId], 800) }))
    .filter((g) => g.src);
  if (!images.length) return null;
  return (
    <SectionShell>
      <SectionHeading eyebrow="On site" title="From the field" />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {images.map((g, i) => (
          <Reveal key={g.id ?? i} delay={Math.min(i, 8) * 0.04}>
            <figure className={cn('group overflow-hidden rounded-lg border bg-muted', i % 5 === 0 && 'md:col-span-2 md:row-span-2')}>
              <img
                src={g.src} alt={g.caption ?? ''} loading="lazy"
                className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
              />
            </figure>
          </Reveal>
        ))}
      </div>
    </SectionShell>
  );
}

// ── offers ─────────────────────────────────────────────────────────────────────

function OffersSection({ section }) {
  const offers = Array.isArray(section.data) ? section.data : [];
  if (!offers.length) return null;
  return (
    <SectionShell tone="ink" className="blueprint">
      <Spotlight size={560} />
      <DriftField count={10} />
      <SectionHeading
        tone="ink"
        eyebrow="Limited time"
        title="Current offers"
        description="Seasonal packages, priced the same way everything else is — against the published rate card."
      />
      <div className="grid gap-5 lg:grid-cols-2">
        {offers.map((offer, i) => (
          <Reveal key={offer.id} delay={i * 0.08} className="h-full">
            <Tilt max={4} scale={1.008} glare className="group relative h-full rounded-lg">
            <div className="relative flex h-full flex-col rounded-lg border border-ink-foreground/15 bg-ink-foreground/[0.04] p-8 transition-colors hover:border-gold/40">
              {offer.badge ? (
                <span className="self-start rounded-full bg-gold px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-gold-foreground">
                  {offer.badge}
                </span>
              ) : null}
              <h3 className="mt-5 font-deva font-display text-2xl font-semibold leading-snug tracking-tight">{offer.title}</h3>
              {offer.description ? (
                <p className="mt-3 text-sm leading-relaxed text-ink-muted">{offer.description}</p>
              ) : null}
              {offer.bullets?.length ? (
                <ul className="mt-6 space-y-3 text-sm">
                  {offer.bullets.map((b, k) => (
                    <li key={k} className="flex gap-3 text-ink-muted">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-gold" aria-hidden /> {b}
                    </li>
                  ))}
                </ul>
              ) : null}
              <div className="mt-auto flex flex-wrap items-end justify-between gap-4 border-t border-ink-foreground/10 pt-6 mt-8">
                {offer.priceMin ? (
                  <p>
                    <span className="block text-[10px] uppercase tracking-widest text-ink-muted">Rate range</span>
                    <span className="font-display text-xl font-semibold">
                      {formatNpr(offer.priceMin, { compact: true })} – {formatNpr(offer.priceMax, { compact: true })}
                    </span>
                  </p>
                ) : <span />}
                <Magnetic strength={0.22}>
                  <Cta href={offer.ctaUrl} variant="gold">
                    {offer.ctaLabel ?? 'Book now'} <ArrowUpRight className="h-4 w-4" />
                  </Cta>
                </Magnetic>
              </div>
            </div>
            </Tilt>
          </Reveal>
        ))}
      </div>
    </SectionShell>
  );
}

// ── feature grids ──────────────────────────────────────────────────────────────

const FEATURE_COPY = {
  why_choose: {
    eyebrow: 'Why us',
    title: 'Four promises, each one measured',
    description: 'These are not slogans. Every one of them is tracked inside the system that runs our jobs.',
  },
  construction: {
    eyebrow: 'Construction',
    title: 'Built to a drawing, billed to a line item',
    description: 'Structural work is documented before it starts and certified after it finishes.',
  },
  pre_engineered: {
    eyebrow: 'Steel buildings',
    title: 'Pre-engineered structures',
    description: 'Shop-fabricated frames for warehouses, showrooms and halls that need clear span, not columns.',
  },
};

function FeatureGridSection({ section }) {
  const items = Array.isArray(section.data) ? section.data : [];
  if (!items.length) return null;
  const copy = FEATURE_COPY[section.key] ?? { title: 'Highlights' };
  const ink = section.key === 'pre_engineered';

  return (
    <SectionShell tone={section.key === 'why_choose' ? 'muted' : ink ? 'ink' : 'paper'}>
      <SectionHeading tone={ink ? 'ink' : 'paper'} {...copy} />
      <div className="grid gap-x-10 gap-y-12 sm:grid-cols-2 lg:grid-cols-4">
        {items.map((f, i) => (
          <Reveal key={f.id} delay={Math.min(i, 6) * 0.05} className="group">
            <div className={cn('h-px w-full transition-colors duration-500', ink ? 'bg-ink-foreground/15 group-hover:bg-gold' : 'bg-border group-hover:bg-gold')} aria-hidden />
            <div className="pt-6">
              <span className={cn(
                'grid h-11 w-11 place-items-center rounded-full border transition-colors',
                ink ? 'border-ink-foreground/20 text-gold' : 'border-border text-gold group-hover:border-gold/40',
              )}>
                <DataIcon name={f.icon} />
              </span>
              <h3 className="mt-5 font-display text-lg font-semibold tracking-tight">
                {f.title === f.title?.toUpperCase() ? titleCase(f.title) : f.title}
              </h3>
              <p className={cn('mt-3 text-sm leading-relaxed', ink ? 'text-ink-muted' : 'text-muted-foreground')}>
                {f.description}
              </p>
            </div>
          </Reveal>
        ))}
      </div>
    </SectionShell>
  );
}

// ── kitchen ────────────────────────────────────────────────────────────────────

function KitchenSection({ section }) {
  const { cards = [], steps = [] } = section.data ?? {};
  if (!cards.length && !steps.length) return null;
  return (
    <SectionShell tone="muted">
      <SectionHeading
        eyebrow="Kitchens"
        title="Modernised around how you actually cook"
        description="Work triangle, ventilation and storage settled on paper before a single finish is chosen."
      />
      <div className="grid gap-10 lg:grid-cols-[1.4fr_1fr]">
        <div className="grid gap-4 content-start">
          {cards.map((c, i) => (
            <Reveal key={c.id} delay={i * 0.06}>
              <div className="group flex gap-5 rounded-lg border bg-card p-6 transition-colors hover:border-gold/40">
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-gold/35 text-gold">
                  <DataIcon name={c.icon} className="h-4 w-4" />
                </span>
                <div>
                  <h3 className="font-display text-lg font-semibold tracking-tight">{c.title}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{c.description}</p>
                </div>
              </div>
            </Reveal>
          ))}
        </div>
        {steps.length ? (
          <Reveal delay={0.1}>
            <div className="rounded-lg border bg-card p-8">
              <p className="eyebrow text-gold">How a kitchen runs</p>
              <ol className="mt-6 space-y-5">
                {steps.map((s) => (
                  <li key={s.id} className="flex gap-4 border-b pb-5 last:border-0 last:pb-0">
                    <Index n={s.position} className="mt-0.5 text-muted-foreground" />
                    <p className="text-sm leading-relaxed">{s.text}</p>
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

// ── stats ──────────────────────────────────────────────────────────────────────

function StatsSection({ section }) {
  const stats = Array.isArray(section.data) ? section.data : [];
  if (!stats.length) return null;
  return (
    <section className="ink-panel relative overflow-hidden">
      <div className="blueprint absolute inset-0 opacity-50" aria-hidden />
      <DriftField count={12} />
      <Spotlight size={480} />
      <StaggerOnView className="container relative grid grid-cols-2 gap-y-12 py-16 md:py-20 lg:grid-cols-4" stagger={0.12}>
        {stats.map((s, i) => (
          <Stagger.Item
            key={i}
            className={cn(
              'px-2 text-center lg:px-8',
              i % 2 === 1 && 'border-l border-ink-foreground/10',
              i > 0 && 'lg:border-l lg:border-ink-foreground/10',
            )}
            variants={{
              hidden: { opacity: 0, y: 22, scale: 0.96 },
              show: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.6, ease: [0.16, 1, 0.3, 1] } },
            }}
          >
            <p className="font-display text-4xl font-semibold tracking-tight text-gold md:text-5xl">
              <CountUp value={s.value} />
            </p>
            <p className="eyebrow mt-3 text-ink-muted">{s.label}</p>
          </Stagger.Item>
        ))}
      </StaggerOnView>
    </section>
  );
}

// ── seepage explainer ──────────────────────────────────────────────────────────

function SeepageSection({ section }) {
  const { block, checkpoints = [] } = section.data ?? {};
  if (!block) return null;
  return (
    <SectionShell>
      <div className="grid gap-14 lg:grid-cols-2 lg:items-start lg:gap-20">
        <Reveal>
          <Eyebrow>Diagnosis</Eyebrow>
          <h2 className="mt-4 font-display text-[2rem] font-semibold leading-[1.1] tracking-[-0.02em] md:text-[2.6rem]">
            {block.heading}
          </h2>
          {block.subheading ? (
            <p className="mt-5 border-l-2 border-gold pl-5 font-display text-lg italic leading-relaxed">
              {block.subheading}
            </p>
          ) : null}
          <p className="mt-6 leading-relaxed text-muted-foreground">{block.body}</p>
          {block.cta ? (
            <Cta href={block.cta.url} variant="gold" size="lg" className="mt-8">
              {block.cta.label} <ArrowUpRight className="h-4 w-4" />
            </Cta>
          ) : null}
        </Reveal>

        {checkpoints.length ? (
          <Reveal delay={0.1}>
            <div className="rounded-lg border bg-card shadow-card">
              <div className="flex items-center justify-between border-b px-7 py-5">
                <p className="font-display text-lg font-semibold tracking-tight">Signs you should call us</p>
                <span className="eyebrow text-muted-foreground">{checkpoints.length} checks</span>
              </div>
              <ul className="divide-y">
                {checkpoints.map((c) => (
                  <li key={c.id} className="flex gap-4 px-7 py-4 text-sm leading-relaxed">
                    <Index n={c.position} className="mt-0.5 shrink-0 text-gold" />
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

// ── content block (interior) ───────────────────────────────────────────────────

function ContentBlockSection({ section }) {
  const block = section.data;
  if (!block) return null;
  return (
    <SectionShell tone="muted">
      <div className="grid gap-14 lg:grid-cols-[1fr_1.1fr] lg:gap-20">
        <Reveal>
          <Eyebrow>Interiors</Eyebrow>
          <h2 className="mt-4 font-display text-[2rem] font-semibold leading-[1.1] tracking-[-0.02em] md:text-[2.6rem]">
            {block.heading}
          </h2>
          {block.subheading ? <p className="mt-5 text-lg text-muted-foreground">{block.subheading}</p> : null}
          <p className="mt-5 leading-relaxed text-muted-foreground">{block.body}</p>
        </Reveal>
        {block.bullets?.length ? (
          <Reveal delay={0.1}>
            <ul className="grid gap-px overflow-hidden rounded-lg border bg-border sm:grid-cols-2">
              {block.bullets.map((b, i) => (
                <li key={i} className="flex gap-3 bg-card p-6 text-sm leading-relaxed">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-gold" aria-hidden /> {b}
                </li>
              ))}
            </ul>
          </Reveal>
        ) : null}
      </div>
    </SectionShell>
  );
}

// ── renovation reasons ─────────────────────────────────────────────────────────

function NumberedListSection({ section }) {
  const items = Array.isArray(section.data) ? section.data : [];
  if (!items.length) return null;
  return (
    <SectionShell>
      <SectionHeading
        eyebrow="Renovation"
        title="When it is time to renovate"
        description="If two or more of these describe your house, a renovation costs less than the repairs you are already paying for."
      />
      <StaggerOnView className="grid gap-x-16 sm:grid-cols-2" stagger={0.06}>
        {items.map((item) => (
          <Stagger.Item
            key={item.id}
            variants={{
              hidden: { opacity: 0, x: -18 },
              show: { opacity: 1, x: 0, transition: { duration: 0.55, ease: [0.16, 1, 0.3, 1] } },
            }}
          >
            <div className="group flex items-baseline gap-6 border-b py-6">
              <span className="font-display text-2xl font-semibold text-border transition-colors duration-300 group-hover:text-gold">
                {String(item.position).padStart(2, '0')}
              </span>
              <p className="text-[15px] leading-relaxed">{item.text}</p>
            </div>
          </Stagger.Item>
        ))}
      </StaggerOnView>
    </SectionShell>
  );
}

// ── pricing ────────────────────────────────────────────────────────────────────

function PricingSection({ section }) {
  const plans = Array.isArray(section.data) ? section.data : [];
  if (!plans.length) return null;
  return (
    <SectionShell tone="muted">
      <SectionHeading
        eyebrow="Transparent pricing"
        title="Popular work, and what it costs"
        description="Published ranges from our rate card. The exact figure is confirmed after the free inspection — never after the work."
        action={
          <Button asChild variant="outline">
            <Link to="/pricing">Estimate your cost <ArrowRight className="h-4 w-4" /></Link>
          </Button>
        }
      />
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {plans.map((plan, i) => {
          const featured = plan.badge === 'Popular';
          return (
            <Reveal key={plan.id} delay={Math.min(i, 4) * 0.06} className="h-full">
              <Tilt max={5} scale={1.012} className="group h-full rounded-lg">
              <div className={cn(
                'flex h-full flex-col rounded-lg border p-7 transition-shadow',
                featured ? 'ink-panel border-ink shadow-lift' : 'bg-card hover:shadow-card',
              )}>
                <div className="flex items-start justify-between gap-3">
                  <h3 className="font-display text-lg font-semibold leading-snug tracking-tight">{plan.title}</h3>
                  {plan.badge ? (
                    <span className={cn(
                      'shrink-0 rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-widest',
                      featured ? 'bg-gold text-gold-foreground' : 'border text-muted-foreground',
                    )}>
                      {plan.badge}
                    </span>
                  ) : null}
                </div>

                <p className="mt-6">
                  <span className="font-display text-[1.75rem] font-semibold tabular-nums tracking-tight">
                    {formatNpr(plan.priceMin, { compact: true })}
                  </span>
                  <span className={cn('text-sm', featured ? 'text-ink-muted' : 'text-muted-foreground')}>
                    {' – '}{formatNpr(plan.priceMax, { compact: true, symbol: false })} {plan.unit}
                  </span>
                </p>

                {plan.inclusions?.length ? (
                  <ul className={cn('mt-6 space-y-2.5 border-t pt-6 text-sm', featured && 'border-ink-foreground/15')}>
                    {plan.inclusions.map((inc, k) => (
                      <li key={k} className={cn('flex gap-2.5', featured ? 'text-ink-muted' : 'text-muted-foreground')}>
                        <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-gold" aria-hidden /> {inc}
                      </li>
                    ))}
                  </ul>
                ) : null}

                <Button asChild variant={featured ? 'gold' : 'outline'} className="mt-auto w-full pt-0" size="lg">
                  <Link to="/contact">Book a free survey</Link>
                </Button>
              </div>
              </Tilt>
            </Reveal>
          );
        })}
      </div>
    </SectionShell>
  );
}

// ── other civil work ───────────────────────────────────────────────────────────

function OtherCivilSection({ section }) {
  const items = Array.isArray(section.data) ? section.data : [];
  if (!items.length) return null;
  return (
    <SectionShell>
      <SectionHeading
        eyebrow="Also on the books"
        title="Other civil work"
        description="Carried out by our own trained crews, measured and billed against a published rate."
      />
      <StaggerOnView className="grid border-t sm:grid-cols-2 lg:grid-cols-3" stagger={0.04}>
        {items.map((item, i) => (
          <Stagger.Item
            key={item.id}
            variants={{
              hidden: { opacity: 0, x: -14 },
              show: { opacity: 1, x: 0, transition: { duration: 0.5, ease: [0.16, 1, 0.3, 1] } },
            }}
          >
            <Link
              to={`/services/${item.slug}`}
              className="group flex items-center justify-between gap-4 border-b py-5 pr-2 transition-colors hover:text-primary sm:pr-8"
            >
              <span className="flex items-baseline gap-4">
                <Index n={i + 1} className="text-muted-foreground/60" />
                <span className="text-[15px] font-medium tracking-tight">{item.name}</span>
              </span>
              <ArrowUpRight className="h-4 w-4 shrink-0 text-muted-foreground/50 transition-all duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-gold" aria-hidden />
            </Link>
          </Stagger.Item>
        ))}
      </StaggerOnView>
    </SectionShell>
  );
}

// ── process ────────────────────────────────────────────────────────────────────

function ProcessSection({ section }) {
  const steps = Array.isArray(section.data) ? section.data : [];
  if (!steps.length) return null;
  return (
    <SectionShell tone="muted">
      <SectionHeading
        align="center"
        eyebrow="How it works"
        title="From your call to your warranty"
        description="Five steps, each one timestamped in the same system our engineers work from."
      />
      <div className="relative">
        {/* The through-line only makes sense once the steps sit in a row, and it
            draws itself in step with the reader rather than appearing at once. */}
        <div className="absolute left-[10%] right-[10%] top-6 hidden h-px bg-border md:block" aria-hidden />
        <DrawLine className="absolute left-[10%] right-[10%] top-6 hidden h-px md:block" />
        <div className="relative grid gap-10 md:grid-cols-5 md:gap-6">
          {steps.map((step, i) => (
            <Reveal key={step.id} delay={i * 0.08}>
              <div className="flex gap-5 md:block">
                <motion.div
                  className="relative grid h-12 w-12 shrink-0 place-items-center rounded-full border border-gold/40 bg-background font-display text-lg font-semibold text-gold md:mx-auto"
                  initial={{ scale: 0.4, opacity: 0 }}
                  whileInView={{ scale: 1, opacity: 1 }}
                  viewport={{ once: true, amount: 0.6 }}
                  transition={{ type: 'spring', stiffness: 220, damping: 16, delay: i * 0.08 }}
                >
                  {step.stepNo}
                </motion.div>
                <div className="md:mt-6 md:text-center">
                  <h3 className="font-display text-base font-semibold tracking-tight">{step.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{step.description}</p>
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </SectionShell>
  );
}

// ── testimonials ───────────────────────────────────────────────────────────────

function TestimonialsSection({ section }) {
  const items = Array.isArray(section.data) ? section.data : [];
  if (!items.length) return null;
  return (
    <SectionShell>
      <SectionHeading eyebrow="Customers" title="What people say afterwards" />
      <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
        {items.map((t, i) => (
          <Reveal key={t.id} delay={Math.min(i, 5) * 0.05} className="h-full">
            <Tilt max={4} scale={1.01} glare className="group h-full rounded-lg">
            <figure className="relative flex h-full flex-col rounded-lg border bg-card p-7 transition-shadow hover:shadow-card">
              <Quote className="absolute right-6 top-6 h-8 w-8 text-gold/15" aria-hidden />
              <Stars rating={t.rating} />
              <blockquote
                className={cn('relative mt-5 flex-1 text-[15px] leading-relaxed', t.locale === 'ne' && 'font-deva')}
                lang={t.locale}
              >
                “{t.quote}”
              </blockquote>
              <figcaption className="mt-6 flex items-center gap-3 border-t pt-5">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-muted font-display text-sm font-semibold">
                  {t.author?.trim()[0] ?? '·'}
                </span>
                <span>
                  <span className={cn('block text-sm font-medium', t.locale === 'ne' && 'font-deva')}>{t.author}</span>
                  <span className={cn('block text-xs text-muted-foreground', t.locale === 'ne' && 'font-deva')}>{t.location}</span>
                </span>
              </figcaption>
            </figure>
            </Tilt>
          </Reveal>
        ))}
      </div>
    </SectionShell>
  );
}

// ── closing form ───────────────────────────────────────────────────────────────

function CtaFormSection({ section, settings }) {
  const phone = settings?.['contact.phonePrimary'];
  const mobile = settings?.['contact.phoneSecondary'];
  return (
    <section id="contact" className="ink-panel relative overflow-hidden">
      <div className="blueprint absolute inset-0 opacity-60" aria-hidden />
      <DriftField count={14} />
      <Spotlight size={600} />
      <motion.div
        className="absolute -left-40 bottom-0 h-[420px] w-[420px] rounded-full blur-3xl"
        style={{ background: 'radial-gradient(circle, hsl(var(--gold) / 0.3), transparent 65%)' }}
        animate={{ scale: [1, 1.15, 1], opacity: [0.3, 0.45, 0.3] }}
        transition={{ duration: 13, repeat: Infinity, ease: 'easeInOut' }}
        aria-hidden
      />
      <div className="container relative grid gap-14 py-20 md:py-28 lg:grid-cols-2 lg:items-center lg:gap-20">
        <Reveal>
          <Eyebrow tone="muted">Free consultation</Eyebrow>
          <h2 className="mt-4 font-display text-[2.25rem] font-semibold leading-[1.08] tracking-[-0.02em] md:text-[3rem]">
            Tell us what is wrong. We will tell you why.
          </h2>
          <p className="mt-6 max-w-lg leading-relaxed text-ink-muted">
            No visiting charge. A certified engineer inspects, explains the cause, and gives you a
            written estimate before anything starts.
          </p>

          <div className="mt-10 space-y-px overflow-hidden rounded-lg border border-ink-foreground/15">
            {[phone, mobile].filter(Boolean).map((n) => (
              <a
                key={n}
                href={`tel:${n}`}
                className="flex items-center justify-between gap-4 bg-ink-foreground/[0.04] px-6 py-4 transition-colors hover:bg-ink-foreground/[0.09]"
              >
                <span className="flex items-center gap-4">
                  <Phone className="h-4 w-4 text-gold" aria-hidden />
                  <span className="font-display text-lg tracking-tight">{n}</span>
                </span>
                <ArrowUpRight className="h-4 w-4 text-ink-muted" aria-hidden />
              </a>
            ))}
          </div>
          <p className="mt-5 text-sm text-ink-muted">{settings?.['contact.address']}</p>
        </Reveal>

        <Reveal delay={0.1}>
          <div className="overflow-hidden rounded-lg bg-card text-card-foreground shadow-float">
            <div className="border-b bg-muted/50 px-7 py-5">
              <h3 className="font-display text-xl font-semibold tracking-tight">Request an inspection</h3>
              <p className="mt-1 text-sm text-muted-foreground">Two-hour response, every working day.</p>
            </div>
            <div className="p-7">
              <LeadForm services={section.data?.services ?? []} sourcePage="/#contact" />
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
