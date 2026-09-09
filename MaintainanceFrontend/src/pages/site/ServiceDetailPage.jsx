import { useParams, Link } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { ChevronRight, Check, CalendarCheck, ShieldCheck, Clock, Wallet } from 'lucide-react';
import { useGetPublicServiceQuery } from '@/features/public/publicApi';
import { selectLocale } from '@/features/ui/uiSlice';
import { LeadForm } from '@/features/public/LeadForm';
import { Skeleton } from '@/components/ui/skeleton';
import { ErrorState } from '@/components/common/ErrorState';
import { Eyebrow, SectionShell } from '@/components/site';
import { Button } from '@/components/ui/button';
import { PageTransition, Reveal, StaggerOnView, Stagger } from '@/components/motion';
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
      provider: { '@type': 'LocalBusiness', name: 'Ghar Jatan' },
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
      <section className="border-b bg-muted/40">
        {cover ? (
          <img src={cover} alt="" className="h-56 w-full object-cover md:h-72" />
        ) : null}
        <div className="container py-8 md:py-10">
          <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Link to="/" className="transition-colors hover:text-foreground">Home</Link>
            <ChevronRight className="h-3 w-3" aria-hidden />
            <Link to="/services" className="transition-colors hover:text-foreground">Services</Link>
            <ChevronRight className="h-3 w-3" aria-hidden />
            <span className="text-foreground">{service.name}</span>
          </nav>

          <div className="mt-5 flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
            <div className="max-w-2xl">
              {service.category ? <Eyebrow>{service.category.name}</Eyebrow> : null}
              <h1 className="mt-2 text-[1.9rem] font-bold leading-[1.15] tracking-tight md:text-4xl">{service.name}</h1>
              <p className="mt-3 text-[15px] leading-relaxed text-muted-foreground">{service.excerpt}</p>

              <ul className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-[13px] text-muted-foreground">
                <li className="flex items-center gap-1.5"><Wallet className="h-3.5 w-3.5 text-gold" aria-hidden /> Free inspection</li>
                <li className="flex items-center gap-1.5"><Clock className="h-3.5 w-3.5 text-gold" aria-hidden /> 2-hour response</li>
                <li className="flex items-center gap-1.5"><ShieldCheck className="h-3.5 w-3.5 text-gold" aria-hidden /> 1-month warranty</li>
              </ul>
            </div>

            <div className="shrink-0 rounded-xl border bg-card p-5 md:min-w-[16rem]">
              {service.priceFrom ? (
                <>
                  <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Published rate</p>
                  <p className="mt-1 text-2xl font-bold tabular-nums">
                    {formatNpr(service.priceFrom, { compact: true })}
                    <span className="text-sm font-normal text-muted-foreground">
                      {' – '}{formatNpr(service.priceTo ?? service.priceFrom, { compact: true, symbol: false })} /{service.priceUnit}
                    </span>
                  </p>
                </>
              ) : (
                <p className="text-sm font-medium text-muted-foreground">Priced after a free inspection</p>
              )}
              <Button asChild className="mt-4 w-full">
                <Link to={`/book/${slug}`}><CalendarCheck className="h-4 w-4" /> Book this service</Link>
              </Button>
            </div>
          </div>
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
              <h2 className="mt-3 text-2xl font-bold tracking-tight">Common questions</h2>
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
                    <dt className="text-lg font-semibold tracking-tight">{faq.question}</dt>
                    <dd className="mt-2 text-sm leading-relaxed text-muted-foreground">{faq.answer}</dd>
                  </Stagger.Item>
                ))}
              </StaggerOnView>
            </section>
          ) : null}

          {data.related?.length ? (
            <section className="mt-14">
              <Eyebrow>Proof</Eyebrow>
              <div className="mt-3 flex flex-wrap items-end justify-between gap-3">
                <h2 className="text-2xl font-bold tracking-tight">Work we have done like this</h2>
                <Link to={`/projects?service=${slug}`} className="text-sm font-medium text-primary hover:underline">
                  See all
                </Link>
              </div>
              <p className="mt-2 text-sm text-muted-foreground">
                The problem, what we did and what it cost. Read one before you book.
              </p>
              <div className="mt-7 grid gap-4 sm:grid-cols-3">
                {data.related.map((p) => (
                  <Reveal key={p.id}>
                    <Link
                      to={`/projects/${p.slug}`}
                      className="group block h-full overflow-hidden rounded-xl border bg-card transition-shadow hover:shadow-card"
                    >
                      <div className="h-28 overflow-hidden bg-muted">
                        {p.images?.[0] && data.media?.[p.images[0].mediaId] ? (
                          <img
                            src={imageUrl(data.media[p.images[0].mediaId], 400)} alt="" loading="lazy"
                            className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
                          />
                        ) : <div className="blueprint-fine h-full w-full" aria-hidden />}
                      </div>
                      <div className="p-4">
                        <p className="text-[14px] font-semibold leading-snug tracking-tight">{p.title}</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {[p.location, p.durationDays ? `${p.durationDays} days` : null].filter(Boolean).join(' · ')}
                        </p>
                        {p.costBandMin ? (
                          <p className="mt-1.5 text-xs font-medium">
                            {formatNpr(p.costBandMin, { compact: true })}–{formatNpr(p.costBandMax, { symbol: false, compact: true })}
                          </p>
                        ) : null}
                      </div>
                    </Link>
                  </Reveal>
                ))}
              </div>
            </section>
          ) : null}
        </article>

        <aside className="lg:sticky lg:top-28 lg:self-start">
          <div className="overflow-hidden rounded-lg border bg-card shadow-card">
            <div className="border-b bg-muted/50 px-6 py-5">
              <h2 className="text-lg font-semibold tracking-tight">Get a free inspection</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                Prefer to pick a time? <Link to={`/book/${slug}`} className="font-medium text-primary hover:underline">Book a slot</Link>.
              </p>
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
