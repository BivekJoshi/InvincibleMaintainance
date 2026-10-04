import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SectionHeading } from '@/components/site/SectionHeading';
import { SectionShell } from '@/components/site/SectionShell';
import { ServiceCard } from '@/components/site/ServiceCard';
import { Stagger, StaggerOnView, cardRise } from '@/three/motion/motionKit';
import { SITE } from '@/config/i18n/site';
import { useT } from '@/hooks/useT';

export function PopularServices({ section, media, tone }) {
  const t = useT(SITE);
  const services = Array.isArray(section.data) ? section.data : [];
  if (!services.length) return null;
  return (
    <SectionShell tone={tone}>
      <SectionHeading
        eyebrow={t('home.services.eyebrow')}
        title={t('home.services.title')}
        description={t('services.description')}
        action={
          <Button asChild variant="outline">
            <Link to="/services">{t('home.services.action')} <ArrowRight className="h-4 w-4" /></Link>
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
