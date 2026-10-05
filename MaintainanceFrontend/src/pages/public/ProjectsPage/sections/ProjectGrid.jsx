import { EmptyState } from '@/components/common/EmptyState';
import { ProjectCard } from '@/components/site/ProjectCard';
import { CardSkeleton } from '@/components/ui/skeleton';
import { StaggerOnView } from '@/three/motion/motionKit';
import { SITE } from '@/config/i18n/site';
import { useT } from '@/hooks/useT';

const GRID = 'grid gap-5 sm:grid-cols-2 lg:grid-cols-3';

/** The three states of the case-study list, on one grid. */
export function ProjectGrid({ projects, media, isLoading }) {
  const t = useT(SITE);
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
        title={t('projects.empty.title')}
        description={t('projects.empty.description')}
      />
    );
  }

  return (
    <StaggerOnView className={GRID}>
      {projects.map((project) => <ProjectCard key={project.id} project={project} media={media} />)}
    </StaggerOnView>
  );
}
