import { Link } from 'react-router-dom';
import { Search } from 'lucide-react';
import { EmptyState } from '@/components/common/EmptyState';
import { ServiceCard } from '@/components/site/ServiceCard';
import { Skeleton } from '@/components/ui/skeleton';
import { Stagger, StaggerOnView, cardRise } from '@/three/motion/motionKit';

const GRID = 'grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4';

/**
 * The catalogue's three states in one place — loading, results, and nothing
 * matched — so they cannot end up on different grids.
 *
 * The skeleton uses the same track as the real grid, which is what stops the
 * page reflowing the moment the query lands.
 */
export function ServiceGrid({ services, media, isLoading }) {
  if (isLoading) {
    return (
      <div className={GRID} aria-hidden>
        {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-80 rounded-xl" />)}
      </div>
    );
  }

  if (!services.length) {
    return (
      <EmptyState
        icon={Search}
        title="Nothing matched that"
        description="Try a different word or browse another category — or tell us what you need and we will quote it."
        action={{ asChild: <Link to="/book">Describe the job</Link> }}
      />
    );
  }

  return (
    <StaggerOnView className={GRID} stagger={0.04}>
      {services.map((service) => (
        <Stagger.Item key={service.id} variants={cardRise}>
          <ServiceCard service={service} media={media} />
        </Stagger.Item>
      ))}
    </StaggerOnView>
  );
}
