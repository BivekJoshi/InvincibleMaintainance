import { Check } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Eyebrow, Media, SectionShell } from '@/components/site/siteBlocks';
import { HeadlineReveal, Reveal, Stagger, StaggerOnView } from '@/three/motion/motionKit';

/** Interiors: copy and bullets on one side, the picture on the other. */
export function ContentBlock({ section, media }) {
  const block = section.data;
  if (!block) return null;
  return (
    <SectionShell>
      <div className="grid gap-8 lg:grid-cols-2 lg:gap-12">
        <Reveal>
          <Eyebrow>Interiors</Eyebrow>
          <HeadlineReveal
            as="h2"
            text={block.heading}
            className="mt-2 text-2xl font-bold tracking-tight md:text-[1.75rem]"
          />
          {block.subheading ? <p className="mt-3 text-[15px] text-muted-foreground">{block.subheading}</p> : null}
          <p className="mt-4 text-sm leading-relaxed text-muted-foreground">{block.body}</p>

          {block.bullets?.length ? (
            <StaggerOnView className="mt-6 grid gap-3 sm:grid-cols-2" stagger={0.05}>
              {block.bullets.map((b, i) => (
                <Stagger.Item
                  key={i}
                  variants={{ hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0, transition: { duration: 0.4 } } }}
                >
                  <Card className="h-full">
                    <CardContent className="flex gap-2.5 p-4 text-[13px] leading-relaxed">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-gold" aria-hidden /> {b}
                    </CardContent>
                  </Card>
                </Stagger.Item>
              ))}
            </StaggerOnView>
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
