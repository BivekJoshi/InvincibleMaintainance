import { Card, CardContent, CardTitle } from '@/components/ui/card';
import { DataIcon, Media, SectionHeading, SectionShell } from '@/components/site/siteBlocks';
import { Stagger, StaggerOnView } from '@/three/motion/motionKit';
import { titleCase } from '@/helpers/format';
import { cn } from '@/helpers/utils';
import { CARD_HOVER, RISE } from '../shared';

/**
 * Feature cards. A feature with a picture gets one; a feature without keeps the
 * icon plate. Both shapes are the same height, so a group can mix the two while
 * an editor is still working through the uploads.
 */
export function FeatureRow({ section, media }) {
  const items = Array.isArray(section.data) ? section.data : [];
  if (!items.length) return null;
  const COPY = {
    why_choose: { eyebrow: 'Why us', title: 'Four promises, each one measured' },
    construction: { eyebrow: 'Construction', title: 'Built to a drawing, billed to a line item' },
    pre_engineered: { eyebrow: 'Steel buildings', title: 'Pre-engineered structures' },
  };
  const illustrated = items.some((f) => f.imageId);

  return (
    <SectionShell tone={section.key === 'why_choose' ? 'paper' : 'muted'}>
      <SectionHeading {...(COPY[section.key] ?? { title: 'Highlights' })} />
      <StaggerOnView className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4" stagger={0.05}>
        {items.map((f) => (
          <Stagger.Item key={f.id} variants={RISE} className="h-full">
            <Card className={cn('sheen group flex h-full flex-col overflow-hidden', CARD_HOVER)}>
              {illustrated ? <Media media={media?.[f.imageId]} ratio={16 / 9} icon={f.icon} zoom /> : null}
              <CardContent className="flex flex-1 flex-col p-5">
                {illustrated ? null : (
                  <span className="grid h-11 w-11 place-items-center rounded-full bg-gold/15 text-gold ring-1 ring-inset ring-gold/25 transition-transform duration-300 group-hover:scale-105">
                    <DataIcon name={f.icon} className="h-[18px] w-[18px]" />
                  </span>
                )}
                <CardTitle className={cn('text-[14px] font-semibold tracking-tight', !illustrated && 'mt-4')}>
                  {f.title === f.title?.toUpperCase() ? titleCase(f.title) : f.title}
                </CardTitle>
                <p className="mt-1.5 text-[13px] leading-relaxed text-muted-foreground">{f.description}</p>
              </CardContent>
            </Card>
          </Stagger.Item>
        ))}
      </StaggerOnView>
    </SectionShell>
  );
}
