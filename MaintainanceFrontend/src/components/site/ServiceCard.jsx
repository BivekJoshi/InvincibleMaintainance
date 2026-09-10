import { Link } from 'react-router-dom';
import { ArrowRight, ShieldCheck } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Media } from './Media';
import { PriceTag } from './PriceTag';

/**
 * One service tile. This is the unit the whole storefront is built from — the
 * home page grid, the catalogue and the search results all render this, so a
 * price or a booking link can never be shown one way in one place and another
 * way somewhere else.
 */
export function ServiceCard({ service, media, compact = false }) {
  return (
    <Card className="sheen group flex h-full flex-col overflow-hidden card-hover">
      <Link to={`/services/${service.slug}`} className="relative block" aria-label={service.name}>
        <Media
          media={media?.[service.imageId]}
          ratio={compact ? 16 / 9 : 16 / 10}
          icon={service.icon}
          zoom
        />
        {service.category ? (
          <Badge
            variant="secondary"
            className="absolute left-3 top-3 bg-background/90 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground backdrop-blur"
          >
            {service.category.name}
          </Badge>
        ) : null}
      </Link>

      <CardContent className="flex flex-1 flex-col p-4">
        <h3 className="text-[15px] font-semibold leading-snug tracking-tight">
          <Link to={`/services/${service.slug}`} className="transition-colors hover:text-primary">{service.name}</Link>
        </h3>
        <p className="mt-1.5 line-clamp-2 text-[13px] leading-relaxed text-muted-foreground">{service.excerpt}</p>

        <p className="mt-3 flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <ShieldCheck className="h-3.5 w-3.5 text-gold" aria-hidden />
          Free inspection · 1-month warranty
        </p>
      </CardContent>

      <CardFooter className="mt-auto flex-col items-stretch p-4 pt-0">
        <Separator className="mb-3.5" />
        <div className="flex items-end justify-between gap-3">
          <PriceTag service={service} />
          <Button asChild size="sm" className="shrink-0">
            <Link to={`/book/${service.slug}`}>
              {service.priceFrom ? 'Book' : 'Get a quote'}
              <ArrowRight className="h-3.5 w-3.5 transition-transform duration-300 group-hover:translate-x-0.5" />
            </Link>
          </Button>
        </div>
      </CardFooter>
    </Card>
  );
}
