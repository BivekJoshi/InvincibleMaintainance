import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SectionHeading, SectionShell, ServiceCard } from '@/components/site';
import { Stagger, StaggerOnView } from '@/three/motion';
import { RISE } from '../shared';

export function PopularServices({ section, media }) {
  const services = Array.isArray(section.data) ? section.data : [];
  if (!services.length) return null;
  return (
    <SectionShell>
      <SectionHeading
        eyebrow="Book online"
        title="Popular services"
        description="Published rates, a free inspection before any work, and a one-month written warranty after it."
        action={
          <Button asChild variant="outline">
            <Link to="/services">Browse all services <ArrowRight className="h-4 w-4" /></Link>
          </Button>
        }
      />
      <StaggerOnView className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4" stagger={0.06}>
        {services.map((service) => (
          <Stagger.Item key={service.id} variants={RISE} className="h-full">
            <ServiceCard service={service} media={media} />
          </Stagger.Item>
        ))}
      </StaggerOnView>
    </SectionShell>
  );
}
