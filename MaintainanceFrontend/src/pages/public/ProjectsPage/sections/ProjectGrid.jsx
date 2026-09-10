import { EmptyState } from '@/components/common/EmptyState';
import { ProjectCard } from '@/components/site/ProjectCard';
import { CardSkeleton } from '@/components/ui/skeleton';
import { StaggerOnView } from '@/three/motion/motionKit';

const GRID = 'grid gap-5 sm:grid-cols-2 lg:grid-cols-3';

/** The three states of the case-study list, on one grid. */
export function ProjectGrid({ projects, media, isLoading }) {
  if (isLoading) {
    return (
      <div className={GRID} aria-hidden>
        {[0, 1, 2].map((i) => <CardSkeleton key={i} />)}
      </div>
    );
  }

  if (!projects.length) {
    return (
      <EmptyState
        title="Nothing published for this service yet"
        description="Try another service, or book a free consultation and we will talk you through similar work."
      />
    );
  }

  return (
    <StaggerOnView className={GRID}>
      {projects.map((project) => <ProjectCard key={project.id} project={project} media={media} />)}
    </StaggerOnView>
  );
}
