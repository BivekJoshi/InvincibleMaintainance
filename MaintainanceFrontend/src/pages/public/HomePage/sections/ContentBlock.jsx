import { Check } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Eyebrow } from '@/components/site/Eyebrow';
import { Media } from '@/components/site/Media';
import { SectionShell } from '@/components/site/SectionShell';
import { HeadlineReveal, Reveal, Stagger, StaggerOnView } from '@/three/motion/motionKit';
import { cn } from '@/helpers/utils';
import { Cta } from '@/components/site/Cta';

/**
 * Interiors: the argument on one side, the picture on the other.
 *
 * The bullets are ruled rather than boxed — six one-line cards in a grid read
 * as six things to click, and none of them are.
 */
export function ContentBlock({ section, media, tone }) {
  const block = section.data;
  if (!block) return null;
  return (
    <SectionShell tone={tone}>
      <div className="grid gap-10 lg:grid-cols-2 lg:items-center lg:gap-16">
        <Reveal>
          <Eyebrow>Interiors</Eyebrow>
          <HeadlineReveal
            as="h2"
            text={block.heading}
            className="mt-2.5 text-[1.6rem] font-bold leading-[1.15] tracking-tight md:text-[2rem]"
          />
          {block.subheading ? (
            <p className="mt-4 border-l-2 border-gold pl-4 text-[15px] leading-relaxed">{block.subheading}</p>
          ) : null}
          <p className="mt-4 text-sm leading-relaxed text-muted-foreground">{block.body}</p>

          {block.bullets?.length ? (
            <StaggerOnView className="mt-8 grid border-t sm:grid-cols-2" stagger={0.05}>
              {block.bullets.map((b, i) => (
                <Stagger.Item
                  key={i}
                  variants={{ hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0, transition: { duration: 0.4 } } }}
                  className={cn(
                    'flex gap-2.5 border-b py-3.5',
                    // A hairline down the middle, drawn by the right-hand cell
                    // so the list is not ruled along its own outer edge.
                    i % 2 ? 'sm:border-l sm:pl-5' : 'sm:pr-5',
                  )}
                >
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-gold" aria-hidden />
                  <span className="text-[13px] leading-relaxed">{b}</span>
                </Stagger.Item>
              ))}
            </StaggerOnView>
          ) : null}

          {block.cta?.label && block.cta?.url ? (
            <Cta href={block.cta.url} className="mt-8">{block.cta.label}</Cta>
          ) : null}
        </Reveal>

        <Reveal delay={0.08}>
          <Card className="overflow-hidden shadow-card">
            <Media media={media?.[block.imageId]} alt={block.heading} ratio={4 / 3} icon="sofa" reveal from="left" />
          </Card>
        </Reveal>
      </div>
    </SectionShell>
  );
}
