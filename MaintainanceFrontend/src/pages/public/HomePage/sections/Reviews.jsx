import { Quote } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Card, CardContent, CardFooter } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { SectionHeading } from '@/components/site/SectionHeading';
import { SectionShell } from '@/components/site/SectionShell';
import { Stars } from '@/components/site/Stars';
import { Stagger, StaggerOnView, cardRise } from '@/three/motion/motionKit';
import { imageUrl } from '@/helpers/format';
import { cn } from '@/helpers/utils';
import { SITE } from '@/config/i18n/site';
import { useT } from '@/hooks/useT';

/** Testimonials, with the customer's photograph when there is one. */
export function Reviews({ section, media, tone }) {
  const t = useT(SITE);
  const items = Array.isArray(section.data) ? section.data : [];
  if (!items.length) return null;
  return (
    <SectionShell tone={tone}>
      <SectionHeading
        eyebrow={t('home.reviews.eyebrow')}
        title={t('home.reviews.title')}
        description={t('home.reviews.description')}
      />
      <StaggerOnView className="grid gap-4 md:grid-cols-2 lg:grid-cols-3" stagger={0.05}>
        {items.map((review) => (
          <Stagger.Item key={review.id} variants={cardRise} className="h-full">
            <Card className="sheen group relative flex h-full flex-col overflow-hidden transition-shadow duration-300 hover:shadow-card">
              <Quote className="absolute -right-1 top-2 h-16 w-16 text-gold/[0.07]" aria-hidden />
              <CardContent className="relative flex flex-1 flex-col p-5">
                <Stars rating={review.rating} />
                <blockquote
                  className={cn('mt-3.5 flex-1 text-[14px] leading-relaxed', review.locale === 'ne' && 'font-deva')}
                  lang={review.locale}
                >
                  “{review.quote}”
                </blockquote>
              </CardContent>
              <CardFooter className="flex-col items-stretch p-5 pt-0">
                <Separator className="mb-3.5" />
                <figcaption className="flex items-center gap-3">
                  <Avatar className="h-9 w-9 shrink-0 ring-1 ring-gold/25">
                    <AvatarImage src={imageUrl(media?.[review.photoId], 200) ?? undefined} alt="" />
                    <AvatarFallback className="bg-primary/10 text-xs font-bold text-primary">
                      {review.author?.trim()[0] ?? '·'}
                    </AvatarFallback>
                  </Avatar>
                  <span>
                    <span className={cn('block text-[13px] font-semibold', review.locale === 'ne' && 'font-deva')}>{review.author}</span>
                    <span className={cn('block text-[11px] text-muted-foreground', review.locale === 'ne' && 'font-deva')}>{review.location}</span>
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
