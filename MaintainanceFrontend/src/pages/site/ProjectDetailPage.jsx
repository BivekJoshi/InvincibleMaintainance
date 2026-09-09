import { Link, useParams } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { ArrowRight, Clock, MapPin, Wallet } from 'lucide-react';
import { useGetPublicProjectQuery } from '@/features/public/publicApi';
import { PageHero, SectionShell, Eyebrow } from '@/components/site';
import { ErrorState } from '@/components/common/ErrorState';
import { Button } from '@/components/ui/button';
import { CardSkeleton } from '@/components/ui/skeleton';
import { PageTransition } from '@/components/motion';
import { useSeo } from '@/hooks/useSeo';
import { selectLocale } from '@/features/ui/uiSlice';
import { formatNpr, imageUrl } from '@/lib/format';

/** One stage of the story, skipped when it was never filled in. */
function Chapter({ eyebrow, title, children }) {
  if (!children) return null;
  return (
    <section className="border-t py-8 first:border-t-0 first:pt-0">
      <Eyebrow>{eyebrow}</Eyebrow>
      <h2 className="mt-2 text-xl font-semibold tracking-tight">{title}</h2>
      <p className="mt-3 whitespace-pre-wrap leading-relaxed text-muted-foreground">{children}</p>
    </section>
  );
}

export default function ProjectDetailPage() {
  const { slug } = useParams();
  const locale = useSelector(selectLocale);
  const { data, isLoading, error, refetch } = useGetPublicProjectQuery({ slug, locale });

  const project = data?.project;

  useSeo({
    title: project?.metaTitle ?? project?.title,
    description: project?.metaDescription ?? project?.problem ?? project?.summary,
  });

  if (isLoading) return <PageTransition><SectionShell><CardSkeleton /></SectionShell></PageTransition>;
  if (error) return <PageTransition><SectionShell><ErrorState error={error} onRetry={refetch} /></SectionShell></PageTransition>;

  const images = project.images ?? [];

  return (
    <PageTransition>
      <PageHero
        eyebrow={project.service?.name ?? project.category?.name ?? 'Case study'}
        title={project.title}
        description={project.summary}
      >
        <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted-foreground">
          {project.location ? (
            <span className="inline-flex items-center gap-1.5"><MapPin className="h-4 w-4" aria-hidden />{project.location}</span>
          ) : null}
          {project.durationDays ? (
            <span className="inline-flex items-center gap-1.5"><Clock className="h-4 w-4" aria-hidden />{project.durationDays} day{project.durationDays === 1 ? '' : 's'} on site</span>
          ) : null}
          {project.costBandMin ? (
            <span className="inline-flex items-center gap-1.5">
              <Wallet className="h-4 w-4" aria-hidden />
              {formatNpr(project.costBandMin, { compact: true })}–{formatNpr(project.costBandMax, { symbol: false, compact: true })}
            </span>
          ) : null}
        </div>
      </PageHero>

      <SectionShell>
        <div className="mx-auto max-w-3xl">
          <Chapter eyebrow="The problem" title="What the customer was dealing with">{project.problem}</Chapter>
          <Chapter eyebrow="The work" title="What we did">{project.solution}</Chapter>
          <Chapter eyebrow="The result" title="How it ended">{project.outcome}</Chapter>
          <Chapter eyebrow="Detail" title="More about this job">{project.body}</Chapter>

          {images.length ? (
            <section className="border-t py-8">
              <Eyebrow>On site</Eyebrow>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {images.map((img) => (
                  <figure key={img.id} className="overflow-hidden rounded-xl border">
                    <img
                      src={imageUrl(data.media?.[img.mediaId], 800) ?? ''}
                      alt={img.caption ?? project.title}
                      loading="lazy"
                      className="aspect-[4/3] w-full object-cover"
                    />
                    {img.caption ? (
                      <figcaption className="px-3 py-2 text-xs text-muted-foreground">{img.caption}</figcaption>
                    ) : null}
                  </figure>
                ))}
              </div>
            </section>
          ) : null}

          <section className="border-t py-8">
            <p className="text-sm text-muted-foreground">
              Costs shown are a band for this job. Yours depends on what our surveyor measures — the visit is free.
            </p>
            <div className="mt-4 flex flex-wrap gap-3">
              <Button asChild>
                <Link to={project.service ? `/book/${project.service.slug}` : '/book'}>
                  Book a free consultation <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              <Button asChild variant="outline">
                <Link to={project.service ? `/projects?service=${project.service.slug}` : '/projects'}>
                  More work like this
                </Link>
              </Button>
            </div>
          </section>
        </div>
      </SectionShell>
    </PageTransition>
  );
}
