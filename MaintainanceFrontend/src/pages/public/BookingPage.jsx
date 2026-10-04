import { useParams } from 'react-router-dom';
import { PageHero } from '@/components/site/PageHero';
import { PageTransition } from '@/three/motion/motionKit';
import { BookingWizard } from '@/components/booking/BookingWizard/BookingWizard';
import { SITE } from '@/config/i18n/site';
import { useSeo } from '@/hooks/useSeo';
import { useT } from '@/hooks/useT';

/**
 * `/book` starts from the catalogue; `/book/:slug` starts with that service
 * already chosen, which is where every "Book" button on a service card lands.
 */
export default function BookingPage() {
  const t = useT(SITE);
  const { slug } = useParams();
  useSeo({ title: t('booking.title'), description: t('booking.seoDescription') });

  return (
    <PageTransition>
      <PageHero
        eyebrow={t('booking.eyebrow')}
        title={t('booking.heading')}
        description={t('booking.description')}
      />
      <div className="container py-10 md:py-14">
        <BookingWizard slug={slug} />
      </div>
    </PageTransition>
  );
}
