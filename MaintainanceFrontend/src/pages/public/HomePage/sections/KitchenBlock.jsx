import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DataIcon, Media, SectionHeading, SectionShell } from '@/components/site';
import { Reveal } from '@/three/motion';

/** Kitchens: the selling points in one column, the running order in the other. */
export function KitchenBlock({ section, media }) {
  const { cards = [], steps = [] } = section.data ?? {};
  if (!cards.length && !steps.length) return null;
  const lead = cards.find((c) => c.imageId);

  return (
    <SectionShell>
      <SectionHeading
        eyebrow="Kitchens"
        title="Modernised around how you actually cook"
        action={<Button asChild variant="outline"><Link to="/book">Book a kitchen survey</Link></Button>}
      />
      <div className="grid gap-6 lg:grid-cols-[1.3fr_1fr]">
        <div className="grid content-start gap-3">
          {/* One wide picture leads the column when a kitchen card carries one. */}
          <Reveal>
            <Card className="overflow-hidden">
              <Media media={media?.[lead?.imageId]} alt={lead?.title ?? ''} ratio={16 / 7} icon="chef-hat" reveal />
            </Card>
          </Reveal>

          {cards.map((c, i) => (
            <Reveal key={c.id} delay={0.05 + i * 0.05}>
              <Card className="sheen transition-shadow duration-300 hover:shadow-card">
                <CardContent className="flex gap-4 p-4">
                  <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-gold/15 text-gold ring-1 ring-inset ring-gold/25">
                    <DataIcon name={c.icon} className="h-[18px] w-[18px]" />
                  </span>
                  <div>
                    <CardTitle className="text-[14px] font-semibold tracking-tight">{c.title}</CardTitle>
                    <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">{c.description}</p>
                  </div>
                </CardContent>
              </Card>
            </Reveal>
          ))}
        </div>

        {steps.length ? (
          <Reveal delay={0.08}>
            <Card className="overflow-hidden">
              <CardHeader className="border-b bg-muted/50 px-5 py-3">
                <CardTitle className="text-sm font-semibold">How a kitchen runs</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <ol className="divide-y">
                  {steps.map((s) => (
                    <li key={s.id} className="flex gap-3 px-5 py-3 text-[13px] leading-relaxed">
                      <span className="text-xs font-bold tabular-nums text-primary">{String(s.position).padStart(2, '0')}</span>
                      {s.text}
                    </li>
                  ))}
                </ol>
              </CardContent>
            </Card>
          </Reveal>
        ) : null}
      </div>
    </SectionShell>
  );
}
