import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ProjectCard } from '@/components/site/ProjectCard';
import { SectionHeading } from '@/components/site/SectionHeading';
import { SectionShell } from '@/components/site/SectionShell';
import { Stagger, StaggerOnView, cardRise } from '@/three/motion/motionKit';

/** Recent work — the same <ProjectCard> the /projects catalogue renders. */
export function RecentWork({ section, media, tone }) {
  const projects = Array.isArray(section.data) ? section.data : [];
  if (!projects.length) return null;
  return (
    <SectionShell tone={tone}>
      <SectionHeading
        eyebrow="Our work"
        title="Recently completed"
        description="Measured, photographed at each stage, handed over against a signed snag list."
        action={
          <Button asChild variant="outline">
            <Link to="/projects">See all work <ArrowRight className="h-4 w-4" /></Link>
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
