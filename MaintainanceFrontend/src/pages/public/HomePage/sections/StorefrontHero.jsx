import { lazy, Suspense } from 'react';
import { Link } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { ArrowRight, CalendarCheck, Phone, Search, ShieldCheck } from 'lucide-react';
import { useGetBootstrapQuery, useGetPublicServicesQuery } from '@/api/publicApi';
import { selectLocale } from '@/redux/slices/uiSlice';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { CategoryTile, Eyebrow } from '@/components/site/siteBlocks';
import { CountUp, StaggerOnView, WordReveal, motion, useReducedMotion } from '@/three/motion/motionKit';
import { MaintenanceDrift } from '@/three/motion/maintenanceDrift';
import { Cta } from '../shared';

// The hero's anchor. Deliberately not the login page's timber frame: this one
// is the trades themselves — screed, waterproofing, tile, conduit, supply — in
// solid colour. WebGL is a big dependency for a marketing page, so it is split
// out of the main bundle and arrives after the copy has already painted.
const SectionCutScene = lazy(() =>
  import('@/three/scenes/SectionCutScene/SectionCutScene').then((m) => ({ default: m.SectionCutScene })));

// Four, not five: the row has to survive one line on a phone, and a fifth term
// is a term nobody reads.
const POPULAR_SEARCHES = ['Seepage', 'Waterproofing', 'Modular kitchen', 'Rewiring'];

