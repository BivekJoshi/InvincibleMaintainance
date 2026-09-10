import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SectionHeading } from '@/components/site/SectionHeading';
import { SectionShell } from '@/components/site/SectionShell';
import { ServiceCard } from '@/components/site/ServiceCard';
import { Stagger, StaggerOnView, cardRise } from '@/three/motion/motionKit';

export function PopularServices({ section, media, tone }) {
  const services = Array.isArray(section.data) ? section.data : [];
  if (!services.length) return null;
  return (
    <SectionShell tone={tone}>
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
          <Stagger.Item key={service.id} variants={cardRise} className="h-full">
            <ServiceCard service={service} media={media} />
          </Stagger.Item>
        ))}
      </StaggerOnView>
    </SectionShell>
  );
}
