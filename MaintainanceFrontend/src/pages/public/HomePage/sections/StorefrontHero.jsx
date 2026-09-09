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
import { CategoryTile, Eyebrow } from '@/components/site';
import { CountUp, StaggerOnView, WordReveal, motion, useReducedMotion } from '@/three/motion';
import { Cta } from '../shared';

// The hero's anchor. Deliberately not the login page's timber frame: this one
// is the trades themselves — screed, waterproofing, tile, conduit, supply — in
// solid colour. WebGL is a big dependency for a marketing page, so it is split
// out of the main bundle and arrives after the copy has already painted.
const SectionCutScene = lazy(() =>
  import('@/three/scenes/SectionCutScene').then((m) => ({ default: m.SectionCutScene })));

const POPULAR_SEARCHES = ['Seepage', 'Waterproofing', 'Modular kitchen', 'Rewiring', 'Renovation'];

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
