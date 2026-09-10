import { useSearchParams } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { useGetPublicProjectsQuery, useGetPublicServicesQuery } from '@/api/publicApi';
import { selectLocale } from '@/redux/slices/uiSlice';
import { useSeo } from '@/hooks/useSeo';
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
  const locale = useSelector(selectLocale);
  const [searchParams, setSearchParams] = useSearchParams();
  const service = searchParams.get('service') ?? '';

  const { data, isLoading } = useGetPublicProjectsQuery({ locale, ...(service ? { service } : {}) });
  const { data: services } = useGetPublicServicesQuery({ locale });

  useSeo({
    title: 'Work we have done',
    description: 'Real jobs across Kathmandu and Lalitpur — the problem, what we did, how long it took and what it cost.',
  });

  return (
    <PageTransition>
      <PageHero
        eyebrow="Proof"
        title="Work we have done"
        description="Every job here was surveyed, priced and finished by our own team. The costs are bands, not quotes — yours depends on what the survey finds."
      />

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