export function StorefrontHero({ section, settings, media }) {
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
      {/* Three layers behind the copy: the colour wash, the trades working away
          on top of it, and a fade into the page colour that takes the drawing
          down with it before the band ends. */}
      <div className="glow-paper absolute inset-0 -z-20" aria-hidden />
      <MaintenanceDrift className="-z-20" />
      <div
        className="absolute inset-0 -z-10 bg-gradient-to-b from-transparent via-transparent to-background"
        aria-hidden
      />

      <div className="container relative py-14 md:py-20 lg:py-24">
        <div className="grid items-center gap-14 lg:grid-cols-[1.05fr_0.95fr] lg:gap-16">
          {/* ── the pitch ── */}
          <div className="mx-auto max-w-xl text-center lg:mx-0 lg:text-left">
            <motion.div
              initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}
            >
              <Badge variant="outline" className="gap-2 border-border/70 bg-card/70 py-1 pl-2.5 font-medium text-muted-foreground backdrop-blur">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="absolute inline-flex h-full w-full animate-pulse-ring rounded-full bg-gold" aria-hidden />
                  <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-gold" aria-hidden />
                </span>
                We call back within 2 hours
              </Badge>
            </motion.div>

            <WordReveal
              as="h1"
              delay={0.05}
              text={slide?.title ?? 'Book a certified engineer for your home'}
              className="mt-6 block text-[2.15rem] font-bold leading-[1.06] tracking-tight md:text-[3rem] lg:text-[3.35rem]"
            />
            <motion.p
              initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.28, ease: [0.16, 1, 0.3, 1] }}
              className="mx-auto mt-5 max-w-lg text-[15px] leading-relaxed text-muted-foreground lg:mx-0"
            >
              {slide?.subtitle ?? 'Published prices, a free inspection first, and a one-month written warranty.'}
            </motion.p>

            {/* Search, then the terms people actually search for. The placeholder
                no longer lists examples — the row underneath is the example, and
                saying it twice was the noisiest thing on the band. */}
            <motion.form
              initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.36, ease: [0.16, 1, 0.3, 1] }}
              role="search"
              action="/services"
              className="group relative mx-auto mt-8 max-w-lg lg:mx-0"
            >
              <Search className="pointer-events-none absolute left-4 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-muted-foreground transition-colors group-focus-within:text-primary" aria-hidden />
              <Input
                type="search" name="q"
                placeholder="What needs fixing?"
                aria-label="Search services"
                className="h-14 rounded-xl border-border/80 bg-card pl-11 pr-[6.75rem] text-[15px] shadow-card focus-visible:ring-4 focus-visible:ring-primary/10 focus-visible:ring-offset-0"
              />
              <Button type="submit" className="absolute right-2 top-2 h-10 rounded-lg px-5">Search</Button>
            </motion.form>

            <div className="mt-3.5 flex flex-wrap items-center justify-center gap-2 text-xs text-muted-foreground lg:justify-start">
              <span className="text-muted-foreground/70">Popular</span>
              {POPULAR_SEARCHES.map((term) => (
                <Link key={term} to={`/services?q=${encodeURIComponent(term)}`}>
                  <Badge
                    variant="outline"
                    className="border-border/60 bg-card/50 px-2.5 py-0.5 text-[11px] font-normal text-muted-foreground hover:border-primary/40 hover:text-foreground"
                  >
                    {term}
                  </Badge>
                </Link>
              ))}
            </div>

            {/* Stacked full-width on a phone so the two CTAs share an edge. The
                number keeps its outline — a full-width tap target with no edge
                is not a target — but loses the shadow, so only one of the two
                reads as the thing to press. */}
            <div className="mt-8 flex flex-col gap-2.5 sm:flex-row sm:flex-wrap sm:items-center sm:justify-center lg:justify-start">
              <Cta href={slide?.ctaUrl} size="lg" className="w-full shadow-card sm:w-auto">
                <CalendarCheck className="h-4 w-4" /> {slide?.ctaLabel ?? 'Book a free inspection'}
              </Cta>
              {mobile ? (
                <Button asChild size="lg" variant="outline" className="w-full border-border/70 shadow-none sm:w-auto">
                  <a href={`tel:${mobile}`}><Phone className="h-4 w-4" /> {mobile}</a>
                </Button>
              ) : null}
            </div>

            {stats.length ? (
              <div className="mt-9">
                <Separator />
                <dl className="flex flex-wrap items-start justify-center gap-x-8 gap-y-4 pt-6 lg:justify-start">
                  {stats.map((stat) => (
                    <div key={stat.label} className="text-center lg:text-left">
                      <dt className="sr-only">{stat.label}</dt>
                      <dd>
                        <span className="block text-[1.35rem] font-bold leading-none tracking-tight text-primary">
                          <CountUp value={stat.value} />
                        </span>
                        <span className="mt-1.5 block text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
                          {stat.label}
                        </span>
                      </dd>
                    </div>
                  ))}
                </dl>
              </div>
            ) : null}
          </div>

          {/* ── the proof ── */}
          <HeroShowcase reduced={Boolean(reduced)} />
        </div>

        {categories.length ? (
          <div className="mt-16 lg:mt-20">
            <Separator />
            <div className="mb-6 mt-10 flex items-end justify-between gap-4">
              <div>
                {/* Same gold hairline every other section heading opens with. */}
                <span className="flex items-center gap-2.5">
                  <span className="h-px w-6 shrink-0 bg-gold/70" aria-hidden />
                  <Eyebrow>Browse by trade</Eyebrow>
                </span>
                <h2 className="mt-2 text-xl font-bold tracking-tight">Pick the work you need doing</h2>
              </div>
              <Button asChild variant="link" className="h-auto shrink-0 p-0">
                <Link to="/services">All services <ArrowRight className="h-3.5 w-3.5" /></Link>
              </Button>
            </div>
            <StaggerOnView className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4" stagger={0.05}>
              {categories.map((c, i) => (
                <CategoryTile key={c.id} category={c} count={countFor(c.slug)} media={media} index={i} />
              ))}
            </StaggerOnView>
          </div>
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
  // The panel's own entrance has to answer prefers-reduced-motion too, not only
  // the scene inside it: the global CSS rule reaches CSS transitions, and these
  // are JS-driven transforms it cannot see.
  const enter = reduced ? {} : {
    initial: { opacity: 0, y: 24 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.7, delay: 0.2, ease: [0.16, 1, 0.3, 1] },
  };
  const badgeEnter = reduced ? {} : {
    initial: { opacity: 0, scale: 0.9 },
    animate: { opacity: 1, scale: 1 },
    transition: { duration: 0.45, delay: 0.75, ease: [0.16, 1, 0.3, 1] },
  };

  return (
    <motion.div {...enter} className="relative mx-auto w-full max-w-md lg:max-w-none">
      {/* A hairline card, not the old lifted one: on paper the canvas clears to
          very nearly the page colour, and without an edge the scene's caption
          rule reads as a line ruled across nothing. No <Tilt> either — a CSS 3D
          transform on a live canvas resamples it blurry, and the scene already
          leans to the pointer on its own. */}
      <div className="overflow-hidden">
        <Suspense fallback={<div className="aspect-[7/6] w-full animate-pulse bg-muted/40" />}>
          <SectionCutScene reduced={reduced} />
        </Suspense>
      </div>

      {/* Over the canvas, not hanging off the card: the caption owns the bottom
          edge and the two would sit on top of each other. */}
      <motion.div {...badgeEnter} className="pointer-events-none absolute left-4 top-4">
        <Badge variant="outline" className="gap-2 border-gold/40 bg-card/90 px-3 py-1.5 text-[11px] font-semibold shadow-card backdrop-blur">
          <ShieldCheck className="h-3.5 w-3.5 text-gold" aria-hidden /> Certified engineers only
        </Badge>
      </motion.div>
    </motion.div>
  );
}
