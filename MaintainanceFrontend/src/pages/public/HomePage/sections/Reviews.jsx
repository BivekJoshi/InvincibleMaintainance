import { Quote } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Card, CardContent, CardFooter } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { SectionHeading, SectionShell, Stars } from '@/components/site/siteBlocks';
import { Stagger, StaggerOnView } from '@/three/motion/motionKit';
import { imageUrl } from '@/helpers/format';
import { cn } from '@/helpers/utils';
import { RISE } from '../shared';

/** Testimonials, with the customer's photograph when there is one. */
export function Reviews({ section, media }) {
  const items = Array.isArray(section.data) ? section.data : [];
  if (!items.length) return null;
  return (
    <SectionShell>
      <SectionHeading eyebrow="Customers" title="What people say afterwards" />
      <StaggerOnView className="grid gap-4 md:grid-cols-2 lg:grid-cols-3" stagger={0.05}>
        {items.map((t) => (
          <Stagger.Item key={t.id} variants={RISE} className="h-full">
            <Card className="relative flex h-full flex-col">
              <Quote className="absolute right-4 top-4 h-7 w-7 text-primary/10" aria-hidden />
              <CardContent className="flex flex-1 flex-col p-5">
                <Stars rating={t.rating} />
                <blockquote className={cn('mt-3 flex-1 text-[13px] leading-relaxed', t.locale === 'ne' && 'font-deva')} lang={t.locale}>
                  “{t.quote}”
                </blockquote>
              </CardContent>
              <CardFooter className="flex-col items-stretch p-5 pt-0">
                <Separator className="mb-3.5" />
                <figcaption className="flex items-center gap-3">
                  <Avatar className="h-8 w-8 shrink-0">
                    <AvatarImage src={imageUrl(media?.[t.photoId], 200) ?? undefined} alt="" />
                    <AvatarFallback className="bg-primary/10 text-xs font-bold text-primary">
                      {t.author?.trim()[0] ?? '·'}
                    </AvatarFallback>
                  </Avatar>
                  <span>
                    <span className={cn('block text-[13px] font-semibold', t.locale === 'ne' && 'font-deva')}>{t.author}</span>
                    <span className={cn('block text-[11px] text-muted-foreground', t.locale === 'ne' && 'font-deva')}>{t.location}</span>
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
