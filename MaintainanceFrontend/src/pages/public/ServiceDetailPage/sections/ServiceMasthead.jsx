import { Link } from 'react-router-dom';
import { CalendarCheck } from 'lucide-react';
import { Breadcrumb } from '@/components/site/Breadcrumb';
import { Eyebrow } from '@/components/site/Eyebrow';
import { PriceRange } from '@/components/site/PriceTag';
import { PromiseList } from '@/components/site/PromiseList';
import { Button } from '@/components/ui/button';
import { imageUrl } from '@/helpers/format';

/**
 * The top of a service page: where you are, what this is, what it costs and
 * the one button that matters.
 *
 * The price plate is a column of its own rather than a line in the copy —
 * "how much" is the question the visitor arrived with, and it should not be
 * something they have to read a paragraph to find.
 */
export function ServiceMasthead({ service, media, slug }) {
  const cover = service.imageId && media?.[service.imageId]
    ? imageUrl(media[service.imageId], 1600)
    : null;

  return (
    <section className="border-b bg-muted/40">
      {cover ? <img src={cover} alt="" className="h-56 w-full object-cover md:h-72" /> : null}

      <div className="container py-8 md:py-10">
        <Breadcrumb
          items={[
            { label: 'Home', to: '/' },
            { label: 'Services', to: '/services' },
            { label: service.name },
          ]}
        />

        <div className="mt-5 flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <div className="max-w-2xl">
            {service.category ? <Eyebrow>{service.category.name}</Eyebrow> : null}
            <h1 className="mt-2 text-[1.9rem] font-bold leading-[1.15] tracking-tight md:text-4xl">{service.name}</h1>
            <p className="mt-3 text-[15px] leading-relaxed text-muted-foreground">{service.excerpt}</p>
            <PromiseList className="mt-4" />
          </div>

          <div className="shrink-0 rounded-xl border bg-card p-5 md:min-w-[16rem]">
            {service.priceFrom ? (
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Published rate</p>
            ) : null}
            <PriceRange service={service} className={service.priceFrom ? 'mt-1' : undefined} />
            <Button asChild className="mt-4 w-full">
              <Link to={`/book/${slug}`}><CalendarCheck className="h-4 w-4" /> Book this service</Link>
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
