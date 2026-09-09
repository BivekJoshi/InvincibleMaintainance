import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { SectionHeading, SectionShell } from '@/components/site/siteBlocks';
import { Stagger, StaggerOnView } from '@/three/motion/motionKit';

/** Renovation: a numbered checklist the reader scores their own house against. */
export function ChecklistBlock({ section }) {
  const items = Array.isArray(section.data) ? section.data : [];
  if (!items.length) return null;
  return (
    <SectionShell tone="muted">
      <SectionHeading
        eyebrow="Renovation"
        title="When it is time to renovate"
        description="If two or more of these describe your house, book a free assessment."
        action={<Button asChild><Link to="/book">Book an assessment</Link></Button>}
      />
      <StaggerOnView className="grid gap-3 sm:grid-cols-2" stagger={0.04}>
        {items.map((item) => (
          <Stagger.Item
            key={item.id}
            variants={{ hidden: { opacity: 0, x: -12 }, show: { opacity: 1, x: 0, transition: { duration: 0.45 } } }}
            className="h-full"
          >
            <Card className="h-full">
              <CardContent className="flex items-start gap-3 p-4 text-[13px] leading-relaxed">
                <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-primary/10 text-[10px] font-bold text-primary">
                  {item.position}
                </span>
                {item.text}
              </CardContent>
            </Card>
          </Stagger.Item>
        ))}
      </StaggerOnView>
    </SectionShell>
  );
}
