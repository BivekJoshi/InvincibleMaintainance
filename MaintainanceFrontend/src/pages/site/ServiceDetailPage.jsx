import { useParams, Link } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { ChevronRight, Check } from 'lucide-react';
import { useGetPublicServiceQuery } from '@/features/public/publicApi';
import { selectLocale } from '@/features/ui/uiSlice';
import { LeadForm } from '@/features/public/LeadForm';
import { Skeleton } from '@/components/ui/skeleton';
import { ErrorState } from '@/components/common/ErrorState';
import { Eyebrow, SectionShell } from '@/components/site';
import { PageTransition, Reveal, StaggerOnView, Stagger, Spotlight, DriftField, WordReveal } from '@/components/motion';
import { cn } from '@/lib/utils';
import { formatNpr, imageUrl } from '@/lib/format';
import { useSeo } from '@/hooks/useSeo';

/**
 * The per-service page the original site never had — the reason it lost every
 * long-tail search like "waterproofing cost Kathmandu".
 */
export default function ServiceDetailPage() {
  const { slug } = useParams();
  const locale = useSelector(selectLocale);
  const { data, isLoading, error, refetch } = useGetPublicServiceQuery({ slug, locale });
  const service = data?.service;

  useSeo({
    title: service?.metaTitle ?? service?.name,
    description: service?.metaDescription ?? service?.excerpt,
    jsonLd: service ? {
      '@context': 'https://schema.org',
      '@type': 'Service',
      name: service.name,
      description: service.excerpt,
      provider: { '@type': 'LocalBusiness', name: 'Homeplex Nepal' },
      areaServed: 'Kathmandu Valley',
      ...(service.priceFrom ? {
        offers: {
          '@type': 'AggregateOffer',
          priceCurrency: 'NPR',
          lowPrice: service.priceFrom / 100,
          highPrice: (service.priceTo ?? service.priceFrom) / 100,
        },
      } : {}),
    } : null,
  });

  if (error) return <ErrorState error={error} onRetry={refetch} className="min-h-[60dvh]" />;
  if (isLoading) {
    return (
      <div className="container space-y-4 py-14">
        <Skeleton className="h-8 w-2/3" /><Skeleton className="h-64 w-full rounded-xl" />
      </div>
    );
  }

  const cover = service.imageId && data.media?.[service.imageId]
    ? imageUrl(data.media[service.imageId], 1600)
    : null;

  return (
    <PageTransition>
      <section className="ink-panel relative overflow-hidden">
        {cover ? (
          <img src={cover} alt="" className="absolute inset-0 h-full w-full object-cover opacity-25" aria-hidden />
        ) : null}
        <div className="blueprint mask-b absolute inset-0 opacity-60" aria-hidden />
        <Spotlight size={520} />
        <DriftField count={8} />

        <div className="container relative py-14 md:py-20">
          <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-xs text-ink-muted">
            <Link to="/" className="transition-colors hover:text-ink-foreground">Home</Link>
            <ChevronRight className="h-3 w-3" aria-hidden />
            <Link to="/services" className="transition-colors hover:text-ink-foreground">Services</Link>
            <ChevronRight className="h-3 w-3" aria-hidden />
            <span className="text-ink-foreground">{service.name}</span>
          </nav>

          {service.category ? <Eyebrow className="mt-8">{service.category.name}</Eyebrow> : null}
          <WordReveal
            as="h1"
            text={service.name}
            className="mt-4 block max-w-3xl font-display text-[clamp(2rem,4.2vw,3rem)] font-semibold leading-[1.06] tracking-[-0.025em]"
          />
          <p className="mt-5 max-w-2xl text-[17px] leading-relaxed text-ink-muted">{service.excerpt}</p>

          {service.priceFrom ? (
            <div className="mt-8 inline-flex items-baseline gap-3 rounded-lg border border-ink-foreground/15 bg-ink-foreground/[0.05] px-5 py-4">
              <span className="font-display text-2xl font-semibold tabular-nums">
                {formatNpr(service.priceFrom, { compact: true })} – {formatNpr(service.priceTo ?? service.priceFrom, { compact: true })}
              </span>
              <span className="text-sm text-ink-muted">per {service.priceUnit}</span>
            </div>
          ) : null}
        </div>
      </section>

      <SectionShell className="py-14 md:py-20">
      <div className="grid gap-12 lg:grid-cols-[1fr_380px] lg:gap-16">
        <article>
          {service.body ? (
            <div className="max-w-2xl">
              {service.body.split('\n\n').map((para, i) => (
                <p key={i} className={cn('leading-relaxed text-muted-foreground', i && 'mt-5')}>{para}</p>
              ))}
            </div>
          ) : null}

          {data.faqs?.length ? (
            <section className="mt-14">
              <Eyebrow>Before you call</Eyebrow>
              <h2 className="mt-3 font-display text-2xl font-semibold tracking-tight">Common questions</h2>
              <StaggerOnView className="mt-7 divide-y border-y" stagger={0.06} as="dl">
                {data.faqs.map((faq) => (
                  <Stagger.Item
                    key={faq.id}
                    className="py-5"
                    variants={{
                      hidden: { opacity: 0, x: -12 },
                      show: { opacity: 1, x: 0, transition: { duration: 0.5, ease: [0.16, 1, 0.3, 1] } },
                    }}
                  >
                    <dt className="font-display text-lg font-semibold tracking-tight">{faq.question}</dt>
                    <dd className="mt-2 text-sm leading-relaxed text-muted-foreground">{faq.answer}</dd>
                  </Stagger.Item>
                ))}
              </StaggerOnView>
            </section>
          ) : null}

          {data.related?.length ? (
            <section className="mt-14">
              <Eyebrow>Proof</Eyebrow>
              <h2 className="mt-3 font-display text-2xl font-semibold tracking-tight">Related projects</h2>
              <div className="mt-7 grid gap-4 sm:grid-cols-3">
                {data.related.map((p) => (
                  <Reveal key={p.id}>
                    <article className="group relative flex min-h-[180px] flex-col justify-end overflow-hidden rounded-lg border bg-ink text-ink-foreground">
                      {p.images?.[0] && data.media?.[p.images[0].mediaId] ? (
                        <img
                          src={imageUrl(data.media[p.images[0].mediaId], 400)} alt="" loading="lazy"
                          className="absolute inset-0 h-full w-full object-cover opacity-60 transition-transform duration-700 group-hover:scale-105"
                        />
                      ) : <div className="blueprint absolute inset-0 opacity-60" aria-hidden />}
                      <div className="absolute inset-0 bg-gradient-to-t from-ink via-ink/60 to-transparent" aria-hidden />
                      <div className="relative p-5">
                        <p className="font-display text-base font-semibold leading-snug">{p.title}</p>
                        <p className="mt-1 text-[10px] uppercase tracking-widest text-ink-muted">{p.location}</p>
                      </div>
                    </article>
                  </Reveal>
                ))}
              </div>
            </section>
          ) : null}
        </article>

        <aside className="lg:sticky lg:top-28 lg:self-start">
          <div className="overflow-hidden rounded-lg border bg-card shadow-card">
            <div className="border-b bg-muted/50 px-6 py-5">
              <h2 className="font-display text-lg font-semibold tracking-tight">Get a free inspection</h2>
              <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
                <li className="flex gap-2.5"><Check className="mt-0.5 h-4 w-4 shrink-0 text-gold" aria-hidden /> No visiting charge</li>
                <li className="flex gap-2.5"><Check className="mt-0.5 h-4 w-4 shrink-0 text-gold" aria-hidden /> We call back within two hours</li>
                <li className="flex gap-2.5"><Check className="mt-0.5 h-4 w-4 shrink-0 text-gold" aria-hidden /> Written estimate before any work</li>
              </ul>
            </div>
            <div className="p-6">
              <LeadForm defaultServiceId={service.id} sourcePage={`/services/${slug}`} />
            </div>
          </div>
        </aside>
      </div>
      </SectionShell>
    </PageTransition>
  );
}
