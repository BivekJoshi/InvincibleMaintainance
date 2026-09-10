import { Clock, MapPin, Wallet } from 'lucide-react';
import { CostBand } from '@/components/site/ProjectCard';

/** One fact, drawn only when the CMS actually holds it. */
function Fact({ icon: Icon, children }) {
  if (!children) return null;
  return (
    <span className="inline-flex items-center gap-1.5">
      <Icon className="h-4 w-4" aria-hidden />
      {children}
    </span>
  );
}

/**
 * Where, how long and roughly how much — the three questions a case study is
 * read for, on one line under the title.
 */
export function ProjectFacts({ project }) {
  return (
    <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted-foreground">
      <Fact icon={MapPin}>{project.location}</Fact>
      <Fact icon={Clock}>
        {project.durationDays
          ? `${project.durationDays} day${project.durationDays === 1 ? '' : 's'} on site`
          : null}
      </Fact>
      <Fact icon={Wallet}>
        {project.costBandMin
          ? <CostBand min={project.costBandMin} max={project.costBandMax} />
          : null}
      </Fact>
    </div>
  );
}
