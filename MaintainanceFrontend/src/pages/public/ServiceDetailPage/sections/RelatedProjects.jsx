import { Link } from 'react-router-dom';
import { Eyebrow } from '@/components/site/Eyebrow';
import { CostBand } from '@/components/site/ProjectCard';
import { Reveal } from '@/three/motion/motionKit';
import { imageUrl } from '@/helpers/format';

/**
 * Proof, in the narrow column beside a service's own copy.
 *
 * Deliberately not `<ProjectCard>`: that tile is built for a three-across grid
 * with room for a summary, and three of them inside an article column would
 * out-shout the service being sold. This is the same content at reading scale.
 */
export function RelatedProjects({ projects, media, slug }) {
  if (!projects?.length) return null;

  return (
    <section className="mt-14">
      <Eyebrow>Proof</Eyebrow>
      <div className="mt-3 flex flex-wrap items-end justify-between gap-3">
        <h2 className="text-2xl font-bold tracking-tight">Work we have done like this</h2>
        <Link to={`/projects?service=${slug}`} className="text-sm font-medium text-primary hover:underline">
          See all
        </Link>
      </div>
      <p className="mt-2 text-sm text-muted-foreground">
        The problem, what we did and what it cost. Read one before you book.
      </p>

      <div className="mt-7 grid gap-4 sm:grid-cols-3">
        {projects.map((project) => {
          const cover = project.images?.[0] && media?.[project.images[0].mediaId];
          return (
            <Reveal key={project.id}>
              <Link
                to={`/projects/${project.slug}`}
                className="card-hover group block h-full overflow-hidden rounded-xl border bg-card"
              >
                <div className="h-28 overflow-hidden bg-muted">
                  {cover ? (
                    <img
                      src={imageUrl(cover, 400)} alt="" loading="lazy"
                      className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
                    />
                  ) : <div className="blueprint-fine h-full w-full" aria-hidden />}
                </div>
                <div className="p-4">
                  <p className="text-[14px] font-semibold leading-snug tracking-tight">{project.title}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {[project.location, project.durationDays ? `${project.durationDays} days` : null]
                      .filter(Boolean).join(' · ')}
                  </p>
                  {project.costBandMin ? (
                    <p className="mt-1.5 text-xs font-medium">
                      <CostBand min={project.costBandMin} max={project.costBandMax} />
                    </p>
                  ) : null}
                </div>
              </Link>
            </Reveal>
          );
        })}
      </div>
    </section>
  );
}
