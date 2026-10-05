import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { SectionHeading } from '@/components/site/SectionHeading';
import { SectionShell } from '@/components/site/SectionShell';
import { Stagger, StaggerOnView } from '@/three/motion/motionKit';
import { SITE } from '@/config/i18n/site';
import { useT } from '@/hooks/useT';

/** Renovation: a numbered checklist the reader scores their own house against. */
export function ChecklistBlock({ section, tone }) {
  const t = useT(SITE);
  const items = Array.isArray(section.data) ? section.data : [];
  if (!items.length) return null;
  return (
    <SectionShell tone={tone}>
      <SectionHeading
        eyebrow={t('home.renovation.eyebrow')}
        title={t('home.renovation.title')}
        description={t('home.renovation.description')}
        action={<Button asChild><Link to="/book">{t('home.renovation.action')}</Link></Button>}
      />
      <StaggerOnView className="grid gap-3 sm:grid-cols-2" stagger={0.04}>
        {items.map((item) => (
          <Stagger.Item
            key={item.id}
            variants={{ hidden: { opacity: 0, x: -12 }, show: { opacity: 1, x: 0, transition: { duration: 0.45 } } }}
            className="h-full"
          >
            <Card className="group h-full transition-colors duration-300 hover:border-primary/30">
              <CardContent className="flex items-start gap-3.5 p-4 text-[13px] leading-relaxed">
                <span className="mt-px grid h-6 w-6 shrink-0 place-items-center rounded-full bg-primary/10 text-[10px] font-bold tabular-nums text-primary ring-1 ring-inset ring-primary/15 transition-colors duration-300 group-hover:bg-primary group-hover:text-primary-foreground group-hover:ring-primary">
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
