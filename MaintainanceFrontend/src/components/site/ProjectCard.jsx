import { Link } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardFooter } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { formatNpr } from '@/helpers/format';
import { Media } from './Media';

/**
 * A published case study. Cost is always a band — the real contract value of a
 * named customer's job never reaches the public site.
 */
export function ProjectCard({ project, media }) {
  const cover = media?.[project.coverId] ?? media?.[project.images?.[0]?.mediaId];

  return (
    <Card className="sheen group flex h-full flex-col overflow-hidden card-hover">
      <Link to={`/projects/${project.slug}`} className="relative block" aria-label={project.title}>
        <Media media={cover} icon="hammer" zoom />
        {project.service ? (
          <Badge
            variant="secondary"
            className="absolute left-3 top-3 bg-background/90 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground backdrop-blur"
          >
            {project.service.name}
          </Badge>
        ) : null}
      </Link>

      <CardContent className="flex flex-1 flex-col p-4">
        <h3 className="text-[15px] font-semibold leading-snug tracking-tight">
          <Link to={`/projects/${project.slug}`} className="transition-colors hover:text-primary">{project.title}</Link>
        </h3>
        {project.problem ? (
          <p className="mt-1.5 line-clamp-2 text-[13px] leading-relaxed text-muted-foreground">{project.problem}</p>
        ) : null}
      </CardContent>

      <CardFooter className="mt-auto flex-col items-stretch p-4 pt-0">
        <Separator className="mb-3.5" />
        <div className="flex items-end justify-between gap-3 text-[11px] text-muted-foreground">
          <span>
            {project.location ? <span className="block">{project.location}</span> : null}
            {project.durationDays ? <span>{project.durationDays} day{project.durationDays === 1 ? '' : 's'}</span> : null}
          </span>
          {project.costBandMin ? (
            <span className="shrink-0 text-right font-medium text-foreground">
              <CostBand min={project.costBandMin} max={project.costBandMax} />
            </span>
          ) : null}
        </div>
      </CardFooter>
    </Card>
  );
}

/**
 * A published cost band, formatted the one way. The currency symbol appears on
 * the lower figure only, so the pair reads as one range rather than two prices.
 */
export function CostBand({ min, max, compact = true }) {
  if (!min) return null;
  return (
    <>
      {formatNpr(min, { compact })}–{formatNpr(max ?? min, { symbol: false, compact })}
    </>
  );
}
