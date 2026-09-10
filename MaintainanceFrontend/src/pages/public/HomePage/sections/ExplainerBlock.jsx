import { ArrowRight } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Eyebrow } from '@/components/site/Eyebrow';
import { Media } from '@/components/site/Media';
import { SectionShell } from '@/components/site/SectionShell';
import { HeadlineReveal, Reveal } from '@/three/motion/motionKit';
import { Cta } from '@/components/site/Cta';

/** Seepage: the symptom list beside the explanation of what causes it. */
export function ExplainerBlock({ section, media, tone }) {
  const { block, checkpoints = [] } = section.data ?? {};
  if (!block) return null;
  return (
    <SectionShell tone={tone}>
      <div className="grid gap-8 lg:grid-cols-2 lg:items-start lg:gap-12">
        <Reveal>
          <Eyebrow>Diagnosis</Eyebrow>
          <HeadlineReveal
            as="h2"
            text={block.heading}
            className="mt-2.5 text-[1.6rem] font-bold leading-[1.15] tracking-tight md:text-[2rem]"
          />
          {block.subheading ? (
            <p className="mt-4 border-l-2 border-gold pl-4 text-[15px] leading-relaxed">{block.subheading}</p>
          ) : null}
          <p className="mt-4 text-sm leading-relaxed text-muted-foreground">{block.body}</p>
          {block.cta ? (
            <Cta href={block.cta.url} className="mt-6">{block.cta.label} <ArrowRight className="h-4 w-4" /></Cta>
          ) : null}
        </Reveal>

        <Reveal delay={0.08} className="grid gap-4">
          {/* What the problem actually looks like — the picture belongs next to
              the symptoms, not at the top of the section. */}
          <Card className="overflow-hidden">
            <Media media={media?.[block.imageId]} alt={block.heading} ratio={16 / 9} icon="droplets" reveal />
          </Card>

          {checkpoints.length ? (
            <Card className="overflow-hidden">
              <CardHeader className="border-b bg-muted/50 px-5 py-3">
                <CardTitle className="text-sm font-semibold">Signs you should book an inspection</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <ul className="divide-y">
                  {checkpoints.map((c) => (
                    <li key={c.id} className="flex gap-3 px-5 py-3 text-[13px] leading-relaxed">
                      <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-primary/10 text-[10px] font-bold text-primary">
                        {c.position}
                      </span>
                      {c.text}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ) : null}
        </Reveal>
      </div>
    </SectionShell>
  );
}
