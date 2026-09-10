import { ArrowRight, Check } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Media } from '@/components/site/Media';
import { SectionHeading } from '@/components/site/SectionHeading';
import { SectionShell } from '@/components/site/SectionShell';
import { Reveal } from '@/three/motion/motionKit';
import { formatNpr } from '@/helpers/format';
import { Cta } from '@/components/site/Cta';

/** An offer, with room for the picture that sells it. */
export function Offers({ section, media, tone }) {
  const offers = Array.isArray(section.data) ? section.data : [];
  if (!offers.length) return null;
  return (
    <SectionShell tone={tone}>
      <SectionHeading eyebrow="Limited time" title="Current offers" />
      <div className="grid gap-4 lg:grid-cols-2">
        {offers.map((offer, i) => (
          <Reveal key={offer.id} delay={i * 0.06} className="h-full">
            <Card className={'card-hover group relative flex h-full flex-col overflow-hidden sm:flex-row'}>
              {/* A third of the card is picture. With none uploaded the slot
                  keeps its width and shows the grid, so the row stays even. */}
              {/* A ratio on a phone, where the card stacks and nothing else sets
                  the height; the full column height once it sits beside the copy. */}
              <div className="relative aspect-[4/3] sm:aspect-auto sm:w-2/5 sm:shrink-0">
                <Media media={media?.[offer.imageId]} alt={offer.title} icon="gift" zoom fill />
              </div>

              <div className="flex flex-1 flex-col">
                <CardHeader className="flex-row items-baseline justify-between gap-3 space-y-0 border-b bg-gold/10 px-5 py-3">
                  <Badge variant="gold" className="text-[10px] font-bold uppercase tracking-wide">
                    {offer.badge ?? 'Offer'}
                  </Badge>
                  {offer.priceMin ? (
                    <span className="text-right leading-none">
                      <span className="text-[15px] font-bold tabular-nums">{formatNpr(offer.priceMin, { compact: true })}</span>
                      <span className="text-xs text-muted-foreground">
                        {' – '}{formatNpr(offer.priceMax, { compact: true, symbol: false })}
                      </span>
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
              <span className="underscore-gold absolute inset-x-0 bottom-0" aria-hidden />
            </Card>
          </Reveal>
        ))}
      </div>
    </SectionShell>
  );
}
