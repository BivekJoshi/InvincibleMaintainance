import { useSearchParams } from 'react-router-dom';
import { useGetPublicProjectsQuery, useGetPublicServicesQuery } from '@/api/publicApi';
import { SITE } from '@/config/i18n/site';
import { useSeo } from '@/hooks/useSeo';
import { useT } from '@/hooks/useT';
import { PageHero } from '@/components/site/PageHero';
import { SectionShell } from '@/components/site/SectionShell';
import { PageTransition } from '@/three/motion/motionKit';
import { ProjectFilter } from './sections/ProjectFilter';
import { ProjectGrid } from './sections/ProjectGrid';

/**
 * The case-study index. The service filter is a server query and lives in the
 * URL, so "our bathroom waterproofing work" is a link the sales team can send.
 */
export default function ProjectsPage() {
  const t = useT(SITE);
  const { locale } = t;
  const [searchParams, setSearchParams] = useSearchParams();
  const service = searchParams.get('service') ?? '';

  const { data, isLoading } = useGetPublicProjectsQuery({ locale, ...(service ? { service } : {}) });
  const { data: services } = useGetPublicServicesQuery({ locale });

  useSeo({ title: t('projects.title'), description: t('projects.seoDescription') });

  return (
    <PageTransition>
      <PageHero eyebrow={t('projects.eyebrow')} title={t('projects.title')} description={t('projects.description')} />

      <SectionShell>
        <ProjectFilter
          services={services?.items ?? []}
          value={service}
          onChange={(v) => setSearchParams(v === 'all' ? {} : { service: v })}
        />
        <ProjectGrid projects={data?.items ?? []} media={data?.media} isLoading={isLoading} />
      </SectionShell>
    </PageTransition>
  );
}
