import { useParams } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { useGetPublicProjectQuery } from '@/api/publicApi';
import { selectLocale } from '@/redux/slices/uiSlice';
import { useSeo } from '@/hooks/useSeo';
import { ErrorState } from '@/components/common/ErrorState';
import { PageHero } from '@/components/site/PageHero';
import { SectionShell } from '@/components/site/SectionShell';
import { CardSkeleton } from '@/components/ui/skeleton';
import { PageTransition } from '@/three/motion/motionKit';
import { ProjectCta } from './sections/ProjectCta';
import { ProjectFacts } from './sections/ProjectFacts';
import { ProjectGallery } from './sections/ProjectGallery';
import { ProjectStory } from './sections/ProjectStory';

/**
 * One case study, read at column width: what went wrong, what we did, what it
 * cost, and what to do about a problem like it.
 */
export default function ProjectDetailPage() {
  const { slug } = useParams();
  const locale = useSelector(selectLocale);
  const { data, isLoading, error, refetch } = useGetPublicProjectQuery({ slug, locale });
  const project = data?.project;

  useSeo({
    title: project?.metaTitle ?? project?.title,
    description: project?.metaDescription ?? project?.problem ?? project?.summary,
  });

  if (error) return <PageTransition><SectionShell><ErrorState error={error} onRetry={refetch} /></SectionShell></PageTransition>;
  if (isLoading || !project) return <PageTransition><SectionShell><CardSkeleton /></SectionShell></PageTransition>;

  return (
    <PageTransition>
      <PageHero
        eyebrow={project.service?.name ?? project.category?.name ?? 'Case study'}
        title={project.title}
        description={project.summary}
      >
        <ProjectFacts project={project} />
      </PageHero>

      <SectionShell>
        <div className="mx-auto max-w-3xl">
          <ProjectStory project={project} />
          <ProjectGallery images={project.images} media={data.media} title={project.title} />
          <ProjectCta service={project.service} />
        </div>
      </SectionShell>
    </PageTransition>
  );
}
