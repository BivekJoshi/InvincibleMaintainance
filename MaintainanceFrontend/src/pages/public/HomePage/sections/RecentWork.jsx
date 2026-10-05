import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ProjectCard } from '@/components/site/ProjectCard';
import { SectionHeading } from '@/components/site/SectionHeading';
import { SectionShell } from '@/components/site/SectionShell';
import { Stagger, StaggerOnView, cardRise } from '@/three/motion/motionKit';
import { SITE } from '@/config/i18n/site';
import { useT } from '@/hooks/useT';

/** Recent work — the same <ProjectCard> the /projects catalogue renders. */
export function RecentWork({ section, media, tone }) {
  const t = useT(SITE);
  const projects = Array.isArray(section.data) ? section.data : [];
  if (!projects.length) return null;
  return (
    <SectionShell tone={tone}>
      <SectionHeading
        eyebrow={t('home.projects.eyebrow')}
        title={t('home.projects.title')}
        description={t('home.projects.description')}
        action={
          <Button asChild variant="outline">
            <Link to="/projects">{t('home.projects.action')} <ArrowRight className="h-4 w-4" /></Link>
          </Button>
        }
      />
      <StaggerOnView className="grid gap-4 md:grid-cols-3" stagger={0.06}>
        {projects.map((p) => (
          <Stagger.Item key={p.id} variants={cardRise} className="h-full">
            <ProjectCard project={p} media={media} />
          </Stagger.Item>
        ))}
      </StaggerOnView>
    </SectionShell>
  );
}
