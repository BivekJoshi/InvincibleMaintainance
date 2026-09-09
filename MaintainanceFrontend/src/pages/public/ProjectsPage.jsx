import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useGetPublicProjectsQuery, useGetPublicServicesQuery } from '@/api/publicApi';
import { PageHero, ProjectCard, SectionShell } from '@/components/site';
import { EmptyState } from '@/components/common/EmptyState';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CardSkeleton } from '@/components/ui/skeleton';
import { PageTransition, StaggerOnView } from '@/three/motion';
import { useSeo } from '@/hooks/useSeo';
import { useSelector } from 'react-redux';
import { selectLocale } from '@/redux/slices/uiSlice';

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

  const projects = data?.items ?? [];

  return (
    <PageTransition>
      <PageHero
        eyebrow="Proof"
        title="Work we have done"
        description="Every job here was surveyed, priced and finished by our own team. The costs are bands, not quotes — yours depends on what the survey finds."
      />

      <SectionShell>
        <div className="mb-6 flex justify-end">
          <Select
            value={service || 'all'}
            onValueChange={(v) => setSearchParams(v === 'all' ? {} : { service: v })}
          >
            <SelectTrigger className="w-[240px]"><SelectValue placeholder="All services" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All services</SelectItem>
              {(services?.items ?? []).map((s) => (
                <SelectItem key={s.id} value={s.slug}>{s.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {isLoading ? (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {[0, 1, 2].map((i) => <CardSkeleton key={i} />)}
          </div>
        ) : projects.length ? (
          <StaggerOnView className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {projects.map((p) => <ProjectCard key={p.id} project={p} media={data.media} />)}
          </StaggerOnView>
        ) : (
          <EmptyState
            title="Nothing published for this service yet"
            description="Try another service, or book a free consultation and we will talk you through similar work."
          />
        )}
      </SectionShell>
    </PageTransition>
  );
}
