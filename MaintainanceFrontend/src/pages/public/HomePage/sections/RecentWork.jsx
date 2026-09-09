import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ProjectCard, SectionHeading, SectionShell } from '@/components/site/siteBlocks';
import { Stagger, StaggerOnView } from '@/three/motion/motionKit';
import { RISE } from '../shared';

/** Recent work — the same <ProjectCard> the /projects catalogue renders. */
export function RecentWork({ section, media }) {
  const projects = Array.isArray(section.data) ? section.data : [];
  if (!projects.length) return null;
  return (
    <SectionShell>
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
          <Stagger.Item key={p.id} variants={RISE} className="h-full">
            <ProjectCard project={p} media={media} />
          </Stagger.Item>
        ))}
      </StaggerOnView>
    </SectionShell>
  );
}
